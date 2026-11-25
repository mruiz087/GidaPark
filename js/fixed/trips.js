// --- GESTIÓN DE VIAJES ---

async function crearViajePuntualDirecto(date) {
    if (!assertNotPastDate(date)) return;

    const { error } = await _supabase.schema('fixed_carpooling').from('fixed_trips').insert({
        group_id: currentGroup.id,
        date: date,
        status: 'substituted',
        effective_id: currentUser.id,
        type: 'single',
        creator_id: currentUser.id
    });

    if (!error) {
        showToast(t('fixed.viaje_puntual_creado'), 'success');
        await refreshFixedData();
        cerrarModal();
    } else {
        showToast(t('fixed.error_guardar'), 'error');
    }
}

async function guardarConfiguracionMaestra() {
    if (!selectedDays.length) return showToast(t('fixed.selecciona_dia'), 'warning');

    const nuevaRutina = {
        dias: selectedDays,
        fecha_inicio: currentGroup?.metadata?.rutina?.fecha_inicio || new Date().toISOString(),
        consecutivos: parseInt(document.getElementById('consectuvios-input')?.value || 2)
    };

    try {
        const { error: rutinaError } = await _supabase.from('groups').update({
            metadata: { ...currentGroup.metadata, rutina: nuevaRutina }
        }).eq('id', currentGroup.id);

        if (rutinaError) throw rutinaError;

        await Promise.all(state.members.map(member =>
            _supabase.schema('fixed_carpooling').from('fixed_members')
                .update({ order_index: member.order_index })
                .eq('id', member.id)
        ));

        if (!currentGroup.metadata) currentGroup.metadata = {};
        currentGroup.metadata.rutina = nuevaRutina;

        showToast(t('fixed.rutina_guardada'), 'success');

        document.getElementById('modal-config-rutina').classList.add('hidden');
        cerrarModal();

        await refreshFixedData();
        renderFixedCalendar();
    } catch (error) {
        console.error("Error Supabase:", error);
        showToast(t('fixed.error_guardar') + ": " + error.message, 'error');
    }
}

async function confirmarEliminarRutina() {
    if (!currentGroup) return;

    const ok = await showConfirm(
        `${t('fixed.confirm_elim_rutina')} "${currentGroup.name}"?\n\n${t('fixed.elim_rutina_desc')}`
    );
    if (!ok) return;

    try {
        const { error } = await _supabase.from('groups')
            .update({
                metadata: { ...currentGroup.metadata, rutina: { dias: [], fecha_inicio: null } }
            })
            .eq('id', currentGroup.id);

        if (error) throw error;

        if (currentGroup.metadata) {
            currentGroup.metadata.rutina = { dias: [], fecha_inicio: null };
        }

        document.getElementById('modal-config-rutina')?.classList.add('hidden');
        showToast(t('fixed.rutina_eliminada'), 'info');
        await refreshFixedData();
    } catch (err) {
        console.error("Error al eliminar rutina:", err);
        showToast(t('fixed.error_eliminar'), 'error');
    }
}

async function pedirRelevo() {
    const dateStr = document.getElementById('modal-viaje').dataset.date;
    if (!currentGroupId || !currentUser) return showToast(t('shared.error_generico'), 'error');
    if (!assertNotPastDate(dateStr)) return;

    try {
        const { data: existing } = await _supabase.schema('fixed_carpooling').from('fixed_trips')
            .select('id')
            .eq('group_id', currentGroupId)
            .eq('date', dateStr)
            .maybeSingle();

        const payload = {
            group_id: currentGroupId,
            date: dateStr,
            status: 'pending_relevo',
            effective_id: null,
            type: 'routine_mod',
            creator_id: currentUser.id
        };

        let result;
        if (existing) {
            result = await _supabase.schema('fixed_carpooling').from('fixed_trips')
                .update(payload)
                .eq('id', existing.id);
        } else {
            result = await _supabase.schema('fixed_carpooling').from('fixed_trips')
                .insert(payload);
        }

        if (result.error) throw result.error;

        showToast(t('fixed.relevo_solicitado'), 'info');
        await refreshFixedData();
        cerrarModal();
        if (typeof renderFixedCalendar === 'function') renderFixedCalendar();
    } catch (err) {
        console.error("Error in pedirRelevo:", err);
        showToast(t('shared.error_generico'), 'error');
    }
}

