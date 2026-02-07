const translations = {
    es: {
        // Tabs
        nav_inicio: "Inicio",
        nav_grupos: "Grupos",
        nav_opciones: "Ajustes",

        // Inicio
        title_inicio: "Inicio",
        label_new_group: "Nuevo Grupo",
        placeholder_group_name: "Nombre del grupo",
        btn_create_group: "Crear Grupo",
        label_join_group: "Unirse a Grupo",
        placeholder_join_code: "CÓDIGO",
        btn_join: "Unirse",

        // Grupos
        title_my_groups: "Mis Grupos",
        no_groups: "No tienes grupos todavía",
        btn_back: "Volver",
        label_group: "Grupo",
        label_select_day: "Selecciona un día",
        btn_add_trip: "+ Viaje",
        no_trips: "No hay viajes este día",
        btn_see_members: "Ver Miembros",

        // Members
        title_members: "Miembros",
        no_members: "No hay miembros registrados",

        // Ajustes
        title_settings: "Ajustes",
        label_public_name: "Tu Nombre Público",
        placeholder_your_name: "Tu nombre",
        label_has_car: "Aporto Coche",
        btn_manage_groups: "Salir de un Grupo",
        btn_logout: "Cerrar Sesión",
        label_language: "Idioma",

        // Modal Viaje
        modal_title_trip: "Nuevo Viaje",
        label_type: "Trayecto",
        type_ida_vuelta: "Ida y Vuelta",
        type_ida: "Solo Ida",
        type_vuelta: "Solo Vuelta",
        label_repeat: "Repetición",
        repeat_none: "Solo hoy",
        repeat_4: "4 semanas",
        repeat_12: "12 semanas",
        btn_cancel: "Cancelar",
        btn_create: "Crear",

        // Modal Manage Groups
        modal_title_manage: "Mis Grupos",
        btn_close: "Cerrar",
        btn_leave: "Salir",
        btn_confirm: "Confirmar",
        no_groups_manage: "No perteneces a ningún grupo",

        // Toasts / Logic
        toast_name_saved: "Nombre guardado",
        toast_invalid_code: "Código no válido",
        toast_past_days: "No puedes editar días pasados",
        toast_is_driver: "No puedes abandonar si eres el conductor",
        toast_left_group: "Has salido de ",
        toast_already_in_group: "Ya perteneces a este grupo",
        confirm_leave_group: "¿Estás seguro de que quieres salir del grupo ",
        driving_proposed: "Sugerido: ",
        driving_real: "Real: ",
        who_drove: "¿Quién condujo?",
        btn_abandon: "Abandonar",
        btn_join_trip: "Apuntarse",
        days: ["DO", "LU", "MA", "MI", "JU", "VI", "SA"]
    },
    eu: {
        // Tabs
        nav_inicio: "Hasiera",
        nav_grupos: "Taldeak",
        nav_opciones: "Aukerak",

        // Inicio
        title_inicio: "Hasiera",
        label_new_group: "Talde berria",
        placeholder_group_name: "Taldearen izena",
        btn_create_group: "Taldea sortu",
        label_join_group: "Talde batera batu",
        placeholder_join_code: "KODEA",
        btn_join: "Batu",

        // Grupos
        title_my_groups: "Nire Taldeak",
        no_groups: "Oraindik ez duzu talderik",
        btn_back: "Atzera",
        label_group: "Taldea",
        label_select_day: "Hautatu egun bat",
        btn_add_trip: "+ Bidaia",
        no_trips: "Ez dago bidaiarik egun honetan",
        btn_see_members: "Kideak ikusi",

        // Members
        title_members: "Kideak",
        no_members: "Ez dago kide erregistratuta",

        // Ajustes
        title_settings: "Aukerak",
        label_public_name: "Zure izen publikoa",
        placeholder_your_name: "Zure izena",
        label_has_car: "Autoa jartzen dut",
        btn_manage_groups: "Talde batetik irten",
        btn_logout: "Saioa itxi",
        label_language: "Hizkuntza",

        // Modal Viaje
        modal_title_trip: "Bidaia berria",
        label_type: "Ibilbidea",
        type_ida_vuelta: "Joan-etorria",
        type_ida: "Joan bakarrik",
        type_vuelta: "Etorri bakarrik",
        label_repeat: "Errepikapena",
        repeat_none: "Gaur bakarrik",
        repeat_4: "4 aste",
        repeat_12: "12 aste",
        btn_cancel: "Utzi",
        btn_create: "Sortu",

        // Modal Manage Groups
        modal_title_manage: "Nire Taldeak",
        btn_close: "Itxi",
        btn_leave: "Irten",
        btn_confirm: "Baieztatu",
        no_groups_manage: "Ez zara inongo taldetako kide",

        // Toasts / Logic
        toast_name_saved: "Izena gordeta",
        toast_invalid_code: "Kode okerra",
        toast_past_days: "Ezin dituzu pasatako egunak editatu",
        toast_is_driver: "Ezin duzu bidaia utzi gidaria bazara",
        toast_left_group: "Taldetik irten zara: ",
        toast_already_in_group: "Dagoeneko talde honetako kide zara",
        confirm_leave_group: "Ziur zaude taldetik irten nahi duzula? ",
        driving_proposed: "Iradokitakoa: ",
        driving_real: "Benetakoa: ",
        who_drove: "Nork gidatu du?",
        btn_abandon: "Utzi",
        btn_join_trip: "Batu",
        days: ["IG", "AL", "AS", "AZ", "OG", "OL", "LA"]
    }
};

let currentLang = localStorage.getItem('lang') || 'es';

function t(key) {
    return translations[currentLang][key] || key;
}

function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('lang', lang);
    applyTranslations();
    refreshCalendar(); // For month names and days
}

function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const translation = t(key);
        if (el.tagName === 'INPUT' && el.type === 'text') {
            el.placeholder = translation;
        } else {
            el.innerText = translation;
        }
    });

    // Update specific logic-based text that isn't easily tagged
    document.getElementById('nav-inicio-text').innerText = t('nav_inicio');
    document.getElementById('nav-grupos-text').innerText = t('nav_grupos');
    document.getElementById('nav-opciones-text').innerText = t('nav_opciones');
    // Update language buttons active state
    document.querySelectorAll('[id^="lang-"]').forEach(btn => btn.classList.remove('active'));
    document.getElementById('lang-' + currentLang).classList.add('active');

    // Update modal confirm buttons manually as they might be needed before re-render
    const confirmOk = document.getElementById('confirm-ok');
    if (confirmOk) confirmOk.innerText = t('btn_confirm');
}

// Global expose
window.t = t;
window.setLanguage = setLanguage;
window.applyTranslations = applyTranslations;
window.currentLang = currentLang;
