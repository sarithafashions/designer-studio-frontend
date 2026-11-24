// utils/authUtils.js
import { jwtDecode } from 'jwt-decode';

export const getTokenRoles = () => {
    const token = localStorage.getItem('token');
    if (!token) return [];

    try {
        const decoded = jwtDecode(token);
        console.log("Decoded",decoded);
        // Handle both array and object formats for roles
        if (Array.isArray(decoded.roles)) {
            return decoded.roles.map(role => role.authority || role);
        } else if (decoded.roles && decoded.roles.authority) {
            return [decoded.roles.authority];
        }
        return [];
    } catch (error) {
        console.error('Error decoding token:', error);
        return [];
    }
};

export const getHighestPriorityRole = () => {
    const roles = getTokenRoles();
    console.log("DecodedRoles",roles);
    // Define your role priority (most privileged first)
    const rolePriority = [
        'OWNER',
        'SHOP_OWNER',
        'TAILOR_MASTER',
        'TAILOR',
        'SHOP_ASSISTANT'
    ];

    return rolePriority.find(role => roles.includes(role)) || null;
};


/**
 * Gets the user email id from the localStorage
 * used in
 * -> components/profile.jsx
 */
export const getUserName = () => {
  // Missing for sessions created before the sign-in change -> empty name instead of a crash
  const userName = localStorage.getItem("username") || ""
  const capitalize = userName
    .split(' ')
    .map((name) => name.charAt(0).toUpperCase() + name.slice(1))
    .join(' ')
  return capitalize;
}
