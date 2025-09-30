import React, { Component } from "react";
import { withRouter } from "../withRouter";
import axios from "axios";

class User extends Component {
  constructor(props) {
    super(props);
    this.state = {
      showLogout: true,
      username: localStorage.getItem("accountName") || "User",
    };
  }

  handleLogout = () => {
    localStorage.removeItem("accountName");
    this.props.navigate("/");
  };

  handleUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        console.log("Selected file:", file);

        // Chuẩn bị dữ liệu
        const formData = new FormData();
        formData.append("file", file);

        try {
          const res = await axios.post("http://localhost:8080/api/files/upload", formData, {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          });
          alert("Upload thành công: " + res.data);
        } catch (err) {
          console.error(err);
          alert("Upload thất bại!");
        }
      }
    };
    input.click();
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

          {/* Nút upload */}
          <button
            style={{
              padding: "10px 20px",
              margin: "10px",
              background: "#28a745",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
            onClick={this.handleUpload}
          >
            Upload File
          </button>

          {/* Nút đi tới File List */}
          <button
            style={{
              padding: "10px 20px",
              margin: "10px",
              background: "#007bff",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
            onClick={() => this.props.navigate("/file-list")}
          >
            File List
          </button>
        </div>
      </div>
    );
  }
}

export default withRouter(User);
