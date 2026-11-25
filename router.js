// Router for handling different group types (flexible, fixed, parking) + Today Dashboard

function getCurrentGroupType() {
    return currentGroupType;
}

function setCurrentGroup(group) {
    if (!group) return;
    currentGroupId = group.id;
    currentGroupType = group.type;
    currentGroup = group;
}

async function getUserGroupIds() {
    if (!currentUser) return [];

    const [flexRes, fixedRes, parkingRes] = await Promise.all([
        _supabase.schema('flexible_carpooling').from('flexible_members').select('group_id').eq('user_id', currentUser.id),
        _supabase.schema('fixed_carpooling').from('fixed_members').select('group_id').eq('user_id', currentUser.id),
        _supabase.schema('parking').from('members').select('group_id').eq('user_id', currentUser.id)
    ]);

    if (parkingRes.error) console.warn("Error fetching parking groups:", parkingRes.error);

    const flexGroupIds = [...new Set((flexRes.data || []).map(m => m.group_id))];
    const fixedGroupIds = [...new Set((fixedRes.data || []).map(m => m.group_id))];
    const parkingGroupIds = [...new Set((parkingRes.data || []).map(m => m.group_id))];

    return [...new Set([...flexGroupIds, ...fixedGroupIds, ...parkingGroupIds])];
}

async function loadGroupDetail(groupId) {
    const { data: group, error } = await _supabase
        .from('groups')
        .select('id, name, code, type, metadata, created_at, custom_mold')
        .eq('id', groupId)
        .single();

    if (error || !group) {
        console.error('Error loading group:', error);
        showToast(t('shared.error_generico'), 'error');
        return;
    }

    setCurrentGroup(group);

    // Ensure tab-grupos is visible if navigated from Inicio dashboard
    const tabGrupos = document.getElementById('tab-grupos');
    if (tabGrupos && tabGrupos.classList.contains('hidden')) {
        ['inicio', 'grupos', 'opciones'].forEach(id => {
            document.getElementById('tab-' + id)?.classList.toggle('hidden', id !== 'grupos');
            const nav = document.getElementById('nav-' + id);
            if (nav) {
                nav.classList.toggle('active', id === 'grupos');
                nav.classList.toggle('text-indigo-400', id === 'grupos');
                nav.classList.toggle('text-slate-500', id !== 'grupos');
            }
        });
    }

    if (group.type === GROUP_TYPES.FLEXIBLE) {
        await loadFlexibleGroupDetail(groupId, group.name);
    } else if (group.type === GROUP_TYPES.FIXED) {
        await loadFixedGroupDetail(groupId, group.name);
    } else if (group.type === GROUP_TYPES.PARKING) {
        await loadParkingGroupDetail(groupId, group.name);
    }
}

function getGroupTheme(type) {
    if (type === 'flexible') {
        return {
            border: 'border-indigo-500',
            text: 'text-indigo-400',
            badgeBg: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
            icon: 'fa-route'
        };
    }
    if (type === 'fixed') {
        return {
            border: 'border-amber-500',
            text: 'text-amber-400',
            badgeBg: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
            icon: 'fa-calendar-check'
        };
    }
    return {
        border: 'border-emerald-500',
        text: 'text-emerald-400',
        badgeBg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
        icon: 'fa-parking'
    };
}

