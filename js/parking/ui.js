// State for weekly view
let currentWeekOffset = 0; // 0 = current week, -1 = last week, etc.
window.currentGroupId = window.currentGroupId || null;

function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
    return new Date(d.setDate(diff));
}

function changeWeek(offset) {
    currentWeekOffset += offset;
    renderParkingCalendar();
}

function renderParkingCalendar() {
    const grid = document.getElementById('parking-calendar-grid');
    if (!grid) return;
    grid.innerHTML = '';

    // Calculate start of the week based on offset
    const today = new Date();
    const startOfCurrentWeek = getStartOfWeek(today);
    const viewStart = new Date(startOfCurrentWeek);
    viewStart.setDate(viewStart.getDate() + (currentWeekOffset * 7));

    // Update Header
    const endOfWeek = new Date(viewStart);
    endOfWeek.setDate(endOfWeek.getDate() + 6);

    const options = { month: 'short', day: 'numeric' };
    const dateRange = `${viewStart.toLocaleDateString('es-ES', options)} - ${endOfWeek.toLocaleDateString('es-ES', options)}`;
    const year = viewStart.getFullYear();

    document.getElementById('parking-month-year').innerText = `${dateRange} ${year}`;

    // Update buttons in index.html to call changeWeek instead of changeMonth
    // We might need to override the onclick attributes dynamically or hardcode them in HTML
    const prevBtn = document.querySelector('#view-group-detail-parking .fa-chevron-left').parentElement;
    const nextBtn = document.querySelector('#view-group-detail-parking .fa-chevron-right').parentElement;

    prevBtn.onclick = () => changeWeek(-1);
    nextBtn.onclick = () => changeWeek(1);

    // Render 7 days
    const startDate = window.parkingState?.startDate || new Date(2025, 0, 1);

    for (let i = 0; i < 7; i++) {
        const currentDate = new Date(viewStart);
        currentDate.setDate(currentDate.getDate() + i);

        const d = currentDate.getDate();

        // Calculate week index for logic
        const weeksPassed = Math.floor((currentDate - startDate) / (1000 * 60 * 60 * 24 * 7));

        // Logic Calculation
        const N = window.parkingState?.spots?.length || 0;
        const U = window.parkingState?.members?.length || 0;

        // Render cell content
        let cellContent = `<span class="text-[8px] font-bold text-slate-600">${d}</span>`;
        if (currentDate.toDateString() === today.toDateString()) {
            cellContent = `<span class="text-[8px] font-bold text-emerald-400">${d}</span>`;
        }

        // Add CLICK handler
        const dateStr = currentDate.toISOString();

        // Calculate assignments for this day
        const dayOfWeek = currentDate.getDay() || 7;
        const dateIso = currentDate.toISOString().split('T')[0];

        const interests = window.parkingState.members.filter(m => {
            const override = window.parkingState.attendance[dateIso]?.find(a => a.user_id === m.user_id);
            if (override) return override.is_attending;
            return m.routine && m.routine.includes(dayOfWeek);
        }).map(m => m.user_id);

        const mold = window.buildMold(N, U);
        const rotationOffset = (U > N) ? weeksPassed : 0;
        const rotatedMembers = window.rotateUsers(window.parkingState.members, rotationOffset);
        const assignments = window.assign(rotatedMembers, mold, interests);

        const myId = currentUser.id;
        const myAssign = assignments.find(a => a.user.user_id === myId);
        const isMyTurn = myAssign && myAssign.status !== 'not_attending';
        const hasSpot = myAssign && myAssign.status === 'assigned';
        const isReserve = myAssign && myAssign.status === 'reserve';

        const isToday = currentDate.toDateString() === today.toDateString();
        const isPast = currentDate < new Date(today.getFullYear(), today.getMonth(), today.getDate());

        const cell = document.createElement('div');
        cell.className = `calendar-cell flex flex-col items-center justify-center p-1 rounded-xl border transition-all ${isPast ? 'opacity-30' : 'cursor-pointer hover:bg-slate-800'}`;

        if (isToday) cell.classList.add('ring-1', 'ring-emerald-500', 'bg-emerald-500/10');
        else if (hasSpot) cell.classList.add('border-emerald-500/50', 'bg-emerald-500/5');
        else cell.classList.add('bg-slate-900/40', 'border-slate-800');

        let spotAnnotation = '';
        if (hasSpot) {
            const pIndex = parseInt(myAssign.slot.substring(1)) - 1;
            const spotName = window.parkingState.spots[pIndex]?.name || myAssign.slot;
            spotAnnotation = `<span class="text-[8px] font-black text-emerald-400 uppercase mt-1 leading-none">${spotName}</span>`;
        } else if (isReserve) {
            spotAnnotation = `<span class="text-[8px] font-black text-amber-500 uppercase mt-1 leading-none">RES</span>`;
        }

        // Only show info if someone attends
        const attendingCount = assignments.filter(a => a.status !== 'not_attending').length;

        cell.innerHTML = `
            <span class="text-[8px] font-black text-slate-500 uppercase mb-0.5">${currentDate.toLocaleDateString('es-ES', { weekday: 'short' }).substring(0, 2)}</span>
            <span class="text-xs font-black ${isToday ? 'text-emerald-400' : 'text-slate-200'} leading-none">${currentDate.getDate()}</span>
            <div class="h-4 flex items-center justify-center">
                ${(attendingCount > 0) ? spotAnnotation : ''}
            </div>
        `;

        if (!isPast) {
            cell.onclick = () => window.openParkingDayDetail(currentDate.toISOString());
        }
        grid.appendChild(cell);
    }

    // Render Legend (Removed per user request)
    const legend = document.getElementById('parking-legend');
    if (legend) legend.innerHTML = '';
}

