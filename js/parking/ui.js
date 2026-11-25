// State for weekly view
let currentWeekOffset = 0;
window.currentGroupId = window.currentGroupId || null;

function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function getISOWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function changeWeek(offset) {
    if (offset === 0) {
        currentWeekOffset = 0;
    } else {
        currentWeekOffset += offset;
    }
    renderParkingCalendar();
}

function renderParkingCalendar() {
    const agenda = document.getElementById('parking-week-agenda');
    if (!agenda) return;
    agenda.innerHTML = '';

    const today = new Date();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfCurrentWeek = getStartOfWeek(today);
    const viewStart = new Date(startOfCurrentWeek);
    viewStart.setDate(viewStart.getDate() + (currentWeekOffset * 7));

    const locale = t('parking.lang_code') || 'es-ES';
    const endOfWeek = new Date(viewStart);
    endOfWeek.setDate(endOfWeek.getDate() + 6);

    const options = { month: 'short', day: 'numeric' };
    const dateRange = `${viewStart.toLocaleDateString(locale, options)} - ${endOfWeek.toLocaleDateString(locale, options)}`;
    const year = viewStart.getFullYear();
    const weekNum = getISOWeekNumber(viewStart);

    const isCurrentWeek = currentWeekOffset === 0;
    const monthTitleEl = document.getElementById('parking-month-year');
    if (monthTitleEl) {
        monthTitleEl.innerText = `${dateRange} ${year} (${t('parking.semana')}${weekNum})`;
        monthTitleEl.classList.toggle('text-emerald-300', isCurrentWeek);
        monthTitleEl.classList.toggle('text-white', !isCurrentWeek);
    }
    const weekBadgeEl = document.getElementById('parking-current-period-badge');
    if (weekBadgeEl) {
        weekBadgeEl.classList.toggle('hidden', !isCurrentWeek);
    }

    const prevBtn = document.querySelector('#view-group-detail-parking .fa-chevron-left')?.parentElement;
    const nextBtn = document.querySelector('#view-group-detail-parking .fa-chevron-right')?.parentElement;
    if (prevBtn) prevBtn.onclick = () => changeWeek(-1);
    if (nextBtn) nextBtn.onclick = () => changeWeek(1);

    const myId = (window.currentUser || window.user)?.id;
    const agendaRows = [];

    for (let i = 0; i < 7; i++) {
        const currentDate = new Date(viewStart.getFullYear(), viewStart.getMonth(), viewStart.getDate() + i);
        const dateYMD = formatLocalYMD(currentDate);
        const assignments = getAssignmentsForDate(currentDate);

        const myAssign = assignments.find(a => a.user.user_id === myId);
        const isMyTurn = myAssign && myAssign.isAttending;
        const hasSpot = myAssign && myAssign.finalSpotName !== null;
        const isFixedSpot = myAssign && myAssign.isFixedSpot;
        const isReserve = isMyTurn && !hasSpot;

        const isToday = currentDate.getTime() === todayMidnight.getTime();
        const isPast = currentDate < todayMidnight;
        const attendingCount = assignments.filter(a => a.isAttending).length;

        let statusBadge = `<span class="text-[10px] font-bold text-slate-500 uppercase">${t('parking.desapuntado')}</span>`;
        if (hasSpot) {
            statusBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black ${isFixedSpot ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}">${isFixedSpot ? '<i class="fas fa-lock text-[9px]"></i>' : '<i class="fas fa-parking text-[9px]"></i>'}${escapeHtml(myAssign.finalSpotName)}</span>`;
        } else if (isReserve) {
            statusBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30"><i class="fas fa-clock text-[9px]"></i>${t('parking.en_reserva')}</span>`;
        }

        const dayLabel = currentDate.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short' });
        agendaRows.push(`
            <button type="button" ${isPast ? 'disabled' : `onclick="window.openParkingDayDetail('${dateYMD}')"`}
                class="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border transition-all text-left ${isToday ? 'bg-emerald-950/35 border-emerald-500/60 ring-1 ring-emerald-500/30' : (hasSpot ? 'bg-slate-900/70 border-emerald-500/25' : 'bg-slate-900/50 border-slate-800/90')} ${isPast ? 'opacity-40 cursor-not-allowed' : 'hover:border-slate-600 active:scale-[0.99]'}">
                <div class="flex items-center gap-3 min-w-0">
                    <span class="w-2.5 h-2.5 rounded-full shrink-0 ${isToday ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : (hasSpot ? 'bg-emerald-500/60' : 'bg-slate-700')}"></span>
                    <div class="flex flex-col min-w-0">
                        <span class="text-xs font-black capitalize truncate ${isToday ? 'text-emerald-300' : 'text-slate-100'}">${escapeHtml(dayLabel)}</span>
                        <span class="text-[10px] text-slate-500 font-bold"><i class="fas fa-users mr-1"></i>${attendingCount} ${t('parking.asistentes')}</span>
                    </div>
                </div>
                <div class="shrink-0 ml-2">${statusBadge}</div>
            </button>
        `);
    }

    agenda.innerHTML = agendaRows.join('');
}

