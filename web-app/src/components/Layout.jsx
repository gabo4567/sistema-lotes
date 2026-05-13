import React, { useLayoutEffect } from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";
import { Outlet, useLocation } from "react-router-dom"

const Layout = () => {
  const location = useLocation();
  const isHome = location.pathname === '/' || location.pathname === '/home';

  useLayoutEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location.pathname, location.search]);

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
