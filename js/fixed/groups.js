// ========== FIXED CARPOOLING GROUPS ==========
// Adapted from GidApp to work with unified structure

const MEMBER_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

let state = {
    members: [],
    trips: [],
    debts: []
};

async function createFixedMembership(groupId) {
    // Get member count to assign order_index
    const { count } = await _supabase.schema('fixed_carpooling').from('fixed_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId);

    const memberColor = MEMBER_COLORS[count % MEMBER_COLORS.length];

    await _supabase.schema('fixed_carpooling').from('fixed_members').insert({
        group_id: groupId,
        user_id: currentUser.id,
        order_index: (count || 0) + 1,
        display_name: currentUser.email.split('@')[0],
        color: memberColor
    });
}

async function joinFixedGroup(groupId) {
    // Get member count to assign order_index and color
    const { count } = await _supabase.schema('fixed_carpooling').from('fixed_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId);

    const memberColor = MEMBER_COLORS[count % MEMBER_COLORS.length];

    await _supabase.schema('fixed_carpooling').from('fixed_members').insert({
        group_id: groupId,
        user_id: currentUser.id,
        order_index: (count || 0) + 1,
        display_name: currentUser.email.split('@')[0],
        color: memberColor
    });
}

async function loadFixedGroupDetail(groupId, groupName) {
    // Load members
    const { data: mems } = await _supabase.schema('fixed_carpooling').from('fixed_members')
        .select('*')
        .eq('group_id', groupId);
    state.members = mems || [];
    groupMembers = mems || []; // For compatibility

    // Load trips
    const { data: trips } = await _supabase.schema('fixed_carpooling').from('fixed_trips')
        .select('*')
        .eq('group_id', groupId);
    state.trips = trips || [];
    allTrips = trips || []; // For compatibility

    // Load debts
    const { data: debts } = await _supabase.schema('fixed_carpooling').from('fixed_debts')
        .select('*')
        .eq('group_id', groupId);
    state.debts = debts || [];

    // Update UI
    document.getElementById('view-groups-list').classList.add('hidden');
    document.getElementById('view-group-detail-fixed').classList.remove('hidden');
    document.getElementById('label-group-name-fixed').innerText = groupName;

    // Render calendar for fixed groups
    if (window.renderFixedCalendar) {
        await renderFixedCalendar();
    }

    // Update "On Leave" button state
    if (window.updateOnLeaveButton) {
        updateOnLeaveButton();
    }
}

async function leaveFixedGroup(groupId) {
    if (!await showConfirm(t('shared.confirm_leave_group'))) return;

    await _supabase.schema('fixed_carpooling').from('fixed_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', currentUser.id);

    showToast(t('shared.toast_left_group'));

    if (currentGroupId === groupId) {
        currentGroupId = null;
        currentGroup = null;
        hideGroupDetail();
        switchTab('grupos');
    }

    loadAllGroups();
}

// Expose functions globally
Object.assign(window, {
    createFixedMembership,
    joinFixedGroup,
    loadFixedGroupDetail,
    leaveFixedGroup,
    state,
    MEMBER_COLORS
});