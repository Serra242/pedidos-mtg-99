// --- LIMPIADOR DE URL ---
// Esto quita el "index.html" y símbolos raros al recargar o hacer clic en botones
if (window.history.replaceState) {
    const urlLimpia = window.location.href.split('?')[0].replace('index.html', '');
    window.history.replaceState(null, null, urlLimpia);
}

// --- CONFIGURACIÓN ---
// RECUERDA PEGAR TU URL DE GOOGLE APPS SCRIPT AQUÍ
const URL_GOOGLE_SCRIPT = "https://script.google.com/macros/s/AKfycbwPl1saQ03qmoMhAptaUjRqCcxG5vhAVdgoeMGfPWV1veiObNRh5PgZjeZ_31r8dxvm/exec";

let usuarioActual = "";
let cesta = [];
let cartaBuscada = null;

let usuariosDB = JSON.parse(localStorage.getItem('el99UsuariosDB')) || {};

// --- SISTEMA DE NOTIFICACIONES ---
function mostrarToast(mensaje) {
    const toast = document.getElementById("toast");
    toast.innerText = mensaje;
    toast.classList.add("show");
    setTimeout(() => { toast.classList.remove("show"); }, 3000);
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

    usuariosDB[user] = { password: pass };
    localStorage.setItem('el99UsuariosDB', JSON.stringify(usuariosDB));
    
    usuarioActual = user;
    mostrarToast("¡Bienvenido a El99, " + user + "!");
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
            resDiv.innerHTML = "<div class='empty-state' style='color:red'>Carta no encontrada.</div>";
            return;
        }

        cartaBuscada = {
            nombre: data.name,
            precio: data.prices.eur || data.prices.usd || 0,
            img: data.image_uris ? data.image_uris.small : (data.card_faces ? data.card_faces[0].image_uris.small : '')
        };

        resDiv.innerHTML = `
            <img src="${cartaBuscada.img}" style="width:160px; border-radius:8px; border: 2px solid #2F2F2F; box-shadow: 4px 4px 0px #F4C2C2; margin-bottom:15px;">
            <strong style="font-size:1.2rem; margin-bottom:5px; display:block;">${cartaBuscada.nombre}</strong>
            <span style="font-size:1.6rem; font-weight:bold; color:var(--naranja-el99); margin-bottom:20px; display:block;">${cartaBuscada.precio}€</span>
            <button class="btn-primary" onclick="añadirCesta()">Añadir al Carrito</button>
        `;
    } catch (e) { 
        resDiv.innerHTML = "<div class='empty-state'>Error de conexión con la API.</div>"; 
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
                <td>${item.nombre}</td>
                <td class="text-center">1</td>
                <td class="text-right">${item.precio}€</td>
                <td class="text-center">
                    <button style="background:var(--rosa-palo); color:var(--gris-oscuro); padding:5px 10px; font-size:0.8rem;" onclick="eliminar(${i})">X</button>
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
        mostrarToast("Falta enlazar el código de Google Script.");
        return;
    }

    const btn = document.getElementById('btnEnviar');
    btn.innerHTML = "Procesando pedido... ⏳";
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

        mostrarToast("¡Pedido confirmado y enviado!");
        cesta = [];
        localStorage.removeItem(`cesta_${usuarioActual}`);
        actualizarTabla();
    } catch (e) {
        mostrarToast("Error de conexión al enviar el pedido.");
    } finally {
        btn.innerHTML = "Confirmar Pedido 📤";
        btn.disabled = false;
    }
}