function renderDayCell(container, dayNum, innerHTML, extraClasses = '', inlineStyle = '', onClick = null) {
    const el = document.createElement('div');
    el.className = `fixed-day-cell flex flex-col items-center justify-center relative border ${extraClasses}`;
    if (inlineStyle) el.style = inlineStyle;
    el.innerHTML = innerHTML;
    if (onClick) el.onclick = onClick;
    container.appendChild(el);
}

function refreshParkingData() {
    if (window.currentGroupId) {
        loadParkingGroupDetail(window.currentGroupId, document.getElementById('parking-group-title').innerText);
    }
}

// Make functions global
window.openSpotManagementModal = openSpotManagementModal;
window.closeSpotManagementModal = closeSpotManagementModal;
window.handleAddSpot = handleAddSpot;
window.handleDeleteSpot = handleDeleteSpot;
window.renderParkingCalendar = renderParkingCalendar;
window.refreshParkingData = refreshParkingData;
window.openParkingDayDetail = openParkingDayDetail;
window.closeParkingDayDetail = closeParkingDayDetail;
window.openParkingMembersModal = openParkingMembersModal;
window.closeParkingMembersModal = closeParkingMembersModal;
window.openRoutineModal = openRoutineModal;
window.closeRoutineModal = closeRoutineModal;
window.toggleRoutineDay = toggleRoutineDay;
window.saveRoutine = saveRoutine;
window.handleToggleAttendance = handleToggleAttendance;

let selectedRoutineDays = [];
let currentDetailDateStr = null;

