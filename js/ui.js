function switchTab(t) {
    ['inicio', 'grupos', 'opciones'].forEach(id => {
        document.getElementById('tab-' + id).classList.add('hidden');
        document.getElementById('nav-' + id).classList.replace('text-indigo-500', 'text-slate-500');
        // Mostrar icono, ocultar texto
        document.getElementById('nav-' + id + '-icon').classList.remove('hidden');
        document.getElementById('nav-' + id + '-text').classList.add('hidden');
    });
    document.getElementById('tab-' + t).classList.remove('hidden');
    document.getElementById('nav-' + t).classList.replace('text-slate-500', 'text-indigo-500');
    // Ocultar icono, mostrar texto
    document.getElementById('nav-' + t + '-icon').classList.add('hidden');
    document.getElementById('nav-' + t + '-text').classList.remove('hidden');
    if (t === 'grupos') {
        hideGroupDetail();
        loadGroups();
    }
}

async function showGroupDetail(id, name) {
    currentGroupId = id;
    document.getElementById('view-groups-list').classList.add('hidden');
    document.getElementById('view-group-detail').classList.remove('hidden');
    document.getElementById('label-group-name').innerText = name;
    const { data } = await _supabase.schema('flexible_carpooling').from('flexible_members').select('*').eq('group_id', currentGroupId);
    groupMembers = data || [];
    refreshCalendar();
    renderMembersList();
}

function hideGroupDetail() {
    document.getElementById('view-groups-list').classList.remove('hidden');
    document.getElementById('view-group-detail').classList.add('hidden');
    document.getElementById('view-group-members').classList.add('hidden');
    selectedDate = null;
}

function showGroupMembers() {
    document.getElementById('view-group-detail').classList.add('hidden');
    document.getElementById('view-group-members').classList.remove('hidden');
}

function hideGroupMembers() {
    document.getElementById('view-group-detail').classList.remove('hidden');
    document.getElementById('view-group-members').classList.add('hidden');
}

function renderMembersList() {
    const container = document.getElementById('html-members-list');
    container.innerHTML = groupMembers.map(m => `
        <div class="p-4 card-dark rounded-2xl flex justify-between items-center shadow-md border-r-4 ${m.aporta_coche ? 'border-indigo-500' : 'border-slate-700'}">
            <div class="flex flex-col">
                <span class="font-black text-xs uppercase text-slate-200">${m.display_name || m.user_email.split('@')[0]}</span>
            </div>
            ${m.aporta_coche ? '<i class="fas fa-car text-indigo-500 text-xs" title="Aporta coche"></i>' : ''}
        </div>
    `).join('') || `<p class="text-slate-500 text-xs uppercase font-bold pt-4 text-center">${t('no_members')}</p>`;
}

function refreshCalendar(showNotification = false) {
    const monthYear = viewDate.toLocaleString(currentLang === 'eu' ? 'eu-ES' : 'es-ES', { month: 'long', year: 'numeric' });
    document.getElementById('calendar-month-title').innerText = monthYear;
    _supabase.schema('flexible_carpooling').from('flexible_trips').select('*').eq('group_id', currentGroupId).then(({ data }) => {
        allTrips = data || [];
        renderCalendarUI();
        if (selectedDate) renderTrips();
        if (showNotification) showToast(t('toast_calendar_refreshed'));
    });
}

