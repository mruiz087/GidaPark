async function loadGroups() {
    const { data } = await _supabase.from('group_members').select('groups(id, name)').eq('user_id', user.id);
    document.getElementById('html-groups-list').innerHTML = (data || []).map(g => `
        <div onclick="showGroupDetail('${g.groups.id}', '${g.groups.name}')" class="p-6 card-dark rounded-3xl flex justify-between items-center cursor-pointer border-l-8 border-indigo-600 shadow-md">
            <span class="font-black text-sm uppercase italic text-slate-200">${g.groups.name}</span>
            <i class="fas fa-chevron-right text-slate-700"></i>
        </div>
    `).join('') || '<p class="text-slate-500 text-xs uppercase font-bold pt-4">No tienes grupos todavía</p>';
}

async function updateProfileName() {
    const name = document.getElementById('user-display-name').value;
    if (!name) return;
    await _supabase.from('group_members').update({ display_name: name }).eq('user_id', user.id);
    showToast("Nombre guardado");
}

async function confirmTripCreation() {
    const type = selectedTripType;  // Usar variable en lugar de select
    const repeat = selectedTripRepeat;  // Usar variable en lugar de select
    let tripDates = [selectedDate];
    for (let i = 1; i <= repeat; i++) {
        let d = new Date(selectedDate);
        d.setDate(d.getDate() + (i * 7));
        tripDates.push(d.toISOString().split('T')[0]);
    }

    // Si es ida y vuelta, crear dos conjuntos de viajes
    if (type === 'ida_vuelta') {
        const tripsIda = tripDates.map(date => ({
            group_id: currentGroupId, date, passengers: [user.id], type: 'ida'
        }));
        const tripsVuelta = tripDates.map(date => ({
            group_id: currentGroupId, date, passengers: [user.id], type: 'vuelta'
        }));
        await _supabase.from('trips').insert([...tripsIda, ...tripsVuelta]);
    } else {
        // Crear solo el tipo seleccionado
        await _supabase.from('trips').insert(tripDates.map(date => ({
            group_id: currentGroupId, date, passengers: [user.id], type
        })));
    }

    // Resetear valores por defecto
    selectedTripType = 'ida_vuelta';
    selectedTripRepeat = 0;

    closeTripModal();
    refreshCalendar();
}

async function setRealDriver(tripId, driverId) {
    await _supabase.from('trips').update({ real_driver_id: driverId || null }).eq('id', tripId);
    refreshCalendar();
}

async function toggleTrip(id, isI, count) {
    let trip = allTrips.find(x => x.id === id);
    if (isI && count === 1) await _supabase.from('trips').delete().eq('id', id);
    else {
        let p = isI ? trip.passengers.filter(u => u !== user.id) : [...trip.passengers, user.id];
        await _supabase.from('trips').update({ passengers: p }).eq('id', id);
    }
    refreshCalendar();
}

async function loadUserData() {
    const { data } = await _supabase.from('group_members').select('aporta_coche, display_name').eq('user_id', user.id).limit(1).single();
    if (data) {
        document.getElementById('user-has-car').checked = data.aporta_coche;
        document.getElementById('user-display-name').value = data.display_name || '';
    }
}

async function updateCarStatus() {
    await _supabase.from('group_members').update({ aporta_coche: document.getElementById('user-has-car').checked }).eq('user_id', user.id);
}

async function createGroup() {
    const name = document.getElementById('new-group-name').value; if (!name) return;
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { data: g } = await _supabase.from('groups').insert([{ name, invite_code: code, admin_id: user.id }]).select().single();
    await _supabase.from('group_members').insert([{ group_id: g.id, user_id: user.id, user_email: user.email, aporta_coche: true }]);
    alert("Código: " + code);
    switchTab('grupos');
}

async function joinGroup() {
    const code = document.getElementById('join-code').value.toUpperCase();
    const { data: g } = await _supabase.from('groups').select('id').eq('invite_code', code).single();
    if (!g) return alert("Código no válido");
    await _supabase.from('group_members').insert([{ group_id: g.id, user_id: user.id, user_email: user.email, aporta_coche: true }]);
    switchTab('grupos');
}

async function leaveGroup() {
    if (!confirm("¿Salir del grupo actual?")) return;
    await _supabase.from('group_members').delete().eq('group_id', currentGroupId).eq('user_id', user.id);
    showToast("Has salido del grupo");
    hideGroupDetail();
    loadGroups();
}

async function deleteAccount() {
    if (!confirm("¿Borrar cuenta?")) return;
    await _supabase.from('group_members').delete().eq('user_id', user.id);
    await _supabase.auth.signOut();
    location.reload();
}
