// ========== FLEXIBLE CARPOOLING UI ==========

function hideGroupDetail() {
    document.getElementById('view-groups-list').classList.remove('hidden');

    const views = [
        'view-group-detail',
        'view-group-detail-fixed',
        'view-group-detail-parking',
        'view-group-members'
    ];

    views.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    selectedDate = null;
    if (typeof loadAllGroups === 'function') {
        loadAllGroups();
    }
}

function showGroupMembers() {
    document.getElementById('view-group-detail').classList.add('hidden');
    document.getElementById('view-group-members').classList.remove('hidden');
    renderMembersList();
}

function hideGroupMembers() {
    document.getElementById('view-group-detail').classList.remove('hidden');
    document.getElementById('view-group-members').classList.add('hidden');
}

function renderMembersList() {
    const container = document.getElementById('html-members-list');
    if (!container) return;

    container.innerHTML = groupMembers.map(m => {
        const hasCar = m.aporta_coche || false;
        const name = m.display_name || m.user_email?.split('@')[0] || 'Usuario';
        const isMe = m.user_id === user?.id;

        return `
            <div class="p-4 card-dark rounded-2xl flex justify-between items-center shadow-md border-r-4 ${hasCar ? 'border-indigo-500' : 'border-slate-700'}">
                <div class="flex flex-col">
                    <span class="font-black text-xs uppercase text-slate-200">${escapeHtml(name)} ${isMe ? `<span class="text-[9px] text-indigo-400">(${t('shared.tu')})</span>` : ''}</span>
                    ${hasCar ? `<span class="text-[8px] font-bold text-indigo-400 uppercase mt-1 italic"><i class="fas fa-car mr-1"></i> ${t('flexible.aporto_coche')}</span>` : ''}
                </div>
                ${hasCar
                    ? '<div class="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center"><i class="fas fa-car text-indigo-400 text-xs"></i></div>'
                    : '<div class="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center"><i class="fas fa-user text-slate-600 text-xs"></i></div>'}
            </div>
        `;
    }).join('') || `<p class="text-slate-500 text-xs uppercase font-bold pt-4 text-center">${t('shared.no_miembros')}</p>`;
}

function refreshCalendar(showNotification = false) {
    const monthYear = viewDate.toLocaleString(currentLang === 'eu' ? 'eu-ES' : 'es-ES', { month: 'long', year: 'numeric' });
    const now = new Date();
    const isCurrentMonth = viewDate.getFullYear() === now.getFullYear() && viewDate.getMonth() === now.getMonth();

    const titleEl = document.getElementById('calendar-month-title');
    if (titleEl) {
        titleEl.innerText = monthYear;
        titleEl.classList.toggle('text-indigo-300', isCurrentMonth);
        titleEl.classList.toggle('text-white', !isCurrentMonth);
    }
    const badgeEl = document.getElementById('flex-current-period-badge');
    if (badgeEl) {
        badgeEl.classList.toggle('hidden', !isCurrentMonth);
    }
    const goTodayBtn = document.getElementById('flex-btn-go-today');
    if (goTodayBtn) {
        goTodayBtn.classList.toggle('hidden', isCurrentMonth);
    }

    _supabase.schema('flexible_carpooling').from('flexible_trips').select('*').eq('group_id', currentGroupId).then(({ data }) => {
        allTrips = data || [];
        renderCalendarUI();
        if (selectedDate) renderTrips();
        if (showNotification) showToast(t('flexible.toast_calendar_refreshed'), 'info');
    });
}

