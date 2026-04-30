// ============================================================
// EL99 — script.js
// ============================================================

// --- LIMPIEZA DE URL ---
if (window.history.replaceState) {
    window.history.replaceState(null, null, window.location.pathname);
}

// --- FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyA-AnAC0egX4Lkftg_oBhZoJFpQMqD4u6U",
    authDomain: "el99-4a9b7.firebaseapp.com",
    projectId: "el99-4a9b7",
    storageBucket: "el99-4a9b7.firebasestorage.app",
    messagingSenderId: "672251205852",
    appId: "1:672251205852:web:83ed0add63cbbad89d3c19",
    measurementId: "G-PQ9YVVHLCT"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- GOOGLE SCRIPT (pega aquí solo tu URL, sin duplicados) ---
const URL_GOOGLE_SCRIPT = "https://script.google.com/macros/s/AKfycbwMV6DIKk92Lfv4A-x6sAEGkZzHyGhQFpTzN12TKQ_L1NZ8lmz-wp-zlfCsMN4oW242/exec";

// --- UID ADMIN (pon tu UID de Firebase aquí para ver el panel admin) ---
// Lo encuentras en Firebase Console > Authentication > Users
const ADMIN_UID = "TU_UID_DE_ADMIN_AQUI";

// ============================================================
// ESTADO GLOBAL
// ============================================================
let usuarioNombre = "";
let uidUsuario = "";
let cesta = [];
let cartasEncontradas = [];
let indiceVersionActual = 0;
let consumoGlobal = 0;
let LIMITE_SEMANAL = 25; // Se sobreescribe con el valor de Firestore al cargar

let historialBusquedas = JSON.parse(localStorage.getItem('historial_el99')) || [];

// ============================================================
// UTILIDADES
// ============================================================

function mostrarToast(msj, color) {
    const t = document.getElementById("toast");
    t.innerText = msj;
    t.style.borderBottomColor = color || 'var(--naranja-el99)';
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 3500);
}