async function tomarRelevo() {
    const modal = document.getElementById('modal-viaje');
    const date = modal.dataset.date;
    if (!currentGroupId || !currentUser) return;
    if (!assertNotPastDate(date)) return;
    const defaultDriverId = getRecommendedDriver(date);

    try {
        const { data: existing } = await _supabase.schema('fixed_carpooling').from('fixed_trips')
            .select('id')
            .eq('group_id', currentGroupId)
            .eq('date', date)
            .maybeSingle();

        const payload = {
            group_id: currentGroupId,
            date: date,
            status: 'substituted',
            effective_id: currentUser.id
        };

        if (existing) {
            await _supabase.schema('fixed_carpooling').from('fixed_trips').update(payload).eq('id', existing.id);
        } else {
            await _supabase.schema('fixed_carpooling').from('fixed_trips').insert(payload);
        }

        if (defaultDriverId && defaultDriverId !== currentUser.id) {
            const { data: existingDebt } = await _supabase
                .schema('fixed_carpooling').from('fixed_debts')
                .select('*')
                .eq('group_id', currentGroupId)
                .eq('creditor_id', currentUser.id)
                .eq('debtor_id', defaultDriverId)
                .maybeSingle();

            if (existingDebt) {
                await _supabase.schema('fixed_carpooling').from('fixed_debts')
                    .update({ amount: (existingDebt.amount || 0) + 1 })
                    .eq('id', existingDebt.id);
            } else {
                await _supabase.schema('fixed_carpooling').from('fixed_debts').insert({
                    group_id: currentGroupId,
                    creditor_id: currentUser.id,
                    debtor_id: defaultDriverId,
                    amount: 1
                });
            }
            await simplificarDeudas(currentGroupId);
            showToast(t('fixed.relevo_tomado'), 'success');
        } else {
            showToast(t('fixed.mando_viaje'), 'success');
        }

        await refreshFixedData();
        cerrarModal();
    } catch (err) {
        console.error("Error en tomarRelevo:", err);
        showToast(t('fixed.error_union'), 'error');
    }
}

async function marcarEspecial(tipo) {
    const dateStr = document.getElementById('modal-viaje').dataset.date;
    if (!currentGroupId) return showToast(t('shared.error_generico'), 'error');
    if (!assertNotPastDate(dateStr)) return;

    try {
        const { data: existing } = await _supabase.schema('fixed_carpooling').from('fixed_trips')
            .select('id, status')
            .eq('group_id', currentGroupId)
            .eq('date', dateStr)
            .maybeSingle();

        if (existing?.status === tipo) {
            await _supabase.schema('fixed_carpooling').from('fixed_trips').delete().eq('id', existing.id);
            showToast(t('fixed.estado_revertido'), 'info');
        } else {
            const payload = {
                group_id: currentGroupId,
                date: dateStr,
                status: tipo,
                effective_id: null,
                type: 'routine_mod',
                creator_id: currentUser.id
            };

            if (existing) {
                await _supabase.schema('fixed_carpooling').from('fixed_trips').update(payload).eq('id', existing.id);
            } else {
                await _supabase.schema('fixed_carpooling').from('fixed_trips').insert(payload);
            }
            showToast(tipo === 'holiday' ? t('fixed.dia_festivo_marcado') : t('fixed.viaje_cancelado_op'), 'info');
        }

        await refreshFixedData();
        cerrarModal();
        if (typeof renderFixedCalendar === 'function') renderFixedCalendar();
    } catch (err) {
        console.error("Error in marcarEspecial:", err);
        showToast(t('shared.error_generico'), 'error');
    }
}

async function tomarLugar() {
    const dateStr = document.getElementById('modal-viaje').dataset.date;
    if (!currentGroupId || !currentUser) return;
    if (!assertNotPastDate(dateStr)) return;

    try {
        const { data: existing } = await _supabase.schema('fixed_carpooling').from('fixed_trips')
            .select('id')
            .eq('group_id', currentGroupId)
            .eq('date', dateStr)
            .maybeSingle();

        const payload = {
            group_id: currentGroupId,
            date: dateStr,
            effective_id: currentUser.id,
            status: 'substituted',
            type: 'routine_mod',
            metadata: { pasajeros: [] }
        };

        if (existing) {
            await _supabase.schema('fixed_carpooling').from('fixed_trips').update(payload).eq('id', existing.id);
        } else {
            await _supabase.schema('fixed_carpooling').from('fixed_trips').insert(payload);
        }

        showToast(t('fixed.mando_viaje'), 'success');
        await refreshFixedData();
        cerrarModal();
        renderFixedCalendar();
    } catch (err) {
        console.error("Error al coger viaje:", err);
        showToast(t('fixed.error_eliminar'), 'error');
    }
}

