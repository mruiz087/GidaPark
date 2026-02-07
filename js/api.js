async function loadGroups() {
    const { data } = await _supabase.from('group_members').select('groups(id, name, invite_code)').eq('user_id', user.id);
    document.getElementById('html-groups-list').innerHTML = (data || []).map(g => `
        <div onclick="showGroupDetail('${g.groups.id}', '${g.groups.name}')" class="p-6 card-dark rounded-3xl cursor-pointer border-l-8 border-indigo-600 shadow-md">
            <div class="flex justify-between items-center">
                <div class="flex flex-col gap-2 items-start text-left">
                    <span class="font-black text-sm uppercase italic text-slate-200">${g.groups.name}</span>
                    <span class="text-[11px] font-bold text-white tracking-widest bg-slate-900 w-24 py-1.5 rounded-lg inline-block text-center">${g.groups.invite_code}</span>
                </div>
                <i class="fas fa-chevron-right text-slate-700"></i>
            </div>
        </div>
    `).join('') || `<p class="text-slate-500 text-xs uppercase font-bold pt-4">${t('no_groups')}</p>`;
}

async function updateProfileName() {
    const name = document.getElementById('user-display-name').value;
    if (!name) return;
    await _supabase.from('group_members').update({ display_name: name }).eq('user_id', user.id);
    showToast(t('toast_name_saved'));
}

async function confirmTripCreation() {
    const type = selectedTripType;
    const repeat = selectedTripRepeat;
    let tripDates = [selectedDate];
    // Crear fechas de viaje (si repeat es 4, crea 4 semanas en total incluyendo hoy)
    for (let i = 1; i < repeat; i++) {
        let d = new Date(selectedDate);
        d.setUTCDate(d.getUTCDate() + (i * 7)); // Usar UTC para evitar problemas de zona horaria
        tripDates.push(d.toISOString().split('T')[0]);
    }

    // Crear viajes con el tipo seleccionado (ida_vuelta es un tipo único)
    await _supabase.from('trips').insert(tripDates.map(date => ({
        group_id: currentGroupId, date, passengers: [user.id], type
    })));

    // Resetear valores por defecto y UI
    selectedTripType = 'ida_vuelta';
    selectedTripRepeat = 0;

    // Resetear botones del modal visualmente
    document.querySelectorAll('#modal-trip .btn-selector').forEach(btn => btn.classList.remove('active'));
    document.querySelector('#modal-trip [onclick*="ida_vuelta"]').classList.add('active');
    document.querySelector('#modal-trip [onclick*="(0, event)"]').classList.add('active');

    closeTripModal();
    refreshCalendar();
}

async function setRealDriver(tripId, driverId) {
    const trip = allTrips.find(x => x.id === tripId);
    if (!trip) return;

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tripDate = new Date(trip.date);
    if (tripDate < today) return showToast(t('toast_past_days'));

    await _supabase.from('trips').update({ real_driver_id: driverId || null }).eq('id', tripId);
    refreshCalendar();
}

async function toggleTrip(id, isI, count) {
    let trip = allTrips.find(x => x.id === id);
    if (!trip) return;

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tripDate = new Date(trip.date);
    if (tripDate < today) return showToast(t('toast_past_days'));

    // Si intenta abandonar y es el conductor real, no dejarle
    if (isI && trip.real_driver_id === user.id) {
        return showToast(t('toast_is_driver'));
    }

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
    showToast("Código: " + code);
    switchTab('grupos');
}

async function joinGroup() {
    const code = document.getElementById('join-code').value.toUpperCase();
    const { data: g } = await _supabase.from('groups').select('id').eq('invite_code', code).single();
    if (!g) return showToast(t('toast_invalid_code'));
    await _supabase.from('group_members').insert([{ group_id: g.id, user_id: user.id, user_email: user.email, aporta_coche: true }]);
    switchTab('grupos');
}




