/**
 * Coffe Bell ERP - Client Logic
 * Decoupled Architecture - Optimized Version
 */

// --- Configuration ---
// The user has provided the Deployment URL
let API_URL = 'https://script.google.com/macros/s/AKfycbwIAhAuY0ncXYPlKfgzxX8iaurn6anq5t4khMEt_VWhoeF98OUbOGrTdHwXxzLfazVx4A/exec';

// --- State & Performance ---
const AppState = {
    tables: [],
    products: [],
    orders: [],
    inventory: [],
    expenses: [],
    stats: null,
    lastSync: 0,
    syncInterval: null
};

let currentUser = null;
let currentCart = [];
let itemsList = [];

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    if (!API_URL) {
        document.getElementById('setup-screen').style.display = 'flex';
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        // PRE-FETCH: Load public data immediately
        prefetchData();
    }
});

async function prefetchData() {
    console.log("Prefetching data...");
    const data = await apiCall('getSyncData', { role: 'public' });
    if (data && data.timestamp) {
        updateLocalState(data);
    }
}

function updateLocalState(data) {
    if (data.tables) AppState.tables = data.tables;
    if (data.products) AppState.products = data.products;
    if (data.orders) AppState.orders = data.orders;

    // Admin Params
    if (data.inventory) AppState.inventory = data.inventory;
    if (data.expenses) AppState.expenses = data.expenses;
    if (data.stats) AppState.stats = data.stats;

    AppState.lastSync = new Date().getTime();

    // Auto-refresh current view
    const activeView = document.querySelector('.view-section.active');
    if (activeView) {
        const id = activeView.id;
        if (id === 'view-tables') renderTablesFromState();
        if (id === 'view-kitchen') renderKitchenFromState();
        if (id === 'view-cashier') renderCashierFromState();
        if (id === 'view-inventory') renderInventoryFromState();
        if (id === 'view-finance') renderFinanceFromState();
        if (id === 'view-products') renderAdminProductsFromState();
        if (id === 'view-reports') renderReportsFromState();
        if (id === 'view-waiter') renderProductsFromState();
    }
}

function startSyncLoop(role) {
    if (AppState.syncInterval) clearInterval(AppState.syncInterval);

    // Admin: 4s loop (includes everything now)
    // Others: 4s loop (includes their specific data)
    let interval = 4000;

    console.log(`Starting Sync Loop for ${role} every ${interval}ms`);

    // Immediate call
    apiCall('getSyncData', { role: role }).then(updateLocalState);

    AppState.syncInterval = setInterval(async () => {
        const data = await apiCall('getSyncData', { role: role });
        if (data) updateLocalState(data);
    }, interval);
}

function saveApiUrl() {
    const input = document.getElementById('api-url-input').value;
    if (input && input.includes('script.google.com')) {
        localStorage.setItem('COFFE_BELL_API_URL', input);
        API_URL = input;
        document.getElementById('setup-screen').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
        prefetchData();
    } else {
        alert("URL invalida. Debe ser un link de Google Apps Script.");
    }
}

// --- API Helper ---
async function apiCall(action, payload = {}, method = 'GET') {
    if (!API_URL) return;

    let url = `${API_URL}?action=${action}`;
    let options = {
        method: method,
        redirect: "follow",
    };

    if (method === 'POST') {
        const postData = JSON.stringify({ action, ...payload });
        options.body = postData;
        options.headers = { "Content-Type": "text/plain;charset=utf-8" };
    } else {
        const query = Object.keys(payload).map(k => `${k}=${encodeURIComponent(payload[k])}`).join('&');
        if (query) url += `&${query}`;
    }

    try {
        const response = await fetch(url, options);
        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch (e) {
            console.error("API Non-JSON Response", text);
            throw new Error("Respuesta inválida del servidor");
        }
    } catch (error) {
        console.error("API Error", error);
        if (action !== 'getSyncData') alert("Error de Conexión: " + error.message);
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

        startSyncLoop(res.role);
        setupUIForRole(res.role);
    } else {
        errorDiv.innerText = res.message || "Login failed";
    }
}

function logout() {
    location.reload();
}

