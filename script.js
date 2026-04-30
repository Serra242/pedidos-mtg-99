// --- 1. LIMPIEZA DE URL ---
if (window.history.replaceState) {
    window.history.replaceState(null, null, window.location.pathname);
}

// --- 2. CONFIGURACIÓN FIREBASE ---
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

// --- 3. URL GOOGLE SCRIPT ---
// ¡PEGA AQUÍ SOLO TU URL, sin duplicados!
const URL_GOOGLE_SCRIPT = "https://script.google.com/macros/s/AKfycbwiy_veazPfQvDPkSuU1ALDGoFjHEu8YYWXswC7Xss9CtVx7z2CqU__frdEMruf4QYt/exec";

// --- 4. ESTADO GLOBAL ---
let usuarioNombre = "";
let uidUsuario = "";
let cesta = [];
let cartasEncontradas = [];
let indiceVersionActual = 0;
let consumoGlobal = 0;
const LIMITE_SEMANAL = 25;

// Historial de búsquedas (guardado en localStorage, max 8 entradas)
let historialBusquedas = JSON.parse(localStorage.getItem('historial_el99')) || [];

// ==============================================
// UTILIDADES
// ==============================================

function mostrarToast(msj) {
    const t = document.getElementById("toast");
    t.innerText = msj;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 3500);
}

// ==============================================
// NAVEGACIÓN: TABS MÓVILES Y VISTAS
// ==============================================

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
        // Ocultamos el badge al entrar en la cesta
        if (badge) badge.style.display = 'none';
    }
}

function cambiarVista(vistaDestino) {
    const authView = document.getElementById('auth-container');
    const appView = document.getElementById('app-container');

    if (vistaDestino === 'APP') {
        authView.classList.remove('active');
        authView.classList.add('hidden');
        setTimeout(() => {
            appView.classList.remove('hidden');
            appView.classList.add('active');
        }, 300);
    } else {
        appView.classList.remove('active');
        appView.classList.add('hidden');
        setTimeout(() => {
            authView.classList.remove('hidden');
            authView.classList.add('active');
        }, 300);
    }
}

// ==============================================
// AUTENTICACIÓN
// ==============================================

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
        const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
        await userCredential.user.updateProfile({ displayName: nombre });
        mostrarToast("¡Cuenta creada! Bienvenido a El99.");
    } catch (error) {
        mostrarToast("Error: " + error.message);
    }
}

async function iniciarSesion(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    try {
        await auth.signInWithEmailAndPassword(email, pass);
    } catch (e) {
        mostrarToast("Error: Usuario o contraseña incorrectos.");
    }
}

auth.onAuthStateChanged(async user => {
    if (user) {
        usuarioNombre = user.displayName || user.email.split('@')[0];
        uidUsuario = user.uid;
        document.getElementById('nombreUsuarioActivo').innerText = usuarioNombre;

        // Registrar en el directorio de magos
        await db.collection("directorio_magos").doc(uidUsuario).set(
            { nombre: usuarioNombre, email: user.email },
            { merge: true }
        );

        await cargarLimiteFirebase();
        cargarComunidad();

        const guardado = localStorage.getItem(`cesta_${usuarioNombre}`);
        cesta = guardado ? JSON.parse(guardado) : [];
        actualizarTabla();
        cargarHistorialVisual();
        cambiarVista('APP');
    } else {
        cambiarVista('AUTH');
    }
});

function cerrarSesion() { auth.signOut(); }

// ==============================================
// LÍMITE SEMANAL (FIREBASE)
// ==============================================

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
        } else {
            consumoGlobal = 0;
        }
    } catch (e) {
        consumoGlobal = 0;
    }
}

async function actualizarLimiteFirebase(cantidadAnadida) {
    consumoGlobal += cantidadAnadida;
    await db.collection("limites_semanales").doc(uidUsuario).set({
        semana: obtenerLunesActual(),
        cantidad: consumoGlobal
    });
}

// ==============================================
// DIRECTORIO DE MAGOS (COMUNIDAD)
// ==============================================

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
                    </label>
                `;
            }
        });
        container.innerHTML = html || '<p class="empty-state" style="margin:0; font-size:0.85rem;">Eres el único mago registrado.</p>';
    } catch (e) {
        container.innerHTML = '<p class="empty-state" style="color:#ff5252; margin:0;">Error al invocar el directorio.</p>';
    }
}

// ==============================================
// HISTORIAL DE BÚSQUEDAS
// ==============================================

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
        resDiv.innerHTML = `
            <div class="empty-state">
                <span style="font-size:2.5rem;">🎴</span><br><br>
                El catálogo está vacío.<br>
                Escribe el nombre de una carta para empezar.
            </div>`;
        return;
    }

    const pills = historialBusquedas
        .map(b => `<button class="history-pill" onclick="buscarDesdeHistorial('${b.replace(/'/g, "\\'")}')">${b}</button>`)
        .join('');

    resDiv.innerHTML = `
        <div class="empty-state">
            <span style="font-size:2rem;">🔮</span><br><br>
            Búsquedas recientes:
            <div class="history-pills">${pills}</div>
        </div>`;
}

function buscarDesdeHistorial(query) {
    document.getElementById('inputBusqueda').value = query;
    buscarCarta();
}

// ==============================================
// BUSCADOR Y CARRUSEL
// ==============================================

