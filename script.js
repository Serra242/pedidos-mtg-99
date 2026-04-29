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
// PEGA AQUÍ TU URL DE GOOGLE SCRIPT
const URL_GOOGLE_SCRIPT = "https://script.google.com/macros/s/AKfycby0bK4zBsRqRei1gsjqZnszjX8eLP-lP3rQ6dK5Ket8qGAzwo4NYDv-aArT8DTrYsU/exec";

let usuarioNombre = "";
let cesta = [];
let cartasEncontradas = []; 
let indiceVersionActual = 0; // Para saber qué versión del carrusel estamos viendo

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

// --- BUSCADOR CON FLECHAS ---
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
        indiceVersionActual = 0; // Reiniciamos al buscar
        dibujarCarrusel();

    } catch(e) { 
        resDiv.innerHTML = "<p class='empty-state'>Error de red al buscar.</p>"; 
    }
}

// Dibuja el cuadro central limitado con flechas
function dibujarCarrusel() {
    const resDiv = document.getElementById('resultadoBusqueda');
    if (cartasEncontradas.length === 0) return;

    const cartaRaw = cartasEncontradas[indiceVersionActual];
    
    const precioRaw = cartaRaw.prices.eur || cartaRaw.prices.usd || null;
    const precioDisplay = precioRaw ? `${precioRaw}€` : `<span style="color:#ff5252; font-size:1.1rem;">Sin Precio</span>`;
    const img = cartaRaw.image_uris ? cartaRaw.image_uris.normal : (cartaRaw.card_faces ? cartaRaw.card_faces[0].image_uris.normal : '');
    const set = cartaRaw.set_name.toUpperCase();
    const lang = cartaRaw.lang.toUpperCase();

    // Contador de versión (Ej: 1 de 5)
    const contador = `<p style="font-size:0.8rem; color:var(--texto-gris); margin-bottom:5px;">Versión ${indiceVersionActual + 1} de ${cartasEncontradas.length}</p>`;

    resDiv.innerHTML = `
        <div class="carousel-container fade-in">
            <button class="carousel-btn" onclick="cambiarVersion(-1)">❮</button>
            
            <div class="carousel-content">
                ${contador}
                <img src="${img}" alt="Carta">
                <h3 style="margin:0 0 5px 0; color:var(--texto-claro); font-size:1.1rem;">${cartaRaw.name}</h3>
                <p style="font-size:0.85rem; color:var(--texto-gris); margin:0 0 10px 0;">${set} [${lang}]</p>
                <p style="font-size:1.6rem; color:var(--naranja-el99); font-weight:bold; margin:0 0 15px 0;">${precioDisplay}</p>
                <button class="btn-primary" onclick="añadirACesta()">Añadir al Pedido</button>
            </div>

            <button class="carousel-btn" onclick="cambiarVersion(1)">❯</button>
        </div>
    `;
}

// Función que mueven las flechas
function cambiarVersion(direccion) {
    indiceVersionActual += direccion;
    // Si llega al final, vuelve al principio, y viceversa
    if (indiceVersionActual >= cartasEncontradas.length) indiceVersionActual = 0;
    if (indiceVersionActual < 0) indiceVersionActual = cartasEncontradas.length - 1;
    
    dibujarCarrusel();
}

// Añadir la carta que se está viendo en ese momento
function añadirACesta() {
    let cartaElegida = cartasEncontradas[indiceVersionActual];
    let precioRaw = cartaElegida.prices.eur || cartaElegida.prices.usd || null;
    let precioNum = precioRaw ? parseFloat(precioRaw) : 0;
    let img = cartaElegida.image_uris ? cartaElegida.image_uris.normal : (cartaElegida.card_faces ? cartaElegida.card_faces[0].image_uris.normal : '');

    let cartaParaCesta = {
        nombre: cartaElegida.name,
        precio: precioNum,
        set: cartaElegida.set_name,
        setCode: cartaElegida.set,
        img: img
    };

    if(precioNum === 0) mostrarToast("Aviso: Carta sin precio añadida a 0€");
    else mostrarToast("Carta añadida al pedido");

    cesta.push(cartaParaCesta);
    localStorage.setItem(`cesta_${usuarioNombre}`, JSON.stringify(cesta));
    actualizarTabla();
}

function actualizarTabla() {
    const tbody = document.getElementById('cuerpoCesta');
    tbody.innerHTML = "";
    let total = 0;
    
    if (cesta.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center empty-state" style="padding: 30px;">Tu cesta está vacía.</td></tr>`;
        document.getElementById('precioTotal').innerText = "0.00";
        return;
    }

    cesta.forEach((item, i) => {
        total += parseFloat(item.precio);
        tbody.innerHTML += `
            <tr class="fade-in">
                <td style="color:var(--texto-claro);">${item.nombre}</td>
                <td style="color:var(--texto-gris); font-size:0.85rem;">${item.set} [${item.setCode.toUpperCase()}]</td>
                <td class="text-right" style="color:var(--rosa-palo); font-weight:bold;">${item.precio.toFixed(2)}€</td>
                <td class="text-center"><button onclick="eliminar(${i})" style="background:transparent; color:#ff5252; border:1px solid #ff5252; padding:4px 8px; font-size:0.8rem; cursor:pointer;">X</button></td>
            </tr>
        `;
    });
    document.getElementById('precioTotal').innerText = total.toFixed(2);
}

function eliminar(i) {
    cesta.splice(i, 1);
    localStorage.setItem(`cesta_${usuarioNombre}`, JSON.stringify(cesta));
    actualizarTabla();
}

// --- ENVÍO AL EXCEL ---
async function enviarPedidoFinal() {
    if(cesta.length === 0) return mostrarToast("No hay cartas en tu cesta.");
    
    const btn = document.getElementById('btnEnviar');
    btn.disabled = true;
    btn.innerText = "Enviando... ⏳";

    try {
        await fetch(URL_GOOGLE_SCRIPT, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({
                usuario: usuarioNombre,
                cesta: cesta,
                total: document.getElementById('precioTotal').innerText
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