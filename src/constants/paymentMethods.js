export const PAYMENT_METHODS = [
    { value: 'Cash', label: 'Cash' },
    { value: 'UPI', label: 'UPI' },
    { value: 'Card', label: 'Card' },
    { value: 'Bank Transfer', label: 'Bank Transfer' },
    { value: 'Other', label: 'Other' },
];

export const PAYMENT_METHOD_OPTIONS = PAYMENT_METHODS.map(m => m.value);