function formatearFecha(ts) {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ============================================================
// MODALES
// ============================================================

function abrirModal(id) {
    document.getElementById(id).classList.remove('hidden-modal');
    document.body.style.overflow = 'hidden';
}

function cerrarModal(id) {
    document.getElementById(id).classList.add('hidden-modal');
    document.body.style.overflow = '';
}

// Cerrar modal al hacer click fuera
document.addEventListener('click', e => {
    ['modal-historial', 'modal-admin'].forEach(id => {
        const modal = document.getElementById(id);
        if (modal && !modal.classList.contains('hidden-modal') && e.target === modal) {
            cerrarModal(id);
        }
    });
});

// ============================================================
// NAVEGACIÓN Y VISTAS
// ============================================================

function cambiarTab(tab) {
    const pBuscador = document.getElementById('panel-buscador');
    const pCesta = document.getElementById('panel-cesta');
    const bBuscador = document.getElementById('tab-buscador');
    const bCesta = document.getElementById('tab-cesta');
    const badge = document.getElementById('tab-badge');

    if (tab === 'buscador') {
        pBuscador.classList.remove('mobile-hidden');
        pCesta.classList.add('mobile-hidden');
        bBuscador.classList.add('active');
        bCesta.classList.remove('active');
    } else {
        pCesta.classList.remove('mobile-hidden');
        pBuscador.classList.add('mobile-hidden');
        bCesta.classList.add('active');
        bBuscador.classList.remove('active');
        if (badge) badge.style.display = 'none';
    }
}

function cambiarVista(vistaDestino) {
    const authView = document.getElementById('auth-container');
    const appView = document.getElementById('app-container');

    if (vistaDestino === 'APP') {
        authView.classList.remove('active'); authView.classList.add('hidden');
        setTimeout(() => { appView.classList.remove('hidden'); appView.classList.add('active'); }, 300);
    } else {
        appView.classList.remove('active'); appView.classList.add('hidden');
        setTimeout(() => { authView.classList.remove('hidden'); authView.classList.add('active'); }, 300);
    }
}

// ============================================================
// AUTENTICACIÓN
// ============================================================

function mostrarRegistro() {
    document.getElementById('login-box').style.display = 'none';
    document.getElementById('register-box').style.display = 'block';
}
function mostrarLogin() {
    document.getElementById('register-box').style.display = 'none';
    document.getElementById('login-box').style.display = 'block';
}

async function registrarUsuario(e) {
    e.preventDefault();
    const nombre = document.getElementById('reg-user').value;
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-pass').value;
    try {
        const uc = await auth.createUserWithEmailAndPassword(email, pass);
        await uc.user.updateProfile({ displayName: nombre });
        mostrarToast("¡Cuenta creada! Bienvenido a El99.");
    } catch (err) { mostrarToast("Error: " + err.message); }
}

async function iniciarSesion(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    try { await auth.signInWithEmailAndPassword(email, pass); }
    catch (err) { mostrarToast("Error: Usuario o contraseña incorrectos."); }
}

function cerrarSesion() { auth.signOut(); }

auth.onAuthStateChanged(async user => {
    if (user) {
        usuarioNombre = user.displayName || user.email.split('@')[0];
        uidUsuario = user.uid;
        document.getElementById('nombreUsuarioActivo').innerText = usuarioNombre;

        // Mostrar botón admin si corresponde
        if (uidUsuario === ADMIN_UID) {
            document.getElementById('btn-admin').classList.remove('hidden-admin');
        }

        // Registrar en directorio de magos
        await db.collection("directorio_magos").doc(uidUsuario).set(
            { nombre: usuarioNombre, email: user.email },
            { merge: true }
        );

        // Cargar límite desde Firestore (con fallback a 25)
        await cargarConfiguracion();
        await cargarLimiteFirebase();
        cargarComunidad();
        comprobarNotificacionesGrupo();

        const guardado = localStorage.getItem(`cesta_${usuarioNombre}`);
        cesta = guardado ? JSON.parse(guardado) : [];
        actualizarTabla();
        cargarHistorialVisual();
        cambiarVista('APP');
    } else {
        cambiarVista('AUTH');
    }
});

// ============================================================
// CONFIGURACIÓN GLOBAL (FIRESTORE) — LÍMITE SEMANAL
// ============================================================

async function cargarConfiguracion() {
    try {
        const doc = await db.collection("config").doc("global").get();
        if (doc.exists && doc.data().limite_semanal) {
            LIMITE_SEMANAL = doc.data().limite_semanal;
        }
    } catch (e) { /* usa el valor por defecto */ }
    // Actualizar el display del límite en el badge
    const el = document.getElementById('limite-display');
    if (el) el.innerText = LIMITE_SEMANAL;
}

// ============================================================
// LÍMITE SEMANAL (FIRESTORE)
// ============================================================

function obtenerLunesActual() {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.getFullYear(), d.getMonth(), diff).getTime();
}

async function cargarLimiteFirebase() {
    try {
        const doc = await db.collection("limites_semanales").doc(uidUsuario).get();
        if (doc.exists && doc.data().semana === obtenerLunesActual()) {
            consumoGlobal = doc.data().cantidad;
        } else { consumoGlobal = 0; }
    } catch (e) { consumoGlobal = 0; }
}

async function actualizarLimiteFirebase(cantidadAnadida) {
    consumoGlobal += cantidadAnadida;
    await db.collection("limites_semanales").doc(uidUsuario).set({
        semana: obtenerLunesActual(),
        cantidad: consumoGlobal
    });
}

// ============================================================
// DIRECTORIO DE MAGOS
// ============================================================

async function cargarComunidad() {
    const container = document.getElementById('lista-comunidad');
    try {
        const snapshot = await db.collection('directorio_magos').get();
        let html = '';
        snapshot.forEach(doc => {
            if (doc.id !== uidUsuario) {
                html += `
                    <label class="checkbox-item">
                        <input type="checkbox" value="${doc.data().nombre}" class="checkbox-grupo">
                        <span class="checkbox-custom"></span>
                        ${doc.data().nombre}
                    </label>`;
            }
        });
        container.innerHTML = html || '<p class="empty-state" style="margin:0; font-size:0.85rem;">Eres el único mago registrado.</p>';
    } catch (e) {
        container.innerHTML = '<p class="empty-state" style="color:#ff5252; margin:0;">Error al invocar el directorio.</p>';
    }
}

