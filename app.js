const SUPABASE_URL = 'https://bfvdolcbtncxnspxgfcq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmdmRvbGNidG5jeG5zcHhnZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5NzY3NTEsImV4cCI6MjA4MzU1Mjc1MX0.dB8GBmomyk5s19CBXfB2TKjt3tKokAZ6HcqV8l29lQQ';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let user = null, currentGroupId = null, selectedDate = null, allTrips = [], groupMembers = [], viewDate = new Date();
viewDate.setDate(1);

// Registro de PWA Service Worker
if ('serviceWorker' in navigator) {
   window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}

// Exponer funciones al window
const fns = { switchTab, createGroup, joinGroup, showGroupDetail, hideGroupDetail, selectDay, toggleTrip, openTripModal, closeTripModal, confirmTripCreation, updateCarStatus, logout, changeMonth, updateProfileName, setRealDriver, deleteAccount };
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
   if(!email || !password) return alert("Rellena los campos");
   
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

function switchTab(t) {
   ['inicio', 'grupos', 'opciones'].forEach(id => {
       document.getElementById('tab-'+id).classList.add('hidden');
       document.getElementById('nav-'+id).classList.replace('text-indigo-500', 'text-slate-500');
   });
   document.getElementById('tab-'+t).classList.remove('hidden');
   document.getElementById('nav-'+t).classList.replace('text-slate-500', 'text-indigo-500');
   if(t === 'grupos') { hideGroupDetail(); loadGroups(); }
}

async function updateProfileName() {
   const name = document.getElementById('user-display-name').value;
   if(!name) return;
   await _supabase.from('group_members').update({ display_name: name }).eq('user_id', user.id);
   showToast("Nombre guardado");
}

function showToast(msg) {
   const t = document.createElement('div');
   t.className = "toast-confirm";
   t.innerText = msg;
   document.body.appendChild(t);
   setTimeout(() => t.remove(), 2000);
}

async function confirmTripCreation() {
   const type = document.getElementById('trip-type').value;
   const repeat = parseInt(document.getElementById('trip-repeat').value);
   let tripDates = [selectedDate];
   for (let i = 1; i <= repeat; i++) {
       let d = new Date(selectedDate);
       d.setDate(d.getDate() + (i * 7));
       tripDates.push(d.toISOString().split('T')[0]);
   }
   await _supabase.from('trips').insert(tripDates.map(date => ({
       group_id: currentGroupId, date, passengers: [user.id], type
   })));
   closeTripModal();
   refreshCalendar();
}

async function loadGroups() {
   const { data } = await _supabase.from('group_members').select('groups(id, name)').eq('user_id', user.id);
   document.getElementById('html-groups-list').innerHTML = (data || []).map(g => `
       <div onclick="showGroupDetail('${g.groups.id}', '${g.groups.name}')" class="p-6 card-dark rounded-3xl flex justify-between items-center cursor-pointer border-l-8 border-indigo-600 shadow-md">
           <span class="font-black text-sm uppercase italic text-slate-200">${g.groups.name}</span>
           <i class="fas fa-chevron-right text-slate-700"></i>
       </div>
   `).join('') || '<p class="text-slate-500 text-xs uppercase font-bold pt-4">No tienes grupos todavía</p>';
}

async function showGroupDetail(id, name) {
   currentGroupId = id;
   document.getElementById('view-groups-list').classList.add('hidden');
   document.getElementById('view-group-detail').classList.remove('hidden');
   document.getElementById('label-group-name').innerText = name;
   const { data } = await _supabase.from('group_members').select('*').eq('group_id', currentGroupId);
   groupMembers = data || [];
   refreshCalendar();
}

function hideGroupDetail() {
   document.getElementById('view-groups-list').classList.remove('hidden');
   document.getElementById('view-group-detail').classList.add('hidden');
   selectedDate = null;
}

function refreshCalendar() {
   document.getElementById('calendar-month-title').innerText = viewDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
   _supabase.from('trips').select('*').eq('group_id', currentGroupId).then(({ data }) => {
       allTrips = data || [];
       renderCalendarUI();
       if(selectedDate) renderTrips();
   });
}

function renderCalendarUI() {
   const container = document.getElementById('calendar-body');
   container.innerHTML = '';
   const year = viewDate.getFullYear(), month = viewDate.getMonth();
   const first = new Date(year, month, 1).getDay();
   const offset = (first === 0) ? 6 : first - 1;
   const days = new Date(year, month + 1, 0).getDate();
   const today = new Date(); today.setHours(0,0,0,0);
   
   for (let i = 0; i < offset; i++) container.innerHTML += `<div></div>`;
   for(let d=1; d<=days; d++) {
       const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
       const dayTrips = allTrips.filter(t => t.date === ds);
       const isDriving = dayTrips.some(t => t.real_driver_id === user.id);
       const isPast = new Date(year, month, d) < today;
       
       let statusClass = '';
       if (isDriving) statusClass = 'driving-day';
       else if (dayTrips.length > 0) statusClass = 'has-trips';

       container.innerHTML += `
           <div onclick="selectDay('${ds}', ${isPast})" class="day-cell ${statusClass} ${selectedDate===ds?'selected-day':''} ${isPast?'day-past':''}">
               <b>${d}</b>
           </div>`;
   }
}

function selectDay(date, isPast) {
   selectedDate = date;
   document.getElementById('selected-date-text').innerText = date;
   document.getElementById('btn-add-trip').classList.toggle('hidden', isPast);
   renderCalendarUI();
   renderTrips();
}

