// ========== FLEXIBLE CARPOOLING API ==========

// Group type selection state
let selectedGroupType = 'flexible';

function selectGroupType(type, event) {
    selectedGroupType = type;
    const grid = event.target.closest('.grid');
    grid?.querySelectorAll('.btn-selector').forEach(btn => btn.classList.remove('active'));
    event.target.closest('.btn-selector')?.classList.add('active');
}

async function createFixedGroupMember(groupId) {
    if (window.createFixedMembership) {
        await window.createFixedMembership(groupId);
    }
}

async function loadUserData() {
    if (!user) return;

    let name = null;

    // 1. Try flexible
    const { data: flexData } = await _supabase.schema('flexible_carpooling')
        .from('flexible_members')
        .select('display_name')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
    name = flexData?.display_name;

    // 2. Try fixed
    if (!name) {
        const { data: fixedData } = await _supabase.schema('fixed_carpooling')
            .from('fixed_members')
            .select('display_name')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle();
        name = fixedData?.display_name;
    }

    // 3. Try parking
    if (!name) {
        const { data: parkingData } = await _supabase.schema('parking')
            .from('members')
            .select('display_name')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle();
        name = parkingData?.display_name;
    }

    const input = document.getElementById('user-display-name');
    if (input) input.value = name || '';

    const headerUserEl = document.getElementById('header-user-name');
    if (headerUserEl) {
        headerUserEl.innerText = name || user.email?.split('@')[0] || '';
    }
}

async function createGroup() {
    const nameInput = document.getElementById('new-group-name');
    const name = nameInput?.value.trim();
    if (!name) {
        showToast(t('shared.fill_fields'), 'warning');
        return;
    }
    const code = generateGroupCode(8);
    const type = selectedGroupType;

    const { data: newGroup, error } = await _supabase.from('groups').insert({ name, code, owner_id: user.id, type }).select().single();
    if (error) {
        showToast(t('shared.create_group_error'), 'error');
        return;
    }

    if (type === 'flexible') {
        const { error: memErr } = await _supabase.schema('flexible_carpooling').from('flexible_members').insert({
            group_id: newGroup.id,
            user_id: user.id,
            user_email: user.email,
            display_name: document.getElementById('user-display-name')?.value.trim() || user.email.split('@')[0],
            aporta_coche: false
        });
        if (memErr) {
            showToast(t('shared.create_group_error'), 'error');
            return;
        }
    } else if (type === 'fixed') {
        await createFixedGroupMember(newGroup.id);
    } else if (type === 'parking') {
        if (window.openSpotTypeSelectionModal) {
            window.openSpotTypeSelectionModal(newGroup.id);
        } else {
            console.error("openSpotTypeSelectionModal is not defined on window object");
        }
    }

    nameInput.value = '';
    selectedGroupType = 'flexible';
    document.querySelectorAll('#tab-inicio .btn-selector').forEach(btn => btn.classList.remove('active'));
    document.getElementById('type-flexible')?.classList.add('active');

    showToast(t('shared.toast_group_created'), 'success');
    if (typeof window.toggleStartActionPanel === 'function') window.toggleStartActionPanel(null);
    switchTab('grupos');
}