// ============================================================
// NOTIFICACIONES DE GRUPO
// Cuando alguien te incluye en su grupo al enviar un pedido,
// se guarda en Firestore: notificaciones/{tuUID}/items/{pedidoID}
// Esta función lo comprueba al entrar y muestra el banner.
// ============================================================

async function comprobarNotificacionesGrupo() {
    try {
        const snap = await db.collection("notificaciones").doc(uidUsuario)
            .collection("items")
            .where("leida", "==", false)
            .orderBy("fecha", "desc")
            .limit(5)
            .get();

        if (snap.empty) return;

        const mensajes = [];
        const batch = db.batch();

        snap.forEach(doc => {
            const d = doc.data();
            mensajes.push(`<strong>${d.de}</strong> te ha incluido en su pedido esta semana 🧙`);
            // Marcar como leída
            batch.update(doc.ref, { leida: true });
        });

        await batch.commit();

        const banner = document.getElementById('banner-notif');
        banner.innerHTML = mensajes.join(' &nbsp;·&nbsp; ');
        banner.classList.remove('hidden-banner');

        // Auto-ocultar tras 8 segundos
        setTimeout(() => banner.classList.add('hidden-banner'), 8000);

    } catch (e) { /* silencioso */ }
}

// Guardar notificación para un compañero al enviar pedido
async function crearNotificacionesGrupo(companeros) {
    if (companeros.length === 0) return;
    try {
        // Buscar los UIDs de los compañeros por nombre
        const snap = await db.collection("directorio_magos").get();
        const mapaUID = {};
        snap.forEach(doc => { mapaUID[doc.data().nombre] = doc.id; });

        const batch = db.batch();
        companeros.forEach(nombre => {
            const uid = mapaUID[nombre];
            if (!uid) return;
            const ref = db.collection("notificaciones").doc(uid).collection("items").doc();
            batch.set(ref, {
                de: usuarioNombre,
                leida: false,
                fecha: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
        await batch.commit();
    } catch (e) { /* silencioso */ }
}

// ============================================================
// HISTORIAL DE BÚSQUEDAS (localStorage)
// ============================================================

function guardarEnHistorial(query) {
    const qLimpia = query.toLowerCase().trim();
    historialBusquedas = historialBusquedas.filter(b => b.toLowerCase() !== qLimpia);
    historialBusquedas.unshift(query.trim());
    if (historialBusquedas.length > 8) historialBusquedas.pop();
    localStorage.setItem('historial_el99', JSON.stringify(historialBusquedas));
}

function cargarHistorialVisual() {
    const resDiv = document.getElementById('resultadoBusqueda');
    if (historialBusquedas.length === 0) {
        resDiv.innerHTML = `<div class="empty-state"><span style="font-size:2.5rem;">🎴</span><br><br>Escribe el nombre de una carta para empezar.</div>`;
        return;
    }
    const pills = historialBusquedas
        .map(b => `<button class="history-pill" onclick="buscarDesdeHistorial('${b.replace(/'/g, "\\'")}')">${b}</button>`)
        .join('');
    resDiv.innerHTML = `<div class="empty-state"><span style="font-size:2rem;">🔮</span><br><br>Búsquedas recientes:<div class="history-pills">${pills}</div></div>`;
}

function buscarDesdeHistorial(query) {
    document.getElementById('inputBusqueda').value = query;
    buscarCarta();
}

// ============================================================
// HISTORIAL DE PEDIDOS (FIRESTORE)
// ============================================================

async function abrirHistorial() {
    abrirModal('modal-historial');
    const contenedor = document.getElementById('modal-historial-contenido');
    contenedor.innerHTML = '<p class="empty-state" style="padding:20px;">Cargando...</p>';

    try {
        const snap = await db.collection("pedidos")
            .where("uid", "==", uidUsuario)
            .orderBy("fecha", "desc")
            .limit(10)
            .get();

        if (snap.empty) {
            contenedor.innerHTML = '<p class="empty-state" style="padding:24px; text-align:center;">Aún no has enviado ningún pedido.</p>';
            return;
        }

        let html = '';
        snap.forEach(doc => {
            const d = doc.data();
            const cartas = d.cesta || [];
            const itemsHTML = cartas.map(c =>
                `<li><span>${c.nombre}</span><span class="historial-set">${c.set} [${(c.setCode || '').toUpperCase()}]</span></li>`
            ).join('');

            html += `
                <div class="historial-card">
                    <div class="historial-card-header">
                        <span class="historial-fecha">📅 ${formatearFecha(d.fecha)}</span>
                        <span class="historial-grupo">${d.grupo !== 'Individual' ? '👥 ' + d.grupo : '🧙 Individual'}</span>
                    </div>
                    <ul class="historial-cartas">${itemsHTML}</ul>
                    <p style="font-size:0.8rem; color:var(--texto-gris); margin:10px 0 0 0; text-align:right;">${cartas.length} carta${cartas.length !== 1 ? 's' : ''}</p>
                </div>`;
        });

        contenedor.innerHTML = html;

    } catch (e) {
        contenedor.innerHTML = '<p class="empty-state" style="color:#ff5252; padding:20px;">Error al cargar el historial.</p>';
    }
}

// ============================================================
// PANEL ADMIN
// ============================================================

async function abrirAdmin() {
    if (uidUsuario !== ADMIN_UID) return;
    abrirModal('modal-admin');

    // Mostrar límite actual
    const inputLimite = document.getElementById('admin-limite-input');
    if (inputLimite) inputLimite.value = LIMITE_SEMANAL;

    cargarResumenAdmin();
}

async function guardarLimiteAdmin() {
    const nuevoLimite = parseInt(document.getElementById('admin-limite-input').value);
    if (!nuevoLimite || nuevoLimite < 1) return mostrarToast("Introduce un número válido.");

    try {
        await db.collection("config").doc("global").set({ limite_semanal: nuevoLimite }, { merge: true });
        LIMITE_SEMANAL = nuevoLimite;
        document.getElementById('limite-display').innerText = LIMITE_SEMANAL;
        actualizarTabla();
        mostrarToast(`Límite actualizado a ${nuevoLimite} cartas ✔`, 'var(--verde-ok)');
    } catch (e) {
        mostrarToast("Error al guardar el límite.");
    }
}

async function cargarResumenAdmin() {
    const contenedor = document.getElementById('admin-resumen-semana');
    contenedor.innerHTML = '<p class="empty-state admin-empty">Cargando pedidos de la semana...</p>';

    try {
        // Pedidos de esta semana
        const lunes = obtenerLunesActual();
        const snap = await db.collection("pedidos")
            .where("semana", "==", lunes)
            .orderBy("fecha", "desc")
            .get();

        if (snap.empty) {
            contenedor.innerHTML = '<p class="empty-state admin-empty">Ningún pedido esta semana todavía.</p>';
            return;
        }

        // Agrupar por usuario
        const porUsuario = {};
        snap.forEach(doc => {
            const d = doc.data();
            if (!porUsuario[d.usuario]) porUsuario[d.usuario] = { cartas: [], grupo: d.grupo };
            porUsuario[d.usuario].cartas.push(...(d.cesta || []));
        });

        let html = '';
        Object.entries(porUsuario).forEach(([nombre, datos]) => {
            const pills = datos.cartas.map(c => `<span class="admin-pill">${c.nombre}</span>`).join('');
            html += `
                <div class="admin-usuario-card">
                    <div class="admin-usuario-nombre">
                        <span>🧙 ${nombre}</span>
                        <span style="font-size:0.8rem; color:var(--texto-gris);">${datos.cartas.length} carta${datos.cartas.length !== 1 ? 's' : ''}</span>
                    </div>
                    ${datos.grupo !== 'Individual' ? `<div class="admin-usuario-cartas">Grupo: ${datos.grupo}</div>` : ''}
                    <div class="admin-pills">${pills}</div>
                </div>`;
        });

        contenedor.innerHTML = html;

    } catch (e) {
        contenedor.innerHTML = '<p class="empty-state" style="color:#ff5252; padding:20px;">Error al cargar los pedidos.</p>';
    }
}

// ============================================================
// BUSCADOR Y CARRUSEL
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('inputBusqueda');
    if (input) input.addEventListener('keypress', e => { if (e.key === 'Enter') buscarCarta(); });
});

async function buscarCarta() {
    const q = document.getElementById('inputBusqueda').value.trim();
    const resDiv = document.getElementById('resultadoBusqueda');
    if (!q) return;

    resDiv.innerHTML = "<p class='empty-state'>Buscando en todos los planos... 🌀</p>";

    try {
        const r = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}+unique:prints`);
        const d = await r.json();

        if (d.status === 404 || !d.data || d.data.length === 0) {
            resDiv.innerHTML = "<p class='empty-state' style='color:var(--rosa-palo)'>Carta no encontrada. Intenta ser más específico.</p>";
            return;
        }

        guardarEnHistorial(q);
        cartasEncontradas = d.data.slice(0, 15);
        indiceVersionActual = 0;

        resDiv.innerHTML = `
            <div class="carousel-container fade-in">
                <button type="button" class="carousel-btn" onclick="cambiarVersion(-1)">❮</button>
                <div class="carousel-content" id="tarjeta-activa">
                    <p id="c-contador" style="font-size:0.8rem; color:var(--texto-gris); margin-bottom:5px;"></p>
                    <div class="carousel-img-wrapper">
                        <img id="c-img" src="" alt="Carta">
                        <span id="badge-en-cesta" class="badge-en-cesta" style="display:none;"></span>
                    </div>
                    <div>
                        <h3 id="c-titulo" style="margin:0 0 4px 0; color:var(--texto-claro); font-size:1.05rem; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;"></h3>
                        <p id="c-set" style="font-size:0.82rem; color:var(--texto-gris); margin:0 0 12px 0;"></p>
                    </div>
                    <div class="carousel-add-row">
                        <input type="number" id="c-cantidad" class="qty-input" value="1" min="1" max="4">
                        <button type="button" id="btn-add-carrusel" class="btn-primary" style="width:auto;" onclick="anadirACesta()">Añadir al Pedido</button>
                    </div>
                </div>
                <button type="button" class="carousel-btn" onclick="cambiarVersion(1)">❯</button>
            </div>`;

        actualizarVistaCarrusel();

    } catch (e) {
        resDiv.innerHTML = "<p class='empty-state'>Error de red al buscar.</p>";
    }
}

function cambiarVersion(direccion) {
    indiceVersionActual += direccion;
    if (indiceVersionActual >= cartasEncontradas.length) indiceVersionActual = 0;
    if (indiceVersionActual < 0) indiceVersionActual = cartasEncontradas.length - 1;

    const tarjeta = document.getElementById('tarjeta-activa');
    tarjeta.style.opacity = 0;
    setTimeout(() => { actualizarVistaCarrusel(); tarjeta.style.opacity = 1; }, 200);
}

function actualizarVistaCarrusel() {
    const cartaRaw = cartasEncontradas[indiceVersionActual];
    const img = cartaRaw.image_uris
        ? cartaRaw.image_uris.normal
        : (cartaRaw.card_faces ? cartaRaw.card_faces[0].image_uris.normal : '');

    document.getElementById('c-contador').innerText = `Versión ${indiceVersionActual + 1} de ${cartasEncontradas.length}`;
    document.getElementById('c-img').src = img;
    document.getElementById('c-titulo').innerText = cartaRaw.name;
    document.getElementById('c-set').innerText = `${cartaRaw.set_name.toUpperCase()} [${cartaRaw.lang.toUpperCase()}]`;

    // Badge "ya tienes X en tu pedido"
    const yaEnCesta = cesta.filter(c => c.nombre === cartaRaw.name && c.setCode === cartaRaw.set).length;
    const badgeCesta = document.getElementById('badge-en-cesta');
    if (badgeCesta) {
        if (yaEnCesta > 0) {
            badgeCesta.innerText = `✔ ${yaEnCesta} en pedido`;
            badgeCesta.style.display = 'block';
        } else {
            badgeCesta.style.display = 'none';
        }
    }

    // Estado botón añadir
    const btnAdd = document.getElementById('btn-add-carrusel');
    const inputCant = document.getElementById('c-cantidad');
    const restantes = LIMITE_SEMANAL - consumoGlobal - cesta.length;

    if (restantes <= 0) {
        btnAdd.disabled = true; inputCant.disabled = true;
        btnAdd.innerText = "Límite alcanzado"; btnAdd.style.background = "#444";
    } else {
        btnAdd.disabled = false; inputCant.disabled = false;
        btnAdd.innerText = "Añadir al Pedido"; btnAdd.style.background = "";
        inputCant.max = Math.min(restantes, 4);
        if (parseInt(inputCant.value) > inputCant.max) inputCant.value = inputCant.max;
    }
}

// ============================================================
// CESTA
// ============================================================

function anadirACesta() {
    const cantidadPedida = Math.max(1, parseInt(document.getElementById('c-cantidad').value) || 1);
    const restantes = LIMITE_SEMANAL - consumoGlobal - cesta.length;

    if (cantidadPedida > restantes) {
        return mostrarToast(`Solo puedes añadir ${restantes} carta${restantes !== 1 ? 's' : ''} más esta semana.`);
    }

    const cartaElegida = cartasEncontradas[indiceVersionActual];
    const cartaParaCesta = { nombre: cartaElegida.name, set: cartaElegida.set_name, setCode: cartaElegida.set };

    for (let i = 0; i < cantidadPedida; i++) cesta.push(cartaParaCesta);

    localStorage.setItem(`cesta_${usuarioNombre}`, JSON.stringify(cesta));
    actualizarTabla();
    actualizarVistaCarrusel();
    mostrarToast(`${cantidadPedida} ${cantidadPedida > 1 ? 'cartas añadidas' : 'carta añadida'} ✔`);

    const tabCesta = document.getElementById('tab-cesta');
    const badge = document.getElementById('tab-badge');
    if (badge && !tabCesta.classList.contains('active')) badge.style.display = 'flex';
}

function eliminar(i) {
    cesta.splice(i, 1);
    localStorage.setItem(`cesta_${usuarioNombre}`, JSON.stringify(cesta));
    actualizarTabla();
    if (document.getElementById('tarjeta-activa')) actualizarVistaCarrusel();
}

function vaciarCesta() {
    if (cesta.length === 0) return;
    if (!confirm(`¿Seguro? Se eliminarán ${cesta.length} carta${cesta.length !== 1 ? 's' : ''}.`)) return;
    cesta = [];
    localStorage.removeItem(`cesta_${usuarioNombre}`);
    actualizarTabla();
    if (document.getElementById('tarjeta-activa')) actualizarVistaCarrusel();
    mostrarToast("Cesta vaciada.");
}

function actualizarTabla() {
    const tbody = document.getElementById('cuerpoCesta');
    tbody.innerHTML = "";

    const totalSemana = consumoGlobal + cesta.length;
    const pct = totalSemana / LIMITE_SEMANAL;

    // Actualizar badge límite con colores de advertencia
    const txtContador = document.getElementById('contadorSemanal');
    const badgeWrapper = document.getElementById('limite-badge-wrapper');
    if (txtContador) {
        txtContador.innerText = totalSemana;
        txtContador.style.color = pct >= 1 ? 'var(--rojo-eliminar)' : pct >= 0.8 ? 'var(--amarillo-warn)' : 'var(--naranja-el99)';
    }
    if (badgeWrapper) {
        badgeWrapper.classList.remove('warn', 'danger');
        if (pct >= 1) badgeWrapper.classList.add('danger');
        else if (pct >= 0.8) badgeWrapper.classList.add('warn');
    }

    // Mostrar toast de aviso al llegar al 80%
    if (pct >= 0.8 && pct < 1 && cesta.length > 0 && totalSemana > (consumoGlobal + cesta.length - 1)) {
        // Solo mostrar una vez cuando cruza el umbral
        const umbralCruzado = totalSemana >= Math.floor(LIMITE_SEMANAL * 0.8);
        const prevTotal = totalSemana - 1;
        if (umbralCruzado && prevTotal < Math.floor(LIMITE_SEMANAL * 0.8)) {
            mostrarToast(`⚠️ Casi al límite: ${totalSemana}/${LIMITE_SEMANAL} cartas usadas`, 'var(--amarillo-warn)');
        }
    }

    document.getElementById('titulo-cesta-contador').innerText = cesta.length;
    document.getElementById('cesta-contador-tab').innerText = cesta.length;

    const btnEnviar = document.getElementById('btnEnviar');
    const btnVaciar = document.getElementById('btnVaciar');

    if (cesta.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="text-center"><div class="empty-state" style="padding:24px 0;"><span style="font-size:2rem;">🗃️</span><br><br>Tu cesta está vacía.</div></td></tr>`;
        btnEnviar.disabled = true;
        if (btnVaciar) btnVaciar.disabled = true;
        return;
    }

    btnEnviar.disabled = false;
    if (btnVaciar) btnVaciar.disabled = false;

    cesta.forEach((item, i) => {
        const tr = document.createElement('tr');
        tr.className = 'fade-in';
        tr.innerHTML = `
            <td style="color:var(--texto-claro);">${item.nombre}</td>
            <td style="color:var(--texto-gris); font-size:0.82rem;">${item.set} [${item.setCode.toUpperCase()}]</td>
            <td class="text-center"><button type="button" class="btn-eliminar-fila" onclick="eliminar(${i})">✕</button></td>`;
        tbody.appendChild(tr);
    });
}

// ============================================================
// ENVÍO FINAL
// ============================================================

async function enviarPedidoFinal() {
    if (cesta.length === 0) return mostrarToast("No hay cartas en tu cesta.");

    const checkboxes = document.querySelectorAll('.checkbox-grupo:checked');
    const companeros = Array.from(checkboxes).map(cb => cb.value);
    const grupoFinal = companeros.length > 0 ? companeros.join(", ") : "Individual";

    const btn = document.getElementById('btnEnviar');
    btn.disabled = true; btn.innerText = "Enviando... ⏳";

    try {
        await actualizarLimiteFirebase(cesta.length);

        // Guardar en Firestore para historial y panel admin
        await db.collection("pedidos").add({
            uid: uidUsuario,
            usuario: usuarioNombre,
            cesta: cesta,
            grupo: grupoFinal,
            semana: obtenerLunesActual(),
            fecha: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Notificar a compañeros de grupo
        await crearNotificacionesGrupo(companeros);

        // Enviar al Excel via Google Script
        await fetch(URL_GOOGLE_SCRIPT, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ usuario: usuarioNombre, cesta: cesta, grupo: grupoFinal })
        });

        mostrarToast("¡Pedido enviado con éxito! ✔", 'var(--verde-ok)');
        cesta = [];
        localStorage.removeItem(`cesta_${usuarioNombre}`);
        checkboxes.forEach(cb => cb.checked = false);
        actualizarTabla();
        if (document.getElementById('tarjeta-activa')) actualizarVistaCarrusel();
        if (window.innerWidth <= 850) cambiarTab('buscador');

    } catch (e) {
        mostrarToast("Error de conexión al enviar el pedido.");
    } finally {
        btn.disabled = false; btn.innerText = "Enviar Pedido Oficial 📤";
    }
}