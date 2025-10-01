import React, { Component } from "react";
import { Navigate } from "react-router-dom";

class Home extends Component {
  render() {
    const userRole = localStorage.getItem("userRole");
    const accountName = localStorage.getItem("accountName");

    if (accountName && userRole) {
      if (userRole === "ROLE_ADMIN") {
        return <Navigate to="/admin" replace />;
      } else {
        return <Navigate to="/user" replace />;
      }
    }

    return <Navigate to="/login" replace />;
  }
}

export default Home;