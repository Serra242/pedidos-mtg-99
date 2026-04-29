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

// --- 3. CONFIGURACIÓN GOOGLE SCRIPT ---
// PEGA AQUÍ TU URL
const URL_GOOGLE_SCRIPT = "https://script.google.com/macros/s/AKfycbw15Yp4XNX581yn3wqXjhds2F33B7PuJPEw3w9DZg6NDjCv59cTrrx1O7PCmmRXnsIw/exec";

let usuarioNombre = "";
let cesta = [];
let cartasEncontradas = []; 
let indiceVersionActual = 0; 

// --- NOTIFICACIONES ---
function mostrarToast(msj) {
    const t = document.getElementById("toast");
    t.innerText = msj;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 3500);
}

// --- TRANSICIONES SPA ---
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

// --- CONTROL DE SESIÓN ---
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
    } catch (error) { mostrarToast("Error: " + error.message); }
}

async function iniciarSesion(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;

    try {
        await auth.signInWithEmailAndPassword(email, pass);
        mostrarToast("Acceso concedido.");
    } catch (error) { mostrarToast("Error: Usuario o contraseña incorrectos."); }
}

auth.onAuthStateChanged(user => {
    if (user) {
        usuarioNombre = user.displayName || user.email.split('@')[0];
        document.getElementById('nombreUsuarioActivo').innerText = usuarioNombre;
        
        const guardado = localStorage.getItem(`cesta_${usuarioNombre}`);
        cesta = guardado ? JSON.parse(guardado) : [];
        actualizarTabla();
        cambiarVista('APP');
    } else {
        cambiarVista('AUTH');
    }
});

function cerrarSesion() { auth.signOut(); }

// --- BUSCADOR CON CARRUSEL FLUIDO ---
async function buscarCarta() {
    const q = document.getElementById('inputBusqueda').value;
    const resDiv = document.getElementById('resultadoBusqueda');
    if(!q) return;

    resDiv.innerHTML = "<p class='empty-state'>Buscando en todos los planos... 🌀</p>";
    
    try {
        const r = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}+unique:prints`);
        const d = await r.json();
        
        if(d.status === 404 || !d.data || d.data.length === 0) {
            return resDiv.innerHTML = "<p class='empty-state' style='color:var(--rosa-palo)'>No encontrada. Intenta ser más específico.</p>";
        }

        cartasEncontradas = d.data.slice(0, 15);
        indiceVersionActual = 0; 
        
        // Creamos la estructura fija una sola vez para que la página NO salte
        resDiv.innerHTML = `
            <div class="carousel-container fade-in">
                <button type="button" class="carousel-btn" onclick="cambiarVersion(-1)">❮</button>
                <div class="carousel-content" id="tarjeta-activa">
                    </div>
                <button type="button" class="carousel-btn" onclick="cambiarVersion(1)">❯</button>
            </div>
        `;
        
        actualizarVistaCarrusel();

    } catch(e) { 
        resDiv.innerHTML = "<p class='empty-state'>Error de red al buscar.</p>"; 
    }
}

// Lógica para cambiar de carta haciendo un fundido (Sin salto de página)
function cambiarVersion(direccion) {
    indiceVersionActual += direccion;
    if (indiceVersionActual >= cartasEncontradas.length) indiceVersionActual = 0;
    if (indiceVersionActual < 0) indiceVersionActual = cartasEncontradas.length - 1;
    
    const tarjeta = document.getElementById('tarjeta-activa');
    
    // Hacemos el fundido a invisible
    tarjeta.style.opacity = 0;
    
    // Esperamos 150ms para cambiar los datos y volver a hacerlo visible
    setTimeout(() => {
        actualizarVistaCarrusel();
        tarjeta.style.opacity = 1;
    }, 150);
}

// Solo actualiza los datos internos (imagen y texto) de la tarjeta central
function actualizarVistaCarrusel() {
    const cartaRaw = cartasEncontradas[indiceVersionActual];
    
    const img = cartaRaw.image_uris ? cartaRaw.image_uris.normal : (cartaRaw.card_faces ? cartaRaw.card_faces[0].image_uris.normal : '');
    const set = cartaRaw.set_name.toUpperCase();
    const lang = cartaRaw.lang.toUpperCase();

    const contenido = `
        <p style="font-size:0.8rem; color:var(--texto-gris); margin-bottom:5px;">Versión ${indiceVersionActual + 1} de ${cartasEncontradas.length}</p>
        <img src="${img}" alt="Carta">
        <h3 style="margin:0 0 5px 0; color:var(--texto-claro); font-size:1.1rem;">${cartaRaw.name}</h3>
        <p style="font-size:0.85rem; color:var(--texto-gris); margin:0 0 15px 0;">${set} [${lang}]</p>
        <button type="button" class="btn-primary" onclick="añadirACesta()">Añadir al Pedido</button>
    `;
    
    document.getElementById('tarjeta-activa').innerHTML = contenido;
}

// Añadir a la cesta sin importar los precios
function añadirACesta() {
    let cartaElegida = cartasEncontradas[indiceVersionActual];
    
    let cartaParaCesta = {
        nombre: cartaElegida.name,
        set: cartaElegida.set_name,
        setCode: cartaElegida.set
    };

    cesta.push(cartaParaCesta);
    localStorage.setItem(`cesta_${usuarioNombre}`, JSON.stringify(cesta));
    actualizarTabla();
    mostrarToast("Carta añadida al pedido");
}

function actualizarTabla() {
    const tbody = document.getElementById('cuerpoCesta');
    tbody.innerHTML = "";
    
    if (cesta.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="text-center empty-state" style="padding: 30px;">Tu cesta está vacía.</td></tr>`;
        return;
    }

    cesta.forEach((item, i) => {
        tbody.innerHTML += `
            <tr class="fade-in">
                <td style="color:var(--texto-claro);">${item.nombre}</td>
                <td style="color:var(--texto-gris); font-size:0.85rem;">${item.set} [${item.setCode.toUpperCase()}]</td>
                <td class="text-center"><button type="button" onclick="eliminar(${i})" style="background:transparent; color:#ff5252; border:1px solid #ff5252; padding:4px 8px; font-size:0.8rem; cursor:pointer;">X</button></td>
            </tr>
        `;
    });
}

function eliminar(i) {
    cesta.splice(i, 1);
    localStorage.setItem(`cesta_${usuarioNombre}`, JSON.stringify(cesta));
    actualizarTabla();
}

// --- ENVÍO AL EXCEL ---
async function enviarPedidoFinal() {
    if(cesta.length === 0) return mostrarToast("No hay cartas en tu cesta.");
    if(URL_GOOGLE_SCRIPT.includes("TU_NUEVA")) return mostrarToast("Recuerda pegar tu URL de Google Script.");
    
    const btn = document.getElementById('btnEnviar');
    btn.disabled = true;
    btn.innerText = "Enviando... ⏳";

    try {
        await fetch(URL_GOOGLE_SCRIPT, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({
                usuario: usuarioNombre,
                cesta: cesta // Ya no enviamos el total
            })
        });
        mostrarToast("¡Pedido enviado con éxito!");
        cesta = [];
        localStorage.removeItem(`cesta_${usuarioNombre}`);
        actualizarTabla();
    } catch(e) { 
        mostrarToast("Error de conexión al enviar el pedido."); 
    } finally {
        btn.disabled = false;
        btn.innerText = "Enviar Pedido Oficial 📤";
    }
}