// --- CONFIGURACIÓN FIREBASE (Mantén tu config intacta) ---
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

// --- CONFIGURACIÓN GOOGLE SCRIPT ---
// ¡Pega tu URL AQUÍ!
const URL_GOOGLE_SCRIPT = "https://script.google.com/macros/s/AKfycbwOP_JujfFlvOL8imlJyUGkY0pqPvSBPor5EXExDAJD3JKmdqsbrYsQaQkePcUhPjMp/exec";

let usuarioNombre = "";
let cesta = [];
let cartasBuscadas = []; // Almacenará las versiones buscadas temporalmente

// --- NOTIFICACIONES ---
function mostrarToast(msj) {
    const t = document.getElementById("toast");
    t.innerText = msj;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 3500);
}

// --- SESIÓN ---
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

// --- BUSCADOR SCRYFALL MULTIPRINT (La magia está aquí) ---
async function buscarCarta() {
    const q = document.getElementById('inputBusqueda').value;
    const resDiv = document.getElementById('resultadoBusqueda');
    if(!q) return;

    resDiv.innerHTML = "<p>Buscando en el multiverso...</p>";
    
    try {
        // La búsqueda 'search' con unique:prints devuelve todas las versiones
        const r = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}+unique:prints`);
        const d = await r.json();
        
        if(d.status === 404 || !d.data || d.data.length === 0) {
            return resDiv.innerHTML = "<p class='empty-state' style='color:#ff5252'>Carta no encontrada. Revisa cómo está escrita.</p>";
        }

        // Limitamos a 15 impresiones para que no sea infinito
        cartasBuscadas = d.data.slice(0, 15);

        // Creamos el carrusel de tarjetas
        let html = "";
        cartasBuscadas.forEach((rawCard, i) => {
            const precioRaw = rawCard.prices.eur || rawCard.prices.usd || 0;
            const precioFinal = precioRaw ? parseFloat(precioRaw).toFixed(2) : "0.00";
            const set = rawCard.set_name.toUpperCase();
            const setCode = rawCard.set.toUpperCase();
            const img = rawCard.image_uris ? rawCard.image_uris.small : (rawCard.card_faces ? rawCard.card_faces[0].image_uris.small : '');

            html += `
                <div class="print-card print-card-js fade-in">
                    <img src="${img}" alt="${rawCard.name}">
                    <h4 style="margin:5px 0;">${rawCard.name}</h4>
                    <p style="font-size:0.8rem; color:#666; margin:0;">${set}</p>
                    <p style="font-size:0.8rem; color:#888; margin:0 0 10px 0;">[${setCode}]</p>
                    <p style="font-size:1.3rem; color:var(--naranja-el99); font-weight:bold; margin:0 0 10px 0;">${precioFinal}€</p>
                    <button class="btn-primary" style="padding: 5px 10px; font-size:0.8rem;" onclick="añadirACesta(${i})">Añadir</button>
                </div>
            `;
        });
        resDiv.innerHTML = html;
        resDiv.classList.add('multi-print-search'); // Activa el carrusel CSS

    } catch(e) { resDiv.innerHTML = "<p class='empty-state'>Error de conexión. Inténtalo más tarde.</p>"; }
}

function añadirACesta(index) {
    const rawCard = cartasBuscadas[index];
    const precioRaw = rawCard.prices.eur || rawCard.prices.usd || 0;
    
    // Objeto carta actualizado para incluir el SET
    const carta = {
        nombre: rawCard.name,
        precio: parseFloat(precioRaw),
        set: rawCard.set_name, // Nombre completo del set (ej: Jumpstart)
        setCode: rawCard.set // Código corto (ej: jmp)
    };

    cesta.push(carta);
    actualizarTabla();
    mostrarToast("Carta añadida al pedido");
}

function actualizarTabla() {
    const tbody = document.getElementById('cuerpoCesta');
    tbody.innerHTML = "";
    let total = 0;
    
    if (cesta.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center empty-state" style="padding: 30px;">Cesta vacía.</td></tr>`;
        document.getElementById('precioTotal').innerText = "0.00";
        return;
    }

    cesta.forEach((item, i) => {
        total += item.precio;
        tbody.innerHTML += `
            <tr>
                <td><strong>${item.nombre}</strong></td>
                <td>${item.set} [${item.setCode.toUpperCase()}]</td> <td>${item.precio.toFixed(2)}€</td>
                <td><button onclick="eliminar(${i})" style="background:transparent; color:#ff5252; border:1px solid #ff5252; padding:5px 10px; font-size:0.8rem;">X</button></td>
            </tr>
        `;
    });
    document.getElementById('precioTotal').innerText = total.toFixed(2);
}

function eliminar(i) { cesta.splice(i, 1); actualizarTabla(); }

async function enviarPedidoFinal() {
    if(cesta.length === 0) return;
    const btn = document.getElementById('btnEnviar');
    btn.disabled = true;
    btn.innerText = "Enviando...";

    try {
        await fetch(URL_GOOGLE_SCRIPT, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({
                usuario: usuarioNombre,
                cesta: cesta, // La cesta ya va con el set info
                total: document.getElementById('precioTotal').innerText
            })
        });
        mostrarToast("¡Pedido enviado con éxito!");
        cesta = []; actualizarTabla();
    } catch(e) { mostrarToast("Error al enviar."); }
    finally { btn.disabled = false; btn.innerText = "Confirmar y Enviar Pedido 🚀"; }
}