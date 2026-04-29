// --- 1. LIMPIEZA DE URL ---
if (window.history.replaceState) {
    window.history.replaceState(null, null, window.location.pathname);
}

// --- 2. CONFIGURACIÓN FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js";

const firebaseConfig = {
  apiKey: "AIzaSyA-AnAC0egX4Lkftg_oBhZoJFpQMqD4u6U",
  authDomain: "el99-4a9b7.firebaseapp.com",
  projectId: "el99-4a9b7",
  storageBucket: "el99-4a9b7.firebasestorage.app",
  messagingSenderId: "672251205852",
  appId: "1:672251205852:web:83ed0add63cbbad89d3c19",
  measurementId: "G-PQ9YVVHLCT"
};

// Inicializamos Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// --- 3. CONFIGURACIÓN GOOGLE SCRIPT ---
const URL_GOOGLE_SCRIPT = "https://script.google.com/macros/s/AKfycbwHKnvSMpbNFzJGf896-6O6w27yrOOXOaCDiyAXTgloGk5qx8fxqkqYkVyn_Avr8R82/exec";

let usuarioNombre = "";
let cesta = [];
let cartasEncontradas = []; // Guardará las versiones buscadas temporalmente

// --- NOTIFICACIONES ---
function mostrarToast(msj) {
    const t = document.getElementById("toast");
    t.innerText = msj;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 3500);
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
        await userCredential.user.updateProfile({ displayName: nombre });
        mostrarToast("¡Cuenta creada! Bienvenido a El99.");
    } catch (error) {
        mostrarToast("Error: " + error.message);
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
        mostrarToast("Error: Usuario o contraseña incorrectos.");
    }
}

// Escuchar cambios de sesión
auth.onAuthStateChanged(user => {
    if (user) {
        usuarioNombre = user.displayName || user.email.split('@')[0];
        document.getElementById('nombreUsuarioActivo').innerText = usuarioNombre;
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'block';
        
        // Cargar cesta si había algo guardado
        const guardado = localStorage.getItem(`cesta_${usuarioNombre}`);
        cesta = guardado ? JSON.parse(guardado) : [];
        actualizarTabla();
    } else {
        document.getElementById('app-container').style.display = 'none';
        document.getElementById('auth-container').style.display = 'flex';
    }
});

function cerrarSesion() {
    auth.signOut();
}

// --- BUSCADOR SCRYFALL AVANZADO (Versiones Múltiples) ---
async function buscarCarta() {
    const q = document.getElementById('inputBusqueda').value;
    const resDiv = document.getElementById('resultadoBusqueda');
    if(!q) return;

    resDiv.innerHTML = "<p class='empty-state'>Buscando en todos los planos... 🌀</p>";
    
    try {
        // Usamos el endpoint de 'search' que permite buscar en español y saca todas las impresiones únicas
        const r = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}+unique:prints`);
        const d = await r.json();
        
        if(d.status === 404 || !d.data || d.data.length === 0) {
            return resDiv.innerHTML = "<p class='empty-state' style='color:var(--rosa-palo)'>No encontrada. Intenta ser más específico.</p>";
        }

        // Limitamos a 15 versiones para no bloquear la pantalla del móvil
        cartasEncontradas = d.data.slice(0, 15);

        // Creamos un carrusel horizontal con CSS inyectado para que puedas ver todas las versiones
        let html = `<div style="display: flex; overflow-x: auto; gap: 15px; padding: 10px 0; width: 100%; -webkit-overflow-scrolling: touch;">`;

        cartasEncontradas.forEach((cartaRaw, index) => {
            // Lógica para evitar el "Gratis". Priorizamos EU, luego USD. Si nada existe, es null.
            let precioRaw = cartaRaw.prices.eur || cartaRaw.prices.usd || null;
            let precioDisplay = precioRaw ? `${precioRaw}€` : `<span style="color:#ff5252; font-size:1.1rem;">Sin Precio</span>`;
            
            let img = cartaRaw.image_uris ? cartaRaw.image_uris.normal : (cartaRaw.card_faces ? cartaRaw.card_faces[0].image_uris.normal : '');
            let set = cartaRaw.set_name.toUpperCase();
            let lang = cartaRaw.lang.toUpperCase();

            html += `
                <div class="fade-in" style="flex: 0 0 auto; width: 180px; background: rgba(0,0,0,0.4); padding: 15px; border-radius: 12px; border: 1px solid #444; text-align: center;">
                    <img src="${img}" style="width:100%; border-radius:8px; border:2px solid var(--naranja-el99); box-shadow: 0 4px 10px rgba(0,0,0,0.5); margin-bottom: 10px;">
                    
                    <h3 style="margin:0 0 5px 0; color:var(--texto-claro); font-size:1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${cartaRaw.name}">${cartaRaw.name}</h3>
                    
                    <p style="font-size:0.75rem; color:var(--texto-gris); margin:0 0 10px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${set}">${set} [${lang}]</p>
                    
                    <p style="font-size:1.4rem; color:var(--naranja-el99); font-weight:bold; margin:0 0 15px 0;">${precioDisplay}</p>
                    
                    <button class="btn-primary" style="padding: 8px 15px; font-size:0.9rem;" onclick="añadirCestaDesdeArray(${index})">Añadir</button>
                </div>
            `;
        });

        html += `</div>`;
        resDiv.innerHTML = html;

    } catch(e) { 
        resDiv.innerHTML = "<p class='empty-state'>Error de red al buscar.</p>"; 
    }
}

// Función que extrae la versión seleccionada por el usuario
function añadirCestaDesdeArray(index) {
    let cartaElegida = cartasEncontradas[index];
    
    let precioRaw = cartaElegida.prices.eur || cartaElegida.prices.usd || null;
    let precioNum = precioRaw ? parseFloat(precioRaw) : 0;
    let img = cartaElegida.image_uris ? cartaElegida.image_uris.normal : (cartaElegida.card_faces ? cartaElegida.card_faces[0].image_uris.normal : '');

    // Formateamos el nombre para que en el Excel te salga con la edición (Ej: Krenko, Mob Boss (M13))
    let cartaParaCesta = {
        nombre: `${cartaElegida.name} (${cartaElegida.set.toUpperCase()})`,
        precio: precioNum,
        img: img
    };

    if(precioNum === 0) {
        mostrarToast("Aviso: Carta sin precio de mercado añadida a 0€");
    } else {
        mostrarToast("Carta añadida al pedido");
    }

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
                <td class="text-center">1</td>
                <td class="text-right" style="color:var(--rosa-palo); font-weight:bold;">${item.precio}€</td>
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