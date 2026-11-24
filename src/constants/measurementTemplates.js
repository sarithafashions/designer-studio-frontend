export const MEASUREMENT_TEMPLATES = {
    'Top': [
        'Full Length', 'Shoulder', 'Upper Chest', 'Chest', 'Waist',
        { name: 'Hip', fields: ['Hip Front', 'Hip Back'] },
        'Seat', 'Sleeve Length', 'Sleeve Loose', 'Arm Hole', 'Bicep',
        'Front Neck', 'Back Neck', 'Remarks'
    ],
    'Blouse': [
        'F.Length', 'B.Length', 'Shoulder', 'Upper Chest', 'Chest',
        'Waist', 'Point', 'Sleeve Length', 'Sleeve Loose', 'Arm Hole',
        'Bicep', 'F.Neck', 'B.Neck', 'Remarks'
    ],
    'Bottom': [
        'Bottom Length', 'Leg Loose', 'Knee Round', 'Thyes', 'Hip', 'Seat', 'Remarks'
    ],
    'Salwar Set': [
        'Full Length', 'Shoulder', 'Upper Chest', 'Chest', 'Waist',
        { name: 'Hip', fields: ['Hip Front', 'Hip Back'] },
        'Seat', 'Sleeve Length', 'Sleeve Loose', 'Arm Hole', 'Bicep',
        'Front Neck', 'Back Neck', 'Bottom Length', 'Leg Loose', 'Remarks'
    ],
    'Default': [
        'Length', 'Width', 'Height', 'Remarks'
    ]
};

export const getTemplateForGarment = (garmentName = '') => {
    const name = garmentName.trim();
    if (name.includes('Blouse')) return MEASUREMENT_TEMPLATES['Blouse'];
    if (name === 'Top') return MEASUREMENT_TEMPLATES['Top'];
    if (name === 'Bottom') return MEASUREMENT_TEMPLATES['Bottom'];
    if (name === 'Salwar Set') return MEASUREMENT_TEMPLATES['Salwar Set'];
    return MEASUREMENT_TEMPLATES['Default'];
};
