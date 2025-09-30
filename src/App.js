import React, { Component } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import User from "./pages/User";
import FileList from "./pages/FileList";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import Home from "./pages/Home";

class App extends Component {
  render() {
    return (
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/user" element={<User />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/file-list" element={<FileList />} />
        </Routes>
      </Router>
    );
  }
}

export default App;