function openParkingDayDetail(dateIsoStr) {
    const date = new Date(dateIsoStr);
    currentDetailDateStr = dateIsoStr.split('T')[0];

    const startDate = window.parkingState.startDate || new Date(2025, 0, 1);
    const weeksPassed = Math.floor((date - startDate) / (1000 * 60 * 60 * 24 * 7));
    const N = window.parkingState.spots.length;
    const U = window.parkingState.members.length;

    if (N === 0 || U === 0) return alert(t('parking.no_datos'));

    // 1. Obtener la rotación base de la semana (EL ORDEN FIJO)
    const rotationOffset = (U > N) ? weeksPassed : 0;
    const rotatedMembers = window.rotateUsers(window.parkingState.members, rotationOffset);

    // 2. Determinar quién quiere ir hoy
    const dayOfWeek = date.getDay() || 7;
    const interestedUserIds = rotatedMembers.filter(m => {
        const override = window.parkingState.attendance[currentDetailDateStr]?.find(a => a.user_id === m.user_id);
        if (override) return override.is_attending;
        return m.routine && m.routine.includes(dayOfWeek);
    }).map(m => m.user_id);

    // 3. REPARTO DINÁMICO DE PLAZAS FÍSICAS (Slots)
    // Cogemos las plazas reales disponibles (P1, P2...) y se las damos a los interesados por orden de lista
    let availablePhysicalSlots = window.parkingState.spots.map((s, i) => `P${i + 1}`);
    const finalAssignments = rotatedMembers.map((member, index) => {
        const isAttending = interestedUserIds.includes(member.user_id);
        const originalStatus = (index < N) ? 'assigned' : 'reserve';
        const originalSlot = (index < N) ? `P${index + 1}` : `R${index + 1 - N}`;
        
        let assignedPhysicalSlot = null;
        if (isAttending && availablePhysicalSlots.length > 0) {
            assignedPhysicalSlot = availablePhysicalSlots.shift(); // Coge la primera plaza libre
        }

        return {
            user: member,
            isAttending,
            originalStatus,   // 'assigned' (Plaza) o 'reserve' (Reserva)
            originalSlot,     // 'P1', 'R1', etc.
            assignedPhysicalSlot // El ID de la plaza real que usará hoy
        };
    });

    // --- RENDERIZADO UI ---
    const modal = document.getElementById('modal-parking-day-detail');
    modal.classList.remove('hidden');
    document.getElementById('parking-detail-date').innerText = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    document.getElementById('check-parking-attendance').checked = interestedUserIds.includes(currentUser.id);

    const list = document.getElementById('parking-assignments-list');
    list.innerHTML = finalAssignments.map((a) => {
        const isMe = a.user.user_id === currentUser.id;
        const pIndex = a.assignedPhysicalSlot ? parseInt(a.assignedPhysicalSlot.substring(1)) - 1 : -1;
        const realSpotName = pIndex >= 0 ? (window.parkingState.spots[pIndex]?.name || a.assignedPhysicalSlot) : null;

        let statusLabel = "";
        let statusColor = "";
        let rowBg = "bg-slate-800/50 border-slate-700";
        let badgeContent = a.originalSlot; // Por defecto mostramos P1, R1...

        if (!a.isAttending) {
            statusLabel = "DESAPUNTADO";
            statusColor = "text-slate-500";
        } else if (a.assignedPhysicalSlot) {
            // Tiene plaza (ya sea por derecho propio o heredada)
            statusLabel = (a.originalStatus === 'assigned') ? "TIENE PLAZA" : "RESERVA CON PLAZA";
            statusColor = "text-emerald-400";
            rowBg = "bg-emerald-900/20 border-emerald-500/30";
            badgeContent = realSpotName; // Mostramos el nombre de la plaza física
        } else {
            // Es reserva y no ha pillado plaza
            statusLabel = "EN RESERVA";
            statusColor = "text-amber-400";
            badgeContent = a.originalSlot; // Muestra R1, R2...
        }

        return `
            <div class="flex items-center justify-between p-4 rounded-xl border ${rowBg} ${isMe ? 'ring-1 ring-emerald-400' : ''} ${!a.isAttending ? 'opacity-40' : ''}">
                <div class="flex items-center gap-3">
                    <div class="flex flex-col">
                        <span class="text-white font-bold text-sm ${isMe ? 'text-emerald-300' : ''}">
                            ${a.user.display_name} ${isMe ? '(Tú)' : ''}
                        </span>
                        <div class="flex items-center gap-2">
                             <span class="text-[9px] font-black px-1.5 bg-slate-900 text-slate-400 rounded border border-slate-700">${a.originalSlot}</span>
                             <span class="text-[10px] uppercase tracking-widest font-black ${statusColor}">${statusLabel}</span>
                        </div>
                    </div>
                </div>
                <div class="text-right">
                    <span class="font-black text-xs px-3 py-1.5 rounded-lg ${a.assignedPhysicalSlot ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-400'}">
                        ${badgeContent}
                    </span>
                </div>
            </div>
        `;
    }).join('');
}

