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
      loading: false
    };
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

  handleUpload = async () => {
    const { selectedFile } = this.state;
    if (!selectedFile) {
      alert("Vui lòng chọn file trước!");
      return;
    }

    try {
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
        }
      });

      if (uploadResponse.status === 201) {
        alert("Upload thành công!");
        this.setState({ selectedFile: null }); // Reset selected file
        this.fetchFileList(); // Refresh danh sách file
      } else {
        throw new Error('Upload thất bại');
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert(err.response?.data?.message || "Bạn không có quyền upload");
    }
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
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            marginBottom: '20px'
          }}>
            <button
              style={{
                padding: "10px 20px",
                background: "#28a745",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
              }}
              onClick={this.handleFileSelect}
            >
              Chọn File
            </button>

            {this.state.selectedFile && (
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