function renderCalendarUI() {
    const container = document.getElementById('calendar-body');
    if (!container) return;
    container.innerHTML = '';

    const year = viewDate.getFullYear(), month = viewDate.getMonth();
    const first = new Date(year, month, 1).getDay();
    const offset = (first === 0) ? 6 : first - 1;
    const daysArr = t('days');

    const headerGrid = document.getElementById('flex-calendar-weekdays');
    if (headerGrid && Array.isArray(daysArr)) {
        headerGrid.innerHTML = daysArr.slice(1).concat(daysArr[0]).map(d => `<div>${d}</div>`).join('');
    }

    const days = new Date(year, month + 1, 0).getDate();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayLocal = formatLocalYMD(today);

    for (let i = 0; i < offset; i++) container.innerHTML += `<div></div>`;
    for (let d = 1; d <= days; d++) {
        const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayTrips = allTrips.filter(t => t.date === ds);
        const isDriving = dayTrips.some(t => t.real_driver_id === user.id);
        const isPast = new Date(year, month, d) < today;
        const isToday = ds === todayLocal;

        let statusClass = '';
        if (isDriving) statusClass = 'driving-day';
        else if (dayTrips.length > 0) statusClass = 'has-trips';

        const tripBadge = dayTrips.length > 0
            ? `<span class="flex items-center gap-0.5 text-[7px] font-black leading-none mt-0.5 ${isDriving ? 'text-emerald-300' : 'text-indigo-300'}"><i class="fas fa-car text-[6px]"></i>${dayTrips.length > 1 ? dayTrips.length : ''}</span>`
            : '';

        container.innerHTML += `
            <div onclick="selectDay('${ds}', ${isPast})" class="day-cell flex-col relative ${statusClass} ${selectedDate === ds ? 'selected-day' : ''} ${isToday ? 'today' : ''} ${isPast ? 'day-past' : ''}">
                <b>${d}</b>
                ${tripBadge}
            </div>`;
    }
}

function selectDay(date, isPast) {
    selectedDate = date;
    const dateTitleEl = document.getElementById('selected-date-text');
    if (dateTitleEl) {
        dateTitleEl.innerText = formatReadableDate(date, currentLang);
    }
    document.getElementById('btn-add-trip')?.classList.toggle('hidden', isPast);
    renderCalendarUI();
    renderTrips();
}

