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
            if (id === tabName) {
                nav.classList.add('active', 'text-indigo-400');
                nav.classList.remove('text-slate-500');
            } else {
                nav.classList.remove('active', 'text-indigo-400');
                nav.classList.add('text-slate-500');
            }
        }
    });

    if (tabName === 'grupos') {
        if (typeof hideGroupDetail === 'function') hideGroupDetail();
        if (typeof loadAllGroups === 'function') loadAllGroups();
    } else if (tabName === 'inicio') {
        if (typeof loadTodayDashboard === 'function') loadTodayDashboard();
    }
}

let activeStartPanel = null;
function toggleStartActionPanel(panel, forceOpen = false) {
    const createPanel = document.getElementById('panel-create-group');
    const joinPanel = document.getElementById('panel-join-group');
    const createBtn = document.getElementById('btn-toggle-create-group');
    const joinBtn = document.getElementById('btn-toggle-join-group');

    if (!panel) {
        activeStartPanel = null;
    } else if (!forceOpen && activeStartPanel === panel) {
        activeStartPanel = null;
    } else {
        activeStartPanel = panel;
    }

    const showCreate = activeStartPanel === 'create';
    const showJoin = activeStartPanel === 'join';

    if (createPanel) createPanel.classList.toggle('hidden', !showCreate);
    if (joinPanel) joinPanel.classList.toggle('hidden', !showJoin);

    if (createBtn) {
        createBtn.classList.toggle('border-emerald-500', showCreate);
        createBtn.classList.toggle('bg-emerald-950/30', showCreate);
    }
    if (joinBtn) {
        joinBtn.classList.toggle('border-indigo-500', showJoin);
        joinBtn.classList.toggle('bg-indigo-950/30', showJoin);
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

function goToCurrentMonth() {
    const now = new Date();
    viewDate = new Date(now.getFullYear(), now.getMonth(), 1);
    if (currentGroupType === GROUP_TYPES.FLEXIBLE) {
        if (window.selectDay) selectDay(formatLocalYMD(now), false);
        if (window.refreshCalendar) refreshCalendar();
    } else if (currentGroupType === GROUP_TYPES.FIXED) {
        if (window.renderFixedCalendar) renderFixedCalendar();
    }
}

function showAuthScreen() {
    document.getElementById('loading-overlay').classList.add('hidden');
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('auth-screen').classList.add('flex');
}

function showRecoveryModal() {
    document.getElementById('loading-overlay').classList.add('hidden');
    document.getElementById('modal-new-password').classList.remove('hidden');
    document.getElementById('modal-new-password').classList.add('flex');
}

function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    const icon = btn?.querySelector('i');
    if (icon) {
        icon.classList.toggle('fa-eye', !isPass);
        icon.classList.toggle('fa-eye-slash', isPass);
    }
}

// Authentication
window.onload = async () => {
    applyTranslations();

    const hash = window.location.hash;
    const isRecoveryHash = hash && hash.includes('type=recovery');

    if (isRecoveryHash) {
        const { data: { subscription } } = _supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
                showRecoveryModal();
                history.replaceState(null, '', window.location.pathname);
                subscription.unsubscribe();
            }
        });

        const { data } = await _supabase.auth.getSession();
        if (data?.session) {
            showRecoveryModal();
            history.replaceState(null, '', window.location.pathname);
            subscription.unsubscribe();
            return;
        }

        setTimeout(() => {
            showRecoveryModal();
            history.replaceState(null, '', window.location.pathname);
            subscription.unsubscribe();
        }, 1500);
        return;
    }

    const { data } = await _supabase.auth.getSession();
    document.getElementById('loading-overlay').classList.add('hidden');

    if (data?.session) {
        user = data.session.user;
        currentUser = user;
        startApp();
    } else {
        showAuthScreen();
    }
};

function getAuthCredentials() {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    return { email, password };
}

