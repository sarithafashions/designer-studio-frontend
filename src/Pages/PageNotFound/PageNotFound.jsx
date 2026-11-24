import React from 'react';
import Lottie from 'react-lottie';
import { useNavigate } from 'react-router-dom';
import page from "./pageNotFound.json";
import './PageNotFound.css'; // Create this CSS file

const PageNotFound = () => {
    const navigate = useNavigate();

    const defaultOptions = {
        loop: true,
        autoplay: true,
        animationData: page,
        rendererSettings: {
            preserveAspectRatio: 'xMidYMid slice'
        }
    };

    return (
        <div className="page-not-found-container">
            <div className="animation-container">
                <Lottie
                    options={defaultOptions}
                />
            </div>

            <div className="content-container">
                <h1 className="title">404 - Page Not Found</h1>
                <p className="description">
                    Oops! The page you're looking for doesn't exist or has been moved.
                </p>

                <div className="action-buttons">
                    <button
                        className="home-button"
                        onClick={() => navigate('/')}
                    >
                        Go to Homepage
                    </button>

                    <button
                        className="back-button"
                        onClick={() => navigate(-1)}
                    >
                        Go Back
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PageNotFound;