function setupUIForRole(role) {
    document.querySelectorAll('.nav-group').forEach(el => el.style.display = 'none');
    const mobileNav = document.getElementById('mobile-nav');
    if (window.innerWidth <= 768) mobileNav.style.display = 'flex';

    if (role === 'admin') {
        document.getElementById('nav-admin').style.display = 'block';
        showView('dashboard');
        refreshDashboard();
        renderTablesFromState();
        // Prefetch heavy views via SyncLoop mostly, but let's trigger renders if data exists
    } else if (role === 'mozo') {
        document.getElementById('nav-mozo').style.display = 'block';
        showView('tables');
        renderTablesFromState();
        renderProductsFromState();
    } else if (role === 'cocina') {
        document.getElementById('nav-cocina').style.display = 'block';
        showView('kitchen');
        renderKitchenFromState();
    } else if (role === 'cajero') {
        document.getElementById('nav-caja').style.display = 'block';
        showView('cashier');
        renderCashierFromState();
    }
}

function showView(viewName) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.mobile-nav-item').forEach(el => el.classList.remove('active'));

    const target = document.getElementById('view-' + viewName);
    if (target) target.classList.add('active');

    // Instant Render from State
    if (viewName === 'tables') renderTablesFromState();
    if (viewName === 'kitchen') renderKitchenFromState();
    if (viewName === 'cashier') renderCashierFromState();

    if (viewName === 'inventory') renderInventoryFromState();
    if (viewName === 'finance') renderFinanceFromState();
    if (viewName === 'products') renderAdminProductsFromState();
    if (viewName === 'reports') renderReportsFromState();

    if (viewName === 'waiter') renderProductsFromState();
}

function showLoading(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
        el.innerHTML = '<div style="display:flex; justify-content:center; padding:20px;"><div style="border: 3px solid #f3f3f3; border-top: 3px solid #6F4E37; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite;"></div></div><style>@keyframes spin {0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); }}</style>';
    }
}

// --- RENDER FROM STATE (Instant) ---

function refreshTables() { renderTablesFromState(); }

