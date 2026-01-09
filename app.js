/**
 * Coffe Bell ERP - Client Logic
 * Decoupled Architecture
 */

// --- Configuration ---
// The user must provide the Deployment URL
let API_URL = localStorage.getItem('COFFE_BELL_API_URL') || '';

// --- State ---
let currentUser = null;
let currentCart = [];
let itemsList = []; // Products

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    if (!API_URL) {
        document.getElementById('setup-screen').style.display = 'flex';
    } else {
        document.getElementById('login-screen').style.display = 'flex';
    }
});

function saveApiUrl() {
    const input = document.getElementById('api-url-input').value;
    if (input && input.includes('script.google.com')) {
        localStorage.setItem('COFFE_BELL_API_URL', input);
        API_URL = input;
        document.getElementById('setup-screen').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
    } else {
        alert("URL invalida. Debe ser un link de Google Apps Script.");
    }
}

// --- API Helper ---
// Google Apps Script Web App redirects 302 to a content serving URL.
// Fetch follows this automatically.
async function apiCall(action, payload = {}, method = 'GET') {
    if (!API_URL) return;

    let url = `${API_URL}?action=${action}`;
    let options = {
        method: method,
        redirect: "follow", // Important for GAS
    };

    if (method === 'POST') {
        // GAS doPost usually works best with simple payload
        // We send data in the body
        const postData = JSON.stringify({ action, ...payload });
        options.body = postData;
        // Weirdly, GAS sometimes prefers text/plain to avoid preflight CORS issues
        options.headers = { "Content-Type": "text/plain;charset=utf-8" };
    } else {
        // Append params for GET
        const query = Object.keys(payload).map(k => `${k}=${encodeURIComponent(payload[k])}`).join('&');
        if (query) url += `&${query}`;
    }

    try {
        const response = await fetch(url, options);
        // Sometimes GAS returns HTML callback if not strictly JSON, but we enforced JSON MimeType
        const json = await response.json();
        return json;
    } catch (error) {
        console.error("API Error", error);
        alert("Error de Conexión: " + error.message);
        return { error: error.message };
    }
}

// --- Auth ---
async function attemptLogin() {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    const errorDiv = document.getElementById('login-error');

    errorDiv.innerText = "Verificando...";
    const res = await apiCall('login', { username: user, password: pass });

    if (res.success) {
        currentUser = res;
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-content').style.display = 'flex';
        setupUIForRole(res.role);
    } else {
        errorDiv.innerText = res.message || "Login failed";
    }
}

function logout() {
    location.reload();
}

function setupUIForRole(role) {
    // Desktop Nav
    document.querySelectorAll('.nav-group').forEach(el => el.style.display = 'none');

    // Mobile Nav
    const mobileNav = document.getElementById('mobile-nav');
    if (window.innerWidth <= 768) {
        mobileNav.style.display = 'flex';
        // Adjust for role
    }

    if (role === 'admin') {
        document.getElementById('nav-admin').style.display = 'block';
        showView('dashboard');
        refreshDashboard();
    } else if (role === 'mozo') {
        document.getElementById('nav-mozo').style.display = 'block';
        showView('waiter');
        loadProducts();
    } else if (role === 'cocina') {
        document.getElementById('nav-cocina').style.display = 'block';
        showView('kitchen');
        refreshKitchen();
        setInterval(refreshKitchen, 30000); // Auto refresh
    } else if (role === 'cajero') {
        document.getElementById('nav-caja').style.display = 'block';
        showView('cashier');
        refreshCashier();
        setInterval(refreshCashier, 30000); // Auto refresh
    }
}

function showView(viewName) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.mobile-nav-item').forEach(el => el.classList.remove('active'));

    const target = document.getElementById('view-' + viewName);
    if (target) target.classList.add('active');
}

// --- Features ---

// Waiter
async function loadProducts() {
    const data = await apiCall('getProducts');
    if (Array.isArray(data)) {
        itemsList = data;
        renderProducts(data);
    }
}

function renderProducts(list) {
    const container = document.getElementById('product-list');
    container.innerHTML = '';

    list.forEach(p => {
        const div = document.createElement('div');
        div.className = 'product-card';
        div.onclick = () => addToCart(p);
        div.innerHTML = `
            <img src="${p.image_url}" class="product-img" onerror="this.src='https://via.placeholder.com/150'">
            <div class="product-info">
              <div style="font-weight:600; font-size:14px">${p.name}</div>
              <div style="color:var(--primary); font-weight:bold">S/ ${p.price}</div>
            </div>
        `;
        container.appendChild(div);
    });
}

