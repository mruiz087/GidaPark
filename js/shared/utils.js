function showToast(msg) {
    // Limpiar toasts anteriores si los hay
    document.querySelectorAll('.toast-confirm').forEach(el => el.remove());

    const t = document.createElement('div');
    t.className = "toast-confirm";
    t.innerText = msg;
    document.body.appendChild(t);
    setTimeout(() => {
        t.style.opacity = '0';
        t.style.transform = 'translate(-50%, -20px)';
        t.style.transition = 'all 0.3s ease-in';
        setTimeout(() => t.remove(), 300);
    }, 2500);
}

function showConfirm(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('modal-confirm');
        const textEl = document.getElementById('confirm-text');
        const cancelBtn = document.getElementById('confirm-cancel');
        const okBtn = document.getElementById('confirm-ok');

        textEl.innerText = message;
        modal.classList.remove('hidden');

        const cleanup = (value) => {
            modal.classList.add('hidden');
            cancelBtn.removeEventListener('click', onCancel);
            okBtn.removeEventListener('click', onOk);
            resolve(value);
        };

        const onCancel = () => cleanup(false);
        const onOk = () => cleanup(true);

        cancelBtn.addEventListener('click', onCancel);
        okBtn.addEventListener('click', onOk);
    });
}
