// ========== PARKING GROUPS LOGIC ==========
window.currentGroupId = null;

window.parkingState = {
    members: [],
    spots: [], // P1, P2...
    mold: [],   // The logic mold [P1, R1, P2...]
    attendance: {} // { "YYYY-MM-DD": [ { user_id, is_attending } ] }
};

// 1. Join Parking Group
async function joinParkingGroup(groupId) {
    const u = window.currentUser || window.user;
    if (!u) {
        console.error("joinParkingGroup Error: No user logged in");
        return;
    }

    console.log("joinParkingGroup start for:", u.id, "target group:", groupId);

    try {
        // Get member count to assign order_index
        const { count, error: countErr } = await _supabase.schema('parking').from('members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', groupId);

        if (countErr) console.warn("Count error (ignorable if first member):", countErr);

        const memberData = {
            group_id: groupId,
            user_id: u.id,
            display_name: u.email.split('@')[0],
            order_index: (count || 0) + 1,
            routine: [1, 2, 3, 4, 5] // Mon-Fri by default
        };

        const { error } = await _supabase.schema('parking').from('members').insert(memberData);

        if (error) {
            console.error("Error joining parking group:", error);
            throw error;
        }

        console.log("Successfully joined parking group:", groupId);
    } catch (err) {
        console.error("Exception in joinParkingGroup:", err);
        throw err;
    }
}

// 2. Load Parking Data
async function loadParkingGroupDetail(groupId, groupName) {
    // 1. UI Switch
    ['view-groups-list', 'view-group-detail', 'view-group-detail-fixed', 'view-group-detail-parking'].forEach(id => {
        document.getElementById(id)?.classList.add('hidden');
    });
    document.getElementById('view-group-detail-parking').classList.remove('hidden');

    // Labels
    document.getElementById('parking-group-title').innerText = groupName;
    window.currentGroupId = groupId; // Set global

    // 2. Load Data (Parallel) - Simplified Fetch
    const p1 = _supabase.schema('parking').from('members').select('*').eq('group_id', groupId).order('order_index');
    const p2 = _supabase.schema('parking').from('spots').select('*').eq('group_id', groupId).order('order_index');
    const p3 = _supabase.from('groups').select('start_date').eq('id', groupId).single();

    const [membersRes, spotsRes, groupRes] = await Promise.all([p1, p2, p3]);

    if (membersRes.error) console.error(membersRes.error);
    if (spotsRes.error) console.error(spotsRes.error);

    window.parkingState.members = membersRes.data || [];
    window.parkingState.spots = spotsRes.data || [];
    window.parkingState.startDate = groupRes.data?.start_date ? new Date(groupRes.data.start_date) : new Date();

    // Fetch attendance for current range (will be called again by calendar render if range changes)
    await fetchAttendanceRange();

    // 3. Render
    if (window.renderParkingCalendar) {
        renderParkingCalendar();
    }
}

async function fetchAttendanceRange() {
    if (!window.currentGroupId) return;

    // For simplicity, fetch all attendance for this group. 
    // In a huge app, we'd limit to current view range.
    const { data, error } = await _supabase.schema('parking')
        .from('attendance')
        .select('*')
        .eq('group_id', window.currentGroupId);

    if (error) {
        console.error("Error fetching attendance:", error);
        return;
    }

    // Organize by date
    window.parkingState.attendance = {};
    data.forEach(at => {
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
        alert("Error al guardar rutina");
        return;
    }

    // Refresh state
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
        alert("Error al actualizar asistencia");
        return;
    }

    // Refresh state
    await fetchAttendanceRange();
}

// 4. Spot Management
async function addSpot(name) {
    if (!name) return;

    // Get max order
    const maxOrder = window.parkingState.spots.reduce((max, s) => Math.max(max, s.order_index), 0);

    const { data, error } = await _supabase.schema('parking').from('spots').insert({
        group_id: window.currentGroupId,
        name: name,
        order_index: maxOrder + 1
    }).select().single();

    if (error) {
        console.error("Error adding spot:", error);
        alert("Error: " + error.message);
        return;
    }

    // Refresh local state
    await loadParkingGroupDetail(window.currentGroupId, document.getElementById('parking-group-title').innerText);
}

async function deleteSpot(spotId) {
    if (!confirm("¿Eliminar plaza? Esto afectará a la rotación futura.")) return;

    const { error } = await _supabase.schema('parking').from('spots').delete().eq('id', spotId);

    if (error) {
        alert("Error: " + error.message);
        return;
    }

    // Refresh local state
    await loadParkingGroupDetail(window.currentGroupId, document.getElementById('parking-group-title').innerText);
}

// Expose
Object.assign(window, {
    joinParkingGroup,
    loadParkingGroupDetail,
    addSpot,
    deleteSpot,
    updateRoutine,
    toggleAttendance,
    fetchAttendanceRange,
    parkingState
});
