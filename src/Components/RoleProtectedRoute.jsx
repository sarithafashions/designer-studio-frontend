// import { Navigate, Outlet } from "react-router-dom";
//
// const RoleProtectedRoute = ({ allowedRoles }) => {
//     const userRole = localStorage.getItem("role");
//
//     if (!userRole || !allowedRoles.includes(userRole)) {
//         return <Navigate to="/" replace />;
//     }
//
//     return <Outlet />;
// };
//
// export default RoleProtectedRoute;

// components/RoleProtectedRoute.jsx
import { Navigate, Outlet } from "react-router-dom";
import { getTokenRoles } from "../utils/authUtils";

const RoleProtectedRoute = ({ allowedRoles }) => {
    const userRoles = getTokenRoles();

    // Check if any of the user's roles match allowed roles
    const hasAccess = allowedRoles.some(role => userRoles.includes(role));

    if (!hasAccess) {
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
};

export default RoleProtectedRoute;