function closeParkingDayDetail() {
    document.getElementById('modal-parking-day-detail').classList.add('hidden');
    currentDetailDateStr = null;
}

function openParkingMembersModal() {
    const modal = document.getElementById('modal-parking-members');
    if (!modal) return;
    modal.classList.remove('hidden');

    const list = document.getElementById('parking-members-list-general');
    if (!list || !window.parkingState?.members) return;

    // Calculate rotation for current week
    const today = new Date();
    const startDate = window.parkingState.startDate || new Date(2025, 0, 1);
    const weeksPassed = Math.floor((today - startDate) / (1000 * 60 * 60 * 24 * 7));

    const N = window.parkingState.spots.length;
    const U = window.parkingState.members.length;
    const rotationOffset = (U > N) ? weeksPassed : 0;

    const rotatedMembers = window.rotateUsers(window.parkingState.members, rotationOffset);

    list.innerHTML = rotatedMembers.map((m, index) => {
        const priorityNum = index + 1;
        const isSpot = priorityNum <= N;
        const statusText = isSpot ? t('parking.plaza') : t('parking.reserva');
        const statusColor = isSpot ? "text-emerald-400" : "text-amber-400";
        const bgColor = isSpot ? "bg-emerald-900/10 border-emerald-500/20" : "bg-slate-800/50 border-slate-700";

        return `
            <div class="flex items-center justify-between p-4 rounded-xl ${bgColor} border">
                <div class="flex items-center gap-3">
                    <div class="w-6 h-6 rounded-lg bg-slate-900 flex items-center justify-center text-[10px] font-black text-slate-500 border border-slate-700">
                        ${priorityNum}
                    </div>
                    <div class="flex flex-col">
                        <span class="text-white font-bold text-sm">${m.display_name} ${m.user_id === currentUser.id ? t('parking.tu') : ''}</span>
                        <span class="text-[9px] uppercase tracking-widest ${statusColor} font-black">${statusText}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function closeParkingMembersModal() {
    document.getElementById('modal-parking-members')?.classList.add('hidden');
}

// Routine Logic
function openRoutineModal() {
    const modal = document.getElementById('modal-parking-routine');
    modal.classList.remove('hidden');

    // Load current routine
    const myMember = window.parkingState.members.find(m => m.user_id === currentUser.id);
    selectedRoutineDays = myMember?.routine || [1, 2, 3, 4, 5];

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
        if (selectedRoutineDays.includes(day)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

async function saveRoutine() {
    await window.updateRoutine(selectedRoutineDays);
    closeRoutineModal();
    showToast(t('parking.toast_rutina_guardada'));
}

async function handleToggleAttendance() {
    if (!currentDetailDateStr) return;
    const isAttending = document.getElementById('check-parking-attendance').checked;
    await window.toggleAttendance(currentDetailDateStr, isAttending);

    // Re-render modal to show updated assignments
    const dateIso = currentDetailDateStr + "T12:00:00Z";
    openParkingDayDetail(dateIso);

    // Also re-render calendar in background
    renderParkingCalendar();
}

// Modal Logic
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

    list.innerHTML = window.parkingState.spots.map(s => `
        <div class="flex justify-between items-center bg-slate-900/50 p-3 rounded-xl border border-slate-700">
            <span class="text-sm font-bold text-slate-300">${s.name}</span>
            <button onclick="handleDeleteSpot('${s.id}')" class="text-red-400 hover:text-red-300 p-2">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');

    if (window.parkingState.spots.length === 0) {
        list.innerHTML = `<p class="text-center text-xs text-slate-500 italic py-4">${t('parking.no_plazas_creadas')}</p>`;
    }
}

async function handleAddSpot() {
    const input = document.getElementById('new-spot-name');
    const name = input.value.trim();
    if (!name) return;

    await window.addSpot(name); // Calling logic from groups.js

    input.value = '';
    renderSpotsList(); // Re-render list with new state (updated by addSpot->loadParkingGroupDetail)
}

async function handleDeleteSpot(id) {
    await window.deleteSpot(id);
    renderSpotsList();
}
