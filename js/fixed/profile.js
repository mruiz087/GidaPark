// --- PERFIL Y AJUSTES ---

function changeLanguage(lang) {
    setLanguage(lang);
    applyTranslations();
    const langName = lang === 'es' ? 'Español' : 'Euskera';
    showToast(t('fixed.idioma_changed') + " " + langName);
}

async function toggleOnLeave() {
    if (!currentGroup) return;

    // Obtener el miembro actual del grupo
    const currentMember = state.members.find(m => m.user_id === currentUser.id);
    if (!currentMember) return;

    const isCurrentlyOnLeave = currentMember.is_on_leave || false;
    const confirmMessage = isCurrentlyOnLeave ? t('fixed.confirm_volver_baja') : t('fixed.confirm_baja');

    if (!await showConfirm(confirmMessage)) return;

    try {
        const newStatus = !isCurrentlyOnLeave;

        const { error } = await _supabase.schema('fixed_carpooling').from('fixed_members')
            .update({ is_on_leave: newStatus })
            .eq('user_id', currentUser.id)
            .eq('group_id', currentGroup.id);

        if (error) throw error;

        // Actualizar estado local
        currentMember.is_on_leave = newStatus;

        showToast(newStatus ? t('fixed.baja_marcada') : t('fixed.baja_quitada'));
        updateOnLeaveButton();
        await refreshFixedData();
    } catch (err) {
        console.error("Error al cambiar estado de baja:", err);
        showToast(t('fixed.error_guardar'), "error");
    }
}

// Expose functions globally
Object.assign(window, {
    toggleOnLeave
});

function updateOnLeaveButton() {
    const btn = document.getElementById('btn-toggle-baja');
    if (!btn || !currentGroup) return;

    const currentMember = state.members.find(m => m.user_id === currentUser.id);
    const isOnLeave = currentMember?.is_on_leave || false;

    if (isOnLeave) {
        btn.setAttribute('data-i18n', 'fixed.volver_baja');
        btn.textContent = t('fixed.volver_baja');
        btn.className = "w-full py-4 bg-amber-900/20 border border-amber-500/30 text-amber-400 text-[10px] font-black uppercase rounded-xl hover:bg-amber-900/40 transition-all";
    } else {
        btn.setAttribute('data-i18n', 'fixed.estoy_de_baja');
        btn.textContent = t('fixed.estoy_de_baja');
        btn.className = "w-full py-4 bg-amber-900/20 border border-amber-500/30 text-amber-400 text-[10px] font-black uppercase rounded-xl hover:bg-amber-900/40 transition-all";
    }
}
