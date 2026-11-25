// ========== FIXED CARPOOLING GROUPS ==========
// Adapted from GidApp to work with unified structure

const MEMBER_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

let state = {
    members: [],
    trips: [],
    debts: []
};

async function createFixedMembership(groupId) {
    const { count } = await _supabase.schema('fixed_carpooling').from('fixed_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId);

    const memberColor = MEMBER_COLORS[(count || 0) % MEMBER_COLORS.length];
    const preferredName = document.getElementById('user-display-name')?.value.trim() || currentUser.email.split('@')[0];

    await _supabase.schema('fixed_carpooling').from('fixed_members').insert({
        group_id: groupId,
        user_id: currentUser.id,
        order_index: (count || 0) + 1,
        display_name: preferredName,
        color: memberColor
    });
}

async function joinFixedGroup(groupId) {
    const { count } = await _supabase.schema('fixed_carpooling').from('fixed_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId);

    const memberColor = MEMBER_COLORS[(count || 0) % MEMBER_COLORS.length];
    const preferredName = document.getElementById('user-display-name')?.value.trim() || currentUser.email.split('@')[0];

    await _supabase.schema('fixed_carpooling').from('fixed_members').insert({
        group_id: groupId,
        user_id: currentUser.id,
        order_index: (count || 0) + 1,
        display_name: preferredName,
        color: memberColor
    });
}

async function loadFixedGroupDetail(groupId, groupName) {
    const [{ data: mems }, { data: trips }, { data: debts }] = await Promise.all([
        _supabase.schema('fixed_carpooling').from('fixed_members').select('*').eq('group_id', groupId),
        _supabase.schema('fixed_carpooling').from('fixed_trips').select('*').eq('group_id', groupId),
        _supabase.schema('fixed_carpooling').from('fixed_debts').select('*').eq('group_id', groupId)
    ]);

    state.members = mems || [];
    groupMembers = mems || [];
    state.trips = trips || [];
    allTrips = trips || [];
    state.debts = debts || [];

    document.getElementById('view-groups-list').classList.add('hidden');
    document.getElementById('view-group-detail-fixed').classList.remove('hidden');
    document.getElementById('label-group-name-fixed').innerText = groupName;

    const codeBadge = document.getElementById('fixed-group-code-badge');
    if (codeBadge && currentGroup?.code) {
        codeBadge.innerText = currentGroup.code;
        codeBadge.classList.remove('hidden');
    }

    const now = new Date();
    viewDate = new Date(now.getFullYear(), now.getMonth(), 1);

    if (window.renderFixedCalendar) {
        await renderFixedCalendar();
    }

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

    showToast(t('shared.toast_left_group'), 'info');

    if (currentGroupId === groupId) {
        currentGroupId = null;
        currentGroup = null;
        hideGroupDetail();
        switchTab('grupos');
    }

    loadAllGroups();
}

Object.assign(window, {
    createFixedMembership,
    joinFixedGroup,
    loadFixedGroupDetail,
    leaveFixedGroup,
    state,
    MEMBER_COLORS
});