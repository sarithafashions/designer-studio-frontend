import React from 'react';
import login from '../../assets/login.png'

const PosterPage = ({poster}) => {
    return (
        <div className="signup-left">
            <div className="student-images">
                <img src={login} alt="Student 1" className="student"/>
            </div>
        </div>
    );
};

export default PosterPage;
