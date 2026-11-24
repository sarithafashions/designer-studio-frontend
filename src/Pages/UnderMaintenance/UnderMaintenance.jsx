import React, { useState, useEffect } from 'react';
import './UnderMaintenance.css';

const UnderMaintenance = () => {
    const [timeLeft, setTimeLeft] = useState({
        hours: '00',
        minutes: '00',
        seconds: '00'
    });

    useEffect(() => {
        // Example countdown timer - set your maintenance end time here
        const countDownDate = new Date();
        countDownDate.setHours(countDownDate.getHours() + 2); // 2 hours from now

        const interval = setInterval(() => {
            const now = new Date().getTime();
            const distance = countDownDate - now;

            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            setTimeLeft({
                hours: hours.toString().padStart(2, '0'),
                minutes: minutes.toString().padStart(2, '0'),
                seconds: seconds.toString().padStart(2, '0')
            });

            if (distance < 0) {
                clearInterval(interval);
                setTimeLeft({ hours: '00', minutes: '00', seconds: '00' });
            }
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="maint-container">
            <div className="maint-content">
                <div className="maint-animation">
                    <div className="maint-gear maint-gear-large">
                        <svg viewBox="0 0 100 100" className="maint-svg">
                            <path d="M82.2,45.6c0.1-0.8,0.2-1.5,0.2-2.3c0-0.8-0.1-1.5-0.2-2.3l9.2-7.2c0.7-0.5,0.8-1.5,0.3-2.2l-8.7-15.1 c-0.4-0.7-1.4-1-2.1-0.6l-10.8,4.3c-1.5-1.2-3.2-2.1-5-2.8l-1.6-11.5c-0.1-0.8-0.8-1.4-1.6-1.4h-17.4c-0.8,0-1.5,0.6-1.6,1.4 l-1.6,11.5c-1.8,0.7-3.5,1.7-5,2.8l-10.8-4.3c-0.7-0.3-1.7-0.1-2.1,0.6L8.3,31.6c-0.4,0.7-0.4,1.7,0.3,2.2l9.2,7.2 C17.7,42.1,17.6,42.8,17.6,43.5c0,0.8,0.1,1.5,0.2,2.3L8.6,52.8c-0.7,0.5-0.8,1.5-0.3,2.2l8.7,15.1c0.4,0.7,1.4,1,2.1,0.6 l10.8-4.3c1.5,1.2,3.2,2.1,5,2.8l1.6,11.5c0.1,0.8,0.8,1.4,1.6,1.4h17.4c0.8,0,1.5-0.6,1.6-1.4l1.6-11.5c1.8-0.7,3.5-1.7,5-2.8 l10.8,4.3c0.7,0.3,1.7,0.1,2.1-0.6l8.7-15.1c0.4-0.7,0.4-1.7-0.3-2.2L82.2,45.6z M50.1,61.4c-9.9,0-17.9-8-17.9-17.9 s8-17.9,17.9-17.9s17.9,8,17.9,17.9S60,61.4,50.1,61.4z" />
                        </svg>
                    </div>
                    <div className="maint-gear maint-gear-small">
                        <svg viewBox="0 0 100 100" className="maint-svg">
                            <path d="M82.2,45.6c0.1-0.8,0.2-1.5,0.2-2.3c0-0.8-0.1-1.5-0.2-2.3l9.2-7.2c0.7-0.5,0.8-1.5,0.3-2.2l-8.7-15.1 c-0.4-0.7-1.4-1-2.1-0.6l-10.8,4.3c-1.5-1.2-3.2-2.1-5-2.8l-1.6-11.5c-0.1-0.8-0.8-1.4-1.6-1.4h-17.4c-0.8,0-1.5,0.6-1.6,1.4 l-1.6,11.5c-1.8,0.7-3.5,1.7-5,2.8l-10.8-4.3c-0.7-0.3-1.7-0.1-2.1,0.6L8.3,31.6c-0.4,0.7-0.4,1.7,0.3,2.2l9.2,7.2 C17.7,42.1,17.6,42.8,17.6,43.5c0,0.8,0.1,1.5,0.2,2.3L8.6,52.8c-0.7,0.5-0.8,1.5-0.3,2.2l8.7,15.1c0.4,0.7,1.4,1,2.1,0.6 l10.8-4.3c1.5,1.2,3.2,2.1,5,2.8l1.6,11.5c0.1,0.8,0.8,1.4,1.6,1.4h17.4c0.8,0,1.5-0.6,1.6-1.4l1.6-11.5c1.8-0.7,3.5-1.7,5-2.8 l10.8,4.3c0.7,0.3,1.7,0.1,2.1-0.6l8.7-15.1c0.4-0.7,0.4-1.7-0.3-2.2L82.2,45.6z M50.1,61.4c-9.9,0-17.9-8-17.9-17.9 s8-17.9,17.9-17.9s17.9,8,17.9,17.9S60,61.4,50.1,61.4z" />
                        </svg>
                    </div>
                    {/*<div className="maint-tools">*/}
                    {/*    <div className="maint-wrench"></div>*/}
                    {/*    <div className="maint-screwdriver"></div>*/}
                    {/*</div>*/}
                </div>

                <h1 className="maint-title">System Maintenance</h1>
                <p className="maint-message">
                    We're currently upgrading our systems to serve you better.
                    The website will be back online shortly. Thank you for your patience.
                </p>

                <div className="maint-countdown">
                    <div className="maint-countdown-item">
                        <span className="maint-countdown-number">{timeLeft.hours}</span>
                        <span className="maint-countdown-label">Hours</span>
                    </div>
                    <div className="maint-countdown-separator">:</div>
                    <div className="maint-countdown-item">
                        <span className="maint-countdown-number">{timeLeft.minutes}</span>
                        <span className="maint-countdown-label">Minutes</span>
                    </div>
                    <div className="maint-countdown-separator">:</div>
                    <div className="maint-countdown-item">
                        <span className="maint-countdown-number">{timeLeft.seconds}</span>
                        <span className="maint-countdown-label">Seconds</span>
                    </div>
                </div>

                {/*<div className="maint-contact">*/}
                {/*    <p>Need immediate assistance?</p>*/}
                {/*    <a href="mailto:support@yourcompany.com" className="maint-contact-link">*/}
                {/*        Contact Support Team*/}
                {/*    </a>*/}
                {/*</div>*/}

                <div className="maint-progress">
                    <div className="maint-progress-bar"></div>
                </div>
            </div>
        </div>
    );
};

export default UnderMaintenance;