// Enter para buscar
document.addEventListener('DOMContentLoaded', () => {
    const inputBusqueda = document.getElementById('inputBusqueda');
    if (inputBusqueda) {
        inputBusqueda.addEventListener('keypress', e => {
            if (e.key === 'Enter') buscarCarta();
        });
    }
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
            </div>
        `;

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
    setTimeout(() => {
        actualizarVistaCarrusel();
        tarjeta.style.opacity = 1;
    }, 200);
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

    const btnAdd = document.getElementById('btn-add-carrusel');
    const inputCant = document.getElementById('c-cantidad');
    const restantes = LIMITE_SEMANAL - consumoGlobal - cesta.length;

    if (restantes <= 0) {
        btnAdd.disabled = true;
        inputCant.disabled = true;
        btnAdd.innerText = "Límite alcanzado";
        btnAdd.style.background = "#444";
    } else {
        btnAdd.disabled = false;
        inputCant.disabled = false;
        btnAdd.innerText = "Añadir al Pedido";
        btnAdd.style.background = "";
        inputCant.max = Math.min(restantes, 4);
        if (parseInt(inputCant.value) > inputCant.max) inputCant.value = inputCant.max;
    }
}

// ==============================================
// CESTA
// ==============================================

function anadirACesta() {
    const cantidadPedida = Math.max(1, parseInt(document.getElementById('c-cantidad').value) || 1);
    const restantes = LIMITE_SEMANAL - consumoGlobal - cesta.length;

    if (cantidadPedida > restantes) {
        return mostrarToast(`Solo puedes añadir ${restantes} carta${restantes !== 1 ? 's' : ''} más esta semana.`);
    }

    const cartaElegida = cartasEncontradas[indiceVersionActual];
    const cartaParaCesta = {
        nombre: cartaElegida.name,
        set: cartaElegida.set_name,
        setCode: cartaElegida.set
    };

    for (let i = 0; i < cantidadPedida; i++) {
        cesta.push(cartaParaCesta);
    }

    localStorage.setItem(`cesta_${usuarioNombre}`, JSON.stringify(cesta));
    actualizarTabla();
    actualizarVistaCarrusel();
    mostrarToast(`${cantidadPedida} ${cantidadPedida > 1 ? 'cartas añadidas' : 'carta añadida'} ✔`);

    // Mostrar badge en tab de cesta (móvil) si no estamos mirando la cesta
    const tabCesta = document.getElementById('tab-cesta');
    const badge = document.getElementById('tab-badge');
    if (badge && !tabCesta.classList.contains('active')) {
        badge.style.display = 'flex';
    }
}

function eliminar(i) {
    cesta.splice(i, 1);
    localStorage.setItem(`cesta_${usuarioNombre}`, JSON.stringify(cesta));
    actualizarTabla();
    if (document.getElementById('tarjeta-activa')) actualizarVistaCarrusel();
}

function vaciarCesta() {
    if (cesta.length === 0) return;
    if (!confirm(`¿Seguro que quieres vaciar la cesta? Se eliminarán ${cesta.length} carta${cesta.length !== 1 ? 's' : ''}.`)) return;
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

    // Actualizar contador semanal
    const txtContador = document.getElementById('contadorSemanal');
    if (txtContador) {
        txtContador.innerText = totalSemana;
        txtContador.style.color = totalSemana >= LIMITE_SEMANAL ? "#ff5252" : "var(--naranja-el99)";
    }

    // Actualizar contadores de título y tab
    document.getElementById('titulo-cesta-contador').innerText = cesta.length;
    document.getElementById('cesta-contador-tab').innerText = cesta.length;

    const btnEnviar = document.getElementById('btnEnviar');
    const btnVaciar = document.getElementById('btnVaciar');

    if (cesta.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" class="text-center">
                    <div class="empty-state" style="padding: 24px 0;">
                        <span style="font-size:2rem;">🗃️</span><br><br>
                        Tu cesta está vacía.
                    </div>
                </td>
            </tr>`;
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
            <td class="text-center">
                <button type="button" class="btn-eliminar-fila" onclick="eliminar(${i})">✕</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ==============================================
// ENVÍO FINAL
// ==============================================

async function enviarPedidoFinal() {
    if (cesta.length === 0) return mostrarToast("No hay cartas en tu cesta.");

    const checkboxes = document.querySelectorAll('.checkbox-grupo:checked');
    const companeros = Array.from(checkboxes).map(cb => cb.value);
    const grupoFinal = companeros.length > 0 ? companeros.join(", ") : "Individual";

    const btn = document.getElementById('btnEnviar');
    btn.disabled = true;
    btn.innerText = "Enviando... ⏳";

    try {
        await actualizarLimiteFirebase(cesta.length);

        await fetch(URL_GOOGLE_SCRIPT, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({
                usuario: usuarioNombre,
                cesta: cesta,
                grupo: grupoFinal
            })
        });

        mostrarToast("¡Pedido enviado con éxito! ✔");
        cesta = [];
        localStorage.removeItem(`cesta_${usuarioNombre}`);
        checkboxes.forEach(cb => cb.checked = false);
        actualizarTabla();
        if (document.getElementById('tarjeta-activa')) actualizarVistaCarrusel();

        // En móvil, volver al buscador tras enviar
        if (window.innerWidth <= 850) cambiarTab('buscador');

    } catch (e) {
        mostrarToast("Error de conexión al enviar el pedido.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Enviar Pedido Oficial 📤";
    }
}