function renderTablesFromState() {
    const container = document.getElementById('tables-grid');
    if (!container) return;

    const tables = AppState.tables;
    if (!tables) {
        if (!AppState.lastSync) container.innerHTML = '<p>Cargando mesas...</p>';
        return;
    }

    container.innerHTML = '';

    if (tables.length === 0) {
        if (!currentUser || currentUser.role !== 'admin') {
            container.innerHTML = '<p>No hay mesas habilitadas.</p>';
        }
    } else {
        tables.forEach(t => {
            const div = document.createElement('div');
            div.className = 'product-card';
            const isFree = t.status === 'free';
            div.style.backgroundColor = isFree ? '#F1F8E9' : '#FFEBEE';
            div.style.border = isFree ? '2px solid #C5E1A5' : '2px solid #EF9A9A';
            div.style.color = isFree ? '#33691E' : '#B71C1C';
            div.style.position = 'relative';

            if (currentUser && currentUser.role === 'admin') {
                const delBtn = document.createElement('span');
                delBtn.innerHTML = '&times;';
                delBtn.style.cssText = 'position:absolute; top:-10px; right:-10px; background:white; border-radius:50%; width:24px; height:24px; box-shadow:0 2px 5px rgba(0,0,0,0.2); color:red; line-height:24px; font-weight:bold; cursor:pointer; z-index:10; display:flex; justify-content:center; align-items:center;';
                delBtn.onclick = (e) => { e.stopPropagation(); deleteTableApi(t.id); };
                div.appendChild(delBtn);
            }

            div.innerHTML += `
                <div style="font-size: 20px; font-weight:700; margin-bottom:5px;">${t.label || 'Mesa ' + t.id}</div>
                <div style="font-size:11px; text-transform:uppercase; letter-spacing:1px; font-weight:600;">
                    ${isFree ? '● Disponible' : '● Ocupada'}
                </div>
                 ${t.orders.length > 0 ? `<div style="font-size:10px; margin-top:8px; background:white; padding:2px 8px; border-radius:10px; display:inline-block; border:1px solid rgba(0,0,0,0.1)">Orden #${t.orders[0]}</div>` : ''}
           `;
            div.onclick = (e) => { if (e.target.tagName !== 'SPAN') handleTableClick(t.id); };
            container.appendChild(div);
        });
    }

    if (currentUser && currentUser.role === 'admin') {
        const addDiv = document.createElement('div');
        addDiv.className = 'product-card';
        addDiv.style.border = '2px dashed #CFD8DC';
        addDiv.style.backgroundColor = '#FAFAFA';
        addDiv.style.color = '#B0BEC5';
        addDiv.style.display = 'flex';
        addDiv.style.justifyContent = 'center';
        addDiv.style.alignItems = 'center';
        addDiv.style.minHeight = '100px';
        addDiv.style.cursor = 'pointer';
        addDiv.innerHTML = '<div style="text-align:center"><span class="material-icons" style="font-size:32px;">add_circle_outline</span><div style="font-size:12px; margin-top:5px">Nueva Mesa</div></div>';
        addDiv.onclick = addNewTable;
        container.appendChild(addDiv);
    }
}

function refreshKitchen() { renderKitchenFromState(); }

function renderKitchenFromState() {
    const container = document.getElementById('kitchen-board');
    if (!container) return;

    const orders = AppState.orders;
    if (!orders || orders.length === 0) {
        if (!AppState.lastSync) container.innerHTML = '<p>Cargando pedidos...</p>';
        else container.innerHTML = '<p>No hay pedidos pendientes</p>';
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

function refreshCashier() { renderCashierFromState(); }

function renderCashierFromState() {
    const tbody = document.getElementById('cashier-list');
    if (!tbody) return;
    const orders = AppState.orders;

    tbody.innerHTML = '';
    if (!orders || orders.length === 0) {
        if (!AppState.lastSync) tbody.innerHTML = '<tr><td colspan="6">Cargando...</td></tr>';
        return;
    }

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

// NEW: Inventory Sync
function loadInventory() { renderInventoryFromState(); }
function renderInventoryFromState() {
    const tbody = document.getElementById('inventory-list');
    if (!tbody) return;

    const items = AppState.inventory;

    if (!items || items.length === 0) {
        if (!AppState.lastSync) tbody.innerHTML = '<tr><td colspan="4">Cargando Insumos...</td></tr>';
        else tbody.innerHTML = '<tr><td colspan="4">Sin insumos registrados</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    items.forEach((item) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div style="font-weight:bold">${item.name}</div>
                <div style="color:#888; font-size:12px">${item.id}</div>
            </td>
            <td style="font-weight:bold; font-size:16px">${Number(item.current_stock).toFixed(2)}</td>
            <td>${item.unit}</td>
            <td>
                ${Number(item.current_stock) < Number(item.min_stock)
                ? '<span style="color:red; font-weight:bold">BAJO STOCK</span>'
                : '<span style="color:green">OK</span>'}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// NEW: Finance Sync
function loadFinance() { renderFinanceFromState(); }
function renderFinanceFromState() {
    // Expenses List
    const tbody = document.getElementById('expense-list');
    if (!tbody) return;

    const expenses = AppState.expenses;

    if (!expenses || expenses.length === 0) {
        if (!AppState.lastSync) tbody.innerHTML = '<tr><td colspan="4">Cargando Gastos...</td></tr>';
        else tbody.innerHTML = '<tr><td colspan="4">Sin gastos registrados</td></tr>';
    } else {
        tbody.innerHTML = '';
        // Sort by date desc
        expenses.slice().reverse().forEach(e => {
            const tr = document.createElement('tr');
            const dateStr = new Date(e.date).toLocaleDateString();
            tr.innerHTML = `
                <td>${dateStr}</td>
                <td>${e.description}</td>
                <td><span class="badge badge-warning">${e.category}</span></td>
                <td style="color:red; font-weight:bold">- S/ ${Number(e.amount).toFixed(2)}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Summary (Naive calculation from local data, or use Stats)
    // If backend provides summary in stats, use that. Or calculate from expenses/orders locally.
    // For now simple Sum from orders/expenses in state
    if (AppState.orders && AppState.expenses) {
        let totalSales = AppState.orders.reduce((acc, o) => acc + (o.status === 'paid' ? Number(o.total) : 0), 0); // Only current loop orders? 
        // Actually, getSyncData might not return ALL historical orders.
        // Better to rely on 'stats' object from backend for totals if available.
    }

    // Use AdvancedStats if available
    if (AppState.stats && AppState.stats.financials) {
        // Assume backend sends this? It wasn't in my previous patch. 
        // Let's stick to what we know: display what we have.
    }
}

// NEW: Admin Products
function loadAdminProducts() { renderAdminProductsFromState(); }
function renderAdminProductsFromState() {
    const tbody = document.getElementById('admin-products-list');
    if (!tbody) return;

    const products = AppState.products;

    if (!products || products.length === 0) {
        if (!AppState.lastSync) tbody.innerHTML = '<tr><td colspan="3">Cargando Carta...</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    products.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div style="font-weight:bold">${p.name}</div>
                <div style="font-size:12px; color:#888;">${p.category}</div>
            </td>
            <td>S/ ${p.price}</td>
            <td>
                <button class="btn btn-sm" onclick="updateProductPriceUi('${p.id}', '${p.price}')">Precio</button>
                <button class="btn btn-sm btn-secondary" onclick="manageRecipeUi('${p.id}', '${p.name}')">Receta</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// NEW: Reports
function loadReports() { renderReportsFromState(); }
function renderReportsFromState() {
    const stats = AppState.stats;

    const topTbody = document.getElementById('report-top-products');
    const waiterTbody = document.getElementById('report-waiter-perf');

    if (!topTbody || !waiterTbody) return;

    if (!stats) {
        topTbody.innerHTML = '<tr><td colspan="2">Cargando Reportes...</td></tr>';
        waiterTbody.innerHTML = '<tr><td colspan="2">Cargando Reportes...</td></tr>';
        return;
    }

    // Top Products
    topTbody.innerHTML = '';
    if (stats.topProducts.length === 0) {
        topTbody.innerHTML = '<tr><td colspan="2">Sin datos de ventas</td></tr>';
    } else {
        stats.topProducts.forEach(p => {
            topTbody.innerHTML += `<tr><td>${p.name}</td><td>${p.qty} un.</td></tr>`;
        });
    }

    // Waiter Perf
    waiterTbody.innerHTML = '';
    if (stats.waiterPerformance.length === 0) {
        waiterTbody.innerHTML = '<tr><td colspan="2">Sin datos</td></tr>';
    } else {
        stats.waiterPerformance.forEach(w => {
            waiterTbody.innerHTML += `<tr><td>${w.waiter}</td><td>S/ ${w.total.toFixed(2)}</td></tr>`;
        });
    }
}


// --- Features ---

async function addNewProductUi() {
    const name = prompt("Nombre del Nuevo Producto:");
    if (!name) return;
    const cat = prompt("Categoría (Entrada, Plato de Fondo, Bebida):", "Plato de Fondo");
    const price = prompt("Precio (S/):");

    if (name && cat && price) {
        const payload = { name: name, category: cat, price: Number(price) };
        const res = await apiCall('addProduct', { productData: payload }, 'POST');
        if (res.success) {
            alert('Producto Creado');
            // Trigger sync
            apiCall('getSyncData', { role: 'admin' }).then(updateLocalState);
        } else {
            alert('Error al crear');
        }
    }
}


async function updateProductPriceUi(id, current) {
    const newPrice = prompt("Nuevo Precio (S/):", current);
    if (newPrice && !isNaN(newPrice)) {
        await apiCall('updateProductPrice', { productId: id, newPrice: newPrice }, 'POST');
        apiCall('getSyncData', { role: 'admin' }).then(updateLocalState);
    }
}

async function manageRecipeUi(prodId, prodName) {
    const recipe = await apiCall('getRecipe', { productId: prodId });

    let msg = `Receta para: ${prodName}\n----------------\n`;
    if (recipe && recipe.length > 0) {
        recipe.forEach(r => {
            msg += `- ${r.ingredient_name} (${r.quantity} ${r.unit})\n`;
        });
    } else {
        msg += "(Sin ingredientes definidos)\n";
    }

    msg += "\n¿Deseas AGREGAR un insumo a esta receta?";

    if (confirm(msg)) {
        const ingId = prompt("ID del Insumo a agregar (ej: I-01):");
        if (!ingId) return;
        const qty = prompt("Cantidad necesaria (ej: 0.2 para 200g si es kg):");
        if (!qty) return;

        const res = await apiCall('addRecipeItem', {
            productId: prodId,
            ingredientId: ingId,
            quantity: qty
        }, 'POST');

        if (res.success) {
            alert("Insumo agregado a la receta.");
            manageRecipeUi(prodId, prodName);
        } else {
            alert("Error al guardar.");
        }
    }
}


async function addNewTable() {
    const label = prompt("Nombre de la nueva mesa (ej: Patio 1):");
    if (!label) return;

    const res = await apiCall('addTable', { label: label }, 'POST');
    if (res.success) {
        // Optimistic Update
        apiCall('getSyncData', { role: 'admin' }).then(updateLocalState);
    } else {
        alert("Error al crear mesa");
    }
}

async function deleteTableApi(id) {
    if (!confirm("¿Eliminar esta mesa?")) return;
    const res = await apiCall('deleteTable', { tableId: id }, 'POST');
    if (res.success) {
        apiCall('getSyncData', { role: 'admin' }).then(updateLocalState);
    } else {
        alert("Error al eliminar");
    }
}

async function handleTableClick(tableId) {
    const table = AppState.tables.find(t => t.id == tableId);

    if (table && table.status === 'occupied') {
        const orderId = table.orders[0];
        if (confirm(`La Mesa ${table.label || tableId} está OCUPADA (Orden #${orderId}).\n¿Deseas ver detalles o agregar productos?`)) {
            alert(`Funcionalidad de Edición en desarrollo.\nOrden ID: ${orderId}`);
        }
    } else {
        selectTable(tableId);
    }
}

function selectTable(id) {
    const select = document.getElementById('table-select');
    if (select) {
        let opts = '';
        if (AppState.tables.length > 0) {
            AppState.tables.forEach(t => {
                opts += `<option value="${t.id}">${t.label || 'Mesa ' + t.id}</option>`;
            });
        }
        select.innerHTML = opts;
        select.value = id;
    }
    showView('waiter');
}

// Waiter
async function loadProducts() {
    renderProductsFromState();
}

function renderProductsFromState() {
    renderProducts(AppState.products);
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
        // Optimistic refresh
        apiCall('getSyncData', { role: 'mozo' }).then(updateLocalState);
    } else {
        alert("Error: " + res.error);
    }
    btn.disabled = false; btn.innerText = "Enviar a Cocina";
}

async function markReady(id) {
    await apiCall('updateOrderStatus', { orderId: id, status: 'ready' }, 'POST');
    // Instant feedback - Manual update state? Better wait for loop or quick fetch
    apiCall('getSyncData', { role: 'cocina' }).then(updateLocalState);
}


// Inventory
async function registerEntry() {
    const id = prompt("Ingrese ID del Insumo (ej: I-01):");
    if (!id) return;

    const qty = prompt("Cantidad a ingresar:");
    if (!qty) return;

    const res = await apiCall('updateInventory', { itemId: id, quantity: qty }, 'POST');
    if (res.success) {
        alert("Stock actualizado. Nuevo total: " + res.newStock);
        apiCall('getSyncData', { role: 'admin' }).then(updateLocalState);
    } else {
        alert("Error: " + res.error);
    }
}


// Finance
async function registerExpense() {
    const desc = prompt("Descripción del Gasto (ej: Compra de Verduras):");
    if (!desc) return;

    const amount = prompt("Monto (S/):");
    if (!amount) return;

    const cat = prompt("Categoría (Insumos, Servicios, Alquiler, Sueldos):", "Insumos");

    const payload = {
        description: desc,
        amount: Number(amount),
        category: cat,
        userId: currentUser ? currentUser.id : 'admin'
    };

    const res = await apiCall('registerExpense', { expenseData: payload }, 'POST');
    if (res.success) {
        alert("Gasto registrado correctamente");
        apiCall('getSyncData', { role: 'admin' }).then(updateLocalState);
        refreshDashboard();
    } else {
        alert("Error al registrar: " + res.error);
    }
}

// Dashboard
async function refreshDashboard() {
    // Dashboard stats might be partial from getSyncData?
    // Let's rely on standard fetch for dashboard totals or stick to backend logic if easy.
    // For now, keep it simple.
    const stats = await apiCall('getDashboardStats');
    if (stats) {
        document.getElementById('dash-sales').innerText = "S/ " + (stats.totalSales || 0).toFixed(2);
        document.getElementById('dash-orders').innerText = stats.orderCount;
    }
}
