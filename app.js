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

    // Mixed intervals
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
        // Catch HTML errors (GAS sometimes returns HTML on error)
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

    // Logic for Sidebar Role content
    if (role === 'admin') {
        document.getElementById('nav-admin').style.display = 'block';
        showView('dashboard');
        refreshDashboard();
        renderTablesFromState();
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

function loadFinance() { renderFinanceFromState(); }
function renderFinanceFromState() {
    const tbody = document.getElementById('expense-list');
    if (!tbody) return;

    const expenses = AppState.expenses;

    if (!expenses || expenses.length === 0) {
        if (!AppState.lastSync) tbody.innerHTML = '<tr><td colspan="4">Cargando Gastos...</td></tr>';
        else tbody.innerHTML = '<tr><td colspan="4">Sin gastos registrados</td></tr>';
    } else {
        tbody.innerHTML = '';
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
}

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

    topTbody.innerHTML = '';
    if (stats.topProducts.length === 0) {
        topTbody.innerHTML = '<tr><td colspan="2">Sin datos de ventas</td></tr>';
    } else {
        stats.topProducts.forEach(p => {
            topTbody.innerHTML += `<tr><td>${p.name}</td><td>${p.qty} un.</td></tr>`;
        });
    }

    waiterTbody.innerHTML = '';
    if (stats.waiterPerformance.length === 0) {
        waiterTbody.innerHTML = '<tr><td colspan="2">Sin datos</td></tr>';
    } else {
        stats.waiterPerformance.forEach(w => {
            waiterTbody.innerHTML += `<tr><td>${w.waiter}</td><td>S/ ${w.total.toFixed(2)}</td></tr>`;
        });
    }
}

// --- Generic Modal System ---

function openModal(title, fields, onSave) {
    document.getElementById('modal-title').innerText = title;
    const body = document.getElementById('modal-body');
    body.innerHTML = ''; // Clear previous

    fields.forEach(field => {
        const div = document.createElement('div');
        const label = document.createElement('label');
        label.className = 'form-label';
        label.innerText = field.label;
        div.appendChild(label);

        let input;
        if (field.type === 'select') {
            input = document.createElement('select');
            input.className = 'form-control';
            field.options.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt;
                option.innerText = opt;
                if (field.value === opt) option.selected = true;
                input.appendChild(option);
            });
        } else {
            input = document.createElement('input');
            input.type = field.type || 'text';
            input.className = 'form-control';
            if (field.value) input.value = field.value;
            if (field.placeholder) input.placeholder = field.placeholder;
        }
        input.id = 'modal-input-' + field.id;
        div.appendChild(input);
        body.appendChild(div);
    });

    const saveBtn = document.getElementById('modal-save-btn');
    // Remove old listeners to prevent dual firing (cloning approach or simple overwrite)
    const newBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newBtn, saveBtn);

    newBtn.onclick = () => {
        const values = {};
        let isValid = true;
        fields.forEach(field => {
            const el = document.getElementById('modal-input-' + field.id);
            if (!el.value) isValid = false;
            values[field.id] = el.value;
        });

        if (!isValid) return alert("Por favor complete todos los campos");

        // Show loading state on button
        newBtn.innerText = "Guardando...";
        newBtn.disabled = true;

        onSave(values).then(() => {
            closeModal();
            newBtn.innerText = "Guardar";
            newBtn.disabled = false;
        }).catch(err => {
            alert(err.message || "Error al guardar");
            newBtn.innerText = "Guardar";
            newBtn.disabled = false;
        });
    };

    document.getElementById('generic-modal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('generic-modal').style.display = 'none';
}


// --- Features Using Modal ---

async function addNewProductUi() {
    openModal("Nuevo Producto", [
        { id: 'name', label: 'Nombre del Producto', type: 'text', placeholder: 'Ej: Lomo Saltado' },
        { id: 'category', label: 'Categoría', type: 'select', options: ['Plato de Fondo', 'Entrada', 'Bebida', 'Postre', 'Extra'] },
        { id: 'price', label: 'Precio (S/)', type: 'number', placeholder: '0.00' }
    ], async (values) => {
        const payload = { name: values.name, category: values.category, price: Number(values.price) };
        const res = await apiCall('addProduct', { productData: payload }, 'POST');
        if (res.success) {
            // alert('Producto Creado'); // Optional, modal closing is enough feedback
            apiCall('getSyncData', { role: 'admin' }).then(updateLocalState);
        } else {
            throw new Error('Error al crear: ' + res.error);
        }
    });
}

async function updateProductPriceUi(id, current) {
    openModal("Actualizar Precio", [
        { id: 'price', label: 'Nuevo Precio (S/)', type: 'number', value: current }
    ], async (values) => {
        await apiCall('updateProductPrice', { productId: id, newPrice: values.price }, 'POST');
        apiCall('getSyncData', { role: 'admin' }).then(updateLocalState);
    });
}

async function manageRecipeUi(prodId, prodName) {
    const recipe = await apiCall('getRecipe', { productId: prodId });

    let msg = `<ul style="padding-left:20px; margin-bottom:20px;">`;
    if (recipe && recipe.length > 0) {
        recipe.forEach(r => {
            msg += `<li><b>${r.ingredient_name}</b>: ${r.quantity} ${r.unit} 
            <span style="color:red; cursor:pointer; font-size:12px;" onclick="deleteRecipeItem('${prodId}', '${r.ingredient_id}')">[x]</span></li>`;
        });
    } else {
        msg += "<li>(Sin ingredientes definidos)</li>";
    }
    msg += "</ul>";

    // Custom Modal Content with "Add" form inside
    openModal(`Receta: ${prodName}`, [
        { id: 'ingId', label: 'ID Insumo a Agregar (ej: I-01)', type: 'text' },
        { id: 'qty', label: 'Cantidad', type: 'number', placeholder: '0.00' }
    ], async (values) => {
        const res = await apiCall('addRecipeItem', {
            productId: prodId,
            ingredientId: values.ingId,
            quantity: values.qty
        }, 'POST');

        if (res.success) {
            alert("Insumo agregado.");
            // manageRecipeUi(prodId, prodName); // Loop?
        } else {
            throw new Error("Error al guardar.");
        }
    });

    const body = document.getElementById('modal-body');
    if (body) {
        const div = document.createElement('div');
        div.innerHTML = msg;
        body.prepend(div);
    }
}

