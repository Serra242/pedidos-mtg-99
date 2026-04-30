// --- 1. LIMPIEZA DE URL ---
if (window.history.replaceState) { window.history.replaceState(null, null, window.location.pathname); }

// --- 2. CONFIGURACIÓN FIREBASE (Mantén la tuya) ---
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

// --- 3. CONFIGURACIÓN GOOGLE SCRIPT ---
const URL_GOOGLE_SCRIPT = "TU_URL_DE_NUEVA_IMPLEMENTACION_AQUI"; // ¡REVISA ESTA URL!

let usuarioNombre = "";
let uidUsuario = ""; 
let cesta = [];
let cartasEncontradas = []; 
let indiceVersionActual = 0; 
let consumoGlobal = 0; 
let historialBusquedas = JSON.parse(localStorage.getItem('historial')) || []; // NUEVO: Historial
const LIMITE_SEMANAL = 25; 

function mostrarToast(msj) {
    const t = document.getElementById("toast");
    t.innerText = msj;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 3500);
}

// --- PESTAÑAS MÓVILES ---
function cambiarTab(tab) {
    const pBuscador = document.getElementById('panel-buscador');
    const pCesta = document.getElementById('panel-cesta');
    const bBuscador = document.getElementById('tab-buscador');
    const bCesta = document.getElementById('tab-cesta');

    if(tab === 'buscador') {
        pBuscador.classList.remove('mobile-hidden'); pCesta.classList.add('mobile-hidden');
        bBuscador.classList.add('active'); bCesta.classList.remove('active');
    } else {
        pCesta.classList.remove('mobile-hidden'); pBuscador.classList.add('mobile-hidden');
        bCesta.classList.add('active'); bBuscador.classList.remove('active');
    }
}

// --- LÍMITE SEMANAL Y COMUNIDAD ---
function obtenerLunesActual() {
    let d = new Date(); let day = d.getDay(); let diff = d.getDate() - day + (day === 0 ? -6 : 1);
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

async function actualizarLimiteFirebase(cantidadAñadida) {
    consumoGlobal += cantidadAñadida;
    await db.collection("limites_semanales").doc(uidUsuario).set({ semana: obtenerLunesActual(), cantidad: consumoGlobal });
}

async function cargarComunidad() {
    const container = document.getElementById('lista-comunidad');
    try {
        const snapshot = await db.collection('directorio_magos').get();
        let html = '';
        snapshot.forEach(doc => {
            if(doc.id !== uidUsuario) { 
                html += `
                    <label style="display: flex; align-items: center; gap: 10px; color: var(--texto-claro); margin-bottom: 8px; cursor: pointer;">
                        <input type="checkbox" value="${doc.data().nombre}" class="checkbox-grupo" style="width: auto; transform: scale(1.2);">
                        ${doc.data().nombre}
                    </label>
                `;
            }
        });
        container.innerHTML = html || '<p class="empty-state" style="margin:0;">Eres el único mago registrado.</p>';
    } catch(e) { container.innerHTML = '<p class="empty-state" style="color:#ff5252;">Error al invocar el directorio.</p>'; }
}

// --- TRANSICIONES SPA Y SESIÓN ---
function cambiarVista(vistaDestino) {
    const authView = document.getElementById('auth-container'), appView = document.getElementById('app-container');
    if (vistaDestino === 'APP') {
        authView.classList.remove('active'); authView.classList.add('hidden');
        setTimeout(() => { appView.classList.remove('hidden'); appView.classList.add('active'); }, 300);
    } else {
        appView.classList.remove('active'); appView.classList.add('hidden');
        setTimeout(() => { authView.classList.remove('hidden'); authView.classList.add('active'); }, 300);
    }
}

function mostrarRegistro() { document.getElementById('login-box').style.display = 'none'; document.getElementById('register-box').style.display = 'block'; }
function mostrarLogin() { document.getElementById('register-box').style.display = 'none'; document.getElementById('login-box').style.display = 'block'; }

async function registrarUsuario(e) {
    e.preventDefault();
    const nombre = document.getElementById('reg-user').value, email = document.getElementById('reg-email').value, pass = document.getElementById('reg-pass').value;
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
        await userCredential.user.updateProfile({ displayName: nombre });
        mostrarToast("¡Cuenta creada!");
    } catch (error) { mostrarToast(error.message); }
}