// Group list rendering with type badges + copy/share code buttons
async function loadAllGroups() {
    if (!currentUser) return;
    const listEl = document.getElementById('html-groups-list');
    if (!listEl) return;

    const allGroupIds = await getUserGroupIds();

    if (allGroupIds.length === 0) {
        listEl.innerHTML = `
            <div class="card-dark p-8 rounded-[2rem] text-center space-y-3 border border-dashed border-slate-700">
                <i class="fas fa-users text-3xl text-slate-600"></i>
                <p class="text-slate-400 text-xs uppercase font-bold">${t('shared.no_grupos')}</p>
            </div>`;
        return;
    }

    const { data: groupData, error: groupError } = await _supabase
        .from('groups')
        .select('id, name, code, type')
        .in('id', allGroupIds)
        .order('created_at', { ascending: true });

    if (groupError) return console.warn('Error loading groups:', groupError);

    const groups = groupData || [];

    listEl.innerHTML = groups.map(g => {
        const theme = getGroupTheme(g.type);
        const safeId = escapeHtml(g.id);
        const safeName = escapeHtml(g.name);
        const safeCode = escapeHtml(g.code);

        return `
        <div onclick="loadGroupDetail('${safeId}')" class="p-5 card-dark rounded-3xl cursor-pointer border-l-4 ${theme.border} shadow-md hover:border-slate-500 transition-all active:scale-[0.99]">
            <div class="flex justify-between items-center gap-3">
                <div class="flex flex-col gap-2 items-start text-left min-w-0 flex-1">
                    <span class="inline-flex items-center gap-1.5 text-[9px] font-black uppercase px-2.5 py-1 rounded-full border ${theme.badgeBg}">
                        ${t('group_type.' + g.type)}
                    </span>
                    <span class="font-black text-base uppercase italic text-slate-100 truncate w-full">${safeName}</span>
                    <div class="flex items-center gap-2 mt-0.5">
                        <button type="button" onclick="copyGroupCode('${safeCode}', event)" title="${t('shared.copiar_codigo')}"
                            class="inline-flex items-center gap-2 text-[11px] font-bold text-slate-200 tracking-widest bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 px-3 py-1.5 rounded-xl transition-all">
                            <span>${safeCode}</span>
                            <i class="far fa-copy text-[10px] text-slate-400"></i>
                        </button>
                        <button type="button" onclick="shareGroupCode('${safeName}', '${safeCode}', event)" title="${t('shared.compartir')}"
                            class="w-8 h-8 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                            <i class="fas fa-share-alt text-[11px]"></i>
                        </button>
                    </div>
                </div>
                <div class="w-9 h-9 rounded-2xl bg-slate-900/70 flex items-center justify-center text-slate-500">
                    <i class="fas fa-chevron-right text-xs"></i>
                </div>
            </div>
        </div>`;
    }).join('');
}