function refreshParkingData() {
    if (window.currentGroupId) {
        loadParkingGroupDetail(window.currentGroupId, document.getElementById('parking-group-title').innerText);
    }
}

let selectedRoutineDays = [];
let currentDetailDateStr = null;

function openParkingDayDetail(dateInput) {
    const dateYMD = String(dateInput).slice(0, 10);
    const date = parseLocalYMD(dateYMD);
    currentDetailDateStr = dateYMD;

    const N = window.parkingState.spots.length;
    const U = window.parkingState.members.length;
    if (N === 0 || U === 0) {
        showToast(t('parking.no_datos'), 'info');
        return;
    }

    const dayOfWeek = date.getDay() || 7;
    const interestedIds = window.parkingState.members.filter(m => {
        const override = window.parkingState.attendance[currentDetailDateStr]?.find(a => a.user_id === m.user_id);
        if (override) return override.is_attending;
        return m.routine && m.routine.includes(dayOfWeek);
    }).map(m => m.user_id);

    const assignments = getAssignmentsForDate(date);
    const list = document.getElementById('parking-assignments-list');
    const myId = (window.currentUser || window.user)?.id;

    const fixedSpotAssignments = assignments.filter(a => a.isFixedSpot);
    const sharedAssignments = assignments.filter(a => !a.isFixedSpot);

    let html = '';

    if (fixedSpotAssignments.length > 0) {
        html += `<div class="mb-4">
            <h4 class="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                <i class="fas fa-lock"></i> ${t('parking.plazas_fijas')}
            </h4>`;

        html += fixedSpotAssignments.map((a) => {
            const isMe = a.user.user_id === myId;
            let statusLabel = t('parking.no_asiste');
            let statusColor = "text-slate-500";
            let rowBg = "bg-slate-800/50 border-slate-700";
            const badgeText = a.spotName || '---';

            if (a.isAttending) {
                statusLabel = t('parking.en_su_plaza');
                statusColor = "text-indigo-400";
                rowBg = "bg-indigo-900/20 border-indigo-500/30";
            } else {
                statusLabel = t('parking.plaza_libre');
                statusColor = "text-emerald-400";
                rowBg = "bg-emerald-900/10 border-emerald-500/20";
            }

            return `
                <div class="flex items-center justify-between p-3 mb-2 rounded-xl border ${rowBg} ${isMe ? 'ring-1 ring-indigo-400' : ''} ${!a.isAttending ? 'opacity-60' : ''}">
                    <div class="flex flex-col">
                        <span class="font-bold text-sm ${isMe ? 'text-indigo-300' : 'text-white'}">${escapeHtml(a.user.display_name)}</span>
                        <span class="text-[10px] uppercase tracking-widest font-black ${statusColor}">${statusLabel}</span>
                    </div>
                    <span class="font-black text-xs px-3 py-1.5 rounded-lg ${a.isAttending ? 'bg-indigo-500 text-white' : 'bg-emerald-500/20 text-emerald-400'}">
                        <i class="fas fa-lock text-[8px] mr-1"></i>${escapeHtml(badgeText)}
                    </span>
                </div>
            `;
        }).join('');
        html += `</div>`;
    }

    html += `<div>
        <h4 class="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-2">
            <i class="fas fa-users"></i> ${t('parking.plazas_compartidas')}
        </h4>`;

    html += sharedAssignments.map((a) => {
        const isMe = a.user.user_id === myId;
        const isOriginalOwner = a.moldValue.startsWith('P');
        const assignedFixedSpot = a.assignedFixedSpot;

        let statusLabel = t('parking.desapuntado');
        let statusColor = "text-slate-500";
        let rowBg = "bg-slate-800/50 border-slate-700";
        let badgeText = a.moldValue;

        if (a.isAttending) {
            if (a.finalSpotName) {
                if (assignedFixedSpot) {
                    statusLabel = t('parking.plaza_fija_asignada');
                    statusColor = "text-indigo-400";
                    rowBg = "bg-indigo-900/20 border-indigo-500/30";
                } else {
                    statusLabel = isOriginalOwner ? t('parking.tiene_plaza') : t('parking.reserva_con_plaza');
                    statusColor = "text-emerald-400";
                    rowBg = "bg-emerald-900/20 border-emerald-500/30";
                }
                badgeText = a.finalSpotName;
            } else {
                statusLabel = t('parking.en_reserva');
                statusColor = "text-amber-400";
                badgeText = a.moldValue;
            }
        }

        return `
            <div class="flex items-center justify-between p-3 mb-2 rounded-xl border ${rowBg} ${isMe ? 'ring-1 ring-emerald-400' : ''} ${!a.isAttending ? 'opacity-45' : ''}">
                <div class="flex flex-col">
                    <span class="font-bold text-sm ${isMe ? 'text-emerald-300' : 'text-white'}">${escapeHtml(a.user.display_name)}</span>
                    <div class="flex items-center gap-2 mt-0.5">
                        <span class="text-[9px] font-black px-1.5 bg-slate-900 text-slate-400 rounded border border-slate-700">${escapeHtml(a.moldValue)}</span>
                        <span class="text-[10px] uppercase tracking-widest font-black ${statusColor}">${statusLabel}</span>
                    </div>
                </div>
                <span class="font-black text-xs px-3 py-1.5 rounded-lg ${a.finalSpotName ? (assignedFixedSpot ? 'bg-indigo-500 text-white' : 'bg-emerald-500 text-white') : 'bg-slate-700 text-slate-300'}">
                    ${assignedFixedSpot ? '<i class="fas fa-lock text-[8px] mr-1"></i>' : ''}${escapeHtml(badgeText)}
                </span>
            </div>
        `;
    }).join('');
    html += `</div>`;

    list.innerHTML = html;

    document.getElementById('parking-detail-date').innerText = formatReadableDate(currentDetailDateStr, currentLang);
    document.getElementById('modal-parking-day-detail').classList.remove('hidden');
    document.getElementById('check-parking-attendance').checked = interestedIds.includes(myId);
}

