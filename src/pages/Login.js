import React, { Component } from "react";
import { withRouter } from "../withRouter";
import axios from "axios";

class Login extends Component {
  constructor(props) {
    super(props);
    this.state = {
      username: "",
      password: "",
    };
  }

  componentDidMount() {
    // Kiểm tra nếu đã đăng nhập thì redirect về trang chủ
    const accountName = localStorage.getItem("accountName");
    if (accountName) {
      this.props.navigate("/");
    }
  }
  handleChange = (e) => {
  this.setState({
    [e.target.name]: e.target.value
  });
};

handleSubmit = async (e) => {
  e.preventDefault();
  const { username, password } = this.state;

  try {
    const res = await axios.post(
      "http://localhost:8080/login",
      { username, password },
      { withCredentials: true }
    );

    if (res.status === 200 && res.data.user) {
      const userData = res.data.user;
      // Lưu thông tin user từ response vào localStorage
      localStorage.setItem("accountName", userData.username);
      localStorage.setItem("userId", userData.id);
      localStorage.setItem("userRole", userData.role);
      localStorage.setItem("userPermissions", JSON.stringify({
        create: userData.create,
        read: userData.read,
        write: userData.write
      }));
      
      alert("Đăng nhập thành công!");

      if (userData.role === "ROLE_ADMIN") {
        this.props.navigate("/admin");
      } else {
        this.props.navigate("/user");
      }
    }
  } catch (err) {
    console.error("Login error:", err);
    alert("Sai tài khoản hoặc mật khẩu!");
  }
};


  render() {
    return (
      <div
        style={{
          maxWidth: "400px",
          margin: "50px auto",
          padding: "20px",
          border: "1px solid #ccc",
          borderRadius: "8px",
        }}
      >
        <h2 style={{ textAlign: "center" }}>Login</h2>
        <form onSubmit={this.handleSubmit}>
          <div style={{ marginBottom: "10px" }}>
            <label>Tài khoản</label>
            <input
              type="text"
              name="username"
              value={this.state.username}
              onChange={this.handleChange}
              style={{
                width: "95%",
                padding: "8px",
                display: "block",
                margin: "0 auto",
              }}
              required
            />
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label>Mật khẩu</label>
            <input
              type="password"
              name="password"
              value={this.state.password}
              onChange={this.handleChange}
              style={{
                width: "95%",
                padding: "8px",
                display: "block",
                margin: "0 auto",
              }}
              required
            />
          </div>
          <button
            type="submit"
            style={{
              width: "100%",
              padding: "15px",
              background: "blue",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
            }}
          >
            Đăng nhập
          </button>
        </form>
      </div>
    );
  }
}


export default withRouter(Login);