async function joinGroup() {
    const btn = document.getElementById('btn-join-group');
    const input = document.getElementById('join-code');
    const code = input.value.trim().toUpperCase();
    if (!code || btn.disabled) {
        if (!code) showToast(t('shared.fill_fields'), 'warning');
        return;
    }

    btn.disabled = true;
    btn.style.opacity = "0.5";

    try {
        const { data: g } = await _supabase.from('groups').select('id, type').eq('code', code).maybeSingle();
        if (!g) {
            showToast(t('shared.toast_invalid_code'), 'error');
            return;
        }

        let schema, table;
        if (g.type === 'flexible') {
            schema = 'flexible_carpooling';
            table = 'flexible_members';
        } else if (g.type === 'fixed') {
            schema = 'fixed_carpooling';
            table = 'fixed_members';
        } else if (g.type === 'parking') {
            schema = 'parking';
            table = 'members';
        }

        const { data: memberCheck } = await _supabase.schema(schema).from(table)
            .select('id')
            .eq('group_id', g.id)
            .eq('user_id', user.id);

        if (memberCheck && memberCheck.length > 0) {
            showToast(t('shared.toast_already_in_group'), 'info');
            input.value = "";
            switchTab('grupos');
            return;
        }

        const preferredName = document.getElementById('user-display-name')?.value.trim() || user.email.split('@')[0];

        if (g.type === 'flexible') {
            await _supabase.schema('flexible_carpooling').from('flexible_members').insert([
                { group_id: g.id, user_id: user.id, user_email: user.email, display_name: preferredName, aporta_coche: true }
            ]);
            showToast(t('shared.toast_group_joined'), 'success');
        } else if (g.type === 'fixed') {
            if (window.joinFixedGroup) {
                await window.joinFixedGroup(g.id);
                showToast(t('shared.toast_group_joined'), 'success');
            }
        } else if (g.type === 'parking') {
            if (window.openSpotTypeSelectionModal) {
                try {
                    window.openSpotTypeSelectionModal(g.id);
                } catch (err) {
                    console.error("Error opening spot type selection:", err);
                    showToast(t('shared.join_group_error'), 'error');
                    return;
                }
            } else {
                showToast(t('shared.error_generico'), 'error');
                return;
            }
        }

        input.value = "";
        if (typeof window.toggleStartActionPanel === 'function') window.toggleStartActionPanel(null);
        switchTab('grupos');
    } catch (err) {
        console.error(err);
        showToast(t('shared.join_group_error'), 'error');
    } finally {
        btn.disabled = false;
        btn.style.opacity = "1";
    }
}

async function loadFlexibleGroupDetail(groupId, groupName) {
    document.getElementById('view-groups-list').classList.add('hidden');
    document.getElementById('view-group-detail').classList.remove('hidden');
    document.getElementById('label-group-name').innerText = groupName;

    const codeBadge = document.getElementById('flex-group-code-badge');
    if (codeBadge && currentGroup?.code) {
        codeBadge.innerText = currentGroup.code;
        codeBadge.classList.remove('hidden');
    }

    const { data: members, error: memberError } = await _supabase.schema('flexible_carpooling')
        .from('flexible_members')
        .select('*')
        .eq('group_id', groupId);

    if (memberError) {
        console.error("Error fetching members:", memberError);
        return;
    }

    groupMembers = (members || []).map(m => ({
        ...m,
        user_email: m.user_email || '---',
        display_name: m.display_name || m.user_email?.split('@')[0] || 'Usuario'
    }));

    const me = groupMembers.find(m => m.user_id === user.id);
    const carCheckbox = document.getElementById('group-user-has-car');
    if (carCheckbox) carCheckbox.checked = me?.aporta_coche || false;

    const now = new Date();
    viewDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const todayYMD = formatLocalYMD(now);

    await loadFlexibleTrips();
    if (typeof selectDay === 'function') selectDay(todayYMD, false);
    refreshCalendar();
}

async function updateProfileName() {
    const input = document.getElementById('user-display-name');
    if (!input || !user) return;

    const newName = input.value.trim();
    if (!newName) return showToast(t('shared.fill_fields'), 'warning');

    try {
        await Promise.all([
            _supabase.schema('flexible_carpooling').from('flexible_members').update({ display_name: newName }).eq('user_id', user.id),
            _supabase.schema('fixed_carpooling').from('fixed_members').update({ display_name: newName }).eq('user_id', user.id),
            _supabase.schema('parking').from('members').update({ display_name: newName }).eq('user_id', user.id)
        ]);

        const headerUserEl = document.getElementById('header-user-name');
        if (headerUserEl) headerUserEl.innerText = newName;

        showToast(t('shared.toast_name_saved'), 'success');

        if (typeof renderMembersList === 'function') renderMembersList();
        if (currentGroupType === 'fixed' && typeof refreshFixedData === 'function') {
            await refreshFixedData();
        }
    } catch (err) {
        console.error("Error updating profile name:", err);
        showToast(t('shared.error_generico'), 'error');
    }
}

