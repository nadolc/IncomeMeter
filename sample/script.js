// Utility functions
let i18n = {};
let currentLang = localStorage.getItem('lang') || 'en-GB';

async function loadLocale(lang) {
    try {
        const res = await fetch(`locales/${lang}.json`);
        i18n = await res.json();
    } catch (error) {
        console.error('Error loading locale file:', error);
        // Fallback to default language
        const res = await fetch(`locales/en-GB.json`);
        i18n = await res.json();
    }
}

function t(key, replacements = {}) {
    let translation = i18n[key] || key;
    
    // Simple interpolation for template strings like 'Hello, {{name}}!'
    for (const [k, v] of Object.entries(replacements)) {
        const regex = new RegExp(`{{${k}}}`, 'g');
        translation = translation.replace(regex, v);
    }
    
    return translation;
}

function localizeHtml() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (i18n[key]) {
            element.textContent = t(key);
        }
    });
}

function formatDate(dateString, dateOnly) {
    if (!dateString) {
        return t('common_no_date');
    }
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return t('common_invalid_date');
        }
        if(dateOnly){
            return date.toLocaleDateString(currentLang, {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
        }
        return date.toLocaleDateString(currentLang, {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        console.error('Error formatting date:', error);
        return t('common_date_error');
    }
}

function formatCurrency(amount) {
    if (typeof amount !== 'number' || isNaN(amount)) {
        return '£0.00';
    }
    // Note: A more robust localization would use Intl.NumberFormat
    return `£${amount.toFixed(2)}`;
}

function getStatusColor(status) {
    switch (status.toLowerCase()) {
        case 'completed':
            return 'status-completed';
        case 'in_progress':
            return 'status-in_progress';
        case 'scheduled':
            return 'status-scheduled';
        default:
            return 'status-cancelled';
    }
}

function formatLocationTime(timestamp) {
    if (!timestamp) {
        return t('common_no_time');
    }
    
    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) {
            return t('common_invalid_time');
        }
        return date.toLocaleTimeString(currentLang, {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
    } catch (error) {
        console.error('Error formatting time:', error);
        return t('common_time_error');
    }
}
