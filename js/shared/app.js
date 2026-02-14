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

function startApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('auth-screen').classList.remove('flex');
    document.getElementById('app-content').classList.remove('hidden');
    document.getElementById('nav-bar').classList.remove('hidden');
    loadUserData();
    applyTranslations();
    switchTab('inicio');
}

function logout() {
    _supabase.auth.signOut().then(() => location.reload());
}

// Expose functions globally
Object.assign(window, {
    // Navigation
    switchTab,
    logout,
    changeMonth, // Unified changeMonth
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
