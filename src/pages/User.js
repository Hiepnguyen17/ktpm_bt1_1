import React, { Component } from "react";
import { withRouter } from "../withRouter";
import axios from "axios";

class User extends Component {
  constructor(props) {
    super(props);
    this.state = {
      showLogout: true,
      username: localStorage.getItem("accountName") || "User",
      selectedFile: null,
      fileList: [],
      loading: false,
      // Thêm state cho chunked upload
      uploadProgress: 0,
      isUploading: false,
      uploadAbortController: null,
      uploadedChunks: new Set(),
      totalChunks: 0,
      isPaused: false,
      uploadSpeed: 0,
      estimatedTime: 0
    };
    
    // Cấu hình cho chunked upload
    this.CHUNK_SIZE = 8 * 1024 * 1024; // 8MB per chunk (tăng từ 4MB)
    this.MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB limit
    this.MAX_CONCURRENT_UPLOADS = 4; // Upload đồng thời 4 chunks
    this.MAX_RETRIES = 3; // Retry tối đa 3 lần cho mỗi chunk
    this.uploadStartTime = null;
    this.uploadedBytes = 0;
  }

  componentDidMount() {
    this.fetchFileList();
  }

  fetchFileList = async () => {
    try {
      this.setState({ loading: true });
      const userId = localStorage.getItem('userId');
      const response = await axios.get(`http://localhost:8080/user/list-blob?userId=${userId}`, {
        withCredentials: true
      });
      
      // Chuyển đổi mảng string thành mảng object để dễ hiển thị
      const formattedFiles = response.data.map(blobPath => {
        // Lấy tên file từ đường dẫn đầy đủ (user-{id}/filename)
        const name = blobPath.split('/').pop();
        return {
          name: name, // Chỉ lưu tên file
          fullPath: blobPath // Lưu đường dẫn đầy đủ để hiển thị hoặc debug
        };
      });
      
      this.setState({ fileList: formattedFiles });
    } catch (error) {
      console.error('Error fetching files:', error);
    } finally {
      this.setState({ loading: false });
    }
  };

  handleLogout = () => {
    // Xóa tất cả dữ liệu trong localStorage
    localStorage.clear();
    this.props.navigate("/");
  };

