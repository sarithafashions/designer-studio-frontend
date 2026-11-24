import React, {useEffect, useState} from "react";

const DateConverterToIST = (utcDate) => {
    const [day, month, year] = new Date(utcDate).toLocaleDateString("en-GB", {
        timeZone: "Asia/Kolkata",
    }).split('/');
    return `${day}-${month}-${year}`;
};

export default DateConverterToIST;
