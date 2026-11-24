// Sign-in page (shared AuthLayout: white card + green panel with the studio illustration and a rotating headline).
// Behaviour unchanged: POST /auth/sign-in, token / user / shop in localStorage, role home redirect, session-expired notice.
import React, {useEffect, useState} from 'react';
import {useNavigate} from "react-router-dom";
import axiosInstance from "./axios.js";
import AuthLayout from "./AuthLayout.jsx";
import Swal from "sweetalert2";
import {getHighestPriorityRole} from "../../utils/authUtils.jsx"
import { FiEye, FiEyeOff, FiAlertCircle, FiArrowRight, FiMail, FiLock } from 'react-icons/fi';

// Landing page per role (used after sign-in and when an already signed-in user opens /login)
const ROLE_HOME = {
    'OWNER': '/owner/overview',
    'SHOP_OWNER': '/shopOwner/dashboard',
    'TAILOR_MASTER': '/tailorMaster/cutting',
    'TAILOR': '/tailor/queue',
    'SHOP_ASSISTANT': '/shopAssistant/jobs'
};

/** Headlines that rotate under the drawings; "art" picks the drawing for each one. */
const SLIDES = [
    {
        title: <>One place for every <strong>order, stitch and payment</strong></>,
        text: "Invoices, advances and receipts, the tailor workroom and finishing — for every branch.",
        art: "studio",
    },
    {
        title: <>Know what is <strong>due today</strong>, before the customer asks</>,
        text: "Ready, in production or late: every delivery at a glance, with the balance still to collect.",
        art: "deliveries",
    },
    {
        title: <>See where work <strong>waits the longest</strong></>,
        text: "From cutting to ironing, every stage is tracked, so slow steps stand out.",
        art: "workflow",
    },
];

const Login = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        role: '',
        email: '',
        password: ''
    });
    const [loading, setLoading] = useState(false);

    const [errors, setErrors] = useState({
        email: '',
    });
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value
        });

        // Validate the email in real time
        if (name === 'email') {
            setErrors({
                ...errors,
                email: validateEmail(value) ? '' : 'Invalid email address'
            });
        }
    };

    const validateEmail = (email) => {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    };

    const isFormValid = () => {
        return (
            formData.email &&
            formData.password &&
            !errors.email
        );
    };

    const handleSubmit = async (e) => {
        setError("");
        e.preventDefault();
        
        if (!isFormValid()) {
            setError("Enter email & password to sign-in");
            return null;
        }
        

        try {
            setLoading(true);
            // POST /auth/sign-in -> { userId, name, email, roles[], shopId, shopName, accessToken, tokenType, expiresIn }
            const res = await axiosInstance.post(`/auth/sign-in`, formData);
            const user = res.data;

            // The token is in the body (accessToken); the Authorization header is the fallback.
            const authHeader = res.headers['authorization'];
            const token = user.accessToken
                || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);
            if (!token) {
                throw new Error('No token in sign-in response');
            }

            localStorage.setItem('token', token);
            localStorage.setItem('userId', user.userId);
            localStorage.setItem('username', user.name || '');
            // OWNER has no shop: don't store the string "null"
            if (user.shopId) localStorage.setItem('shopId', user.shopId); else localStorage.removeItem('shopId');
            if (user.shopName) localStorage.setItem('shopName', user.shopName); else localStorage.removeItem('shopName');

            // Role from the token (same source the route guards use)
            const role = getHighestPriorityRole();
            if (!role) {
                throw new Error('No valid role found in token');
            }
            localStorage.setItem('role', role);

            navigate(ROLE_HOME[role] || '/undermaintenance', { replace: true });
        } catch (err) {
            setError(err.response?.data?.message || err.message || "Login failed")
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            const role = getHighestPriorityRole();
            if (role) {
                navigate(ROLE_HOME[role] || '/undermaintenance', { replace: true });
            }
        }
    }, [navigate]);

    useEffect(() => {
        // Check for session expiration
        const queryParams = new URLSearchParams(window.location.search);
        const logoutReason = sessionStorage.getItem('logoutReason');

        if (queryParams.get('sessionExpired') === 'true' || logoutReason) {
            Swal.fire({
                icon: 'info',
                title: 'Please sign in again',
                text: logoutReason || 'Your session has expired. Please log in again.',
                showConfirmButton: true,
                confirmButtonText: 'OK',
            })

            // Clean up
            sessionStorage.removeItem('logoutReason');
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    return (
        <AuthLayout slides={SLIDES}>
                    <div className="lg-head">
                        <h1 className="lg-title">Welcome to Saritha&rsquo;s Studio</h1>
                        <p className="lg-sub">Sign in to manage orders, production and payments across your branches.</p>
                    </div>

                    <form className="lg-form" onSubmit={handleSubmit} noValidate>
                        <div className="lg-field">
                            <label htmlFor="email" className="lg-label">Email address<em aria-hidden>*</em></label>
                            <div className="lg-input-wrap">
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    placeholder="Enter your email address"
                                    autoComplete="username"
                                    className="lg-input"
                                    value={formData.email}
                                    onChange={handleChange}
                                    aria-invalid={errors.email ? "true" : undefined}
                                    aria-describedby={errors.email ? "email-error" : undefined}
                                    required
                                    autoFocus
                                />
                                <span className="lg-input-icon" aria-hidden><FiMail /></span>
                            </div>
                            {errors.email && <span id="email-error" className="lg-field-error">{errors.email}</span>}
                        </div>

                        <div className="lg-field">
                            <label htmlFor="password" className="lg-label">Password<em aria-hidden>*</em></label>
                            <div className="lg-input-wrap">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    id="password"
                                    name="password"
                                    placeholder="Enter your password"
                                    autoComplete="current-password"
                                    className="lg-input"
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                />
                                <span className="lg-input-icon" aria-hidden><FiLock /></span>
                                <button
                                    type="button"
                                    className="lg-eye"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                    aria-pressed={showPassword}
                                >
                                    {showPassword ? <FiEyeOff aria-hidden /> : <FiEye aria-hidden />}
                                </button>
                            </div>
                        </div>

                        <div className="lg-row">
                            <a href="/forgot-password" className="lg-link">Forgot password?</a>
                        </div>

                        {error && (
                            <div className="lg-error" role="alert">
                                <FiAlertCircle aria-hidden />
                                <span>{error}</span>
                            </div>
                        )}

                        <button type="submit" className="lg-submit" disabled={loading}>
                            {loading ? (
                                <>
                                    <span className="lg-spinner" aria-hidden />
                                    Signing in…
                                </>
                            ) : (
                                <>
                                    Sign in <FiArrowRight aria-hidden />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="lg-note"><span>New staff? Ask your owner for an account.</span></div>
        </AuthLayout>
    );
};

export default Login;