async function iniciarSesion(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value, pass = document.getElementById('login-pass').value;
    try { await auth.signInWithEmailAndPassword(email, pass); } catch (e) { mostrarToast("Error de acceso."); }
}

auth.onAuthStateChanged(async user => {
    if (user) {
        usuarioNombre = user.displayName || user.email.split('@')[0];
        uidUsuario = user.uid; 
        document.getElementById('nombreUsuarioActivo').innerText = usuarioNombre;
        
        await db.collection("directorio_magos").doc(uidUsuario).set({ nombre: usuarioNombre, email: user.email }, { merge: true });
        await cargarLimiteFirebase();
        cargarComunidad(); 
        
        const guardado = localStorage.getItem(`cesta_${usuarioNombre}`);
        cesta = guardado ? JSON.parse(guardado) : [];
        actualizarTabla();
        cargarHistorialVisual(); // NUEVO: Cargar historial al entrar
        cambiarVista('APP');
    } else { cambiarVista('AUTH'); }
});

function cerrarSesion() { auth.signOut(); }

// --- EVENTO ENTER PARA BUSCAR ---
document.getElementById('inputBusqueda').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') buscarCarta();
});

// --- HISTORIAL DE BÚSQUEDA ---
function cargarHistorialVisual() {
    const resDiv = document.getElementById('resultadoBusqueda');
    if (historialBusquedas.length === 0) {
        resDiv.innerHTML = `<div class="empty-state"><span style="font-size:2.5rem;">🎴</span><br><br>El catálogo está vacío.<br>Escribe el nombre de una carta para empezar.</div>`;
        return;
    }
    
    let pills = historialBusquedas.map(b => `<button class="history-pill" onclick="buscarDesdeHistorial('${b}')">${b}</button>`).join('');
    resDiv.innerHTML = `
        <div class="empty-state" style="margin-top: 20px;">
            <span style="font-size:2.5rem;">🔮</span><br><br>¿Buscas algo de nuevo?
            <div class="history-pills">${pills}</div>
        </div>
    `;
}

function buscarDesdeHistorial(query) {
    document.getElementById('inputBusqueda').value = query;
    buscarCarta();
}

function guardarEnHistorial(query) {
    let qLimpia = query.toLowerCase().trim();
    if (!historialBusquedas.includes(qLimpia)) {
        historialBusquedas.unshift(qLimpia);
        if (historialBusquedas.length > 8) historialBusquedas.pop(); // Guarda las últimas 8
        localStorage.setItem('historial', JSON.stringify(historialBusquedas));
    }
}

