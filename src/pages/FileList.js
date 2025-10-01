import React, { Component } from "react";
import { withRouter } from "../withRouter";
import axios from "axios";

class FileList extends Component {
  constructor(props) {
    super(props);
    this.state = {
      showLogout: true,
      username: localStorage.getItem("accountName") || "User",
      files: [],
    };
  }

  componentDidMount() {
    // Lấy username lưu vào localStorage
    localStorage.setItem("accountName", this.state.username);

    // Gọi API để lấy danh sách file
    axios
      .get("http://localhost:8080/api/files")
      .then((res) => {
        // Giả sử backend trả về mảng tên file
        const files = res.data.map((name, i) => ({
          id: i + 1,
          name,
          createdAt: new Date().toISOString().split("T")[0], // mock ngày
        }));
        this.setState({ files });
      })
      .catch((err) => console.error(err));
  }

  handleLogout = () => {
    localStorage.removeItem("accountName");
    this.props.navigate("/");
  };

  handleDownload = (file) => {
    alert("Download: " + file.name);
    // TODO: gọi API backend tải file
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
              background: "#0f0b0bff",
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
          }}
        >
          <h2
            style={{
              marginBottom: "20px",
              fontWeight: "600",
              textAlign: "center",
            }}
          >
            File List
          </h2>

          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
              fontSize: "14px",
            }}
          >
            <thead>
              <tr style={{ background: "#f1f3f5" }}>
                <th style={thStyle}>STT</th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Created At</th>
                <th style={thStyle}>Action</th>
              </tr>
            </thead>
            <tbody>
              {this.state.files.map((file, index) => (
                <tr
                  key={file.id}
                  style={{
                    background: index % 2 === 0 ? "#fff" : "#f9f9f9",
                  }}
                >
                  <td style={tdStyle}>{index + 1}</td>
                  <td style={tdStyle}>{file.name}</td>
                  <td style={tdStyle}>{file.createdAt}</td>
                  <td style={tdStyle}>
                    <button
                      style={{
                        padding: "5px 10px",
                        background: "#28a745",
                        color: "#fff",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                      onClick={() => this.handleDownload(file)}
                    >
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
}

const thStyle = {
  padding: "10px",
  borderBottom: "1px solid #ddd",
  fontWeight: "600",
};

const tdStyle = {
  padding: "10px",
  borderBottom: "1px solid #eee",
};

export default withRouter(FileList);
