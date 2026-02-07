let user = null, currentGroupId = null, selectedDate = null, allTrips = [], groupMembers = [], viewDate = new Date();
viewDate.setDate(1);

// Variables para selección de viaje
let selectedTripType = 'ida_vuelta';
let selectedTripRepeat = 0;

// Funciones para selección de botones
function selectTripType(type, event) {
   selectedTripType = type;
   event.target.parentElement.querySelectorAll('.btn-selector').forEach(btn => btn.classList.remove('active'));
   event.target.classList.add('active');
}

function selectTripRepeat(weeks, event) {
   selectedTripRepeat = weeks;
   event.target.parentElement.querySelectorAll('.btn-selector').forEach(btn => btn.classList.remove('active'));
   event.target.classList.add('active');
}

// Registro de PWA Service Worker
if ('serviceWorker' in navigator) {
   window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { }); });
}

// Exponer funciones al window
const fns = {
   switchTab, createGroup, joinGroup, showGroupDetail, hideGroupDetail,
   selectDay, toggleTrip, openTripModal, closeTripModal, confirmTripCreation,
   updateCarStatus, logout, changeMonth, updateProfileName, setRealDriver,
   selectTripType, selectTripRepeat, openManageGroupsModal, closeManageGroupsModal, leaveGroupConfirm,
   showGroupMembers, hideGroupMembers
};
Object.assign(window, fns);

window.onload = async () => {
   const { data } = await _supabase.auth.getSession();
   document.getElementById('loading-overlay').classList.add('hidden'); // Quitar carga

   if (data?.session) {
      user = data.session.user;
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
   } else { user = data.user; }
   startApp();
};

function startApp() {
   document.getElementById('auth-screen').classList.add('hidden');
   document.getElementById('auth-screen').classList.remove('flex');
   document.getElementById('app-content').classList.remove('hidden');
   document.getElementById('nav-bar').classList.remove('hidden');
   loadUserData();
   switchTab('inicio');
}
