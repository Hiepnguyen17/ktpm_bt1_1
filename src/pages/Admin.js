import React, { Component } from "react";
import { withRouter } from "../withRouter";

class AdminPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      showLogout: false,
      username: localStorage.getItem("accountName") || "admin",
      search: "",
      users: [
        { id: 1, username: "Tanmotcu", role: "USER", write: false, create: false, read: false },
        { id: 2, username: "admin", role: "ADMIN", write: false, create: false, read: false },
        { id: 3, username: "Cumottan", role: "USER", write: false, create: false, read: false },
      ],
    };
  }

  componentDidMount() {
    localStorage.setItem("accountName", this.state.username);
  }

  handleMouseEnter = () => this.setState({ showLogout: true });
  handleMouseLeave = () => this.setState({ showLogout: false });

  handleLogout = () => {
    localStorage.removeItem("accountName");
    this.props.navigate("/");
  };

  togglePermission = (id, field) => {
    this.setState((prevState) => ({
      users: prevState.users.map((u) =>
        u.id === id ? { ...u, [field]: !u[field] } : u
      ),
    }));
  };

  setRule = (user) => {
    alert(`Send rule to ${user.username}: ${JSON.stringify(user)}`);
  };

  handleSearch = (e) => {
    this.setState({ search: e.target.value });
  };

  renderHeader() {
  const avatarUrl =
    "https://i.pinimg.com/originals/68/76/99/6876993a25a8fc274cc09aee12171034.jpg";

  return (
    <div
      style={{
        position: "absolute",
        top: "10px",
        right: "20px",
        textAlign: "right",
      }}
      onMouseEnter={this.handleMouseEnter}
      onMouseLeave={this.handleMouseLeave}
    >
      {/* avatar + username */}
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
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            objectFit: "cover",
            marginRight: "10px",
          }}
        />
      </div>

      {this.state.showLogout && (
        <button
          style={{
            marginTop: "5px",
            marginRight: "16px",
            padding: "6px 12px",
            background: "#007bff",
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
    const filteredUsers = this.state.users.filter((u) =>
      u.username.toLowerCase().includes(this.state.search.toLowerCase())
    );

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
          <h2 style={{ marginBottom: "20px", fontWeight: "600" }}>
            USER LIST
          </h2>

          {/* Search box */}
          <div style={{ marginBottom: "15px" }}>
            <input
              type="text"
              placeholder="Search by username"
              value={this.state.search}
              onChange={this.handleSearch}
              style={{
                width: "300px",
                padding: "8px 12px",
                border: "1px solid #ddd",
                borderRadius: "6px",
                outline: "none",
              }}
            />
          </div>

          {/* User table */}
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
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Username</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Write</th>
                <th style={thStyle}>Create</th>
                <th style={thStyle}>Read</th>
                <th style={thStyle}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user, index) => (
                <tr
                  key={user.id}
                  style={{
                    background: index % 2 === 0 ? "#fff" : "#f9f9f9",
                  }}
                >
                  <td style={tdStyle}>{user.id}</td>
                  <td style={tdStyle}>{user.username}</td>
                  <td style={tdStyle}>{user.role}</td>
                  <td style={tdStyle}>
                    <input
                      type="checkbox"
                      checked={user.write}
                      onChange={() => this.togglePermission(user.id, "write")}
                    />
                  </td>
                  <td style={tdStyle}>
                    <input
                      type="checkbox"
                      checked={user.create}
                      onChange={() => this.togglePermission(user.id, "create")}
                    />
                  </td>
                  <td style={tdStyle}>
                    <input
                      type="checkbox"
                      checked={user.read}
                      onChange={() => this.togglePermission(user.id, "read")}
                    />
                  </td>
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
                      onClick={() => this.setRule(user)}
                    >
                      Set Rule
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

export default withRouter(AdminPage);