function renderCalendarUI() {
    const container = document.getElementById('calendar-body');
    container.innerHTML = '';
    const year = viewDate.getFullYear(), month = viewDate.getMonth();
    const first = new Date(year, month, 1).getDay();
    const offset = (first === 0) ? 6 : first - 1;
    const daysArr = t('days');

    // Update day headers
    document.querySelector('.calendar-grid.text-\\[8px\\]').innerHTML = daysArr.slice(1).concat(daysArr[0]).map(d => `<div>${d}</div>`).join('');

    const days = new Date(year, month + 1, 0).getDate();
    const today = new Date(); today.setHours(0, 0, 0, 0);

    for (let i = 0; i < offset; i++) container.innerHTML += `<div></div>`;
    for (let d = 1; d <= days; d++) {
        const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayTrips = allTrips.filter(t => t.date === ds);
        const isDriving = dayTrips.some(t => t.real_driver_id === user.id);
        const isPast = new Date(year, month, d) < today;

        let statusClass = '';
        if (isDriving) statusClass = 'driving-day';
        else if (dayTrips.length > 0) statusClass = 'has-trips';

        container.innerHTML += `
            <div onclick="selectDay('${ds}', ${isPast})" class="day-cell ${statusClass} ${selectedDate === ds ? 'selected-day' : ''} ${isPast ? 'day-past' : ''}">
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
    const trips = allTrips
        .filter(t => t.date === selectedDate)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); // Mantener orden de creación
    const container = document.getElementById('list-trips-day');

    // Calcular estadísticas por combinatoria de pasajeros
    const combinatoriaStats = {};

    allTrips.forEach(t => {
        if (t.real_driver_id && t.passengers && t.passengers.length > 0) {
            // Crear clave única para esta combinación de pasajeros (ordenada)
            const comboKey = [...t.passengers].sort().join('|');

            // Inicializar si no existe
            if (!combinatoriaStats[comboKey]) {
                combinatoriaStats[comboKey] = {};
            }

            // Incrementar el contador del conductor en esta combinatoria
            // Los viajes "ida_vuelta" cuentan como 2 (ida + vuelta)
            const tripCount = t.type === 'ida_vuelta' ? 2 : 1;
            combinatoriaStats[comboKey][t.real_driver_id] =
                (combinatoriaStats[comboKey][t.real_driver_id] || 0) + tripCount;
        }
    });

    container.innerHTML = trips.map(trip => {
        const ps = trip.passengers || [];
        const isI = ps.includes(user.id);
        const paxDetails = ps.map(pid => groupMembers.find(m => m.user_id === pid));
        const candidates = paxDetails.filter(m => m?.aporta_coche);

        // Obtener estadísticas de ESTA combinatoria específica
        const comboKey = [...ps].sort().join('|');
        const comboStats = combinatoriaStats[comboKey] || {};

        let proposed = null;
        if (candidates.length > 0) {
            // Proponer al que menos ha conducido en ESTA combinación específica
            proposed = candidates.reduce((min, p) =>
                (comboStats[p.user_id] || 0) < (comboStats[min.user_id] || 0) ? p : min
            );
        }
        const propName = proposed ? (proposed.display_name || proposed.user_email.split('@')[0]) : '---';
        const real = groupMembers.find(m => m.user_id === trip.real_driver_id);
        const realName = real ? (real.display_name || real.user_email.split('@')[0]) : '---';

        const today = new Date(); today.setHours(0, 0, 0, 0);
        const tripDate = new Date(trip.date);
        const isPast = tripDate < today;

        const labelType = trip.type === 'ida_vuelta' ? t('type_ida_vuelta') : (trip.type === 'ida' ? t('type_ida') : t('type_vuelta'));

        return `
            <div class="card-dark p-6 rounded-[2rem] space-y-4 shadow-xl border border-slate-700 ${isPast ? 'opacity-75' : ''}">
                <div class="flex justify-between items-start">
                    <span class="text-[9px] font-black text-indigo-400 uppercase tracking-widest">${labelType}</span>
                    <div class="text-right text-[8px] font-bold text-slate-500 uppercase">
                        ${t('driving_proposed')}<span class="text-white">${propName}</span><br>
                        ${t('driving_real')}<span class="text-green-400 font-black">${realName}</span>
                    </div>
                </div>
                <div class="flex flex-wrap gap-2">
                    ${paxDetails.map(p => `
                        <div class="bg-slate-900 px-3 py-1 rounded-full text-[8px] font-bold ${p?.user_id === trip.real_driver_id ? 'border border-green-500 text-green-400' : 'text-slate-300 border border-slate-800'}">
                            ${p?.display_name || p?.user_email.split('@')[0]}
                        </div>`).join('')}
                </div>
                <select onchange="setRealDriver('${trip.id}', this.value)" 
                    ${isPast ? 'disabled' : ''}
                    class="w-full bg-slate-900 p-3 rounded-xl text-[10px] text-slate-300 border-none outline-none ${isPast ? 'cursor-not-allowed' : ''}">
                    <option value="">${t('who_drove')}</option>
                    ${candidates.map(d => `<option value="${d.user_id}" ${trip.real_driver_id === d.user_id ? 'selected' : ''}>${d.display_name || d.user_email.split('@')[0]}</option>`).join('')}
                </select>
                <button onclick="toggleTrip('${trip.id}', ${isI}, ${ps.length})" 
                    ${isPast ? 'disabled' : ''}
                    class="w-full ${isPast ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed' : (isI ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-indigo-600 text-white')} py-3 rounded-xl text-[10px] font-black uppercase">
                    ${isI ? t('btn_abandon') : t('btn_join_trip')}
                </button>
            </div>`;
    }).join('') || `<p class="text-slate-600 text-[10px] uppercase font-bold text-center py-4">${t('no_trips')}</p>`;
}

function changeMonth(delta) { viewDate.setMonth(viewDate.getMonth() + delta); refreshCalendar(); }
function openTripModal() { document.getElementById('modal-trip').classList.remove('hidden'); }
function closeTripModal() { document.getElementById('modal-trip').classList.add('hidden'); }
function openManageGroupsModal() {
    document.getElementById('modal-manage-groups').classList.remove('hidden');
    renderManageGroups();
}

function closeManageGroupsModal() {
    document.getElementById('modal-manage-groups').classList.add('hidden');
}

async function renderManageGroups() {
    // 1. Obtener los IDs de los grupos
    const { data: members, error: memberError } = await _supabase.schema('flexible_carpooling')
        .from('flexible_members')
        .select('group_id')
        .eq('user_id', user.id);

    if (memberError) return;

    const groupIds = [...new Set(members.map(m => m.group_id))];
    if (groupIds.length === 0) {
        document.getElementById('list-manage-groups').innerHTML = `<p class="text-slate-500 text-xs uppercase font-bold pt-4 text-center">${t('no_groups_manage')}</p>`;
        return;
    }

    // 2. Obtener detalles de los grupos
    const { data: unique, error: groupError } = await _supabase
        .from('groups')
        .select('id, name, code')
        .in('id', groupIds);

    if (groupError) return;

    container.innerHTML = (unique || []).map(g => `
        <div class="p-4 bg-slate-900 rounded-2xl flex justify-between items-center border border-slate-800">
            <div class="flex flex-col text-left">
                <span class="font-black text-[10px] uppercase italic text-slate-200">${g.name}</span>
                <span class="text-[8px] font-bold text-slate-500 tracking-widest mt-1">${g.code}</span>
            </div>
            <button onclick="leaveGroupConfirm('${g.id}', '${g.name}')" 
                class="bg-red-500/10 text-red-500 px-3 py-2 rounded-lg text-[9px] font-black uppercase border border-red-500/20">
                ${t('btn_leave')}
            </button>
        </div>
    `).join('') || `<p class="text-slate-500 text-xs uppercase font-bold pt-4 text-center">${t('no_groups_manage')}</p>`;
}

async function leaveGroupConfirm(groupId, name) {
    if (!await showConfirm(`${t('confirm_leave_group')}"${name}"?`)) return;

    // Limpiar viajes futuros antes de salir
    await cleanupFutureTrips(groupId);

    await _supabase.schema('flexible_carpooling').from('flexible_members').delete().eq('group_id', groupId).eq('user_id', user.id);
    showToast(`${t('toast_left_group')} "${name}"`);
    renderManageGroups(); // Actualizar lista en el modal
    loadGroups(); // Actualizar lista principal
}

async function logout() { await _supabase.auth.signOut(); location.reload(); }
