// --- 1. LIMPIEZA DE URL ---
if (window.history.replaceState) {
    window.history.replaceState(null, null, window.location.pathname);
}

// --- 2. CONFIGURACIÓN FIREBASE (Compat Version) ---
const firebaseConfig = {
  apiKey: "AIzaSyA-AnAC0egX4Lkftg_oBhZoJFpQMqD4u6U",
  authDomain: "el99-4a9b7.firebaseapp.com",
  projectId: "el99-4a9b7",
  storageBucket: "el99-4a9b7.firebasestorage.app",
  messagingSenderId: "672251205852",
  appId: "1:672251205852:web:83ed0add63cbbad89d3c19"
};

// Inicializamos Firebase con la sintaxis correcta para el navegador
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// --- 3. CONFIGURACIÓN GOOGLE SCRIPT ---
const URL_GOOGLE_SCRIPT = "https://script.google.com/macros/s/AKfycbwHKnvSMpbNFzJGf896-6O6w27yrOOXOaCDiyAXTgloGk5qx8fxqkqYkVyn_Avr8R82/exec";

let usuarioNombre = "";
let cesta = [];

// --- SISTEMA DE NOTIFICACIONES ---
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

// Registro Real en Firebase
async function registrarUsuario(e) {
    e.preventDefault();
    const nombre = document.getElementById('reg-user').value;
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-pass').value;

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
        // Guardamos el nombre del mago en el perfil de Firebase
        await userCredential.user.updateProfile({ displayName: nombre });
        mostrarToast("¡Cuenta creada! Bienvenido a El99.");
    } catch (error) {
        mostrarToast("Error al registrarse. Revisa los datos.");
        console.error(error);
    }
}

// Login Real en Firebase
async function iniciarSesion(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;

    try {
        await auth.signInWithEmailAndPassword(email, pass);
        mostrarToast("Acceso concedido.");
    } catch (error) {
        mostrarToast("Usuario o contraseña incorrectos.");
    }
}

// Escuchar cambios de sesión
auth.onAuthStateChanged(user => {
    if (user) {
        // Obtenemos el nombre guardado, o usamos la primera parte del email
        usuarioNombre = user.displayName || user.email.split('@')[0];
        document.getElementById('nombreUsuarioActivo').innerText = usuarioNombre;
        
        // Cargar cesta local (temporal por sesión)
        const guardado = localStorage.getItem(`cesta_${usuarioNombre}`);
        cesta = guardado ? JSON.parse(guardado) : [];
        actualizarTabla();
        
        cambiarVista('APP');
    } else {
        cambiarVista('AUTH');
    }
});

function cerrarSesion() {
    auth.signOut();
}

// --- BUSCADOR SCRYFALL ---
let cartaBuscada = null;

async function buscarCarta() {
    const q = document.getElementById('inputBusqueda').value;
    const resDiv = document.getElementById('resultadoBusqueda');
    if(!q) return;

    resDiv.innerHTML = "<p class='empty-state'>Invocando carta...</p>";
    try {
        const r = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(q)}`);
        const d = await r.json();
        
        if(d.status === 404) return resDiv.innerHTML = "<p class='empty-state' style='color:var(--rosa-palo)'>Carta no encontrada.</p>";

        cartaBuscada = {
            nombre: d.name,
            precio: d.prices.eur || d.prices.usd || 0,
            img: d.image_uris ? d.image_uris.normal : (d.card_faces ? d.card_faces[0].image_uris.normal : '')
        };

        resDiv.innerHTML = `
            <div class="fade-in">
                <img src="${cartaBuscada.img}" style="width:100%; max-width:200px; border-radius:10px; border:2px solid var(--naranja-el99); box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
                <h3 style="margin:15px 0 5px 0; color:var(--texto-claro);">${cartaBuscada.nombre}</h3>
                <p style="font-size:1.8rem; color:var(--naranja-el99); font-weight:bold; margin:0 0 15px 0;">${cartaBuscada.precio}€</p>
                <button class="btn-primary" onclick="añadirCesta()">Añadir al Pedido</button>
            </div>
        `;
    } catch(e) { resDiv.innerHTML = "<p class='empty-state'>Error de red al buscar.</p>"; }
}

function añadirCesta() {
    if(!cartaBuscada) return;
    cesta.push({...cartaBuscada});
    localStorage.setItem(`cesta_${usuarioNombre}`, JSON.stringify(cesta));
    actualizarTabla();
    document.getElementById('inputBusqueda').value = "";
    document.getElementById('resultadoBusqueda').innerHTML = "<p class='empty-state'>¡Añadida! Busca la siguiente.</p>";
    cartaBuscada = null;
    mostrarToast("Carta añadida al pedido");
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
                <td class="text-center">1</td>
                <td class="text-right" style="color:var(--rosa-palo); font-weight:bold;">${item.precio}€</td>
                <td class="text-center"><button onclick="eliminar(${i})" style="background:transparent; color:#ff5252; border:1px solid #ff5252; padding:4px 8px; font-size:0.8rem;">X</button></td>
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