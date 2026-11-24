// import React, { useEffect } from 'react';
// import { useNavigate } from 'react-router-dom';
//
// const Home = () => {
//     const navigate = useNavigate();
//
//     useEffect(() => {
//         const token = localStorage.getItem('token');
//         const role = localStorage.getItem('role');
//
//         if (!token) {
//             navigate("/login");
//         } else {
//             if (role === "OWNER") {
//                 navigate("/dashboard");
//             } else if (role === "SHOP_OWNER") {
//                 navigate("/shopOwner");
//             } else if(role === "TAILOR_MASTER") {
//                 navigate("/tailorMaster");
//             } else if(role === "TAILOR") {
//                 navigate("/tailor");
//             } else {
//                 navigate("/undermaintenance");
//             }
//         }
//     }, [navigate]);
//
//     return null;
// };
//
// export default Home;

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHighestPriorityRole } from '../../utils/authUtils';

const Home = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/login', { replace: true });
        } else {
            const role = getHighestPriorityRole();
            const roleRoutes = {
                'OWNER': '/owner',
                'SHOP_OWNER': '/shopOwner',
                'TAILOR_MASTER': '/tailorMaster',
                'TAILOR': '/tailor',
                'SHOP_ASSISTANT': '/shopAssistant'
            };
            navigate(roleRoutes[role] || '/undermaintenance', { replace: true });
        }
    }, [navigate]);

    return null;
};

export default Home;
