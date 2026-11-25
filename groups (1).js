// ========== PARKING GROUPS LOGIC ==========
window.currentGroupId = null;

window.parkingState = {
    members: [],
    spots: [],
    mold: [],
    attendance: {},
    customMold: null,
    isOwner: false
};

// 1. Join Parking Group
async function joinParkingGroup(groupId, spotType = 'shared', fixedSpotName = null) {
    const u = window.currentUser || window.user;
    if (!u) {
        console.error("joinParkingGroup Error: No user logged in");
        return;
    }

    try {
        let fixedSpotId = null;

        if (spotType === 'fixed' && fixedSpotName) {
            const { data: existingSpots } = await _supabase.schema('parking').from('spots')
                .select('order_index')
                .eq('group_id', groupId)
                .order('order_index', { ascending: false })
                .limit(1);

            const maxOrder = existingSpots?.[0]?.order_index || 0;

            const { data: newSpot, error: spotError } = await _supabase.schema('parking').from('spots').insert({
                group_id: groupId,
                name: fixedSpotName,
                order_index: maxOrder + 1,
                is_fixed_spot: true,
                owner_id: u.id
            }).select().single();

            if (spotError) throw spotError;
            fixedSpotId = newSpot.id;
        }

        const { count, error: countErr } = await _supabase.schema('parking').from('members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', groupId);

        if (countErr) console.warn("Count error (ignorable if first member):", countErr);

        const preferredName = document.getElementById('user-display-name')?.value.trim() || u.email.split('@')[0];

        const memberData = {
            group_id: groupId,
            user_id: u.id,
            display_name: preferredName,
            order_index: (count || 0) + 1,
            is_admin: (count === 0),
            routine: [1, 2, 3, 4, 5],
            has_fixed_spot: (spotType === 'fixed'),
            fixed_spot_id: fixedSpotId
        };

        const { error } = await _supabase.schema('parking').from('members').insert(memberData);
        if (error) throw error;
    } catch (err) {
        console.error("Exception in joinParkingGroup:", err);
        throw err;
    }
}

// 2. Load Parking Data
async function loadParkingGroupDetail(groupId, groupName) {
    ['view-groups-list', 'view-group-detail', 'view-group-detail-fixed', 'view-group-detail-parking', 'view-group-members'].forEach(id => {
        document.getElementById(id)?.classList.add('hidden');
    });
    document.getElementById('view-group-detail-parking').classList.remove('hidden');

    document.getElementById('parking-group-title').innerText = groupName;
    window.currentGroupId = groupId;

    const codeBadge = document.getElementById('parking-group-code-badge');
    if (codeBadge && currentGroup?.code) {
        codeBadge.innerText = currentGroup.code;
        codeBadge.classList.remove('hidden');
    }

    const p1 = _supabase.schema('parking').from('members').select('*').eq('group_id', groupId).order('order_index');
    const p2 = _supabase.schema('parking').from('spots').select('*').eq('group_id', groupId).order('order_index');
    const p3 = _supabase.from('groups').select('created_at, custom_mold').eq('id', groupId).single();

    const [membersRes, spotsRes, groupRes] = await Promise.all([p1, p2, p3]);

    if (membersRes.error) console.error(membersRes.error);
    if (spotsRes.error) console.error(spotsRes.error);
    if (groupRes.error) console.error('Error loading group data:', groupRes.error);

    window.parkingState.members = membersRes.data || [];
    window.parkingState.spots = spotsRes.data || [];
    window.parkingState.startDate = groupRes.data?.created_at ? new Date(groupRes.data.created_at) : new Date();

    let rawCustomMold = groupRes.data?.custom_mold;
    if (typeof rawCustomMold === 'string' && rawCustomMold.startsWith('{')) {
        rawCustomMold = rawCustomMold.replace(/[{}]/g, '').split(',');
    } else if (typeof rawCustomMold === 'string') {
        try { rawCustomMold = JSON.parse(rawCustomMold); } catch { rawCustomMold = null; }
    }

    let resolvedMold = (Array.isArray(rawCustomMold) && rawCustomMold.length > 0) ? rawCustomMold : null;
    if (!resolvedMold) {
        const localVal = localStorage.getItem(`parking_custom_mold_${groupId}`);
        if (localVal) {
            try {
                const parsed = JSON.parse(localVal);
                if (Array.isArray(parsed) && parsed.length > 0) resolvedMold = parsed;
            } catch { /* ignore */ }
        }
    }

    window.parkingState.customMold = resolvedMold;

    const currentUid = (window.currentUser || window.user)?.id;
    const myMember = window.parkingState.members.find(m => m.user_id === currentUid);
    window.parkingState.isAdmin = !!(myMember?.is_admin || (myMember?.order_index === 1));

    await fetchAttendanceRange();

    if (window.renderParkingCalendar) {
        renderParkingCalendar();
    }
}

