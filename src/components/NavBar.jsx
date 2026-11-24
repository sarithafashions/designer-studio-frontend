import React, { useState, useEffect, useRef } from "react";
import logo from "../assets/logo.png";
import icon from "../assets/img.png";
import { FaUserCircle } from "react-icons/fa";
import { RiArrowDropDownLine } from "react-icons/ri";

import "./NavBar.css";
import { useNavigate, useLocation, Outlet, Navigate } from "react-router-dom";
import Swal from "sweetalert2";
import Profile from "./Profile/Profile.jsx";

function NavBar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const dropdownMenuRef = useRef(null);
  const profileButtonRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const [token, setToken] = useState(null);

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const handleClickOutside = (event) => {
    if (
      dropdownMenuRef.current &&
      !dropdownMenuRef.current.contains(event.target)
    ) {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    setToken(token);
    // setRole(role);

    if (!token && location.pathname !== "/login") {
      navigate("/login", { replace: true });
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, location.pathname, navigate]);



  // Don't render anything until we've checked for token
  if (token === null) {
    return null; // Or loading spinner
  }

  // If no token, redirect to login (redundant safety check)
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <header className="header-nav">
        <div className="logo-section">
          <img src={logo} alt="Logo" />
        </div>
        <div className="navbar">
          <Profile/>
        </div>
      </header>
      <Outlet />
    </>
  );
}

export default NavBar;
