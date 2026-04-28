// --- CONFIGURACIÓN ---
// --- LIMPIADOR DE URL ---
// Esto quita el "index.html" y cualquier símbolo raro de la barra de direcciones sin recargar la página
if (window.history.replaceState) {
    const urlLimpia = window.location.href.split('?')[0].replace('index.html', '');
    window.history.replaceState(null, null, urlLimpia);
}
// ¡RECUERDA PEGAR TU NUEVA URL AQUÍ!
const URL_GOOGLE_SCRIPT = "https://script.google.com/macros/s/AKfycbylfpsBL5MZwY0yz3NCvTW4HhUxRXrSXUgveyY-QEvdXnbZC_7CB2nLNykia8spRybT/exec";

let usuarioActual = "";
let cesta = [];
let cartaBuscada = null;

let usuariosDB = JSON.parse(localStorage.getItem('mtgUsuariosDB')) || {};

// --- SISTEMA DE NOTIFICACIONES ---
function mostrarToast(mensaje) {
    const toast = document.getElementById("toast");
    toast.innerText = mensaje;
    toast.className = "toast show";
    setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 3000);
}

// --- AUTENTICACIÓN ---
function mostrarRegistro() {
    document.getElementById('login-box').style.display = 'none';
    document.getElementById('register-box').style.display = 'block';
}

function mostrarLogin() {
    document.getElementById('register-box').style.display = 'none';
    document.getElementById('login-box').style.display = 'block';
}

function registrarUsuario(e) {
    e.preventDefault(); 
    
    const user = document.getElementById('reg-user').value.trim();
    const pass = document.getElementById('reg-pass').value;

    if (usuariosDB[user]) {
        mostrarToast("Ese nombre ya está en uso.");
        return;
    }

    // Guardamos usuario
    usuariosDB[user] = { password: pass };
    localStorage.setItem('mtgUsuariosDB', JSON.stringify(usuariosDB));
    
    // Auto-Login directo sin alertas
    usuarioActual = user;
    mostrarToast("¡Bienvenido, " + user + "!");
    iniciarApp();
}

function iniciarSesion(e) {
    e.preventDefault();
    
    const user = document.getElementById('login-user').value.trim();
    const pass = document.getElementById('login-pass').value;

    if (!usuariosDB[user] || usuariosDB[user].password !== pass) {
        mostrarToast("Usuario o contraseña incorrectos.");
        return;
    }

    usuarioActual = user;
    mostrarToast("¡Hola de nuevo, " + user + "!");
    iniciarApp();
}

function iniciarApp() {
    document.getElementById('formRegister').reset();
    document.getElementById('formLogin').reset();
    
    document.getElementById('nombreUsuarioActivo').innerText = usuarioActual;
    document.getElementById('auth-container').style.display = "none";
    document.getElementById('app-container').style.display = "block";
    
    const guardado = localStorage.getItem(`cesta_${usuarioActual}`);
    cesta = guardado ? JSON.parse(guardado) : [];
    actualizarTabla();
}

function cerrarSesion() {
    usuarioActual = "";
    document.getElementById('app-container').style.display = "none";
    document.getElementById('auth-container').style.display = "flex";
    mostrarLogin();
}

// --- TIENDA Y SCRYFALL ---
async function buscarCarta() {
    const query = document.getElementById('inputBusqueda').value;
    const resDiv = document.getElementById('resultadoBusqueda');
    if (!query) return;

    resDiv.innerHTML = "<div class='empty-state'>Invocando carta... 🌀</div>";
    
    try {
        const res = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(query)}`);
        const data = await res.json();
        
        if (data.status === 404) {
            resDiv.innerHTML = "<div class='empty-state' style='color:#F4C2C2'>El hechizo falló. Carta no encontrada.</div>";
            return;
        }

        cartaBuscada = {
            nombre: data.name,
            precio: data.prices.eur || data.prices.usd || 0,
            img: data.image_uris ? data.image_uris.small : (data.card_faces ? data.card_faces[0].image_uris.small : '')
        };

        resDiv.innerHTML = `
            <img src="${cartaBuscada.img}" style="width:160px; border-radius:8px; box-shadow:0 8px 16px rgba(0,0,0,0.6); margin-bottom:15px;">
            <strong style="font-size:1.2rem; margin-bottom:5px;">${cartaBuscada.nombre}</strong>
            <span style="font-size:1.5rem; font-weight:bold; color:var(--naranja-palo); margin-bottom:20px;">${cartaBuscada.precio}€</span>
            <button class="btn-primary" onclick="añadirCesta()">Añadir a la Cesta</button>
        `;
    } catch (e) { 
        resDiv.innerHTML = "<div class='empty-state' style='color:#F4C2C2'>Error de conexión con la API.</div>"; 
    }
}

function añadirCesta() {
    if(!cartaBuscada) return;
    
    cesta.push({...cartaBuscada});
    localStorage.setItem(`cesta_${usuarioActual}`, JSON.stringify(cesta));
    actualizarTabla();
    
    document.getElementById('inputBusqueda').value = "";
    document.getElementById('resultadoBusqueda').innerHTML = "<div class='empty-state'>¡Añadida! Busca la siguiente.</div>";
    cartaBuscada = null;
    mostrarToast("Carta añadida al pedido");
}

function actualizarTabla() {
    const cuerpo = document.getElementById('cuerpoCesta');
    cuerpo.innerHTML = "";
    let total = 0;

    if (cesta.length === 0) {
        cuerpo.innerHTML = `<tr><td colspan="4" class="text-center empty-state" style="padding: 30px;">Tu cesta está vacía.</td></tr>`;
        document.getElementById('precioTotal').innerText = "0.00";
        return;
    }

    cesta.forEach((item, i) => {
        total += parseFloat(item.precio);
        cuerpo.innerHTML += `
            <tr>
                <td><strong style="color:var(--blanco);">${item.nombre}</strong></td>
                <td class="text-center">1</td>
                <td class="text-right" style="color:var(--rosa-palo);">${item.precio}€</td>
                <td class="text-center">
                    <button style="background:transparent; color:#ff5252; border:1px solid #ff5252; padding:5px 10px; font-size:0.8rem;" onclick="eliminar(${i})">X</button>
                </td>
            </tr>
        `;
    });
    document.getElementById('precioTotal').innerText = total.toFixed(2);
}

function eliminar(i) {
    cesta.splice(i, 1);
    localStorage.setItem(`cesta_${usuarioActual}`, JSON.stringify(cesta));
    actualizarTabla();
}

// --- ENVÍO DE DATOS ---
async function enviarPedidoFinal() {
    if (cesta.length === 0) {
        mostrarToast("No hay cartas en tu cesta.");
        return;
    }
    if (URL_GOOGLE_SCRIPT.includes("TU_URL")) {
        mostrarToast("Error interno: URL de Google Script sin configurar.");
        return;
    }

    const btn = document.getElementById('btnEnviar');
    btn.innerHTML = "Enviando al líder de la mesa... ⏳";
    btn.disabled = true;

    try {
        await fetch(URL_GOOGLE_SCRIPT, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({
                usuario: usuarioActual,
                cesta: cesta,
                total: document.getElementById('precioTotal').innerText
            })
        });

        mostrarToast("¡Pedido enviado con éxito!");
        cesta = [];
        localStorage.removeItem(`cesta_${usuarioActual}`);
        actualizarTabla();
    } catch (e) {
        mostrarToast("Hubo un error al enviar la información.");
    } finally {
        btn.innerHTML = "Enviar Pedido Oficial 📤";
        btn.disabled = false;
    }
}