async function loadFlexibleTrips() {
    const { data: trips } = await _supabase.schema('flexible_carpooling')
        .from('flexible_trips')
        .select('*')
        .eq('group_id', currentGroupId);
    allTrips = trips || [];
}

async function confirmTripCreation() {
    if (!selectedDate) return;
    const type = selectedTripType;
    const repeat = selectedTripRepeat;
    const tripDates = [selectedDate];

    const baseDate = parseLocalYMD(selectedDate);
    for (let i = 1; i < repeat; i++) {
        const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + (i * 7));
        tripDates.push(formatLocalYMD(d));
    }

    const { error } = await _supabase.schema('flexible_carpooling').from('flexible_trips').insert(
        tripDates.map(date => ({
            group_id: currentGroupId,
            date,
            passengers: [user.id],
            type
        }))
    );

    if (error) {
        showToast(t('shared.error_generico'), 'error');
        return;
    }

    selectedTripType = 'ida_vuelta';
    selectedTripRepeat = 0;

    document.querySelectorAll('#modal-trip .btn-selector').forEach(btn => btn.classList.remove('active'));
    document.querySelector('#modal-trip [onclick*="ida_vuelta"]')?.classList.add('active');
    document.querySelector('#modal-trip [onclick*="(0, event)"]')?.classList.add('active');

    closeTripModal();
    refreshCalendar();
}

async function setRealDriver(tripId, driverId) {
    const trip = allTrips.find(x => x.id === tripId);
    if (!trip) return;

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tripDate = parseLocalYMD(trip.date);
    if (tripDate < today) return showToast(t('flexible.toast_past_days'), 'warning');

    await _supabase.schema('flexible_carpooling').from('flexible_trips')
        .update({ real_driver_id: driverId || null })
        .eq('id', tripId);
    refreshCalendar();
}

async function toggleTrip(id, isI, count) {
    const trip = allTrips.find(x => x.id === id);
    if (!trip) return;

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tripDate = parseLocalYMD(trip.date);
    if (tripDate < today) return showToast(t('flexible.toast_past_days'), 'warning');

    if (isI && trip.real_driver_id === user.id) {
        return showToast(t('flexible.toast_is_driver'), 'warning');
    }

    if (isI && count === 1) {
        await _supabase.schema('flexible_carpooling').from('flexible_trips').delete().eq('id', id);
    } else {
        const p = isI ? trip.passengers.filter(u => u !== user.id) : [...trip.passengers, user.id];
        await _supabase.schema('flexible_carpooling').from('flexible_trips').update({ passengers: p }).eq('id', id);
    }
    refreshCalendar();
}

async function cleanupFutureTrips(groupId) {
    if (!user) return;
    const today = formatLocalYMD(new Date());

    const { data: trips, error } = await _supabase.schema('flexible_carpooling').from('flexible_trips')
        .select('*')
        .eq('group_id', groupId)
        .gte('date', today);

    if (error || !trips) return;

    for (const trip of trips) {
        const updates = {};
        let changed = false;

        const pax = Array.isArray(trip.passengers) ? trip.passengers : [];
        if (pax.includes(user.id)) {
            updates.passengers = pax.filter(id => id !== user.id);
            changed = true;
        }

        if (trip.real_driver_id === user.id) {
            updates.real_driver_id = null;
            changed = true;
        }

        if (changed) {
            const finalPax = updates.passengers !== undefined ? updates.passengers : pax;
            if (finalPax.length === 0) {
                await _supabase.schema('flexible_carpooling').from('flexible_trips').delete().eq('id', trip.id);
            } else {
                await _supabase.schema('flexible_carpooling').from('flexible_trips').update(updates).eq('id', trip.id);
            }
        }
    }
}

Object.assign(window, {
    selectGroupType,
    loadUserData,
    createGroup,
    joinGroup,
    loadFlexibleGroupDetail,
    loadFlexibleTrips,
    updateProfileName,
    confirmTripCreation,
    setRealDriver,
    toggleTrip,
    cleanupFutureTrips
});