async function renderTrips() {
    const trips = allTrips
        .filter(t => t.date === selectedDate)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const container = document.getElementById('list-trips-day');
    if (!container) return;

    const combinatoriaStats = {};
    allTrips.forEach(t => {
        if (t.real_driver_id && t.passengers && t.passengers.length > 0) {
            const comboKey = [...t.passengers].sort().join('|');
            if (!combinatoriaStats[comboKey]) combinatoriaStats[comboKey] = {};
            const tripCount = t.type === 'ida_vuelta' ? 2 : 1;
            combinatoriaStats[comboKey][t.real_driver_id] =
                (combinatoriaStats[comboKey][t.real_driver_id] || 0) + tripCount;
        }
    });

    const today = new Date(); today.setHours(0, 0, 0, 0);

    container.innerHTML = trips.map(trip => {
        const ps = trip.passengers || [];
        const isI = ps.includes(user.id);
        const paxDetails = ps.map(pid => groupMembers.find(m => m.user_id === pid));
        const candidates = paxDetails.filter(m => m?.aporta_coche);

        const comboKey = [...ps].sort().join('|');
        const comboStats = combinatoriaStats[comboKey] || {};

        let proposed = null;
        if (candidates.length > 0) {
            proposed = candidates.reduce((min, p) =>
                (comboStats[p.user_id] || 0) < (comboStats[min.user_id] || 0) ? p : min
            );
        }
        const propName = proposed ? (proposed.display_name || proposed.user_email.split('@')[0]) : '---';
        const real = groupMembers.find(m => m.user_id === trip.real_driver_id);
        const realName = real ? (real.display_name || real.user_email.split('@')[0]) : '---';

        const tripDate = parseLocalYMD(trip.date);
        const isPast = tripDate < today;

        const labelType = trip.type === 'ida_vuelta'
            ? t('flexible.tipo_ida_vuelta')
            : (trip.type === 'ida' ? t('flexible.tipo_ida') : t('flexible.tipo_vuelta'));

        return `
            <div class="card-dark p-5 rounded-[1.75rem] space-y-4 shadow-xl border border-slate-700/80 ${isPast ? 'opacity-75' : ''}">
                <div class="flex justify-between items-start gap-2">
                    <div class="flex items-center gap-2">
                        <span class="px-2.5 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-[9px] font-black text-indigo-300 uppercase tracking-wider">${labelType}</span>
                        <span class="text-[10px] font-bold text-slate-400"><i class="fas fa-users mr-1"></i>${ps.length}</span>
                    </div>
                    <div class="text-right text-[9px] font-bold text-slate-400 uppercase leading-tight">
                        <div>${t('flexible.conductor_sugerido')}: <span class="text-white">${escapeHtml(propName)}</span></div>
                        <div>${t('flexible.conductor_real')}: <span class="text-emerald-400 font-black">${escapeHtml(realName)}</span></div>
                    </div>
                </div>
                <div class="flex flex-wrap gap-1.5">
                    ${paxDetails.map(p => `
                        <div class="bg-slate-900/90 px-3 py-1 rounded-full text-[10px] font-bold ${p?.user_id === trip.real_driver_id ? 'border border-emerald-500 text-emerald-400' : 'text-slate-300 border border-slate-800'}">
                            ${p?.user_id === trip.real_driver_id ? '<i class="fas fa-car mr-1 text-[9px]"></i>' : ''}${escapeHtml(p?.display_name || p?.user_email?.split('@')[0] || '')}
                        </div>`).join('')}
                </div>
                <select onchange="setRealDriver('${trip.id}', this.value)"
                    ${isPast ? 'disabled' : ''}
                    class="w-full bg-slate-900 p-3 rounded-xl text-xs text-slate-200 border border-slate-800 outline-none ${isPast ? 'cursor-not-allowed' : ''}">
                    <option value="">${t('flexible.quien_condujo')}</option>
                    ${candidates.map(d => `<option value="${escapeHtml(d.user_id)}" ${trip.real_driver_id === d.user_id ? 'selected' : ''}>${escapeHtml(d.display_name || d.user_email.split('@')[0])}</option>`).join('')}
                </select>
                <button onclick="toggleTrip('${trip.id}', ${isI}, ${ps.length})"
                    ${isPast ? 'disabled' : ''}
                    class="w-full ${isPast ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed' : (isI ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20' : 'bg-indigo-600 text-white hover:bg-indigo-500')} py-3 rounded-xl text-[10px] font-black uppercase transition-all">
                    ${isI ? t('flexible.abandonar_viaje') : t('flexible.unirse_viaje')}
                </button>
            </div>`;
    }).join('') || `<p class="text-slate-500 text-[10px] uppercase font-bold text-center py-6">${t('flexible.no_viajes')}</p>`;
}