function addToCart(product) {
    const existing = currentCart.find(i => i.id === product.id);
    if (existing) {
        existing.quantity++;
    } else {
        currentCart.push({ ...product, quantity: 1 });
    }
    updateCartUI();
}

function updateCartUI() {
    const container = document.getElementById('current-order-items');
    const totalEl = document.getElementById('order-total');
    container.innerHTML = '';
    let total = 0;

    if (currentCart.length === 0) {
        container.innerHTML = '<div class="empty-cart">Vacio</div>';
        totalEl.innerText = "S/ 0.00";
        return;
    }

    currentCart.forEach((item, index) => {
        total += item.price * item.quantity;
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.marginBottom = '10px';
        div.innerHTML = `
            <span>${item.quantity}x ${item.name}</span>
            <span>S/ ${(item.price * item.quantity).toFixed(2)}</span>
        `;
        container.appendChild(div);
    });
    totalEl.innerText = "S/ " + total.toFixed(2);
}

async function submitOrder() {
    if (currentCart.length === 0) return alert("Carrito vacio");

    const table = document.getElementById('table-select').value;
    const orderData = {
        table_number: table,
        waiter_id: currentUser.id,
        items: currentCart,
        total: currentCart.reduce((a, b) => a + (b.price * b.quantity), 0)
    };

    const btn = document.querySelector('.btn-success');
    btn.disabled = true; btn.innerText = "Enviando...";

    const res = await apiCall('createOrder', { orderData }, 'POST');

    if (res.success) {
        alert("Orden enviada!");
        currentCart = [];
        updateCartUI();
    } else {
        alert("Error: " + res.error);
    }
    btn.disabled = false; btn.innerText = "Enviar a Cocina";
}

// Kitchen
async function refreshKitchen() {
    const container = document.getElementById('kitchen-board');
    const orders = await apiCall('getOrders', { role: 'cocina' });

    if (!orders || orders.length === 0) {
        container.innerHTML = '<p>No hay pedidos pendientes</p>';
        return;
    }

    container.innerHTML = '';
    orders.forEach(o => {
        const div = document.createElement('div');
        div.className = `ticket ${o.status === 'ready' ? 'ready' : ''}`;

        const items = o.items.map(i => `<div class="ticket-item">${i.quantity}x ${i.product_name}</div>`).join('');

        div.innerHTML = `
            <div class="ticket-header">
                <span>Mesa ${o.table_number}</span>
                <span>${o.updated_at ? new Date(o.updated_at).toLocaleTimeString().slice(0, 5) : ''}</span>
            </div>
            ${items}
            <div style="margin-top:15px; text-align:right;">
                ${o.status !== 'ready' ? `<button class="btn btn-success" onclick="markReady('${o.id}')">Listo</button>` : ''}
            </div>
        `;
        container.appendChild(div);
    });
}

async function markReady(id) {
    await apiCall('updateOrderStatus', { orderId: id, status: 'ready' }, 'POST');
    refreshKitchen();
}

// Cashier
async function refreshCashier() {
    const tbody = document.getElementById('cashier-list');
    const orders = await apiCall('getOrders', { role: 'caja' });

    tbody.innerHTML = '';
    orders.forEach(o => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${o.id.toString().slice(-4)}</td>
            <td>${o.table_number}</td>
            <td>${o.waiter_id}</td>
            <td>S/ ${Number(o.total).toFixed(2)}</td>
            <td>${o.status}</td>
            <td><button class="btn btn-success btn-sm" onclick="payOrder('${o.id}')">Cobrar</button></td>
        `;
        tbody.appendChild(tr);
    });
}

async function payOrder(id) {
    if (confirm("Confirmar pago?")) {
        await apiCall('updateOrderStatus', { orderId: id, status: 'paid' }, 'POST');
        refreshCashier();
    }
}

// Dashboard
async function refreshDashboard() {
    const stats = await apiCall('getDashboardStats');
    if (stats) {
        document.getElementById('dash-sales').innerText = "S/ " + (stats.totalSales || 0).toFixed(2);
        document.getElementById('dash-orders').innerText = stats.orderCount;
    }
}
