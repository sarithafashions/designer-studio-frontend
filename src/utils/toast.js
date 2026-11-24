import Swal from 'sweetalert2';

/*
 * Toasts (top right, non-blocking) and a confirmation dialog, styled by src/Pages/shared/popups.css (design.md):
 * white card, hairline border, tinted status icon, title + optional detail text (new lines kept),
 * close button, thin progress line in the status colour; pauses while hovered.
 */

// Line icons (feather style) for the status circles.
const ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="11" x2="12" y2="16"/><line x1="12" y1="7.5" x2="12.01" y2="7.5"/></svg>',
    question: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
};

/** Swal options for a status icon drawn as a tinted circle. */
const iconOptions = (type) => ({
    icon: type,
    iconHtml: ICONS[type] || ICONS.info,
    customClass: { icon: `sf-icon sf-icon-${type}` },
});

const ToastInstance = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    showCloseButton: true,
    timer: 3600,
    timerProgressBar: true,
    didOpen: (popup) => {
        popup.addEventListener('mouseenter', Swal.stopTimer);
        popup.addEventListener('mouseleave', Swal.resumeTimer);
    },
});

const show = (type, title, text = '') => {
    const icon = iconOptions(type);
    return ToastInstance.fire({
        ...icon,
        title,
        text,
        // errors stay a little longer so the reason can be read
        timer: type === 'error' ? 6000 : 3600,
        customClass: { ...icon.customClass, popup: `sf-toast sf-toast-${type}` },
    });
};

export const toast = {
    success: (title, text = '') => show('success', title, text),
    error: (title, text = '') => show('error', title, text),
    warning: (title, text = '') => show('warning', title, text),
    info: (title, text = '') => show('info', title, text),

    /**
     * Confirmation dialog for important actions. Resolves true when confirmed.
     * danger: red main button (delete / void / cancel).
     */
    confirm: async ({
        title = 'Are you sure?',
        text = 'This action cannot be undone.',
        confirmButtonText = 'Yes, proceed',
        cancelButtonText = 'Cancel',
        icon = 'warning',
        danger = true,
    } = {}) => {
        const result = await Swal.fire({
            title,
            text,
            ...(icon ? iconOptions(icon) : {}),
            showCancelButton: true,
            confirmButtonText,
            cancelButtonText,
            reverseButtons: true,
            focusCancel: danger,
            customClass: {
                ...(icon ? iconOptions(icon).customClass : {}),
                ...(danger ? { confirmButton: 'sf-danger' } : {}),
            },
        });
        return result.isConfirmed;
    },
};

export default toast;