function openFlexibleStatsModal() {
    const modal = document.getElementById('modal-flexible-stats');
    const container = document.getElementById('flexible-stats-content');
    if (!modal || !container) return;

    const totalByDriver = {};
    const comboStats = {};

    allTrips.forEach(tr => {
        if (!tr.real_driver_id) return;
        const weight = tr.type === 'ida_vuelta' ? 2 : 1;
        totalByDriver[tr.real_driver_id] = (totalByDriver[tr.real_driver_id] || 0) + weight;

        if (Array.isArray(tr.passengers) && tr.passengers.length > 0) {
            const comboKey = [...tr.passengers].sort().join('|');
            if (!comboStats[comboKey]) comboStats[comboKey] = {};
            comboStats[comboKey][tr.real_driver_id] = (comboStats[comboKey][tr.real_driver_id] || 0) + weight;
        }
    });

    const entries = groupMembers
        .filter(m => m.aporta_coche || totalByDriver[m.user_id])
        .map(m => ({
            member: m,
            count: totalByDriver[m.user_id] || 0
        }))
        .sort((a, b) => b.count - a.count);

    const maxCount = Math.max(1, ...entries.map(e => e.count));

    if (entries.length === 0 || Object.keys(totalByDriver).length === 0) {
        container.innerHTML = `<p class="text-slate-400 text-xs text-center py-6 font-bold">${t('flexible.sin_estadisticas')}</p>`;
    } else {
        let html = `<div class="space-y-2.5">`;
        html += entries.map(({ member, count }) => {
            const pct = Math.round((count / maxCount) * 100);
            const name = member.display_name || member.user_email?.split('@')[0] || 'Usuario';
            const isMe = member.user_id === user?.id;
            return `
                <div class="bg-slate-900/70 border border-slate-800 p-3 rounded-xl space-y-1.5">
                    <div class="flex justify-between items-center text-xs">
                        <span class="font-bold text-slate-200">${escapeHtml(name)} ${isMe ? `<span class="text-[9px] text-indigo-400">(${t('shared.tu')})</span>` : ''}</span>
                        <span class="font-black text-emerald-400">${count} <span class="text-[9px] font-bold text-slate-500 uppercase">${t('flexible.viajes_conducidos')}</span></span>
                    </div>
                    <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div class="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all" style="width: ${pct}%"></div>
                    </div>
                </div>
            `;
        }).join('');
        html += `</div>`;

        const comboKeys = Object.keys(comboStats);
        if (comboKeys.length > 0) {
            html += `<div class="pt-3 border-t border-slate-800 space-y-2">
                <p class="text-[10px] font-black uppercase text-slate-400 tracking-wider">${t('flexible.por_combinacion')}</p>`;
            html += comboKeys.map(key => {
                const pids = key.split('|');
                const names = pids.map(pid => {
                    const m = groupMembers.find(x => x.user_id === pid);
                    return escapeHtml(m?.display_name || m?.user_email?.split('@')[0] || '?');
                }).join(' + ');

                const countsHtml = pids
                    .filter(pid => comboStats[key][pid])
                    .map(pid => {
                        const m = groupMembers.find(x => x.user_id === pid);
                        const n = escapeHtml(m?.display_name || m?.user_email?.split('@')[0] || '?');
                        return `<span class="inline-flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded-lg text-[10px] text-slate-200">${n}: <strong class="text-emerald-400">${comboStats[key][pid]}</strong></span>`;
                    }).join(' ');

                return `
                    <div class="bg-slate-900/40 border border-slate-800/80 p-3 rounded-xl space-y-1.5">
                        <p class="text-[10px] font-bold text-indigo-300">${names}</p>
                        <div class="flex flex-wrap gap-1.5">${countsHtml}</div>
                    </div>
                `;
            }).join('');
            html += `</div>`;
        }

        container.innerHTML = html;
    }

    modal.classList.remove('hidden');
}

function closeFlexibleStatsModal() {
    document.getElementById('modal-flexible-stats')?.classList.add('hidden');
}

function openTripModal() { document.getElementById('modal-trip').classList.remove('hidden'); }
function closeTripModal() { document.getElementById('modal-trip').classList.add('hidden'); }
function openManageGroupsModal() {
    document.getElementById('modal-manage-groups').classList.remove('hidden');
    renderManageGroups();
}

async function updateGroupCarStatus(event) {
    const hasCar = event.target.checked;
    if (!currentGroupId || !user) return;

    try {
        const { error } = await _supabase.schema('flexible_carpooling').from('flexible_members')
            .update({ aporta_coche: hasCar })
            .eq('user_id', user.id)
            .eq('group_id', currentGroupId);

        if (error) throw error;

        const me = groupMembers.find(m => m.user_id === user.id);
        if (me) me.aporta_coche = hasCar;

        showToast(t('flexible.aporto_coche'), 'success');
        renderMembersList();
    } catch (err) {
        console.error("Error updating car status:", err);
        showToast(t('shared.error_generico'), 'error');
        event.target.checked = !hasCar;
    }
}

function closeManageGroupsModal() {
    document.getElementById('modal-manage-groups').classList.add('hidden');
}

