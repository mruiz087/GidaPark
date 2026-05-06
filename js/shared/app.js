// Main app initialization and state management

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { }); });
}

// Navigation
function switchTab(tabName) {
    ['inicio', 'grupos', 'opciones'].forEach(id => {
        const tab = document.getElementById('tab-' + id);
        const nav = document.getElementById('nav-' + id);
        if (tab) tab.classList.toggle('hidden', id !== tabName);
        if (nav) {
            const icon = document.getElementById('nav-' + id + '-icon');
            const text = document.getElementById('nav-' + id + '-text');
            if (id === tabName) {
                nav.classList.remove('text-slate-500');
                nav.classList.add('text-indigo-500');
                if (icon) icon.classList.add('hidden');
                if (text) text.classList.remove('hidden');
            } else {
                nav.classList.add('text-slate-500');
                nav.classList.remove('text-indigo-500');
                if (icon) icon.classList.remove('hidden');
                if (text) text.classList.add('hidden');
            }
        }
    });

    if (tabName === 'grupos') {
        hideGroupDetail();
        loadAllGroups();
    }
}

function changeMonth(delta) {
    viewDate.setMonth(viewDate.getMonth() + delta);
    if (currentGroupType === GROUP_TYPES.FLEXIBLE) {
        if (window.refreshCalendar) refreshCalendar();
    } else if (currentGroupType === GROUP_TYPES.FIXED) {
        if (window.renderFixedCalendar) renderFixedCalendar();
    }
}

// Authentication
window.onload = async () => {
    // Detect password recovery token in URL (Supabase sends #access_token=...&type=recovery)
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
        // Let Supabase process the token from the URL
        const { data, error } = await _supabase.auth.getSession();
        document.getElementById('loading-overlay').classList.add('hidden');
        // Show the new password modal directly
        document.getElementById('modal-new-password').classList.remove('hidden');
        document.getElementById('modal-new-password').classList.add('flex');
        // Clean URL so the token isn't re-used on refresh
        history.replaceState(null, '', window.location.pathname);
        return;
    }

    const { data } = await _supabase.auth.getSession();
    document.getElementById('loading-overlay').classList.add('hidden');

    if (data?.session) {
        user = data.session.user;
        currentUser = user; // For fixed modules
        startApp();
    } else {
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('auth-screen').classList.add('flex');
    }
};

document.getElementById('btn-login').onclick = async () => {
    const email = document.getElementById('email').value, password = document.getElementById('password').value;
    if (!email || !password) return alert("Rellena los campos");

    const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
    if (error) {
        const s = await _supabase.auth.signUp({ email, password });
        if (s.error) return alert(s.error.message);
        user = s.data.user;
        currentUser = user;
    } else {
        user = data.user;
        currentUser = user;
    }
    startApp();
};

async function startApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('auth-screen').classList.remove('flex');
    document.getElementById('app-content').classList.remove('hidden');
    document.getElementById('nav-bar').classList.remove('hidden');
    loadUserData();
    applyTranslations();

    // Check if user has groups to decide initial tab
    const groupIds = await getUserGroupIds();
    if (groupIds.length > 0) {
        switchTab('grupos');
    } else {
        switchTab('inicio');
    }
}

function logout() {
    _supabase.auth.signOut().then(() => location.reload());
}

// ====== PASSWORD RECOVERY ======

function openForgotPassword() {
    const modal = document.getElementById('modal-forgot-password');
    document.getElementById('reset-email').value = document.getElementById('email')?.value || '';
    document.getElementById('forgot-feedback').classList.add('hidden');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeForgotPassword() {
    const modal = document.getElementById('modal-forgot-password');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

async function sendResetEmail() {
    const email = document.getElementById('reset-email').value.trim();
    const feedback = document.getElementById('forgot-feedback');
    const btn = document.getElementById('btn-send-reset');

    if (!email) return;

    btn.disabled = true;
    btn.textContent = '...';
    feedback.classList.add('hidden');

    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await _supabase.auth.resetPasswordForEmail(email, { redirectTo });

    btn.disabled = false;
    btn.textContent = t('shared.send_reset_email');
    feedback.classList.remove('hidden');

    if (error) {
        feedback.textContent = t('shared.reset_email_error');
        feedback.className = 'text-xs text-center font-bold rounded-xl py-2 px-3 bg-red-500/10 text-red-400';
    } else {
        feedback.textContent = t('shared.reset_email_sent');
        feedback.className = 'text-xs text-center font-bold rounded-xl py-2 px-3 bg-green-500/10 text-green-400';
        // Auto-close after 4 seconds
        setTimeout(() => closeForgotPassword(), 4000);
    }
}

async function updateNewPassword() {
    const newPass = document.getElementById('new-password-input').value;
    const confirmPass = document.getElementById('confirm-password-input').value;
    const feedback = document.getElementById('new-password-feedback');
    const btn = document.getElementById('btn-update-password');

    feedback.classList.remove('hidden');

    if (newPass.length < 6) {
        feedback.textContent = t('shared.password_too_short');
        feedback.className = 'text-xs text-center font-bold rounded-xl py-2 px-3 bg-red-500/10 text-red-400';
        return;
    }
    if (newPass !== confirmPass) {
        feedback.textContent = t('shared.password_mismatch');
        feedback.className = 'text-xs text-center font-bold rounded-xl py-2 px-3 bg-red-500/10 text-red-400';
        return;
    }

    btn.disabled = true;
    btn.textContent = '...';

    const { error } = await _supabase.auth.updateUser({ password: newPass });

    btn.disabled = false;
    btn.textContent = t('shared.update_password');

    if (error) {
        feedback.textContent = t('shared.password_update_error');
        feedback.className = 'text-xs text-center font-bold rounded-xl py-2 px-3 bg-red-500/10 text-red-400';
    } else {
        feedback.textContent = t('shared.password_updated');
        feedback.className = 'text-xs text-center font-bold rounded-xl py-2 px-3 bg-green-500/10 text-green-400';
        // Sign out and reload to show login screen cleanly
        setTimeout(async () => {
            await _supabase.auth.signOut();
            location.reload();
        }, 2500);
    }
}

// Expose functions globally
Object.assign(window, {
    // Navigation
    switchTab,
    logout,
    changeMonth, // Unified changeMonth
    // Password recovery
    openForgotPassword,
    closeForgotPassword,
    sendResetEmail,
    updateNewPassword,
    // Flexible trip selectors
    selectTripType: (type, event) => {
        selectedTripType = type;
        event.target.parentElement.querySelectorAll('.btn-selector').forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');
    },
    selectTripRepeat: (weeks, event) => {
        selectedTripRepeat = weeks;
        event.target.parentElement.querySelectorAll('.btn-selector').forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');
    },
});