async function fetchAttendanceRange() {
    if (!window.currentGroupId) return;

    const { data, error } = await _supabase.schema('parking')
        .from('attendance')
        .select('*')
        .eq('group_id', window.currentGroupId);

    if (error) {
        console.error("Error fetching attendance:", error);
        return;
    }

    window.parkingState.attendance = {};
    (data || []).forEach(at => {
        if (!window.parkingState.attendance[at.date]) window.parkingState.attendance[at.date] = [];
        window.parkingState.attendance[at.date].push(at);
    });
}

async function updateRoutine(routine) {
    if (!window.currentGroupId) return;

    const { error } = await _supabase.schema('parking')
        .from('members')
        .update({ routine: routine })
        .eq('group_id', window.currentGroupId)
        .eq('user_id', currentUser.id);

    if (error) {
        console.error("Error updating routine:", error);
        showToast(t('parking.error_rutina'), 'error');
        return;
    }

    await loadParkingGroupDetail(window.currentGroupId, document.getElementById('parking-group-title').innerText);
}

async function toggleAttendance(dateStr, isAttending) {
    if (!window.currentGroupId) return;

    const { error } = await _supabase.schema('parking')
        .from('attendance')
        .upsert({
            group_id: window.currentGroupId,
            user_id: currentUser.id,
            date: dateStr,
            is_attending: isAttending
        }, { onConflict: 'group_id,user_id,date' });

    if (error) {
        console.error("Error updating attendance:", error);
        showToast(t('parking.error_asistencia'), 'error');
        return;
    }

    await fetchAttendanceRange();
}

// 4. Spot Management
async function addSpot(name) {
    if (!name) return;

    const maxOrder = window.parkingState.spots.reduce((max, s) => Math.max(max, s.order_index || 0), 0);

    const { error } = await _supabase.schema('parking').from('spots').insert({
        group_id: window.currentGroupId,
        name: name,
        order_index: maxOrder + 1
    }).select().single();

    if (error) {
        console.error("Error adding spot:", error);
        showToast(t('shared.error_generico') + ": " + error.message, 'error');
        return;
    }

    await loadParkingGroupDetail(window.currentGroupId, document.getElementById('parking-group-title').innerText);
}

async function moveSpot(spotId, direction) {
    const spots = [...(window.parkingState.spots || [])];
    const idx = spots.findIndex(s => s.id === spotId);
    const targetIdx = idx + direction;
    if (idx < 0 || targetIdx < 0 || targetIdx >= spots.length) return;

    const current = spots[idx];
    const target = spots[targetIdx];
    const currentOrder = current.order_index ?? (idx + 1);
    const targetOrder = target.order_index ?? (targetIdx + 1);

    try {
        const [{ error: e1 }, { error: e2 }] = await Promise.all([
            _supabase.schema('parking').from('spots').update({ order_index: targetOrder }).eq('id', current.id),
            _supabase.schema('parking').from('spots').update({ order_index: currentOrder }).eq('id', target.id)
        ]);
        if (e1 || e2) throw e1 || e2;

        showToast(t('parking.reorder_success'), 'success');
        await loadParkingGroupDetail(window.currentGroupId, document.getElementById('parking-group-title').innerText);
    } catch (err) {
        console.error("Error reordering spots:", err);
        showToast(t('shared.error_generico'), 'error');
    }
}

