import React from "react";
import Navbar from "./Navbar";
import { Outlet } from "react-router-dom"

const Layout = () => {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <Navbar />

      <main style={{ flex: 1, padding: "20px" }}>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