async function renderManageGroups() {
    const [flexRes, fixedRes, parkingRes] = await Promise.all([
        _supabase.schema('flexible_carpooling').from('flexible_members').select('group_id').eq('user_id', user.id),
        _supabase.schema('fixed_carpooling').from('fixed_members').select('group_id').eq('user_id', user.id),
        _supabase.schema('parking').from('members').select('group_id').eq('user_id', user.id)
    ]);

    const flexIds = (flexRes.data || []).map(m => m.group_id);
    const fixedIds = (fixedRes.data || []).map(m => m.group_id);
    const parkingIds = (parkingRes.data || []).map(m => m.group_id);
    const allIds = [...new Set([...flexIds, ...fixedIds, ...parkingIds])];

    const container = document.getElementById('list-manage-groups');
    if (!container) return;

    if (allIds.length === 0) {
        container.innerHTML = `<p class="text-slate-500 text-xs uppercase font-bold pt-4 text-center">${t('shared.no_grupos')}</p>`;
        return;
    }

    const { data: groupData, error: groupError } = await _supabase
        .from('groups')
        .select('id, name, code, type')
        .in('id', allIds)
        .order('created_at', { ascending: true });

    if (groupError) return;

    container.innerHTML = (groupData || []).map(g => `
        <div class="p-4 bg-slate-900 rounded-2xl flex justify-between items-center border border-slate-800">
            <div class="flex flex-col text-left">
                <span class="text-[8px] font-black ${g.type === 'flexible' ? 'text-indigo-400' : g.type === 'fixed' ? 'text-amber-400' : 'text-emerald-400'} uppercase">${t('group_type.' + g.type)}</span>
                <span class="font-black text-[10px] uppercase italic text-slate-200">${escapeHtml(g.name)}</span>
                <span class="text-[8px] font-bold text-slate-500 tracking-widest mt-1">${escapeHtml(g.code)}</span>
            </div>
            <button type="button" data-leave-id="${escapeHtml(g.id)}" data-leave-name="${escapeHtml(g.name)}" data-leave-type="${escapeHtml(g.type)}"
                class="btn-leave-group bg-red-500/10 text-red-500 px-3 py-2 rounded-lg text-[9px] font-black uppercase border border-red-500/20 hover:bg-red-500/20">
                ${t('shared.salir')}
            </button>
        </div>
    `).join('');

    container.querySelectorAll('.btn-leave-group').forEach(btn => {
        btn.onclick = () => leaveGroupConfirm(btn.dataset.leaveId, btn.dataset.leaveName, btn.dataset.leaveType);
    });
}

async function leaveGroupConfirm(groupId, name, type) {
    if (!await showConfirm(`${t('shared.confirm_leave_group')} "${name}"?`)) return;

    if (type === 'flexible') {
        await cleanupFutureTrips(groupId);
        await _supabase.schema('flexible_carpooling').from('flexible_members').delete().eq('group_id', groupId).eq('user_id', user.id);
    } else if (type === 'fixed') {
        await _supabase.schema('fixed_carpooling').from('fixed_members').delete().eq('group_id', groupId).eq('user_id', user.id);
    } else if (type === 'parking') {
        await _supabase.schema('parking').from('members').delete().eq('group_id', groupId).eq('user_id', user.id);
    }

    showToast(`${t('shared.toast_left_group')} "${name}"`, 'info');
    renderManageGroups();
    loadAllGroups();
}

Object.assign(window, {
    hideGroupDetail,
    showGroupMembers,
    hideGroupMembers,
    renderMembersList,
    refreshCalendar,
    renderCalendarUI,
    selectDay,
    renderTrips,
    openFlexibleStatsModal,
    closeFlexibleStatsModal,
    openTripModal,
    closeTripModal,
    openManageGroupsModal,
    updateGroupCarStatus,
    closeManageGroupsModal,
    renderManageGroups,
    leaveGroupConfirm
});