// --- BUSCADOR ---
async function buscarCarta() {
    const q = document.getElementById('inputBusqueda').value;
    const resDiv = document.getElementById('resultadoBusqueda');
    if(!q) return;

    resDiv.innerHTML = "<p class='empty-state'>Buscando en todos los planos... 🌀</p>";
    
    try {
        const r = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}+unique:prints`);
        const d = await r.json();
        
        if(d.status === 404 || !d.data || d.data.length === 0) {
            return resDiv.innerHTML = "<p class='empty-state' style='color:var(--rosa-palo)'>Carta no encontrada.</p>";
        }

        guardarEnHistorial(q); // Guardamos la búsqueda exitosa
        cartasEncontradas = d.data.slice(0, 15);
        indiceVersionActual = 0; 
        
        resDiv.innerHTML = `
            <div class="carousel-container fade-in">
                <button type="button" class="carousel-btn" onclick="cambiarVersion(-1)">❮</button>
                <div class="carousel-content" id="tarjeta-activa" style="min-height: 400px; display: flex; flex-direction: column; justify-content: space-between;">
                    <p id="c-contador" style="font-size:0.8rem; color:var(--texto-gris); margin-bottom:5px;"></p>
                    <div style="height: 280px; display: flex; align-items: center; justify-content: center; margin-bottom: 15px;">
                        <img id="c-img" src="" alt="Carta" style="max-height: 100%; width: auto; border-radius: 10px; border: 2px solid var(--naranja-el99); box-shadow: 0 4px 10px rgba(0,0,0,0.5);">
                    </div>
                    <div>
                        <h3 id="c-titulo" style="margin:0 0 5px 0; color:var(--texto-claro); font-size:1.1rem; height: 26px; overflow: hidden;"></h3>
                        <p id="c-set" style="font-size:0.85rem; color:var(--texto-gris); margin:0 0 15px 0; height: 20px; overflow: hidden;"></p>
                    </div>
                    
                    <!-- NUEVO: Selector de cantidad y añadir -->
                    <div style="display:flex; justify-content:center; gap:10px; align-items:center;">
                        <input type="number" id="c-cantidad" class="qty-input" value="1" min="1" max="4">
                        <button type="button" id="btn-add-carrusel" class="btn-primary" style="width: auto;" onclick="añadirACesta()">Añadir al Pedido</button>
                    </div>
                </div>
                <button type="button" class="carousel-btn" onclick="cambiarVersion(1)">❯</button>
            </div>
        `;
        actualizarVistaCarrusel();
    } catch(e) { resDiv.innerHTML = "<p class='empty-state'>Error de red al buscar.</p>"; }
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
    const img = cartaRaw.image_uris ? cartaRaw.image_uris.normal : (cartaRaw.card_faces ? cartaRaw.card_faces[0].image_uris.normal : '');
    const set = cartaRaw.set_name.toUpperCase();
    const lang = cartaRaw.lang.toUpperCase();

    document.getElementById('c-contador').innerText = `Versión ${indiceVersionActual + 1} de ${cartasEncontradas.length}`;
    document.getElementById('c-img').src = img;
    document.getElementById('c-titulo').innerText = cartaRaw.name;
    document.getElementById('c-set').innerText = `${set} [${lang}]`;

    const btnAdd = document.getElementById('btn-add-carrusel');
    const inputCant = document.getElementById('c-cantidad');
    
    // Bloquear si el límite general ya está al máximo
    if (consumoGlobal + cesta.length >= LIMITE_SEMANAL) {
        btnAdd.disabled = true; inputCant.disabled = true;
        btnAdd.innerText = "Límite Alcanzado";
        btnAdd.style.background = "#444";
    } else {
        btnAdd.disabled = false; inputCant.disabled = false;
        btnAdd.innerText = "Añadir al Pedido";
        btnAdd.style.background = "var(--naranja-el99)";
        
        // Ajustamos el max del input para que no pida más de las que le quedan
        let cartasRestantes = LIMITE_SEMANAL - (consumoGlobal + cesta.length);
        inputCant.max = cartasRestantes < 4 ? cartasRestantes : 4; 
    }
}

function añadirACesta() {
    let cantidadPedida = parseInt(document.getElementById('c-cantidad').value) || 1;

    if (consumoGlobal + cesta.length + cantidadPedida > LIMITE_SEMANAL) {
        return mostrarToast(`Error: Solo puedes pedir ${LIMITE_SEMANAL - (consumoGlobal + cesta.length)} cartas más.`);
    }

    let cartaElegida = cartasEncontradas[indiceVersionActual];
    let cartaParaCesta = { nombre: cartaElegida.name, set: cartaElegida.set_name, setCode: cartaElegida.set };

    // Añadimos el objeto tantas veces como copias haya pedido
    for(let i=0; i<cantidadPedida; i++) {
        cesta.push(cartaParaCesta);
    }

    localStorage.setItem(`cesta_${usuarioNombre}`, JSON.stringify(cesta));
    actualizarTabla();
    actualizarVistaCarrusel(); 
    mostrarToast(`${cantidadPedida} ${cantidadPedida > 1 ? 'cartas añadidas' : 'carta añadida'} al pedido`);
}

function actualizarTabla() {
    const tbody = document.getElementById('cuerpoCesta');
    tbody.innerHTML = "";
    
    const totalSemana = consumoGlobal + cesta.length;
    const txtContador = document.getElementById('contadorSemanal');
    txtContador.innerText = totalSemana;
    txtContador.style.color = (totalSemana >= LIMITE_SEMANAL) ? "#ff5252" : "var(--naranja-el99)";

    // Actualizamos los títulos y tabs con la cantidad de cartas en la cesta local
    document.getElementById('titulo-cesta-contador').innerText = cesta.length;
    document.getElementById('cesta-contador-tab').innerText = cesta.length;

    const btnEnviar = document.getElementById('btnEnviar');

    if (cesta.length === 0) {
        tbody.innerHTML = `<tr><td colspan=\"3\" class=\"text-center\"><div class=\"empty-state\" style=\"padding: 20px;\"><span style=\"font-size:2rem\">🗃️</span><br><br>Tu cesta está vacía.</div></td></tr>`;
        btnEnviar.disabled = true; // Desactivar visualmente el botón
        return;
    }

    btnEnviar.disabled = false; // Activar el botón si hay cosas

    cesta.forEach((item, i) => {
        tbody.innerHTML += `
            <tr class=\"fade-in\">
                <td style=\"color:var(--texto-claro);\">${item.nombre}</td>
                <td style=\"color:var(--texto-gris); font-size:0.85rem;\">${item.set} [${item.setCode.toUpperCase()}]</td>
                <td class=\"text-center\"><button type=\"button\" onclick=\"eliminar(${i})\" style=\"background:transparent; color:#ff5252; border:1px solid #ff5252; padding:4px 8px; font-size:0.8rem; cursor:pointer;\">X</button></td>
            </tr>
        `;
    });
}

