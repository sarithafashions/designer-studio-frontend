// Forgot password (shared AuthLayout): email -> POST /auth/password-reset/code, then "check your email".
// The response is the same for every email (the backend never says whether an account exists).
import { useState } from 'react';
import { useNavigate } from "react-router-dom";
import { FiMail, FiArrowLeft, FiArrowRight, FiAlertCircle, FiCheck } from 'react-icons/fi';
import axiosInstance, { getErrorMessage } from "../axios.js";
import AuthLayout from "../AuthLayout.jsx";

const SLIDES = [{
    title: <>Locked out? <strong>We&rsquo;ll get you back in</strong></>,
    text: "We email you a link to set a new password. It works for 10 minutes.",
    art: "forgot",
}];

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [emailError, setEmailError] = useState('');
    const [submitError, setSubmitError] = useState('');
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const validateEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

    const handleReset = async (e) => {
        e.preventDefault();
        setIsSubmitted(true);
        setSubmitError('');
        if (!email) {
            setEmailError('Email is required');
            return;
        }
        if (!validateEmail(email)) {
            setEmailError('Please enter a valid email address');
            return;
        }
        setEmailError('');
        try {
            setLoading(true);
            await axiosInstance.post('/auth/password-reset/code', { email });
            setShowSuccess(true);
        } catch (error) {
            setSubmitError(getErrorMessage(error, 'Could not send the email. Please try again.'));
        } finally {
            setLoading(false);
        }
    };

    const handleEmailChange = (e) => {
        setEmail(e.target.value);
        if (isSubmitted) {
            if (!e.target.value) setEmailError('Email is required');
            else if (!validateEmail(e.target.value)) setEmailError('Please enter a valid email address');
            else setEmailError('');
        }
    };

    return (
        <AuthLayout slides={SLIDES}>
            {showSuccess ? (
                <div className="lg-done">
                    <div className="lg-done-icon"><FiMail aria-hidden /></div>
                    <h1 className="lg-title">Check your email</h1>
                    <p className="lg-sub">
                        If an account exists for <b>{email}</b>, you&rsquo;ll get an email with a link to reset your password.
                    </p>
                    <div className="lg-tips">
                        <div className="lg-tips-title">Didn&rsquo;t get it?</div>
                        <ul>
                            <li><FiCheck aria-hidden /> Check your spam or promotions folder</li>
                            <li><FiCheck aria-hidden /> Make sure the email address is right</li>
                            <li><FiCheck aria-hidden /> The link works for 10 minutes — ask again if it expired</li>
                        </ul>
                    </div>
                    <button type="button" className="lg-submit" onClick={() => navigate("/login")}>
                        <FiArrowLeft aria-hidden /> Back to sign in
                    </button>
                    <button type="button" className="lg-textbtn" onClick={() => { setShowSuccess(false); setIsSubmitted(false); }}>
                        Use another email
                    </button>
                </div>
            ) : (
                <>
                    <div className="lg-head">
                        <h1 className="lg-title">Forgot your password?</h1>
                        <p className="lg-sub">Enter the email you sign in with and we&rsquo;ll send you a link to set a new one.</p>
                    </div>
                    <form className="lg-form" onSubmit={handleReset} noValidate>
                        <div className="lg-field">
                            <label htmlFor="fp-email" className="lg-label">Email address<em aria-hidden>*</em></label>
                            <div className="lg-input-wrap">
                                <input
                                    id="fp-email"
                                    type="email"
                                    placeholder="Enter your email address"
                                    autoComplete="email"
                                    className="lg-input"
                                    value={email}
                                    onChange={handleEmailChange}
                                    onBlur={() => isSubmitted && !validateEmail(email) && setEmailError('Please enter a valid email address')}
                                    aria-invalid={emailError ? "true" : undefined}
                                    aria-describedby={emailError ? "fp-email-error" : undefined}
                                    required
                                    autoFocus
                                />
                                <span className="lg-input-icon" aria-hidden><FiMail /></span>
                            </div>
                            {emailError && <span id="fp-email-error" className="lg-field-error">{emailError}</span>}
                        </div>

                        {submitError && (
                            <div className="lg-error" role="alert">
                                <FiAlertCircle aria-hidden />
                                <span>{submitError}</span>
                            </div>
                        )}

                        <button type="submit" className="lg-submit" disabled={loading}>
                            {loading ? <><span className="lg-spinner" aria-hidden /> Sending…</> : <>Send reset link <FiArrowRight aria-hidden /></>}
                        </button>
                    </form>
                    <button type="button" className="lg-back" onClick={() => navigate("/login")}>
                        <FiArrowLeft aria-hidden /> Back to sign in
                    </button>
                </>
            )}
        </AuthLayout>
    );
};

export default ForgotPassword;