function getAssignmentsForDate(date) {
    const N = window.parkingState?.spots?.length || 0;
    const U = window.parkingState?.members?.length || 0;
    if (N === 0 || U === 0) return [];

    const dateIsoStr = formatLocalYMD(date);
    const startDate = window.parkingState.startDate || new Date(2025, 0, 6);

    const startMonday = getStartOfWeek(new Date(startDate));
    const currentMonday = getStartOfWeek(new Date(date));
    const diffTime = currentMonday - startMonday;
    const weeksPassed = Math.round(diffTime / (1000 * 60 * 60 * 24 * 7));

    const fixedSpotUsers = window.parkingState.members.filter(m => m.has_fixed_spot);
    const sharedUsers = window.parkingState.members.filter(m => !m.has_fixed_spot);
    const sharedU = sharedUsers.length;

    const sharedSpots = window.parkingState.spots.filter(s => !s.is_fixed_spot);
    const sharedN = sharedSpots.length;

    const dayOfWeek = date.getDay() || 7;

    const interestedIds = window.parkingState.members.filter(m => {
        const override = window.parkingState.attendance[dateIsoStr]?.find(a => a.user_id === m.user_id);
        if (override) return override.is_attending;
        return m.routine && m.routine.includes(dayOfWeek);
    }).map(m => m.user_id);

    const fixedSpotAssignments = fixedSpotUsers.map(member => {
        const isAttending = interestedIds.includes(member.user_id);
        const spot = window.parkingState.spots.find(s => s.id === member.fixed_spot_id);
        const spotName = spot?.name || '---';

        return {
            user: member,
            moldValue: 'FIXED',
            isAttending,
            finalSpotName: isAttending ? spotName : null,
            priority: 0,
            isFixedSpot: true,
            spotName,
            spotAvailable: !isAttending
        };
    });

    const availableFixedSpots = fixedSpotAssignments
        .filter(a => a.spotAvailable)
        .map(a => ({ spotName: a.spotName, originalOwner: a.user }));

    const mold = window.getMold(sharedN, sharedU, true);
    const rotationOffset = (sharedU > sharedN) ? weeksPassed : 0;
    const rotatedSharedMembers = window.rotateUsers(sharedUsers, rotationOffset);

    const sharedAssignments = rotatedSharedMembers.map((member, index) => ({
        user: member,
        moldValue: mold[index] || 'R',
        isAttending: interestedIds.includes(member.user_id),
        finalSpotName: null,
        priority: index,
        isFixedSpot: false
    }));

    const availableSharedSpots = [];
    sharedAssignments.forEach(a => {
        if (a.moldValue.startsWith('P')) {
            const spotIndex = parseInt(a.moldValue.substring(1)) - 1;
            const spotName = sharedSpots[spotIndex]?.name || a.moldValue;

            if (a.isAttending) {
                a.finalSpotName = spotName;
            } else {
                availableSharedSpots.push(spotName);
            }
        }
    });

    const reserveCandidates = sharedAssignments
        .filter(a => a.moldValue.startsWith('R') && a.isAttending)
        .sort((a, b) => parseInt(a.moldValue.substring(1)) - parseInt(b.moldValue.substring(1)));

    reserveCandidates.forEach(candidate => {
        if (availableSharedSpots.length > 0) {
            candidate.finalSpotName = availableSharedSpots.shift();
        }
    });

    reserveCandidates.forEach(candidate => {
        if (!candidate.finalSpotName && availableFixedSpots.length > 0) {
            const fixedSpot = availableFixedSpots.shift();
            candidate.finalSpotName = fixedSpot.spotName;
            candidate.assignedFixedSpot = true;
            candidate.fixedSpotOwner = fixedSpot.originalOwner;
        }
    });

    return [...fixedSpotAssignments, ...sharedAssignments];
}