function eliminar(i) {
    cesta.splice(i, 1);
    localStorage.setItem(`cesta_${usuarioNombre}`, JSON.stringify(cesta));
    actualizarTabla();
    if (document.getElementById('tarjeta-activa')) actualizarVistaCarrusel(); 
}

// --- ENVÍO AL EXCEL ---
async function enviarPedidoFinal() {
    if(cesta.length === 0) return mostrarToast("No hay cartas en tu cesta.");
    
    const checkboxes = document.querySelectorAll('.checkbox-grupo:checked');
    let compañeros = Array.from(checkboxes).map(cb => cb.value);
    let grupoFinal = compañeros.length > 0 ? compañeros.join(", ") : "Individual";

    const btn = document.getElementById('btnEnviar');
    btn.disabled = true; btn.innerText = "Enviando... ⏳";

    try {
        await actualizarLimiteFirebase(cesta.length);
        await fetch(URL_GOOGLE_SCRIPT, {
            method: 'POST', mode: 'no-cors',
            body: JSON.stringify({ usuario: usuarioNombre, cesta: cesta, grupo: grupoFinal })
        });

        mostrarToast("¡Pedido enviado con éxito!");
        cesta = []; localStorage.removeItem(`cesta_${usuarioNombre}`);
        checkboxes.forEach(cb => cb.checked = false);
        actualizarTabla();
        if(document.getElementById('tarjeta-activa')) actualizarVistaCarrusel();
        
        // Si estaba en móvil en la pestaña cesta, lo devolvemos al buscador
        if(window.innerWidth <= 850) cambiarTab('buscador');
        
    } catch(e) { 
        mostrarToast("Error de conexión al enviar el pedido."); 
    } finally {
        btn.disabled = false; btn.innerText = "Enviar Pedido Oficial 📤";
    }
}