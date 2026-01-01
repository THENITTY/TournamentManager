import toast from 'react-hot-toast';

/**
 * Toast utility functions for consistent notifications across the app
 */

export const showSuccess = (message: string) => {
    toast.success(message, {
        duration: 3000,
        position: 'top-right',
        style: {
            background: '#1a1a1a',
            color: '#fff',
            border: '1px solid rgba(234, 179, 8, 0.3)',
        },
    });
};

export const showError = (message: string) => {
    toast.error(message, {
        duration: 4000,
        position: 'top-right',
        style: {
            background: '#1a1a1a',
            color: '#fff',
            border: '1px solid rgba(239, 68, 68, 0.3)',
        },
    });
};

export const showLoading = (message: string) => {
    return toast.loading(message, {
        position: 'top-right',
        style: {
            background: '#1a1a1a',
            color: '#fff',
            border: '1px solid rgba(255, 255, 255, 0.1)',
        },
    });
};

export const dismissToast = (toastId: string) => {
    toast.dismiss(toastId);
};

/**
 * Show a promise-based toast that automatically handles loading, success, and error states
 */
export const showPromise = <T,>(
    promise: Promise<T>,
    messages: {
        loading: string;
        success: string;
        error: string;
    }
) => {
    return toast.promise(
        promise,
        {
            loading: messages.loading,
            success: messages.success,
            error: messages.error,
        },
        {
            position: 'top-right',
            style: {
                background: '#1a1a1a',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.1)',
            },
            success: {
                style: {
                    border: '1px solid rgba(234, 179, 8, 0.3)',
                },
            },
            error: {
                style: {
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                },
            },
        }
    );
};
