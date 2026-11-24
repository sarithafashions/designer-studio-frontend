// App shell shared by the role apps (SHOP_OWNER, TAILOR_MASTER, …): sidebar + mobile top bar + content.
// Guards the whole area: no token -> /login; signed in without `role` -> home.
import { useEffect, useState } from "react";
import { NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import Swal from "sweetalert2";
import { FiLogOut, FiMenu } from "react-icons/fi";
import logo from "../../assets/logo.png";
import { getTokenRoles, getUserName } from "../../utils/authUtils.jsx";
import { signOut } from "../LoginPages/axios.js";
import { initials } from "./lib/format.js";
import "./theme.css";

/**
 * @param role       role required to see the area (e.g. "SHOP_OWNER")
 * @param roleLabel  shown under the user's name ("Shop owner")
 * @param navLabel   small heading above the links ("Shop")
 * @param nav        [{ to, label, icon }]
 * @param brand      name shown at the top (default: the signed-in shop's name)
 */
export default function AppShell({ role, roleLabel, navLabel, nav, brand }) {
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);
    const token = localStorage.getItem("token");
    const shopName = brand || localStorage.getItem("shopName") || "Your shop";
    const userName = getUserName() || roleLabel;

    // Close the mobile drawer on navigation.
    useEffect(() => setMenuOpen(false), [location.pathname]);

    if (!token) return <Navigate to="/login" replace />;
    if (!getTokenRoles().includes(role)) return <Navigate to="/" replace />;

    const logout = () =>
        Swal.fire({
            title: "Log out?",
            text: "You will need to sign in again.",
            showCancelButton: true,
            confirmButtonText: "Log out",
            cancelButtonText: "Stay",
            reverseButtons: true,
            confirmButtonColor: "#17171c",
        }).then((r) => r.isConfirmed && signOut());

    return (
        <div className="so-app">
            <div className="so-shell">
                <div className={`so-backdrop ${menuOpen ? "open" : ""}`} onClick={() => setMenuOpen(false)} />
                <aside className={`so-sidebar ${menuOpen ? "open" : ""}`} aria-label="Main navigation">
                    <div className="so-brand">
                        <img src={logo} alt="" />
                    </div>
                    <div className="so-brand-shop">{shopName}</div>
                    <nav className="so-nav">
                        <div className="so-nav-label">{navLabel}</div>
                        {nav.map((item) => {
                            const Icon = item.icon;
                            return (
                                <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? "active" : "")}>
                                    <Icon size={18} aria-hidden />
                                    {item.label}
                                </NavLink>
                            );
                        })}
                    </nav>

                    <div className="so-sidebar-foot">
                        <div className="so-user">
                            <div className="so-avatar" aria-hidden>
                                {initials(userName)}
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <div className="so-user-name">{userName}</div>
                                <div className="so-user-role">{roleLabel}</div>
                            </div>
                        </div>
                        <button type="button" className="so-linkbtn" onClick={logout}>
                            <FiLogOut size={18} aria-hidden /> Log out
                        </button>
                    </div>
                </aside>

                <div className="so-main">
                    <div className="so-topbar">
                        <button
                            type="button"
                            className="so-icon-btn"
                            aria-label="Open menu"
                            aria-expanded={menuOpen}
                            onClick={() => setMenuOpen(true)}
                        >
                            <FiMenu />
                        </button>
                        <div className="so-brand-name">{shopName}</div>
                        <div className="so-avatar" aria-hidden>
                            {initials(userName)}
                        </div>
                    </div>
                    <main className="so-content">
                        <Outlet />
                    </main>
                </div>
            </div>
        </div>
    );
}
