export const formatDateTime = (dateString: string | number | Date | null | undefined) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    // Invalid Date check
    if (isNaN(date.getTime())) return '';

    return date.toLocaleString('it-IT', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
};

export const formatDate = (dateString: string | number | Date | null | undefined) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';

    return date.toLocaleDateString('it-IT', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
};