function closeParkingDayDetail() {
    document.getElementById('modal-parking-day-detail')?.classList.add('hidden');
    currentDetailDateStr = null;
}

function openParkingMembersModal() {
    const modal = document.getElementById('modal-parking-members');
    if (!modal) return;
    modal.classList.remove('hidden');

    const list = document.getElementById('parking-members-list-general');
    const membersBase = window.parkingState.members;

    const fixedMembers = membersBase.filter(m => m.has_fixed_spot);
    const sharedMembers = membersBase.filter(m => !m.has_fixed_spot);
    const sharedU = sharedMembers.length;

    const today = new Date();
    const startDate = window.parkingState.startDate || new Date(2025, 0, 6);
    const startMonday = getStartOfWeek(new Date(startDate));
    const currentMonday = getStartOfWeek(new Date(today));
    const diffTime = currentMonday - startMonday;
    const weeksPassed = Math.round(diffTime / (1000 * 60 * 60 * 24 * 7));

    const sharedSpots = window.parkingState.spots.filter(s => !s.is_fixed_spot);
    const sharedN = sharedSpots.length;
    const mold = window.getMold(sharedN, sharedU, true);
    const offset = (sharedU > sharedN && sharedU > 0) ? (((weeksPassed % sharedU) + sharedU) % sharedU) : 0;

    let html = '';

    if (fixedMembers.length > 0) {
        html += `<div class="mb-4">
            <h4 class="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                <i class="fas fa-lock"></i> ${t('parking.plazas_fijas')}
            </h4>`;

        html += fixedMembers.map(m => {
            const spot = window.parkingState.spots.find(s => s.id === m.fixed_spot_id);
            const spotName = spot?.name || '---';

            return `
                <div class="flex items-center justify-between p-4 mb-2 rounded-xl bg-indigo-900/10 border border-indigo-500/20">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-indigo-900/30 flex items-center justify-center text-[10px] font-black text-indigo-400 border border-indigo-500/30">
                            <i class="fas fa-lock"></i>
                        </div>
                        <div class="flex flex-col">
                            <span class="text-white font-bold text-sm">${escapeHtml(m.display_name)}</span>
                            <span class="text-[9px] uppercase tracking-widest text-indigo-400 font-black">${t('parking.plaza_fija_label')}</span>
                        </div>
                    </div>
                    <span class="font-black text-xs px-3 py-1.5 rounded-lg bg-indigo-500 text-white">${escapeHtml(spotName)}</span>
                </div>
            `;
        }).join('');
        html += `</div>`;
    }

    html += `<div>
        <h4 class="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-2">
            <i class="fas fa-users"></i> ${t('parking.plazas_compartidas')}
        </h4>`;

    html += sharedMembers.map((m, index) => {
        const moldValue = sharedU > 0 ? (mold[(index + (sharedU - offset)) % sharedU] || 'R') : 'R';
        const isSpot = moldValue.startsWith('P');

        const statusText = isSpot ? t('parking.tiene_plaza') : t('parking.reserva');
        const statusColor = isSpot ? "text-emerald-400" : "text-amber-400";
        const bgColor = isSpot ? "bg-emerald-900/10 border-emerald-500/20" : "bg-slate-800/50 border-slate-700";

        return `
            <div class="flex items-center justify-between p-4 mb-2 rounded-xl ${bgColor} border">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-[10px] font-black text-slate-400 border border-slate-700">
                        ${escapeHtml(moldValue)}
                    </div>
                    <div class="flex flex-col">
                        <span class="text-white font-bold text-sm">${escapeHtml(m.display_name)}</span>
                        <span class="text-[9px] uppercase tracking-widest ${statusColor} font-black">${statusText}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    html += `</div>`;

    list.innerHTML = html;

    const editBtn = document.getElementById('btn-edit-mold');
    if (editBtn) editBtn.classList.toggle('hidden', !window.parkingState.isAdmin);

    const indicator = document.getElementById('mold-custom-indicator');
    if (indicator) indicator.classList.toggle('hidden', !window.parkingState.customMold);
}

function closeParkingMembersModal() {
    document.getElementById('modal-parking-members')?.classList.add('hidden');
}

function openRoutineModal() {
    const modal = document.getElementById('modal-parking-routine');
    modal.classList.remove('hidden');

    const myId = (window.currentUser || window.user)?.id;
    const myMember = window.parkingState.members.find(m => m.user_id === myId);
    selectedRoutineDays = myMember?.routine ? [...myMember.routine] : [1, 2, 3, 4, 5];

    updateRoutineUI();
}

function closeRoutineModal() {
    document.getElementById('modal-parking-routine').classList.add('hidden');
}

function toggleRoutineDay(day) {
    if (selectedRoutineDays.includes(day)) {
        selectedRoutineDays = selectedRoutineDays.filter(d => d !== day);
    } else {
        selectedRoutineDays.push(day);
    }
    updateRoutineUI();
}

function updateRoutineUI() {
    document.querySelectorAll('#modal-parking-routine .day-btn-pill').forEach(btn => {
        const day = parseInt(btn.dataset.day);
        btn.classList.toggle('active', selectedRoutineDays.includes(day));
    });
}

async function saveRoutine() {
    await window.updateRoutine(selectedRoutineDays);
    closeRoutineModal();
    showToast(t('parking.toast_rutina_guardada'), 'success');
}

async function handleToggleAttendance() {
    if (!currentDetailDateStr) return;
    const isAttending = document.getElementById('check-parking-attendance').checked;
    await window.toggleAttendance(currentDetailDateStr, isAttending);

    openParkingDayDetail(currentDetailDateStr);
    renderParkingCalendar();
}

function openSpotManagementModal() {
    document.getElementById('modal-manage-spots').classList.remove('hidden');
    renderSpotsList();
}

function closeSpotManagementModal() {
    document.getElementById('modal-manage-spots').classList.add('hidden');
}

function renderSpotsList() {
    const list = document.getElementById('spots-list');
    if (!window.parkingState || !window.parkingState.spots) return;

    const spots = window.parkingState.spots;
    list.innerHTML = spots.map((s, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === spots.length - 1;
        return `
        <div class="flex justify-between items-center bg-slate-900/60 p-3 rounded-xl border border-slate-700/80 gap-2">
            <div class="flex items-center gap-2 min-w-0">
                ${s.is_fixed_spot ? '<i class="fas fa-lock text-indigo-400 text-xs"></i>' : '<i class="fas fa-parking text-emerald-400 text-xs"></i>'}
                <span class="text-sm font-bold text-slate-200 truncate">${escapeHtml(s.name)}</span>
            </div>
            <div class="flex items-center gap-1 shrink-0">
                <button type="button" onclick="handleMoveSpot('${s.id}', -1)" title="${t('parking.move_up')}"
                    class="w-7 h-7 rounded-lg ${isFirst ? 'bg-slate-800/40 text-slate-600 cursor-not-allowed' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'} text-xs flex items-center justify-center" ${isFirst ? 'disabled' : ''}>
                    <i class="fas fa-arrow-up text-[10px]"></i>
                </button>
                <button type="button" onclick="handleMoveSpot('${s.id}', 1)" title="${t('parking.move_down')}"
                    class="w-7 h-7 rounded-lg ${isLast ? 'bg-slate-800/40 text-slate-600 cursor-not-allowed' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'} text-xs flex items-center justify-center" ${isLast ? 'disabled' : ''}>
                    <i class="fas fa-arrow-down text-[10px]"></i>
                </button>
                <button type="button" onclick="handleDeleteSpot('${s.id}')" class="w-7 h-7 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center justify-center ml-1">
                    <i class="fas fa-trash text-[10px]"></i>
                </button>
            </div>
        </div>
    `;
    }).join('');

    if (spots.length === 0) {
        list.innerHTML = `<p class="text-center text-xs text-slate-500 italic py-4">${t('parking.no_plazas_creadas')}</p>`;
    }
}

async function handleAddSpot() {
    const input = document.getElementById('new-spot-name');
    const name = input.value.trim();
    if (!name) return;

    await window.addSpot(name);
    input.value = '';
    renderSpotsList();
}

async function handleMoveSpot(id, direction) {
    await window.moveSpot(id, direction);
    renderSpotsList();
}

async function handleDeleteSpot(id) {
    await window.deleteSpot(id);
    renderSpotsList();
}

// ========== MOLD EDITOR ==========
let currentMoldDraft = [];

function openMoldEditorModal() {
    const sharedSpots = window.parkingState.spots.filter(s => !s.is_fixed_spot);
    const sharedUsers = window.parkingState.members.filter(m => !m.has_fixed_spot);
    const N = sharedSpots.length;
    const U = sharedUsers.length;
    if (U === 0) return;

    currentMoldDraft = [...window.getMold(N, U, true)];
    renderMoldEditor();
    document.getElementById('modal-mold-editor').classList.remove('hidden');
}

function closeMoldEditorModal() {
    document.getElementById('modal-mold-editor').classList.add('hidden');
    currentMoldDraft = [];
}

function renderMoldEditor() {
    const list = document.getElementById('mold-editor-list');
    if (!list) return;

    const isCustomActive = !!window.parkingState.customMold;

    list.innerHTML = currentMoldDraft.map((slot, index) => {
        const isP = slot.startsWith('P');
        const badgeColor = isP ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white';
        const rowBg = isP ? 'bg-emerald-900/10 border-emerald-500/20' : 'bg-slate-800/50 border-slate-700';
        const isFirst = index === 0;
        const isLast = index === currentMoldDraft.length - 1;

        return `
            <div class="flex items-center gap-3 p-3 rounded-xl border ${rowBg} transition-all">
                <span class="font-black text-xs px-2 py-1 rounded-lg ${badgeColor} min-w-[36px] text-center">${escapeHtml(slot)}</span>
                <span class="flex-1 text-slate-400 text-[10px] uppercase font-bold">${isP ? t('parking.plaza') : t('parking.reserva')}</span>
                <div class="flex gap-1">
                    <button onclick="window.moveMoldSlot(${index}, -1)"
                        class="w-8 h-8 rounded-lg ${isFirst ? 'bg-slate-800/30 text-slate-600 cursor-not-allowed' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'} flex items-center justify-center text-xs font-black transition-all"
                        ${isFirst ? 'disabled' : ''}>↑</button>
                    <button onclick="window.moveMoldSlot(${index}, 1)"
                        class="w-8 h-8 rounded-lg ${isLast ? 'bg-slate-800/30 text-slate-600 cursor-not-allowed' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'} flex items-center justify-center text-xs font-black transition-all"
                        ${isLast ? 'disabled' : ''}>↓</button>
                </div>
            </div>
        `;
    }).join('');

    const statusEl = document.getElementById('mold-editor-status');
    if (statusEl) {
        if (isCustomActive) {
            statusEl.innerHTML = `<span class="text-[9px] font-black text-amber-400 uppercase tracking-widest">${t('parking.molde_custom_label')}</span>`;
        } else {
            statusEl.innerHTML = `<span class="text-[9px] font-black text-slate-500 uppercase tracking-widest">${t('parking.molde_auto_label')}</span>`;
        }
    }
}

function moveMoldSlot(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= currentMoldDraft.length) return;
    [currentMoldDraft[index], currentMoldDraft[newIndex]] = [currentMoldDraft[newIndex], currentMoldDraft[index]];
    renderMoldEditor();
}

async function saveMoldEditor() {
    if (currentMoldDraft.length === 0) return;
    try {
        await window.saveCustomMold([...currentMoldDraft]);
        closeMoldEditorModal();
        renderParkingCalendar();
        showToast(t('parking.molde_guardado'), 'success');
    } catch (e) {
        console.error('saveMoldEditor error:', e);
        showToast(t('shared.error_generico'), 'error');
    }
}

async function resetMoldEditor() {
    try {
        await window.resetCustomMold();
        const sharedSpots = window.parkingState.spots.filter(s => !s.is_fixed_spot);
        const sharedUsers = window.parkingState.members.filter(m => !m.has_fixed_spot);
        currentMoldDraft = [...window.buildMold(sharedSpots.length, sharedUsers.length)];
        renderMoldEditor();
        renderParkingCalendar();
        showToast(t('parking.molde_reseteado'), 'info');
    } catch {
        showToast(t('shared.error_generico'), 'error');
    }
}

Object.assign(window, {
    changeWeek,
    getAssignmentsForDate,
    openSpotManagementModal,
    closeSpotManagementModal,
    handleAddSpot,
    handleMoveSpot,
    handleDeleteSpot,
    renderParkingCalendar,
    refreshParkingData,
    openParkingDayDetail,
    closeParkingDayDetail,
    openParkingMembersModal,
    closeParkingMembersModal,
    openRoutineModal,
    closeRoutineModal,
    toggleRoutineDay,
    saveRoutine,
    handleToggleAttendance,
    openMoldEditorModal,
    closeMoldEditorModal,
    moveMoldSlot,
    saveMoldEditor,
    resetMoldEditor
});
