import React from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";
import { Outlet, useLocation } from "react-router-dom"

const Layout = () => {
  const location = useLocation();
  const isHome = location.pathname === '/' || location.pathname === '/home';
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Navbar />
      <main className={`main-content${isHome ? ' main-content--home' : ''}`}>
        <Outlet />
      </main>
      <div className="footer-spacer" />
      <Footer />
    </div>
  );
};

export default Layout;