async function marcarBaja() {
    const dateStr = document.getElementById('modal-viaje').dataset.date;
    if (!currentGroupId || !currentUser) return;
    if (!assertNotPastDate(dateStr)) return;

    try {
        const { data: trip } = await _supabase.schema('fixed_carpooling').from('fixed_trips')
            .select('*')
            .eq('group_id', currentGroupId)
            .eq('date', dateStr)
            .maybeSingle();

        if (trip) {
            if (trip.type === 'single' && trip.creator_id === currentUser.id) {
                await _supabase.schema('fixed_carpooling').from('fixed_trips').delete().eq('id', trip.id);
                showToast(t('fixed.viaje_eliminado'), 'info');
            } else {
                await _supabase.schema('fixed_carpooling').from('fixed_trips').update({
                    effective_id: null,
                    status: 'canceled'
                }).eq('id', trip.id);
                showToast(t('fixed.bajado_viaje'), 'info');
            }
        } else {
            await _supabase.schema('fixed_carpooling').from('fixed_trips').insert({
                group_id: currentGroupId,
                date: dateStr,
                status: 'canceled',
                effective_id: null
            });
            showToast(t('fixed.viaje_cancelado_op'), 'info');
        }

        await refreshFixedData();
        cerrarModal();
        renderFixedCalendar();
    } catch (err) {
        console.error("Error in marcarBaja:", err);
        showToast(t('fixed.error_eliminar'), 'error');
    }
}

async function eliminarViajePuntual() {
    const modal = document.getElementById('modal-viaje');
    const dateStr = modal.dataset.date;

    if (!currentGroupId || !currentUser?.id) {
        showToast(t('shared.error_generico'), 'error');
        return;
    }
    if (!assertNotPastDate(dateStr)) return;

    try {
        const { data: trip, error: fetchError } = await _supabase.schema('fixed_carpooling').from('fixed_trips')
            .select('*')
            .eq('group_id', currentGroupId)
            .eq('date', dateStr)
            .single();

        if (fetchError || !trip) {
            showToast(t('fixed.viaje_no_encontrado'), 'error');
            return;
        }

        if (trip.type !== 'single' || trip.creator_id !== currentUser.id) {
            showToast(t('fixed.sin_permisos'), 'error');
            return;
        }

        const confirmed = await showConfirm(`${t('fixed.confirm_elim_viaje')}\n\n${t('fixed.elim_viaje_desc')}`);
        if (!confirmed) return;

        const pasajeros = trip.metadata?.pasajeros || [];

        for (const pasajeroId of pasajeros) {
            await _supabase.schema('fixed_carpooling').from('fixed_debts')
                .delete()
                .eq('group_id', currentGroupId)
                .eq('creditor_id', currentUser.id)
                .eq('debtor_id', pasajeroId);
        }

        const { error: tripError } = await _supabase.schema('fixed_carpooling').from('fixed_trips')
            .delete()
            .eq('id', trip.id);

        if (tripError) throw tripError;

        showToast(t('fixed.viaje_eliminado'), 'success');
        await refreshFixedData();
        cerrarModal();
        renderFixedCalendar();
    } catch (err) {
        console.error(err);
        showToast(t('fixed.error_eliminar'), 'error');
    }
}

async function bajarseViajePuntual(trip) {
    if (trip?.date && !assertNotPastDate(trip.date)) return;
    if (!await showConfirm(`${t('fixed.confirm_bajarse')}\n\n${t('fixed.baj_descri')}`)) return;

    try {
        const pasajeros = trip.metadata?.pasajeros || [];
        const nuevosPasajeros = pasajeros.filter(p => p !== currentUser.id);

        const { error: tripError } = await _supabase.schema('fixed_carpooling').from('fixed_trips').update({
            metadata: { ...trip.metadata, pasajeros: nuevosPasajeros }
        }).eq('id', trip.id);

        if (tripError) throw tripError;

        const { error: debtError } = await _supabase.schema('fixed_carpooling').from('fixed_debts')
            .delete()
            .eq('group_id', currentGroup.id)
            .eq('creditor_id', trip.effective_id)
            .eq('debtor_id', currentUser.id);

        if (debtError && debtError.code !== 'PGRST116') {
            throw debtError;
        }

        showToast(t('fixed.bajado_viaje'), 'info');
        await refreshFixedData();
        cerrarModal();
        renderFixedCalendar();
    } catch (err) {
        console.error("Error al bajarse del viaje:", err);
        showToast(t('fixed.error_bajarse'), 'error');
    }
}

Object.assign(window, {
    crearViajePuntualDirecto,
    guardarConfiguracionMaestra,
    confirmarEliminarRutina,
    pedirRelevo,
    tomarRelevo,
    marcarEspecial,
    tomarLugar,
    marcarBaja,
    eliminarViajePuntual,
    bajarseViajePuntual,
    refreshFixedData
});
