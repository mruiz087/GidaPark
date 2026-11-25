function showToast(msg, type = 'success') {
    document.querySelectorAll('.toast-confirm').forEach(el => el.remove());

    const tEl = document.createElement('div');
    tEl.className = `toast-confirm toast-${type}`;

    const iconMap = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle',
        warning: 'fa-exclamation-triangle'
    };
    const icon = iconMap[type] || iconMap.success;

    tEl.innerHTML = `<i class="fas ${icon} mr-2"></i><span>${escapeHtml(msg)}</span>`;
    document.body.appendChild(tEl);

    setTimeout(() => {
        tEl.style.opacity = '0';
        tEl.style.transform = 'translate(-50%, -20px)';
        tEl.style.transition = 'all 0.3s ease-in';
        setTimeout(() => tEl.remove(), 300);
    }, 2800);
}

function showConfirm(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('modal-confirm');
        const textEl = document.getElementById('confirm-text');
        const cancelBtn = document.getElementById('confirm-cancel');
        const okBtn = document.getElementById('confirm-ok');

        // Support simple linebreaks safely
        textEl.innerHTML = escapeHtml(String(message)).replace(/\n/g, '<br>');
        modal.classList.remove('hidden');

        const cleanup = (value) => {
            modal.classList.add('hidden');
            cancelBtn.removeEventListener('click', onCancel);
            okBtn.removeEventListener('click', onOk);
            resolve(value);
        };

        const onCancel = () => cleanup(false);
        const onOk = () => cleanup(true);

        cancelBtn.addEventListener('click', onCancel);
        okBtn.addEventListener('click', onOk);
    });
}

/** Escape text for safe use inside HTML. */
function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Format a Date as YYYY-MM-DD in local time (prevents UTC midnight day shifts). */
function formatLocalYMD(date) {
    const d = date instanceof Date ? date : new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Parse YYYY-MM-DD string as local midnight Date. */
function parseLocalYMD(dateStr) {
    const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
}

/** Format YYYY-MM-DD into a human-readable localized string. */
function formatReadableDate(dateStr, lang) {
    if (!dateStr) return '';
    const d = parseLocalYMD(dateStr);
    const locale = (lang || window.currentLang) === 'eu' ? 'eu-ES' : 'es-ES';
    const text = d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
    return text.charAt(0).toUpperCase() + text.slice(1);
}

/** 8-char uppercase join code using crypto (new groups only). */
function generateGroupCode(length = 8) {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    let out = '';
    for (let i = 0; i < length; i++) {
        out += alphabet[bytes[i] % alphabet.length];
    }
    return out;
}

/** Copy text to clipboard with fallback and toast feedback. */
async function copyGroupCode(code, event) {
    if (event) event.stopPropagation();
    if (!code) return;
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(code);
        } else {
            const ta = document.createElement('textarea');
            ta.value = code;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
        }
        showToast(`${t('shared.codigo_copiado')}: ${code}`, 'success');
    } catch (err) {
        console.error('Copy failed:', err);
        showToast(t('shared.error_generico'), 'error');
    }
}

/** Native share or clipboard fallback for inviting to a group. */
async function shareGroupCode(groupName, code, event) {
    if (event) event.stopPropagation();
    const shareMsg = t('shared.share_text')
        .replace('{name}', groupName)
        .replace('{code}', code);

    if (navigator.share) {
        try {
            await navigator.share({
                title: `GidaPark - ${groupName}`,
                text: shareMsg
            });
            return;
        } catch (err) {
            if (err.name === 'AbortError') return;
        }
    }
    await copyGroupCode(code);
}

Object.assign(window, {
    showToast,
    showConfirm,
    escapeHtml,
    formatLocalYMD,
    parseLocalYMD,
    formatReadableDate,
    generateGroupCode,
    copyGroupCode,
    shareGroupCode
});