// Needs global exposure for the onclick event in HTML string
window.deleteRecipeItem = async function (pid, iid) {
    if (!confirm("Borrar ingrediente?")) return;
    await apiCall('deleteRecipeItem', { productId: pid, ingredientId: iid }, 'POST');
    alert("Eliminado");
};


async function addNewTable() {
    openModal("Nueva Mesa", [
        { id: 'label', label: 'Nombre de la Mesa', type: 'text', placeholder: 'Ej: Terraza 4' }
    ], async (values) => {
        const res = await apiCall('addTable', { label: values.label }, 'POST');
        if (res.success) {
            apiCall('getSyncData', { role: 'admin' }).then(updateLocalState);
        } else {
            throw new Error("Error al crear mesa");
        }
    });
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
    // 1. Render to potential desktop container (if we keep it)
    // 2. Render to Sticky Footer
    const container = document.getElementById('current-order-items'); // Desktop/Static
    const stickyContainer = document.getElementById('sticky-cart-items'); // Mobile
    const totalEl = document.getElementById('order-total'); // Desktop
    const stickyTotalEl = document.getElementById('sticky-cart-total'); // Mobile

    let html = '';
    let total = 0;

    if (currentCart.length === 0) {
        html = '<div class="empty-cart">Vacio</div>';
    } else {
        currentCart.forEach((item) => {
            total += item.price * item.quantity;
            html += `
                <div style="display:flex; justify-content:space-between; margin-bottom:5px; border-bottom:1px dashed #eee; padding-bottom:2px;">
                    <span>${item.quantity}x ${item.name}</span>
                    <span>S/ ${(item.price * item.quantity).toFixed(2)}</span>
                </div>
            `;
        });
    }

    // Update Desktop
    if (container) container.innerHTML = html;
    if (totalEl) totalEl.innerText = "S/ " + total.toFixed(2);

    // Update Sticky (Mobile)
    if (stickyContainer) stickyContainer.innerHTML = html;
    if (stickyTotalEl) stickyTotalEl.innerText = "Total: S/ " + total.toFixed(2);

    // Show/Hide Sticky bar based on cart content
    const bar = document.getElementById('cart-sticky-bar');
    if (bar) {
        bar.style.display = currentCart.length > 0 ? 'flex' : 'none';
    }
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

    const btns = document.querySelectorAll('.btn-submit-order');
    btns.forEach(b => { b.disabled = true; b.innerText = "Enviando..."; });

    const res = await apiCall('createOrder', { orderData }, 'POST');

    if (res.success) {
        alert("Orden enviada a Cocina! 👨‍🍳");
        currentCart = [];
        updateCartUI();
        // Optimistic refresh
        apiCall('getSyncData', { role: 'mozo' }).then(updateLocalState);
    } else {
        console.error("Order Failed", res);
        alert("❌ Error al enviar orden:\n" + (res.error || "Error desconocido en el servidor."));
    }

    btns.forEach(b => { b.disabled = false; b.innerText = "Enviar a Cocina"; });
}

async function markReady(id) {
    await apiCall('updateOrderStatus', { orderId: id, status: 'ready' }, 'POST');
    apiCall('getSyncData', { role: 'cocina' }).then(updateLocalState);
}


// Inventory
async function registerEntry() {
    openModal("Registrar Ingreso de Stock", [
        { id: 'id', label: 'ID del Insumo', type: 'text', placeholder: 'Ej: I-01' },
        { id: 'qty', label: 'Cantidad a Agregar', type: 'number', placeholder: '0' }
    ], async (values) => {
        const res = await apiCall('updateInventory', { itemId: values.id, quantity: values.qty }, 'POST');
        if (res.success) {
            alert("Stock actualizado. Nuevo total: " + res.newStock);
            apiCall('getSyncData', { role: 'admin' }).then(updateLocalState);
        } else {
            throw new Error("Error: " + res.error);
        }
    });
}


// Finance
async function registerExpense() {
    openModal("Registrar Gasto", [
        { id: 'desc', label: 'Descripción', type: 'text', placeholder: 'Ej: Pago de Luz' },
        { id: 'amount', label: 'Monto (S/)', type: 'number', placeholder: '0.00' },
        { id: 'cat', label: 'Categoría', type: 'select', options: ['Insumos', 'Servicios', 'Alquiler', 'Sueldos', 'Mantenimiento', 'Otros'] }
    ], async (values) => {
        const payload = {
            description: values.desc,
            amount: Number(values.amount),
            category: values.cat,
            userId: currentUser ? currentUser.id : 'admin'
        };

        const res = await apiCall('registerExpense', { expenseData: payload }, 'POST');
        if (res.success) {
            apiCall('getSyncData', { role: 'admin' }).then(updateLocalState);
            refreshDashboard();
        } else {
            throw new Error("Error: " + res.error);
        }
    });
}

// Dashboard
async function refreshDashboard() {
    const stats = await apiCall('getDashboardStats');
    if (stats) {
        document.getElementById('dash-sales').innerText = "S/ " + (stats.totalSales || 0).toFixed(2);
        document.getElementById('dash-orders').innerText = stats.orderCount;
    }
}