// Compute quick today summary for the Inicio tab
async function loadTodayDashboard() {
    const container = document.getElementById('today-summary-container');
    if (!container || !currentUser) return;

    const todayDate = new Date();
    const todayYMD = formatLocalYMD(todayDate);
    const headerDateEl = document.getElementById('today-summary-date');
    if (headerDateEl) {
        headerDateEl.innerText = formatReadableDate(todayYMD, currentLang);
    }

    const refreshIcon = document.getElementById('today-refresh-icon');
    refreshIcon?.classList.add('animate-spin');

    // Skeleton cards while Supabase fetches group summaries
    container.innerHTML = [1, 2].map(() => `
        <div class="card-dark p-4 rounded-2xl border-l-4 border-slate-700 animate-pulse flex items-center justify-between gap-3">
            <div class="space-y-2 flex-1">
                <div class="h-3 w-28 bg-slate-700/80 rounded"></div>
                <div class="h-2.5 w-44 bg-slate-800 rounded"></div>
            </div>
            <div class="w-4 h-4 bg-slate-800 rounded"></div>
        </div>
    `).join('');

    try {
        const allGroupIds = await getUserGroupIds();
        if (allGroupIds.length === 0) {
            container.innerHTML = `
                <div class="card-dark p-5 rounded-3xl text-center border border-slate-800">
                    <p class="text-slate-400 text-xs font-bold">${t('shared.no_grupos')}</p>
                </div>`;
            if (typeof window.toggleStartActionPanel === 'function') {
                window.toggleStartActionPanel('create', true);
            }
            return;
        }

        const { data: groups } = await _supabase
            .from('groups')
            .select('id, name, code, type, metadata, created_at, custom_mold')
            .in('id', allGroupIds)
            .order('created_at', { ascending: true });

        if (!groups || groups.length === 0) {
            container.innerHTML = `<p class="text-slate-500 text-xs text-center py-2">${t('shared.sin_actividad_hoy')}</p>`;
            return;
        }

        const formatShortUpcomingDay = (dateStr) => {
            const d = parseLocalYMD(dateStr);
            const locale = currentLang === 'eu' ? 'eu-ES' : 'es-ES';
            return d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
        };

        const cards = await Promise.all(groups.map(async (g) => {
            const theme = getGroupTheme(g.type);
            let statusHtml = '';
            let highlightClass = '';

            if (g.type === 'flexible') {
                const { data: trips } = await _supabase.schema('flexible_carpooling')
                    .from('flexible_trips')
                    .select('*')
                    .eq('group_id', g.id)
                    .gte('date', todayYMD)
                    .order('date', { ascending: true })
                    .limit(30);

                const allUpcoming = trips || [];
                const todayTrips = allUpcoming.filter(tr => tr.date === todayYMD);
                const myTrips = todayTrips.filter(tr => (tr.passengers || []).includes(currentUser.id));
                const driving = todayTrips.some(tr => tr.real_driver_id === currentUser.id);

                if (driving) {
                    statusHtml = `<span class="text-emerald-400 font-black"><i class="fas fa-car mr-1"></i> ${t('shared.te_toca_conducir_hoy')}</span>`;
                    highlightClass = 'border-emerald-500/40 bg-emerald-950/20';
                } else if (myTrips.length > 0) {
                    statusHtml = `<span class="text-indigo-300 font-bold"><i class="fas fa-check-circle mr-1"></i> ${t('shared.viaje_hoy')} (${myTrips.length})</span>`;
                } else if (todayTrips.length > 0) {
                    statusHtml = `<span class="text-slate-300 font-bold">${todayTrips.length} ${t('shared.viaje_hoy')}</span>`;
                } else {
                    const futureTrips = allUpcoming.filter(tr => tr.date > todayYMD);
                    const nextTrip = futureTrips.find(tr => (tr.passengers || []).includes(currentUser.id)) || futureTrips[0];
                    const nextPart = nextTrip
                        ? ` · <span class="text-indigo-300 font-bold">${t('shared.proximo')} ${escapeHtml(formatShortUpcomingDay(nextTrip.date))}</span>`
                        : '';
                    statusHtml = `<span class="text-slate-500 font-semibold">${t('shared.sin_viajes_hoy')}${nextPart}</span>`;
                }
            } else if (g.type === 'fixed') {
                const [{ data: mems }, { data: trips }] = await Promise.all([
                    _supabase.schema('fixed_carpooling').from('fixed_members').select('*').eq('group_id', g.id),
                    _supabase.schema('fixed_carpooling').from('fixed_trips').select('*').eq('group_id', g.id)
                ]);

                const prevGroup = currentGroup;
                const prevMembers = state.members;
                const prevTrips = state.trips;
                currentGroup = g;
                state.members = mems || [];
                state.trips = trips || [];

                const trip = (trips || []).find(tr => tr.date === todayYMD);
                const recommended = typeof getRecommendedDriver === 'function' ? getRecommendedDriver(todayYMD) : null;
                const effectiveDriverId = trip?.effective_id !== undefined ? trip.effective_id : recommended;

                let nextFixedPart = '';
                if (!effectiveDriverId && trip?.status !== 'pending_relevo') {
                    for (let offset = 1; offset <= 14; offset++) {
                        const nextD = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate() + offset);
                        const nextYMD = formatLocalYMD(nextD);
                        const nextTrip = (trips || []).find(tr => tr.date === nextYMD);
                        if (nextTrip?.status === 'holiday' || nextTrip?.status === 'canceled') continue;
                        const nextRec = typeof getRecommendedDriver === 'function' ? getRecommendedDriver(nextYMD) : null;
                        const nextEff = nextTrip?.effective_id !== undefined ? nextTrip.effective_id : nextRec;
                        if (nextEff || nextTrip?.status === 'pending_relevo') {
                            const isMine = nextEff === currentUser.id;
                            nextFixedPart = ` · <span class="${isMine ? 'text-emerald-300' : 'text-amber-300'} font-bold">${t('shared.proximo')} ${escapeHtml(formatShortUpcomingDay(nextYMD))}${isMine ? ` (${t('shared.tu')})` : ''}</span>`;
                            break;
                        }
                    }
                }

                currentGroup = prevGroup;
                state.members = prevMembers;
                state.trips = prevTrips;

                if (trip?.status === 'holiday') {
                    statusHtml = `<span class="text-amber-300 font-bold">${t('fixed.dia_festivo')}${nextFixedPart}</span>`;
                } else if (trip?.status === 'canceled') {
                    statusHtml = `<span class="text-slate-400 font-bold">${t('fixed.viaje_cancelado')}${nextFixedPart}</span>`;
                } else if (trip?.status === 'pending_relevo') {
                    statusHtml = `<span class="text-red-400 font-black animate-pulse"><i class="fas fa-exclamation-triangle mr-1"></i> ${t('shared.estado_relevo_pendiente')}</span>`;
                    highlightClass = 'border-red-500/40 bg-red-950/20';
                } else if (effectiveDriverId === currentUser.id) {
                    statusHtml = `<span class="text-emerald-400 font-black"><i class="fas fa-car mr-1"></i> ${t('shared.te_toca_conducir_hoy')}</span>`;
                    highlightClass = 'border-emerald-500/40 bg-emerald-950/20';
                } else if (effectiveDriverId) {
                    const drv = (mems || []).find(m => m.user_id === effectiveDriverId);
                    statusHtml = `<span class="text-slate-300 font-bold">${t('shared.conduce_hoy')} <strong class="text-white">${escapeHtml(drv?.display_name || '---')}</strong></span>`;
                } else {
                    statusHtml = `<span class="text-slate-500 font-semibold">${t('shared.sin_viajes_hoy')}${nextFixedPart}</span>`;
                }
            } else if (g.type === 'parking') {
                const [{ data: mems }, { data: spots }, { data: att }] = await Promise.all([
                    _supabase.schema('parking').from('members').select('*').eq('group_id', g.id).order('order_index'),
                    _supabase.schema('parking').from('spots').select('*').eq('group_id', g.id).order('order_index'),
                    _supabase.schema('parking').from('attendance').select('*').eq('group_id', g.id).gte('date', todayYMD)
                ]);

                const prevParkingState = window.parkingState;
                let rawCustomMold = g.custom_mold;
                if (typeof rawCustomMold === 'string' && rawCustomMold.startsWith('{')) {
                    rawCustomMold = rawCustomMold.replace(/[{}]/g, '').split(',');
                } else if (typeof rawCustomMold === 'string') {
                    try { rawCustomMold = JSON.parse(rawCustomMold); } catch { rawCustomMold = null; }
                }

                const attendanceMap = {};
                (att || []).forEach(row => {
                    if (!attendanceMap[row.date]) attendanceMap[row.date] = [];
                    attendanceMap[row.date].push(row);
                });

                window.parkingState = {
                    members: mems || [],
                    spots: spots || [],
                    startDate: g.created_at ? new Date(g.created_at) : new Date(),
                    customMold: Array.isArray(rawCustomMold) && rawCustomMold.length > 0 ? rawCustomMold : null,
                    attendance: attendanceMap
                };

                const assignments = typeof window.getAssignmentsForDate === 'function' ? window.getAssignmentsForDate(todayDate) : [];
                const mine = assignments.find(a => a.user.user_id === currentUser.id);

                let nextParkingPart = '';
                if ((!mine || !mine.isAttending) && typeof window.getAssignmentsForDate === 'function') {
                    for (let offset = 1; offset <= 14; offset++) {
                        const nextD = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate() + offset);
                        const nextYMD = formatLocalYMD(nextD);
                        const nextAssigns = window.getAssignmentsForDate(nextD);
                        const nextMine = nextAssigns.find(a => a.user.user_id === currentUser.id);
                        if (nextMine && nextMine.isAttending) {
                            const spotNote = nextMine.finalSpotName ? ` (${escapeHtml(nextMine.finalSpotName)})` : '';
                            nextParkingPart = ` · <span class="text-emerald-300 font-bold">${t('shared.proximo')} ${escapeHtml(formatShortUpcomingDay(nextYMD))}${spotNote}</span>`;
                            break;
                        }
                    }
                }

                window.parkingState = prevParkingState;

                if (!mine || !mine.isAttending) {
                    statusHtml = `<span class="text-slate-500 font-semibold">${t('shared.no_aparcas_hoy')}${nextParkingPart}</span>`;
                } else if (mine.finalSpotName) {
                    statusHtml = `<span class="text-emerald-400 font-black"><i class="fas fa-parking mr-1"></i> ${t('shared.tienes_plaza_hoy')} <span class="bg-emerald-500/20 px-2 py-0.5 rounded-lg text-emerald-300">${escapeHtml(mine.finalSpotName)}</span></span>`;
                    highlightClass = 'border-emerald-500/40 bg-emerald-950/20';
                } else {
                    statusHtml = `<span class="text-amber-400 font-bold"><i class="fas fa-clock mr-1"></i> ${t('shared.en_reserva_hoy')}</span>`;
                }
            }

            return `
                <button type="button" onclick="loadGroupDetail('${escapeHtml(g.id)}')"
                    class="w-full text-left p-4 card-dark rounded-2xl border-l-4 ${theme.border} ${highlightClass} flex items-center justify-between gap-3 hover:border-slate-500 transition-all active:scale-[0.99]">
                    <div class="min-w-0 flex-1 space-y-1">
                        <div class="flex items-center gap-2">
                            <span class="font-black text-xs uppercase italic text-white truncate">${escapeHtml(g.name)}</span>
                            <span class="text-[8px] font-black uppercase ${theme.text}">${t('group_type.' + g.type).split(' ')[0]}</span>
                        </div>
                        <div class="text-[11px]">${statusHtml}</div>
                    </div>
                    <i class="fas fa-chevron-right text-slate-600 text-xs"></i>
                </button>
            `;
        }));

        container.innerHTML = cards.join('');
    } catch (err) {
        console.error('Error loading today dashboard:', err);
        container.innerHTML = `<p class="text-slate-500 text-xs text-center py-2">${t('shared.sin_actividad_hoy')}</p>`;
    } finally {
        refreshIcon?.classList.remove('animate-spin');
    }
}

Object.assign(window, {
    getCurrentGroupType,
    setCurrentGroup,
    getUserGroupIds,
    loadGroupDetail,
    loadAllGroups,
    loadTodayDashboard
});
