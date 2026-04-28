// --- 1. LIMPIEZA DE URL ---
if (window.history.replaceState) {
    window.history.replaceState(null, null, window.location.pathname);
}

// --- 2. CONFIGURACIÓN FIREBASE ---
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA-AnAC0egX4Lkftg_oBhZoJFpQMqD4u6U",
  authDomain: "el99-4a9b7.firebaseapp.com",
  projectId: "el99-4a9b7",
  storageBucket: "el99-4a9b7.firebasestorage.app",
  messagingSenderId: "672251205852",
  appId: "1:672251205852:web:83ed0add63cbbad89d3c19",
  measurementId: "G-PQ9YVVHLCT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// --- 3. CONFIGURACIÓN GOOGLE SCRIPT ---
const URL_GOOGLE_SCRIPT = "https://script.google.com/macros/s/AKfycbwHKnvSMpbNFzJGf896-6O6w27yrOOXOaCDiyAXTgloGk5qx8fxqkqYkVyn_Avr8R82/exec";

let usuarioNombre = "";
let cesta = [];

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
        // Guardamos el nombre en el perfil de Firebase
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

// Escuchar cambios de sesión (Esto detecta si el usuario ya estaba logueado)
auth.onAuthStateChanged(user => {
    if (user) {
        usuarioNombre = user.displayName || user.email.split('@')[0];
        document.getElementById('nombreUsuarioActivo').innerText = usuarioNombre;
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'block';
        actualizarTabla();
    } else {
        document.getElementById('app-container').style.display = 'none';
        document.getElementById('auth-container').style.display = 'flex';
    }
});

function cerrarSesion() {
    auth.signOut();
}

// --- BUSCADOR SCRYFALL ---
async function buscarCarta() {
    const q = document.getElementById('inputBusqueda').value;
    const resDiv = document.getElementById('resultadoBusqueda');
    if(!q) return;

    resDiv.innerHTML = "<p>Invocando carta...</p>";
    try {
        const r = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(q)}`);
        const d = await r.json();
        
        if(d.status === 404) return resDiv.innerHTML = "<p>No encontrada.</p>";

        const carta = {
            nombre: d.name,
            precio: d.prices.eur || d.prices.usd || 0,
            img: d.image_uris ? d.image_uris.normal : d.card_faces[0].image_uris.normal
        };

        resDiv.innerHTML = `
            <div class="fade-in">
                <img src="${carta.img}" style="width:100%; max-width:200px; border-radius:10px; border:3px solid var(--gris-oscuro);">
                <h3 style="margin:10px 0;">${carta.nombre}</h3>
                <p style="font-size:1.8rem; color:var(--naranja-el99); font-weight:bold; margin:0 0 15px 0;">${carta.precio}€</p>
                <button class="btn-primary" onclick='añadirCesta(${JSON.stringify(carta)})'>Añadir al Pedido</button>
            </div>
        `;
    } catch(e) { resDiv.innerHTML = "<p>Error de red.</p>"; }
}

function añadirCesta(c) {
    cesta.push(c);
    actualizarTabla();
    mostrarToast("Carta añadida");
}

function actualizarTabla() {
    const tbody = document.getElementById('cuerpoCesta');
    tbody.innerHTML = "";
    let total = 0;
    cesta.forEach((item, i) => {
        total += parseFloat(item.precio);
        tbody.innerHTML += `
            <tr class="fade-in">
                <td>${item.nombre}</td>
                <td>1</td>
                <td>${item.precio}€</td>
                <td><button onclick="eliminar(${i})" style="background:var(--rosa-palo)">X</button></td>
            </tr>
        `;
    });
    document.getElementById('precioTotal').innerText = total.toFixed(2);
}

function eliminar(i) {
    cesta.splice(i, 1);
    actualizarTabla();
}

// --- ENVÍO AL EXCEL ---
async function enviarPedidoFinal() {
    if(cesta.length === 0) return;
    const btn = document.getElementById('btnEnviar');
    btn.disabled = true;
    btn.innerText = "Enviando... ⏳";

    try {
        // Usamos usuarioNombre para que Google cree la pestaña con su nombre real
        await fetch(URL_GOOGLE_SCRIPT, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({
                usuario: usuarioNombre,
                cesta: cesta,
                total: document.getElementById('precioTotal').innerText
            })
        });
        mostrarToast("¡Pedido enviado! Revisa tu Excel.");
        cesta = [];
        actualizarTabla();
    } catch(e) { 
        mostrarToast("Error al enviar."); 
    } finally {
        btn.disabled = false;
        btn.innerText = "Enviar Pedido 🚀";
    }
}