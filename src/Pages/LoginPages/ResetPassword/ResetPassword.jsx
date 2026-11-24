// Reset password (shared AuthLayout), opened from the emailed link /resert-password/:email/:code.
// New + confirm password with a live rules checklist -> POST /auth/password-reset {email, code, newPassword, confirmPassword}.
import { useState } from 'react';
import { useNavigate, useParams } from "react-router-dom";
import { FiLock, FiEye, FiEyeOff, FiArrowLeft, FiArrowRight, FiAlertCircle, FiCheck, FiCheckCircle, FiCircle } from 'react-icons/fi';
import axiosInstance, { getErrorMessage } from "../axios.js";
import AuthLayout from "../AuthLayout.jsx";

const SLIDES = [{
    title: <>A fresh start with a <strong>new password</strong></>,
    text: "Choose something only you know: at least 8 characters with a letter and a number.",
    art: "reset",
}];

// Same rule as the backend: 8-100 characters, at least one letter and one digit (symbols allowed)
const validatePassword = (password) => /^(?=.*[A-Za-z])(?=.*\d).{8,100}$/.test(password);

const ResetPassword = () => {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [errors, setErrors] = useState({ password: '', confirmPassword: '' });
    const [submitError, setSubmitError] = useState('');
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const { email, code } = useParams();
    const navigate = useNavigate();

    const rules = [
        { ok: newPassword.length >= 8, label: "At least 8 characters" },
        { ok: /[A-Za-z]/.test(newPassword), label: "A letter" },
        { ok: /\d/.test(newPassword), label: "A number" },
        { ok: !!confirmPassword && newPassword === confirmPassword, label: "Both passwords match" },
    ];

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitted(true);
        const next = { password: '', confirmPassword: '' };
        if (!newPassword) next.password = 'Password is required';
        else if (!validatePassword(newPassword)) next.password = 'Must be 8+ characters with a letter and a number';
        if (!confirmPassword) next.confirmPassword = 'Please confirm your password';
        else if (newPassword !== confirmPassword) next.confirmPassword = 'Passwords do not match';
        setErrors(next);
        setSubmitError('');
        if (next.password || next.confirmPassword) return;

        try {
            setLoading(true);
            // POST /auth/password-reset takes JSON (not multipart). email + 6-digit code come from the email link.
            await axiosInstance.post(`/auth/password-reset`, { email, code, newPassword, confirmPassword });
            setShowSuccess(true);
        } catch (error) {
            // e.g. "Invalid or expired code" (400) or too many attempts (429)
            setSubmitError(getErrorMessage(error, 'Could not reset the password. Please request a new code.'));
            setShowSuccess(false);
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordChange = (e) => {
        const value = e.target.value;
        setNewPassword(value);
        if (isSubmitted) {
            setErrors((er) => ({
                ...er,
                password: !value ? 'Password is required' : !validatePassword(value) ? 'Must be 8+ characters with a letter and a number' : '',
                confirmPassword: confirmPassword ? (confirmPassword !== value ? 'Passwords do not match' : '') : er.confirmPassword,
            }));
        }
    };

    const handleConfirmPasswordChange = (e) => {
        const value = e.target.value;
        setConfirmPassword(value);
        if (isSubmitted) {
            setErrors((er) => ({
                ...er,
                confirmPassword: !value ? 'Please confirm your password' : newPassword !== value ? 'Passwords do not match' : '',
            }));
        }
    };

    const eye = (
        <button type="button" className="lg-eye" onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "Hide passwords" : "Show passwords"} aria-pressed={showPassword}>
            {showPassword ? <FiEyeOff aria-hidden /> : <FiEye aria-hidden />}
        </button>
    );

    return (
        <AuthLayout slides={SLIDES}>
            {showSuccess ? (
                <div className="lg-done">
                    <div className="lg-done-icon ok"><FiCheckCircle aria-hidden /></div>
                    <h1 className="lg-title">Password changed</h1>
                    <p className="lg-sub">Your password has been reset. Sign in with your new password.</p>
                    <button type="button" className="lg-submit" onClick={() => navigate("/login")}>
                        Go to sign in <FiArrowRight aria-hidden />
                    </button>
                </div>
            ) : (
                <>
                    <div className="lg-head">
                        <h1 className="lg-title">Set a new password</h1>
                        <p className="lg-sub">
                            {email ? <>For <b>{email}</b>. </> : null}Choose a password you haven&rsquo;t used here before.
                        </p>
                    </div>
                    <form className="lg-form" onSubmit={handleSubmit} noValidate>
                        <div className="lg-field">
                            <label htmlFor="rp-new" className="lg-label">New password<em aria-hidden>*</em></label>
                            <div className="lg-input-wrap">
                                <input
                                    id="rp-new"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Enter a new password"
                                    autoComplete="new-password"
                                    className="lg-input"
                                    value={newPassword}
                                    onChange={handlePasswordChange}
                                    aria-invalid={errors.password ? "true" : undefined}
                                    aria-describedby="rp-rules"
                                    required
                                    autoFocus
                                />
                                <span className="lg-input-icon" aria-hidden><FiLock /></span>
                                {eye}
                            </div>
                            {errors.password && <span className="lg-field-error">{errors.password}</span>}
                        </div>

                        <div className="lg-field">
                            <label htmlFor="rp-confirm" className="lg-label">Confirm new password<em aria-hidden>*</em></label>
                            <div className="lg-input-wrap">
                                <input
                                    id="rp-confirm"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Enter it again"
                                    autoComplete="new-password"
                                    className="lg-input"
                                    value={confirmPassword}
                                    onChange={handleConfirmPasswordChange}
                                    aria-invalid={errors.confirmPassword ? "true" : undefined}
                                    required
                                />
                                <span className="lg-input-icon" aria-hidden><FiLock /></span>
                                {eye}
                            </div>
                            {errors.confirmPassword && <span className="lg-field-error">{errors.confirmPassword}</span>}
                        </div>

                        <ul className="lg-rules" id="rp-rules" aria-label="Password rules">
                            {rules.map((r) => (
                                <li key={r.label} className={r.ok ? "ok" : undefined}>
                                    {r.ok ? <FiCheck aria-hidden /> : <FiCircle aria-hidden />} {r.label}
                                </li>
                            ))}
                        </ul>

                        {submitError && (
                            <div className="lg-error" role="alert">
                                <FiAlertCircle aria-hidden />
                                <span>
                                    {submitError}{" "}
                                    <button type="button" className="lg-inline-link" onClick={() => navigate("/forgot-password")}>Request a new link</button>
                                </span>
                            </div>
                        )}

                        <button type="submit" className="lg-submit" disabled={loading}>
                            {loading ? <><span className="lg-spinner" aria-hidden /> Saving…</> : <>Reset password <FiArrowRight aria-hidden /></>}
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

export default ResetPassword;