function setAuthLoading(isLoading) {
    const btnLogin = document.getElementById('btn-login');
    const btnReg = document.getElementById('btn-register');
    if (btnLogin) {
        btnLogin.disabled = isLoading;
        btnLogin.classList.toggle('opacity-60', isLoading);
    }
    if (btnReg) {
        btnReg.disabled = isLoading;
        btnReg.classList.toggle('opacity-60', isLoading);
    }
}

async function handleLogin() {
    const { email, password } = getAuthCredentials();
    if (!email || !password) return showToast(t('shared.fill_fields'), 'error');

    setAuthLoading(true);
    try {
        const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
        if (error) return showToast(t('shared.login_error'), 'error');

        user = data.user;
        currentUser = user;
        startApp();
    } finally {
        setAuthLoading(false);
    }
}

document.getElementById('btn-login').onclick = handleLogin;

// Allow submitting login with Enter key
['email', 'password'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleLogin();
        });
    }
});

document.getElementById('btn-register').onclick = async () => {
    const { email, password } = getAuthCredentials();
    if (!email || !password) return showToast(t('shared.fill_fields'), 'error');
    if (password.length < 6) return showToast(t('shared.password_too_short'), 'error');

    setAuthLoading(true);
    try {
        const { data, error } = await _supabase.auth.signUp({ email, password });
        if (error) return showToast(error.message, 'error');

        if (data.session && data.user) {
            user = data.user;
            currentUser = user;
            showToast(t('shared.register_ok'), 'success');
            startApp();
        } else {
            showToast(t('shared.register_check_email'), 'info');
        }
    } finally {
        setAuthLoading(false);
    }
};

async function startApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('auth-screen').classList.remove('flex');
    document.getElementById('app-header')?.classList.remove('hidden');
    document.getElementById('app-content').classList.remove('hidden');
    document.getElementById('nav-bar').classList.remove('hidden');

    await loadUserData();
    applyTranslations();

    switchTab('inicio');
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
        setTimeout(async () => {
            await _supabase.auth.signOut();
            location.reload();
        }, 2500);
    }
}

// Global Escape key to close active modals + offline/online PWA notices
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;

    const confirmModal = document.getElementById('modal-confirm');
    if (confirmModal && !confirmModal.classList.contains('hidden')) {
        document.getElementById('confirm-cancel')?.click();
        return;
    }

    const fixedConfigModal = document.getElementById('modal-config-rutina');
    if (fixedConfigModal && !fixedConfigModal.classList.contains('hidden')) {
        if (typeof window.cancelarConfigRutina === 'function') window.cancelarConfigRutina();
        return;
    }

    const protectedIds = new Set(['loading-overlay', 'modal-new-password']);
    const openModals = Array.from(document.querySelectorAll('.fixed.inset-0:not(.hidden)'))
        .filter(m => !protectedIds.has(m.id));
    if (openModals.length > 0) {
        const topModal = openModals[openModals.length - 1];
        topModal.classList.add('hidden');
        topModal.classList.remove('flex');
    }
});

window.addEventListener('offline', () => {
    if (typeof showToast === 'function') showToast(t('shared.sin_conexion'), 'warning');
});

window.addEventListener('online', () => {
    if (typeof showToast === 'function') showToast(t('shared.conexion_recuperada'), 'success');
});

// Expose functions globally
Object.assign(window, {
    switchTab,
    toggleStartActionPanel,
    logout,
    changeMonth,
    goToCurrentMonth,
    togglePasswordVisibility,
    openForgotPassword,
    closeForgotPassword,
    sendResetEmail,
    updateNewPassword,
    selectTripType: (type, event) => {
        selectedTripType = type;
        const container = event.target.closest('.grid');
        container?.querySelectorAll('.btn-selector').forEach(btn => btn.classList.remove('active'));
        event.target.closest('.btn-selector')?.classList.add('active');
    },
    selectTripRepeat: (weeks, event) => {
        selectedTripRepeat = weeks;
        const container = event.target.closest('.grid');
        container?.querySelectorAll('.btn-selector').forEach(btn => btn.classList.remove('active'));
        event.target.closest('.btn-selector')?.classList.add('active');
    }
});