async function deleteSpot(spotId) {
    if (!await showConfirm(t('parking.confirm_delete_spot'))) return;

    const { error } = await _supabase.schema('parking').from('spots').delete().eq('id', spotId);

    if (error) {
        showToast(t('shared.error_generico') + ": " + error.message, 'error');
        return;
    }

    await loadParkingGroupDetail(window.currentGroupId, document.getElementById('parking-group-title').innerText);
}

// 5. Custom Mold Management
function _moldKey(groupId) { return `parking_custom_mold_${groupId}`; }

async function saveCustomMold(moldArray) {
    if (!window.currentGroupId) return;

    const { error: updateError } = await _supabase
        .from('groups')
        .update({ custom_mold: moldArray })
        .eq('id', window.currentGroupId);

    if (updateError) {
        console.error('[Parking] Error updating custom_mold in Supabase:', updateError);
    }

    localStorage.setItem(_moldKey(window.currentGroupId), JSON.stringify(moldArray));
    window.parkingState.customMold = moldArray;

    if (updateError) throw updateError;
}

async function resetCustomMold() {
    if (!window.currentGroupId) return;

    const { error } = await _supabase
        .from('groups')
        .update({ custom_mold: null })
        .eq('id', window.currentGroupId);

    if (error) {
        console.error('[Parking] Error resetting custom_mold:', error);
    }

    localStorage.removeItem(_moldKey(window.currentGroupId));
    window.parkingState.customMold = null;
}

// Spot Type Selection Modal Functions
let pendingGroupId = null;

function openSpotTypeSelectionModal(groupId) {
    pendingGroupId = groupId;
    document.getElementById('modal-spot-type-selection').classList.remove('hidden');
    document.getElementById('fixed-spot-name-container').classList.add('hidden');
    document.getElementById('fixed-spot-name-input').value = '';
}

function closeSpotTypeSelectionModal() {
    document.getElementById('modal-spot-type-selection').classList.add('hidden');
    pendingGroupId = null;
}

async function selectSpotType(type) {
    if (type === 'shared') {
        if (pendingGroupId) {
            const gId = pendingGroupId;
            try {
                await joinParkingGroup(gId, 'shared');
                closeSpotTypeSelectionModal();
                showToast(t('shared.toast_group_joined'), 'success');
                if (typeof loadAllGroups === 'function') loadAllGroups();
            } catch (err) {
                showToast(t('shared.join_group_error'), 'error');
            }
        }
    } else if (type === 'fixed') {
        document.getElementById('fixed-spot-name-container').classList.remove('hidden');
    }
}

async function confirmFixedSpot() {
    const spotName = document.getElementById('fixed-spot-name-input').value.trim();
    if (!spotName) {
        showToast(t('parking.plaza_fija_error'), 'warning');
        return;
    }

    if (pendingGroupId) {
        const gId = pendingGroupId;
        try {
            await joinParkingGroup(gId, 'fixed', spotName);
            closeSpotTypeSelectionModal();
            showToast(t('shared.toast_group_joined'), 'success');
            if (typeof loadAllGroups === 'function') loadAllGroups();
        } catch (err) {
            showToast(t('shared.join_group_error'), 'error');
        }
    }
}

Object.assign(window, {
    joinParkingGroup,
    loadParkingGroupDetail,
    addSpot,
    moveSpot,
    deleteSpot,
    updateRoutine,
    toggleAttendance,
    fetchAttendanceRange,
    saveCustomMold,
    resetCustomMold,
    parkingState,
    openSpotTypeSelectionModal,
    closeSpotTypeSelectionModal,
    selectSpotType,
    confirmFixedSpot
});
