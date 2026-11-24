// Shared frame of the sign-in screens (login, forgot password, reset password): a white card on the left with the
// logo, the screen's content and a footer, and a deep-green panel on the right with the studio illustration and a
// headline (one, or several that rotate, each with its own drawing). The page is exactly the window height; the
// panel is hidden below 1024px.
import { useEffect, useState } from "react";
import { FiScissors } from "react-icons/fi";
import "./Login.css";
import logo from "../../assets/logo.png";
import AuthIllustration from "./AuthIllustration.jsx";
import AuthArtDeliveries from "./AuthArtDeliveries.jsx";
import AuthArtWorkflow from "./AuthArtWorkflow.jsx";
import AuthArtForgot from "./AuthArtForgot.jsx";
import AuthArtReset from "./AuthArtReset.jsx";

const ART = { studio: AuthIllustration, deliveries: AuthArtDeliveries, workflow: AuthArtWorkflow, forgot: AuthArtForgot, reset: AuthArtReset };

/** slides: [{title: node, text: string, art?: "studio" | "deliveries" | "workflow" | "forgot" | "reset"}] (art defaults to the studio); with more than one, they rotate every 6 s (not with reduced motion). */
export default function AuthLayout({ slides, children }) {
    const [slide, setSlide] = useState(0);
    const many = slides.length > 1;

    useEffect(() => {
        if (!many || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
        const t = setInterval(() => setSlide((i) => (i + 1) % slides.length), 6000);
        return () => clearInterval(t);
    }, [many, slides.length]);

    const current = slides[slide] || slides[0];
    const Art = ART[current.art] || AuthIllustration;
    return (
        <div className="lg">
            <main className="lg-card">
                <div className="lg-brand">
                    <img src={logo} alt="Saritha's Stitch Hub & Academy" />
                </div>
                <div className="lg-body">{children}</div>
                <div className="lg-foot">
                    <span>© {new Date().getFullYear()} Saritha&rsquo;s Designer Studio. All rights reserved.</span>
                    <span>Fashion Boutique &amp; Designer Studio</span>
                </div>
            </main>

            <aside className="lg-panel" aria-hidden="true">
                <div className="lg-art">
                    <div key={slide} className={many ? "lg-art-fade" : undefined} style={{ display: "grid", minHeight: 0 }}>
                        <Art className="lg-art-svg" />
                    </div>
                </div>
                <div className="lg-copy">
                    <div className="lg-copy-icon"><FiScissors /></div>
                    <div key={slide} className={many ? "lg-fade" : undefined}>
                        <h2>{current.title}</h2>
                        <p>{current.text}</p>
                    </div>
                    {many && (
                        <div className="lg-dots">
                            {slides.map((_, i) => (
                                <button key={i} type="button" tabIndex={-1} aria-current={i === slide} onClick={() => setSlide(i)} />
                            ))}
                        </div>
                    )}
                </div>
            </aside>
        </div>
    );
}