async function renderTrips() {
   const trips = allTrips.filter(t => t.date === selectedDate);
   const container = document.getElementById('list-trips-day');
   const stats = {};
   allTrips.forEach(t => { if(t.real_driver_id) stats[t.real_driver_id] = (stats[t.real_driver_id] || 0) + 1; });

   container.innerHTML = trips.map(t => {
       const ps = t.passengers || [];
       const isI = ps.includes(user.id);
       const paxDetails = ps.map(pid => groupMembers.find(m => m.user_id === pid));
       const candidates = paxDetails.filter(m => m?.aporta_coche);
       
       let proposed = null;
       if (candidates.length > 0) {
           proposed = candidates.reduce((min, p) => (stats[p.user_id]||0) < (stats[min.user_id]||0) ? p : min);
       }
       const propName = proposed ? (proposed.display_name || proposed.user_email.split('@')[0]) : '---';
       const real = groupMembers.find(m => m.user_id === t.real_driver_id);
       const realName = real ? (real.display_name || real.user_email.split('@')[0]) : '---';

       return `
           <div class="card-dark p-6 rounded-[2rem] space-y-4 shadow-xl border border-slate-700">
               <div class="flex justify-between items-start">
                   <span class="text-[9px] font-black text-indigo-400 uppercase tracking-widest">${t.type?.toUpperCase()}</span>
                   <div class="text-right text-[8px] font-bold text-slate-500 uppercase">
                       Sugerido: <span class="text-white">${propName}</span><br>
                       Real: <span class="text-green-400 font-black">${realName}</span>
                   </div>
               </div>
               <div class="flex flex-wrap gap-2">
                   ${paxDetails.map(p => `<div class="bg-slate-900 px-3 py-1 rounded-full text-[8px] font-bold ${p?.user_id === t.real_driver_id ? 'border border-green-500 text-green-400' : 'text-slate-300 border border-slate-800'}">${p?.display_name || p?.user_email.split('@')[0]} (${stats[p?.user_id]||0})</div>`).join('')}
               </div>
               <select onchange="setRealDriver('${t.id}', this.value)" class="w-full bg-slate-900 p-3 rounded-xl text-[10px] text-slate-300 border-none outline-none">
                   <option value="">¿Quién condujo?</option>
                   ${candidates.map(d => `<option value="${d.user_id}" ${t.real_driver_id === d.user_id ? 'selected' : ''}>${d.display_name || d.user_email.split('@')[0]}</option>`).join('')}
               </select>
               <button onclick="toggleTrip('${t.id}', ${isI}, ${ps.length})" class="w-full ${isI?'bg-red-500/10 text-red-400 border border-red-500/20':'bg-indigo-600 text-white'} py-3 rounded-xl text-[10px] font-black uppercase">
                   ${isI ? 'Abandonar' : 'Apuntarse'}
               </button>
           </div>`;
   }).join('') || '<p class="text-slate-600 text-[10px] uppercase font-bold text-center py-4">No hay viajes este día</p>';
}

async function setRealDriver(tripId, driverId) {
   await _supabase.from('trips').update({ real_driver_id: driverId || null }).eq('id', tripId);
   refreshCalendar();
}

async function toggleTrip(id, isI, count) {
   let trip = allTrips.find(x => x.id === id);
   if (isI && count === 1) await _supabase.from('trips').delete().eq('id', id);
   else {
       let p = isI ? trip.passengers.filter(u => u !== user.id) : [...trip.passengers, user.id];
       await _supabase.from('trips').update({ passengers: p }).eq('id', id);
   }
   refreshCalendar();
}

async function loadUserData() {
   const { data } = await _supabase.from('group_members').select('aporta_coche, display_name').eq('user_id', user.id).limit(1).single();
   if (data) {
       document.getElementById('user-has-car').checked = data.aporta_coche;
       document.getElementById('user-display-name').value = data.display_name || '';
   }
}

async function updateCarStatus() {
   await _supabase.from('group_members').update({ aporta_coche: document.getElementById('user-has-car').checked }).eq('user_id', user.id);
}

async function createGroup() {
   const name = document.getElementById('new-group-name').value; if(!name) return;
   const code = Math.random().toString(36).substring(2,8).toUpperCase();
   const { data: g } = await _supabase.from('groups').insert([{ name, invite_code: code, admin_id: user.id }]).select().single();
   await _supabase.from('group_members').insert([{ group_id: g.id, user_id: user.id, user_email: user.email, aporta_coche: true }]);
   alert("Código: " + code);
   switchTab('grupos');
}

async function joinGroup() {
   const code = document.getElementById('join-code').value.toUpperCase();
   const { data: g } = await _supabase.from('groups').select('id').eq('invite_code', code).single();
   if(!g) return alert("Código no válido");
   await _supabase.from('group_members').insert([{ group_id: g.id, user_id: user.id, user_email: user.email, aporta_coche: true }]);
   switchTab('grupos');
}

async function deleteAccount() {
   if(!confirm("¿Borrar cuenta?")) return;
   await _supabase.from('group_members').delete().eq('user_id', user.id);
   await _supabase.auth.signOut();
   location.reload();
}

function changeMonth(delta) { viewDate.setMonth(viewDate.getMonth() + delta); refreshCalendar(); }
function openTripModal() { document.getElementById('modal-trip').classList.remove('hidden'); }
function closeTripModal() { document.getElementById('modal-trip').classList.add('hidden'); }
async function logout() { await _supabase.auth.signOut(); location.reload(); }