  handleFileSelect = () => {
    if (this.state.isUploading) return;
    
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        this.setState({ selectedFile: file });
      }
    };
    input.click();
  };

  downloadFile = async (sasUrl, fileName) => {
    try {
      const response = await fetch(sasUrl);
      const blob = await response.blob();
      
      // Tạo URL tạm thời cho blob
      const url = window.URL.createObjectURL(blob);
      
      // Tạo thẻ a ẩn và trigger click để download
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileName;
      
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Lỗi khi tải file. Vui lòng thử lại sau.');
    }
  };

  // Chia file thành các chunk với tối ưu hóa
  createFileChunks = (file) => {
    const chunks = [];
    let start = 0;
    let chunkIndex = 0;
    
    // Tối ưu chunk size dựa trên file size
    let optimalChunkSize = this.CHUNK_SIZE;
    if (file.size > 100 * 1024 * 1024) { // File > 100MB
      optimalChunkSize = 16 * 1024 * 1024; // 16MB chunks
    } else if (file.size > 500 * 1024 * 1024) { // File > 500MB
      optimalChunkSize = 32 * 1024 * 1024; // 32MB chunks
    }
    
    while (start < file.size) {
      const end = Math.min(start + optimalChunkSize, file.size);
      const chunk = file.slice(start, end);
      chunks.push({
        data: chunk,
        index: chunkIndex,
        start: start,
        end: end,
        size: chunk.size
      });
      start = end;
      chunkIndex++;
    }
    
    return chunks;
  };

  // Upload một chunk với retry mechanism
  uploadChunk = async (chunk, sasUrl, blockId, retryCount = 0) => {
    const { uploadAbortController } = this.state;
    
    try {
      const response = await axios.put(
        `${sasUrl}&comp=block&blockid=${blockId}`,
        chunk.data,
        {
          headers: {
            'Content-Type': 'application/octet-stream',
            'x-ms-blob-type': 'BlockBlob'
          },
          signal: uploadAbortController?.signal,
          timeout: 120000, // Tăng timeout lên 2 phút
          maxRedirects: 0, // Tắt redirect để tăng tốc
          onUploadProgress: (progressEvent) => {
            // Tính toán upload speed và estimated time
            if (this.uploadStartTime) {
              const elapsed = (Date.now() - this.uploadStartTime) / 1000;
              const totalUploaded = this.uploadedBytes + progressEvent.loaded;
              const speed = totalUploaded / elapsed / 1024 / 1024; // MB/s
              
              const remainingBytes = this.state.selectedFile.size - totalUploaded;
              const estimatedTime = speed > 0 ? remainingBytes / (speed * 1024 * 1024) : 0;
              
              this.setState({ 
                uploadSpeed: speed,
                estimatedTime: estimatedTime
              });
            }
          }
        }
      );
      
      return response.status === 201;
    } catch (error) {
      if (retryCount < this.MAX_RETRIES && !uploadAbortController?.signal.aborted) {
        console.log(`Retry chunk ${chunk.index}, attempt ${retryCount + 1}/${this.MAX_RETRIES}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
        return this.uploadChunk(chunk, sasUrl, blockId, retryCount + 1);
      }
      throw error;
    }
  };

  // Commit tất cả các block thành blob hoàn chỉnh
  commitBlocks = async (sasUrl, blockIds) => {
    const { uploadAbortController } = this.state;
    
    const blockListXml = `<?xml version="1.0" encoding="utf-8"?>
    <BlockList>
      ${blockIds.map(id => `<Latest>${id}</Latest>`).join('')}
    </BlockList>`;
    
    const response = await axios.put(
      `${sasUrl}&comp=blocklist`,
      blockListXml,
      {
        headers: {
          'Content-Type': 'application/xml'
        },
        signal: uploadAbortController?.signal,
        timeout: 30000
      }
    );
    
    return response.status === 201;
  };

  // Upload file lớn với chunked upload
  handleLargeFileUpload = async () => {
    const { selectedFile } = this.state;
    if (!selectedFile) {
      alert("Vui lòng chọn file trước!");
      return;
    }

    // Kiểm tra kích thước file
    if (selectedFile.size > this.MAX_FILE_SIZE) {
      alert(`File quá lớn! Vui lòng chọn file nhỏ hơn ${this.MAX_FILE_SIZE / (1024 * 1024 * 1024)}GB.`);
      return;
    }

    const abortController = new AbortController();
    
    try {
      this.setState({ 
        isUploading: true, 
        uploadProgress: 0,
        uploadAbortController: abortController,
        uploadedChunks: new Set(),
        isPaused: false,
        uploadSpeed: 0,
        estimatedTime: 0
      });

      this.uploadStartTime = Date.now();
      this.uploadedBytes = 0;

      // Bước 1: Lấy SAS URL từ server
      const sasResponse = await axios.post(
        `http://localhost:8080/user/upload-sas?blobName=${encodeURIComponent(selectedFile.name)}`, 
        {}, 
        {
          withCredentials: true,
          signal: abortController.signal
        }
      );

      if (!sasResponse.data.sasUrl) {
        throw new Error('Không nhận được SAS URL');
      }

      // Bước 2: Chia file thành chunks
      const chunks = this.createFileChunks(selectedFile);
      const totalChunks = chunks.length;
      this.setState({ totalChunks });

      // Bước 3: Upload chunks song song với concurrency control
      const blockIds = new Array(chunks.length);
      const semaphore = new Array(this.MAX_CONCURRENT_UPLOADS).fill(null);
      let currentIndex = 0;
      
      const uploadNextChunk = async () => {
        while (currentIndex < chunks.length) {
          // Kiểm tra nếu bị pause
          while (this.state.isPaused) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          // Kiểm tra nếu bị cancel
          if (abortController.signal.aborted) {
            throw new Error('Upload cancelled');
          }

          const chunkIndex = currentIndex++;
          if (chunkIndex >= chunks.length) break;
          
          const chunk = chunks[chunkIndex];
          const blockId = btoa(`block-${chunk.index.toString().padStart(6, '0')}`);
          
          try {
            const success = await this.uploadChunk(chunk, sasResponse.data.sasUrl, blockId);
            
            if (success) {
              this.uploadedBytes += chunk.size;
              blockIds[chunkIndex] = blockId;
              
              this.setState(prevState => {
                const newUploadedChunks = new Set(prevState.uploadedChunks);
                newUploadedChunks.add(chunk.index);
                const progress = Math.round((newUploadedChunks.size / totalChunks) * 100);
                
                return {
                  uploadedChunks: newUploadedChunks,
                  uploadProgress: progress
                };
              });
            } else {
              throw new Error(`Chunk ${chunk.index} upload failed`);
            }
          } catch (error) {
            console.error(`Error uploading chunk ${chunkIndex}:`, error);
            throw error;
          }
        }
      };
      
      // Bắt đầu upload song song
      const uploadPromises = semaphore.map(() => uploadNextChunk());
      await Promise.all(uploadPromises);

      // Bước 4: Commit tất cả blocks (filter out null values)
      const validBlockIds = blockIds.filter(id => id !== undefined);
      const commitSuccess = await this.commitBlocks(sasResponse.data.sasUrl, validBlockIds);
      
      if (commitSuccess) {
        alert("Upload thành công!");
        this.setState({ 
          selectedFile: null, 
          uploadProgress: 0,
          isUploading: false,
          uploadAbortController: null,
          uploadedChunks: new Set(),
          totalChunks: 0
        });
        this.fetchFileList();
      } else {
        throw new Error('Commit blocks thất bại');
      }

    } catch (err) {
      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED' || err.message === 'Upload cancelled') {
        alert("Upload đã bị hủy");
      } else if (err.code === 'ECONNABORTED') {
        alert("Upload timeout! Vui lòng thử lại.");
      } else {
        console.error("Upload error:", err);
        alert(err.response?.data?.message || "Lỗi upload. Vui lòng thử lại!");
      }
    } finally {
      this.setState({ 
        isUploading: false, 
        uploadProgress: 0,
        uploadAbortController: null,
        uploadedChunks: new Set(),
        totalChunks: 0,
        isPaused: false,
        uploadSpeed: 0,
        estimatedTime: 0
      });
      this.uploadedBytes = 0;
    }
  };

  // Upload file nhỏ (giữ nguyên logic cũ)
  handleUpload = async () => {
    const { selectedFile } = this.state;
    if (!selectedFile) {
      alert("Vui lòng chọn file trước!");
      return;
    }

    // Nếu file > 10MB thì dùng chunked upload
    if (selectedFile.size > 10 * 1024 * 1024) {
      return this.handleLargeFileUpload();
    }

    try {
      this.setState({ isUploading: true });

      // Bước 1: Lấy SAS URL từ server
      const sasResponse = await axios.post(`http://localhost:8080/user/upload-sas?blobName=${encodeURIComponent(selectedFile.name)}`, {}, {
        withCredentials: true
      });

      if (!sasResponse.data.sasUrl) {
        throw new Error('Không nhận được SAS URL');
      }

      // Bước 2: Upload file trực tiếp lên Azure Blob Storage using SAS URL
      const uploadResponse = await axios.put(sasResponse.data.sasUrl, selectedFile, {
        headers: {
          'x-ms-blob-type': 'BlockBlob',
          'Content-Type': selectedFile.type || 'application/octet-stream'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          this.setState({ uploadProgress: percentCompleted });
        }
      });

      if (uploadResponse.status === 201) {
        alert("Upload thành công!");
        this.setState({ selectedFile: null, uploadProgress: 0 }); // Reset selected file
        this.fetchFileList(); // Refresh danh sách file
      } else {
        throw new Error('Upload thất bại');
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert(err.response?.data?.message || "Bạn không có quyền upload");
    } finally {
      this.setState({ isUploading: false, uploadProgress: 0 });
    }
  };

  // Hủy upload
  handleCancelUpload = () => {
    const { uploadAbortController } = this.state;
    if (uploadAbortController) {
      uploadAbortController.abort();
    }
  };

  // Tạm dừng upload
  handlePauseUpload = () => {
    this.setState({ isPaused: true });
  };

  // Tiếp tục upload
  handleResumeUpload = () => {
    this.setState({ isPaused: false });
  };

  // Format thời gian
  formatTime = (seconds) => {
    if (!seconds || seconds === Infinity) return '--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format file size
  formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  renderHeader() {
    const avatarUrl =
      "https://statictuoitre.mediacdn.vn/thumb_w/730/2017/7-1512755474943.jpg";

    return (
      <div
        style={{
          position: "absolute",
          top: "10px",
          right: "20px",
          textAlign: "right",
        }}
      >
        <div
          style={{
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            fontWeight: "bold",
            fontSize: "16px",
          }}
        >
          <img
            src={avatarUrl}
            alt="User Avatar"
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              objectFit: "cover",
              marginRight: "10px",
            }}
          />
          <span>{this.state.username}</span>
        </div>

        {this.state.showLogout && (
          <button
            style={{
              marginTop: "5px",
              marginRight: "16px",
              padding: "6px 12px",
              background: "#15090aff",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
            onClick={this.handleLogout}
          >
            Logout
          </button>
        )}
      </div>
    );
  }

  render() {
    return (
      <div
        style={{
          padding: "20px",
          position: "relative",
          minHeight: "100vh",
          background: "#f8f9fa",
          fontFamily: "Arial, sans-serif",
        }}
      >
        {this.renderHeader()}

        <div
          style={{
            background: "#fff",
            padding: "20px",
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            maxWidth: "900px",
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          <h2 style={{ marginBottom: "20px", fontWeight: "600" }}>USER PAGE</h2>

          {/* Khu vực upload file */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '15px',
            marginBottom: '20px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <button
                style={{
                  padding: "10px 20px",
                  background: this.state.isUploading ? "#6c757d" : "#28a745",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: this.state.isUploading ? "not-allowed" : "pointer",
                }}
                onClick={this.handleFileSelect}
                disabled={this.state.isUploading}
              >
                Chọn File
              </button>

              {this.state.selectedFile && !this.state.isUploading && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '5px 10px',
                  background: '#f8f9fa',
                  borderRadius: '4px',
                  border: '1px solid #dee2e6'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}>
                    <span>{this.state.selectedFile.name}</span>
                    <span style={{ fontSize: '12px', color: '#6c757d' }}>
                      ({this.formatFileSize(this.state.selectedFile.size)})
                    </span>
                    <button
                      style={{
                        padding: '2px 6px',
                        background: '#dc3545',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        fontSize: '12px',
                        lineHeight: '1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      onClick={() => this.setState({ selectedFile: null })}
                      title="Hủy chọn file"
                    >
                      ×
                    </button>
                  </div>
                  <button
                    style={{
                      padding: "5px 15px",
                      background: "#007bff",
                      color: "#fff",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                    onClick={this.handleUpload}
                  >
                    Upload
                  </button>
                </div>
              )}
            </div>

            {/* Upload progress (cho cả file nhỏ và lớn) */}
            {this.state.isUploading && (
              <div style={{
                width: '100%',
                maxWidth: '500px',
                display: 'flex',
                flexDirection: 'column',
                gap: '15px',
                padding: '20px',
                background: '#f8f9fa',
                borderRadius: '8px',
                border: '1px solid #dee2e6'
              }}>
                {/* File info */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: '14px', fontWeight: '500' }}>
                    {this.state.selectedFile?.name}
                  </span>
                  <span style={{ fontSize: '12px', color: '#6c757d' }}>
                    {this.formatFileSize(this.state.selectedFile?.size)}
                  </span>
                </div>
                
                {/* Progress bar */}
                <div style={{
                  width: '100%',
                  height: '12px',
                  backgroundColor: '#e9ecef',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  <div style={{
                    width: `${this.state.uploadProgress}%`,
                    height: '100%',
                    backgroundColor: this.state.isPaused ? '#ffc107' : '#28a745',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
                
                {/* Progress details */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  color: '#495057'
                }}>
                  <span>{this.state.uploadProgress}%</span>
                  {this.state.totalChunks > 0 && (
                    <span>
                      {this.state.uploadedChunks.size}/{this.state.totalChunks} chunks
                    </span>
                  )}
                </div>

                {/* Upload stats (chỉ hiển thị cho file lớn) */}
                {this.state.totalChunks > 0 && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    color: '#6c757d'
                  }}>
                    <span>
                      Tốc độ: {this.state.uploadSpeed.toFixed(1)} MB/s
                    </span>
                    <span>
                      Còn lại: {this.formatTime(this.state.estimatedTime)}
                    </span>
                  </div>
                )}

                {/* Control buttons (chỉ hiển thị cho file lớn) */}
                {this.state.totalChunks > 0 && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '10px'
                  }}>
                    {this.state.isPaused ? (
                      <button
                        onClick={this.handleResumeUpload}
                        style={{
                          padding: '6px 12px',
                          background: '#28a745',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        ▶ Tiếp tục
                      </button>
                    ) : (
                      <button
                        onClick={this.handlePauseUpload}
                        style={{
                          padding: '6px 12px',
                          background: '#ffc107',
                          color: '#212529',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        ⏸ Tạm dừng
                      </button>
                    )}
                    
                    <button
                      onClick={this.handleCancelUpload}
                      style={{
                        padding: '6px 12px',
                        background: '#dc3545',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      ✕ Hủy
                    </button>
                  </div>
                )}

                {/* Status */}
                <div style={{
                  textAlign: 'center',
                  fontSize: '12px',
                  color: this.state.isPaused ? '#856404' : '#495057',
                  fontStyle: 'italic'
                }}>
                  {this.state.isPaused ? 'Đã tạm dừng' : 'Đang upload...'}
                  {this.state.selectedFile?.size > 10 * 1024 * 1024 && (
                    <span style={{ marginLeft: '5px' }}>(Chunked Upload)</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Danh sách file */}
          <div style={{
            marginTop: '30px',
            borderTop: '1px solid #dee2e6',
            paddingTop: '20px'
          }}>
            <h3 style={{ marginBottom: '20px' }}>Danh sách file của bạn</h3>
            
            {this.state.loading ? (
              <p>Đang tải danh sách file...</p>
            ) : this.state.fileList.length === 0 ? (
              <p>Chưa có file nào</p>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                maxHeight: '400px',
                overflowY: 'auto',
                padding: '10px'
              }}>
                {this.state.fileList.map((file, index) => (
                  <div key={index} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px',
                    background: '#f8f9fa',
                    borderRadius: '4px',
                    border: '1px solid #dee2e6'
                  }}>
                    <span style={{ flex: 1 }}>{file.name}</span>
                    <button
                      onClick={async () => {
                        // Kiểm tra quyền read từ localStorage
                        const userPermissions = JSON.parse(localStorage.getItem('userPermissions') || '{}');
                        if (!userPermissions.read) {
                          alert('Bạn không có quyền tải file!');
                          return;
                        }

                        try {
                          // Lấy SAS URL để download
                          const blobName = file.name; // Chỉ lấy tên file, không lấy full path
                          const response = await axios.get(`http://localhost:8080/user/download-sas?blobName=${encodeURIComponent(blobName)}`, {
                            withCredentials: true
                          });
                          if (response.data.sasUrl) {
                            await this.downloadFile(response.data.sasUrl, file.name);
                          }
                        } catch (error) {
                          if (error.response?.status === 403) {
                            alert('Bạn không có quyền tải file này!');
                          } else {
                            console.error('Error getting download URL:', error);
                            alert('Không thể tải file. Vui lòng thử lại sau.');
                          }
                        }
                      }}
                      style={{
                        padding: '5px 10px',
                        background: '#28a745',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      Tải xuống
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
}

export default withRouter(User);