
import { useState } from "react";
import { FaUserCircle } from "react-icons/fa";
import { RiArrowDropDownLine } from "react-icons/ri";
import { RxExit } from "react-icons/rx";
import "./Profile.css";
import Swal from "sweetalert2";
import { getUserName } from '../../utils/authUtils';
import { signOut } from "../../Pages/LoginPages/axios.js";

function Profile() {
  const [isOpen, setIsOpen] = useState(false);

  const userName = getUserName();
  console.log(userName);

  const handleLogout = () => {
    setIsOpen(false);
    Swal.fire({
      title: "Logout Confirmation",
      text: "Are you sure you want to logout?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, logout",
      cancelButtonText: "No, stay",
      reverseButtons: true,
    }).then((result) => {
      if (result.isConfirmed) {
        // Revokes the token on the server, clears storage and reloads to /login
        signOut();
      }
    });
  };

  return (
    <div className="profile-container">
      <div className="profile">
        <FaUserCircle className="profile-icon" />


        <button className="profile-dropdown-btn" onClick={() => setIsOpen(!isOpen)}>
          <div className="user-name-container">
            <p className="user-name">{userName}</p>
          </div>

          <div  className={`profile-dropdown-btn ${isOpen ? "active" : ""}`}>
            <RiArrowDropDownLine size={24} />
          </div>
        </button>
      </div>

      {isOpen && (
        <div className="profile-dropdown">
          <button
            className="dropdown-item logout-btn"
            onClick={handleLogout}
          >
            <RxExit size={20}/>Logout
          </button>
        </div>
      )}
    </div>
  );
}

export default Profile;
