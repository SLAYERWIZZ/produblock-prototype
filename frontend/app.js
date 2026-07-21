const api = '/api';

const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const logoutBtn2 = document.getElementById('logoutBtn2');
const loginSection = document.getElementById('login-section');
const dashboard = document.getElementById('dashboard');
const orderFormSection = document.getElementById('order-form-section');
const loginMsg = document.getElementById('loginMsg');

// Toggle Login / Registro Público
const showRegisterLink = document.getElementById('showRegisterLink');
const showLoginLink = document.getElementById('showLoginLink');
const loginFormView = document.getElementById('login-form-view');
const registerFormView = document.getElementById('register-form-view');

if (showRegisterLink && showLoginLink) {
  showRegisterLink.onclick = (e) => {
    e.preventDefault();
    loginFormView.classList.add('hidden');
    registerFormView.classList.remove('hidden');
    document.getElementById('regMsg').textContent = '';
  };
  showLoginLink.onclick = (e) => {
    e.preventDefault();
    registerFormView.classList.add('hidden');
    loginFormView.classList.remove('hidden');
    loginMsg.textContent = '';
  };
}

// --- Autocompletar fecha de hoy ---
const today = new Date().toISOString().split('T')[0];
const dateInput = document.getElementById('order-date');
if (dateInput) dateInput.value = today;

// --- Campo de Zona Personalizada ("Otros") ---
const orderZoneSelect = document.getElementById('order-zone');
const customZoneGroup = document.getElementById('custom-zone-group');
if (orderZoneSelect && customZoneGroup) {
  orderZoneSelect.onchange = () => {
    if (orderZoneSelect.value === 'Otros') {
      customZoneGroup.classList.remove('hidden');
      document.getElementById('order-zone-custom').required = true;
    } else {
      customZoneGroup.classList.add('hidden');
      document.getElementById('order-zone-custom').required = false;
    }
  };
}

// --- Helper fetch con cabecera de rol y usuario ---
async function fetchWithAuth(url, options = {}) {
  const role = sessionStorage.getItem('userRole') || '';
  const username = sessionStorage.getItem('username') || '';
  const headers = {
    ...options.headers,
    'X-User-Role': role,
    'X-User-Username': username
  };
  return fetch(url, { ...options, headers });
}

// Sesión persistente al refrescar
const savedRole = sessionStorage.getItem('userRole');
if (savedRole) {
  loginSection.classList.add('hidden');
  initSession(savedRole);
}

// Registro Público
const registerBtn = document.getElementById('registerBtn');
const regMsg = document.getElementById('regMsg');
if (registerBtn) {
  registerBtn.onclick = async () => {
    const user = document.getElementById('reg-username').value;
    const pwd = document.getElementById('reg-password').value;
    const role = document.getElementById('reg-role').value;

    if (!user || !pwd) {
      regMsg.textContent = 'Por favor completa todos los campos.';
      regMsg.style.color = 'var(--danger)';
      return;
    }

    try {
      const resp = await fetch(`${api}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pwd, role: role })
      });
      const data = await resp.json();
      if (resp.ok) {
        regMsg.textContent = data.msg;
        regMsg.style.color = 'var(--accent)';
        document.getElementById('reg-username').value = '';
        document.getElementById('reg-password').value = '';
      } else {
        regMsg.textContent = data.msg || 'Error al registrar';
        regMsg.style.color = 'var(--danger)';
      }
    } catch (e) {
      regMsg.textContent = 'Error de red';
      regMsg.style.color = 'var(--danger)';
    }
  };
}

loginBtn.onclick = async () => {
  const user = document.getElementById('username').value;
  const pwd = document.getElementById('password').value;
  
  try {
    const resp = await fetch(`${api}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user, password: pwd })
    });
    const data = await resp.json();
    if (resp.ok) {
      sessionStorage.setItem('userRole', data.role);
      sessionStorage.setItem('username', user);
      loginSection.classList.add('hidden');
      initSession(data.role);
    } else {
      loginMsg.textContent = data.msg || 'Error de autenticación';
      loginMsg.style.color = 'var(--danger)';
    }
  } catch (error) {
    loginMsg.textContent = 'Error de conexión con el servidor';
    loginMsg.style.color = 'var(--danger)';
  }
};

function handleLogout() {
  sessionStorage.clear();
  location.reload();
}

if (logoutBtn) logoutBtn.onclick = handleLogout;
if (logoutBtn2) logoutBtn2.onclick = handleLogout;

function initSession(role) {
  const username = sessionStorage.getItem('username') || 'Usuario';
  
  const vName = document.getElementById('vendedor-name');
  if (vName) vName.textContent = username;
  const aName = document.getElementById('analista-name');
  if (aName) aName.textContent = username;

  if (role === 'vendedor') {
    orderFormSection.classList.remove('hidden');
    dashboard.classList.add('hidden');
    loadHistory();
  } else if (role === 'analista') {
    orderFormSection.classList.add('hidden');
    dashboard.classList.remove('hidden');
    
    // Ocultar pestañas de admin para Analista
    document.getElementById('admin-nav-tabs').classList.add('hidden');
    document.getElementById('admin-sec-content').classList.add('hidden');
    document.getElementById('admin-orders-content').classList.add('hidden');
    document.getElementById('admin-metrics-content').classList.remove('hidden');
    
    loadHistory();
    loadDashboardData();
  } else if (role === 'admin') {
    // Es Admin: Mover el formulario de ventas adentro de la pestaña 2 del admin para unificar
    const orderFormSectionEl = document.getElementById('order-form-section');
    const placeholder = document.getElementById('form-container-placeholder');
    if (orderFormSectionEl && placeholder) {
      placeholder.appendChild(orderFormSectionEl);
      orderFormSectionEl.classList.remove('hidden'); // Hacerlo visible
    }

    // Configurar etiquetas de admin
    const vRole = document.getElementById('vendedor-role');
    if (vRole) { vRole.textContent = 'Admin'; vRole.style.background = 'rgba(167, 139, 250, 0.15)'; vRole.style.color = '#a78bfa'; }
    const aRole = document.getElementById('analista-role');
    if (aRole) { aRole.textContent = 'Admin'; aRole.style.background = 'rgba(167, 139, 250, 0.15)'; aRole.style.color = '#a78bfa'; }

    dashboard.classList.remove('hidden');
    document.getElementById('admin-nav-tabs').classList.remove('hidden');
    
    // Configurar pestañas del Admin
    setupAdminTabs();
    
    // Carga inicial
    loadHistory();
    loadUsersList();
    loadLoginLogs();
    loadDashboardData();
  }
}

// --- Gestión de Pestañas de Admin ---
function setupAdminTabs() {
  const adminTabBtns = document.querySelectorAll('.admin-tab-btn');
  const adminSecContent = document.getElementById('admin-sec-content');
  const adminOrdersContent = document.getElementById('admin-orders-content');
  const adminMetricsContent = document.getElementById('admin-metrics-content');

  adminTabBtns.forEach(btn => {
    btn.onclick = () => {
      adminTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const target = btn.getAttribute('data-admin-tab');
      
      adminSecContent.classList.add('hidden');
      adminOrdersContent.classList.add('hidden');
      adminMetricsContent.classList.add('hidden');

      if (target === 'sec-tab') {
        adminSecContent.classList.remove('hidden');
        loadUsersList();
        loadLoginLogs();
      } else if (target === 'orders-tab') {
        adminOrdersContent.classList.remove('hidden');
        loadHistory();
      } else if (target === 'metrics-tab') {
        adminMetricsContent.classList.remove('hidden');
        loadDashboardData();
      }
    };
  });
}

// --- Obtener la etiqueta (badge) HTML según el producto ---
function getProductBadgeHTML(product) {
  const norm = product.toLowerCase()
    .replace(/á/g, 'a')
    .replace(/í/g, 'i')
    .replace(/ó/g, 'o')
    .replace(/ú/g, 'u')
    .replace(/\s+/g, '-');
  return `<span class="badge badge-${norm}">${product}</span>`;
}

// --- Cargar Historial de Pedidos ---
let loadedOrdersList = [];

async function loadHistory() {
  const historyBody = document.getElementById('historyBody');
  const emptyHistoryMsg = document.getElementById('emptyHistoryMsg');
  const historyTable = document.getElementById('historyTable');
  
  try {
    const resp = await fetchWithAuth(`${api}/orders`);
    if (!resp.ok) throw new Error('Error al cargar historial');
    const orders = await resp.json();
    loadedOrdersList = orders;
    
    historyBody.innerHTML = '';
    
    if (orders.length === 0) {
      historyTable.style.display = 'none';
      emptyHistoryMsg.style.display = 'block';
      return;
    }
    
    historyTable.style.display = 'table';
    emptyHistoryMsg.style.display = 'none';
    
    orders.forEach(order => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${order.fecha}</td>
        <td>${getProductBadgeHTML(order.producto)}</td>
        <td>${order.zona}</td>
        <td>${order.cantidad}</td>
        <td>$${parseFloat(order.precio_uni).toFixed(2)}</td>
        <td style="font-weight: 600; color: var(--accent);">$${parseFloat(order.total).toFixed(2)}</td>
        <td style="font-weight: 500; color: #a0aec0;">${order.vendedor}</td>
        <td style="text-align: center;">
          <button class="btn-action btn-edit" onclick="startEditOrder(${order.id})">✏️ Editar</button>
        </td>
      `;
      historyBody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
  }
}

// --- Flujo de Edición de Pedidos ---
let editOrderId = null;
const formActionTitle = document.getElementById('form-action-title');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const submitOrderBtn = document.getElementById('submitOrderBtn');

window.startEditOrder = (id) => {
  const order = loadedOrdersList.find(o => o.id === id);
  if (!order) return;

  editOrderId = id;
  formActionTitle.textContent = 'Corregir / Editar Pedido';
  submitOrderBtn.textContent = 'Guardar Cambios';
  cancelEditBtn.classList.remove('hidden');

  // Llenar formulario
  document.getElementById('order-date').value = order.fecha;
  document.getElementById('order-product').value = order.producto;
  
  const customZoneInput = document.getElementById('order-zone-custom');
  
  // Si la zona no es de las predefinidas
  const predfZones = ["Quito Norte", "Quito Sur", "Cumbayá", "Tumbaco", "Calderón"];
  if (predfZones.includes(order.zona)) {
    orderZoneSelect.value = order.zona;
    customZoneGroup.classList.add('hidden');
    customZoneInput.value = '';
    customZoneInput.required = false;
  } else {
    orderZoneSelect.value = 'Otros';
    customZoneGroup.classList.remove('hidden');
    customZoneInput.value = order.zona;
    customZoneInput.required = true;
  }

  document.getElementById('order-qty').value = order.cantidad;
  document.getElementById('order-price').value = order.precio_uni;

  document.getElementById('orderForm').scrollIntoView({ behavior: 'smooth' });
};

function resetOrderForm() {
  editOrderId = null;
  formActionTitle.textContent = 'Registrar Pedido';
  submitOrderBtn.textContent = 'Guardar Registro de Pedido';
  cancelEditBtn.classList.add('hidden');
  customZoneGroup.classList.add('hidden');
  document.getElementById('order-zone-custom').required = false;
  orderForm.reset();
  if (dateInput) dateInput.value = today;
}

if (cancelEditBtn) {
  cancelEditBtn.onclick = () => {
    resetOrderForm();
    orderMsg.textContent = '';
  };
}

// --- Guardar / Actualizar Pedido ---
const orderForm = document.getElementById('orderForm');
const orderMsg = document.getElementById('orderMsg');

if (orderForm) {
  orderForm.onsubmit = async (e) => {
    e.preventDefault();
    orderMsg.textContent = editOrderId ? 'Guardando cambios...' : 'Guardando pedido...';
    orderMsg.style.color = '#fff';

    // Manejar zona dinámica
    let finalZone = orderZoneSelect.value;
    if (finalZone === 'Otros') {
      finalZone = document.getElementById('order-zone-custom').value;
    }

    const orderData = {
      fecha: document.getElementById('order-date').value,
      producto: document.getElementById('order-product').value,
      zona: finalZone,
      cantidad: parseInt(document.getElementById('order-qty').value),
      precio_uni: parseFloat(document.getElementById('order-price').value)
    };

    const url = editOrderId ? `${api}/orders/${editOrderId}` : `${api}/orders`;
    const method = editOrderId ? 'PUT' : 'POST';

    try {
      const resp = await fetchWithAuth(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });
      const data = await resp.json();

      if (resp.ok) {
        orderMsg.textContent = editOrderId ? '¡Pedido corregido con éxito!' : `¡Pedido guardado! Total: $${data.total}`;
        orderMsg.style.color = 'var(--accent)';
        resetOrderForm();
        loadHistory();
        
        const currentRole = sessionStorage.getItem('userRole');
        if (currentRole === 'admin' || currentRole === 'analista') {
          loadDashboardData();
        }
      } else {
        orderMsg.textContent = data.msg || 'Error al guardar el pedido';
        orderMsg.style.color = 'var(--danger)';
      }
    } catch (err) {
      orderMsg.textContent = 'Error al conectar con el servidor';
      orderMsg.style.color = 'var(--danger)';
    }
  };
}

// --- GESTIÓN DE USUARIOS (ADMIN ONLY) ---
let editingUserId = null;
const userFormTitle = document.getElementById('user-form-title');
const adminCreateUserBtn = document.getElementById('adminCreateUserBtn');
const adminCancelUserEditBtn = document.getElementById('adminCancelUserEditBtn');
const passFieldLabel = document.getElementById('pass-field-label');
const passHelpText = document.getElementById('pass-help-text');

async function loadUsersList() {
  const body = document.getElementById('usersListBody');
  if (!body) return;

  try {
    const resp = await fetchWithAuth(`${api}/users`);
    if (!resp.ok) throw new Error('Error al cargar usuarios');
    const users = await resp.json();

    // Actualizar KPI de usuarios activos en el dashboard
    const activeUsersCount = users.filter(u => u.status === 'active').length;
    const kpiUsers = document.getElementById('kpi-users-count');
    if (kpiUsers) kpiUsers.textContent = activeUsersCount;

    body.innerHTML = '';
    users.forEach(u => {
      const tr = document.createElement('tr');
      
      let actionBtnHTML = '';
      if (u.username !== 'admin') {
        let toggleBtn = '';
        if (u.status === 'pending') {
          toggleBtn = `<button class="btn-action btn-approve" onclick="changeUserStatus(${u.id}, 'active')" title="Aprobar Cuenta">✔️</button>`;
        } else if (u.status === 'active') {
          toggleBtn = `<button class="btn-action btn-disable" onclick="changeUserStatus(${u.id}, 'inactive')" title="Bloquear Cuenta">❌</button>`;
        } else if (u.status === 'inactive') {
          toggleBtn = `<button class="btn-action btn-approve" onclick="changeUserStatus(${u.id}, 'active')" title="Re-activar Cuenta">✔️</button>`;
        }

        actionBtnHTML = `
          ${toggleBtn}
          <button class="btn-action btn-edit" onclick="startEditUser(${u.id}, '${u.username}', '${u.role}')" title="Editar Perfil">✏️</button>
          <button class="btn-action btn-disable" onclick="deleteUserProfile(${u.id}, '${u.username}')" title="Eliminar Perfil" style="background: rgba(231,76,60,0.12); color: #f43f5e; border-color: rgba(231,76,60,0.2);">🗑️</button>
        `;
      } else {
        actionBtnHTML = `<span style="color: #64748b; font-style: italic;">Sin acciones</span>`;
      }

      tr.innerHTML = `
        <td style="font-weight: 600;">${u.username}</td>
        <td><span class="badge-role" style="font-size: 0.65rem;">${u.role}</span></td>
        <td><span class="badge-status status-${u.status}">${u.status === 'active' ? 'Activo' : u.status === 'pending' ? 'Pendiente' : 'Bloqueado'}</span></td>
        <td style="text-align: center;">${actionBtnHTML}</td>
      `;
      body.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
  }
}

window.changeUserStatus = async (id, newStatus) => {
  try {
    const resp = await fetchWithAuth(`${api}/users/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    if (resp.ok) {
      loadUsersList();
    } else {
      const data = await resp.json();
      alert(data.msg || 'Error al cambiar estado');
    }
  } catch (e) {
    console.error(e);
  }
};

window.startEditUser = (id, username, role) => {
  editingUserId = id;
  userFormTitle.textContent = 'Modificar Usuario';
  adminCreateUserBtn.textContent = 'Guardar Cambios';
  adminCancelUserEditBtn.classList.remove('hidden');
  
  passFieldLabel.textContent = 'Contraseña Nueva (Opcional)';
  passHelpText.style.display = 'block';
  document.getElementById('admin-u-pass').required = false;

  document.getElementById('admin-u-name').value = username;
  document.getElementById('admin-u-role').value = role;
};

function resetUserForm() {
  editingUserId = null;
  userFormTitle.textContent = 'Crear Usuario Nuevo';
  adminCreateUserBtn.textContent = 'Crear Cuenta Activa';
  adminCancelUserEditBtn.classList.add('hidden');
  
  passFieldLabel.textContent = 'Contraseña';
  passHelpText.style.display = 'none';
  document.getElementById('admin-u-pass').required = true;

  adminCreateUserForm.reset();
}

if (adminCancelUserEditBtn) {
  adminCancelUserEditBtn.onclick = resetUserForm;
}

window.deleteUserProfile = async (id, username) => {
  if (!confirm(`¿Estás seguro de eliminar permanentemente el perfil de usuario "${username}"? Esta acción no se puede deshacer.`)) {
    return;
  }

  try {
    const resp = await fetchWithAuth(`${api}/users/${id}`, {
      method: 'DELETE'
    });
    if (resp.ok) {
      loadUsersList();
    } else {
      const data = await resp.json();
      alert(data.msg || 'Error al eliminar usuario');
    }
  } catch (e) {
    console.error(e);
  }
};

// Crear/Editar usuario desde panel de Administrador
const adminCreateUserForm = document.getElementById('adminCreateUserForm');
const adminUserMsg = document.getElementById('adminUserMsg');

if (adminCreateUserForm) {
  adminCreateUserForm.onsubmit = async (e) => {
    e.preventDefault();
    adminUserMsg.textContent = 'Guardando cambios...';
    adminUserMsg.style.color = '#fff';

    const usernameVal = document.getElementById('admin-u-name').value;
    const passwordVal = document.getElementById('admin-u-pass').value;
    const roleVal = document.getElementById('admin-u-role').value;

    const userData = {
      username: usernameVal,
      role: roleVal
    };
    if (passwordVal.trim() !== '') {
      userData.password = passwordVal;
    }

    const url = editingUserId ? `${api}/users/${editingUserId}` : `${api}/users`;
    const method = editingUserId ? 'PUT' : 'POST';

    try {
      const resp = await fetchWithAuth(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      if (resp.ok) {
        adminUserMsg.textContent = editingUserId ? '¡Usuario modificado con éxito!' : '¡Usuario creado y activado!';
        adminUserMsg.style.color = 'var(--accent)';
        resetUserForm();
        loadUsersList();
      } else {
        const data = await resp.json();
        adminUserMsg.textContent = data.msg || 'Error al guardar usuario';
        adminUserMsg.style.color = 'var(--danger)';
      }
    } catch (err) {
      adminUserMsg.textContent = 'Error de conexión';
      adminUserMsg.style.color = 'var(--danger)';
    }
  };
}

// --- Cargar Logs de Inicios de Sesión ---
async function loadLoginLogs() {
  const body = document.getElementById('loginLogsBody');
  if (!body) return;

  try {
    const resp = await fetchWithAuth(`${api}/login_logs`);
    if (!resp.ok) throw new Error('Error al cargar auditoría');
    const logs = await resp.json();

    body.innerHTML = '';
    logs.forEach(l => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight: 600;">${l.username}</td>
        <td><span class="badge-role" style="font-size: 0.65rem;">${l.role}</span></td>
        <td style="color: #cbd5e1;">${l.fecha_hora}</td>
        <td style="color: #38bdf8; font-family: monospace;">${l.ip_address}</td>
      `;
      body.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
  }
}

// ==================== DASHBOARD INTEGRADO CON FILTROS DINÁMICOS ====================
let allOrdersData = [];
let chartInstances = {};

// Selectores de Filtros
const filterYear = document.getElementById('filter-year');
const filterMonth = document.getElementById('filter-month');
const filterZone = document.getElementById('filter-zone');
const filterProduct = document.getElementById('filter-product');
const resetFiltersBtn = document.getElementById('resetFiltersBtn');

async function loadDashboardData() {
  try {
    const resp = await fetchWithAuth(`${api}/orders`);
    if (!resp.ok) throw new Error('Error cargando datos de dashboard');
    allOrdersData = await resp.json();

    // Inicializar los filtros dropdowns
    populateFilterDropdowns();
    
    // Calcular métricas generales y dibujar gráficos
    updateDashboard();
  } catch (e) {
    console.error(e);
  }
}

function populateFilterDropdowns() {
  // Almacenar valores actuales para no perderlos si cambian dinámicamente
  const currYear = filterYear.value;
  const currMonth = filterMonth.value;
  const currZone = filterZone.value;
  const currProduct = filterProduct.value;

  // Extraer valores únicos
  const years = new Set();
  const months = new Set();
  const zones = new Set();
  const products = new Set();

  allOrdersData.forEach(o => {
    if (o.fecha) {
      years.add(o.fecha.split('-')[0]);
      months.add(o.fecha.split('-')[1]);
    }
    if (o.zona) zones.add(o.zona);
    if (o.producto) products.add(o.producto);
  });

  // Rellenar selectores
  fillSelect(filterYear, Array.from(years).sort().reverse(), currYear);
  fillSelect(filterMonth, Array.from(months).sort(), currMonth);
  fillSelect(filterZone, Array.from(zones).sort(), currZone);
  fillSelect(filterProduct, Array.from(products).sort(), currProduct);
}

function fillSelect(element, list, currentValue) {
  element.innerHTML = '<option value="">Todos</option>';
  list.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item;
    opt.textContent = item;
    if (item === currentValue) opt.selected = true;
    element.appendChild(opt);
  });
}

// Event Listeners de Filtros
[filterYear, filterMonth, filterZone, filterProduct].forEach(el => {
  if (el) {
    el.onchange = () => {
      updateDashboard();
    };
  }
});

if (resetFiltersBtn) {
  resetFiltersBtn.onclick = () => {
    filterYear.value = '';
    filterMonth.value = '';
    filterZone.value = '';
    filterProduct.value = '';
    updateDashboard();
  };
}

// Función Principal de Procesamiento y Filtrado
function updateDashboard() {
  const yearVal = filterYear.value;
  const monthVal = filterMonth.value;
  const zoneVal = filterZone.value;
  const productVal = filterProduct.value;

  // 1. Filtrar lista de pedidos
  const filtered = allOrdersData.filter(o => {
    if (yearVal && o.fecha.split('-')[0] !== yearVal) return false;
    if (monthVal && o.fecha.split('-')[1] !== monthVal) return false;
    if (zoneVal && o.zona !== zoneVal) return false;
    if (productVal && o.producto !== productVal) return false;
    return true;
  });

  const noDataMsg = document.getElementById('noDataMsg');
  const chartsWrapper = document.getElementById('charts-wrapper');
  const conclusionsList = document.getElementById('conclusions-list');

  // Si no hay datos, mostrar banner y vaciar métricas
  if (filtered.length === 0) {
    noDataMsg.classList.remove('hidden');
    chartsWrapper.classList.add('hidden');
    conclusionsList.innerHTML = '<li style="text-align: center; color: #888;">No hay datos para la selección de filtros actual.</li>';
    clearKpis();
    return;
  }

  noDataMsg.classList.add('hidden');
  chartsWrapper.classList.remove('hidden');

  // 2. Procesar KPIs Rápidos
  let totalSales = 0;
  let totalOrders = filtered.length;
  const uniqueProducts = new Set();
  
  filtered.forEach(o => {
    totalSales += parseFloat(o.total);
    uniqueProducts.add(o.producto);
  });

  document.getElementById('kpi-total-sales').textContent = `$${totalSales.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById('kpi-orders-count').textContent = totalOrders;
  document.getElementById('kpi-products-count').textContent = uniqueProducts.size;

  // 3. Procesar Tarjetas Especiales
  // A. Producto Estrella (Por cantidad)
  const productQtyMap = {};
  filtered.forEach(o => {
    productQtyMap[o.producto] = (productQtyMap[o.producto] || 0) + o.cantidad;
  });
  let starProduct = 'Ninguno';
  let starProductQty = 0;
  let totalUnits = 0;
  Object.keys(productQtyMap).forEach(k => {
    totalUnits += productQtyMap[k];
    if (productQtyMap[k] > starProductQty) {
      starProduct = k;
      starProductQty = productQtyMap[k];
    }
  });
  const starPercentage = totalUnits > 0 ? ((starProductQty / totalUnits) * 100).toFixed(1) : 0;
  document.getElementById('kpi-star-product').textContent = starProduct;
  document.getElementById('kpi-star-product-percentage').textContent = `${starPercentage}% del total unidades`;

  // B. Zona Líder
  const zoneOrdersMap = {};
  filtered.forEach(o => {
    zoneOrdersMap[o.zona] = (zoneOrdersMap[o.zona] || 0) + 1;
  });
  let topZone = 'Ninguna';
  let topZoneCount = 0;
  Object.keys(zoneOrdersMap).forEach(k => {
    if (zoneOrdersMap[k] > topZoneCount) {
      topZone = k;
      topZoneCount = zoneOrdersMap[k];
    }
  });
  document.getElementById('kpi-top-zone').textContent = topZone;
  document.getElementById('kpi-top-zone-orders').textContent = `${topZoneCount} pedidos`;

  // C. Vendedor Top
  const sellerOrdersMap = {};
  filtered.forEach(o => {
    sellerOrdersMap[o.vendedor] = (sellerOrdersMap[o.vendedor] || 0) + 1;
  });
  let topSeller = 'Ninguno';
  let topSellerCount = 0;
  Object.keys(sellerOrdersMap).forEach(k => {
    if (sellerOrdersMap[k] > topSellerCount) {
      topSeller = k;
      topSellerCount = sellerOrdersMap[k];
    }
  });
  document.getElementById('kpi-top-seller').textContent = topSeller;
  document.getElementById('kpi-top-seller-orders').textContent = `${topSellerCount} registros de venta`;

  // D. Crecimiento Mensual
  const salesByMonthMap = {};
  allOrdersData.forEach(o => {
    const m = o.fecha.slice(0, 7); // YYYY-MM
    salesByMonthMap[m] = (salesByMonthMap[m] || 0) + o.total;
  });
  const sortedMonths = Object.keys(salesByMonthMap).sort();
  let trendText = 'Sin datos previos';
  let trendCompare = 'respecto al mes anterior';
  if (sortedMonths.length > 1) {
    const lastMonth = sortedMonths[sortedMonths.length - 1];
    const prevMonth = sortedMonths[sortedMonths.length - 2];
    const lastVal = salesByMonthMap[lastMonth];
    const prevVal = salesByMonthMap[prevMonth];
    if (prevVal > 0) {
      const growth = ((lastVal - prevVal) / prevVal * 100).toFixed(1);
      trendText = `${growth > 0 ? '+' : ''}${growth}%`;
      trendCompare = `en ${lastMonth} vs ${prevMonth}`;
    }
  }
  document.getElementById('kpi-trend-growth').textContent = trendText;
  document.getElementById('kpi-trend-compare').textContent = trendCompare;

  // 4. Renderizar Gráficos de Chart.js
  renderFilteredCharts(filtered);

  // 5. Autogenerar Conclusiones
  generateAutomaticConclusions(starProduct, starPercentage, topZone, topZoneCount, topSeller, topSellerCount, totalSales, totalOrders);
}

function clearKpis() {
  document.getElementById('kpi-total-sales').textContent = '$0.00';
  document.getElementById('kpi-orders-count').textContent = '0';
  document.getElementById('kpi-products-count').textContent = '0';
  document.getElementById('kpi-star-product').textContent = 'Ninguno';
  document.getElementById('kpi-star-product-percentage').textContent = '0% del total';
  document.getElementById('kpi-top-zone').textContent = 'Ninguna';
  document.getElementById('kpi-top-zone-orders').textContent = '0 pedidos';
  document.getElementById('kpi-top-seller').textContent = 'Ninguno';
  document.getElementById('kpi-top-seller-orders').textContent = '0 registros';
}

function generateAutomaticConclusions(starProd, starPct, topZ, topZCount, topSell, topSellCount, totalSales, totalOrders) {
  const list = document.getElementById('conclusions-list');
  const avgOrder = totalOrders > 0 ? (totalSales / totalOrders).toFixed(2) : 0;
  
  list.innerHTML = `
    <li>✔️ <strong>Producto estrella:</strong> El producto con mayor demanda en el periodo seleccionado es <strong>${starProd}</strong>, representando el <strong>${starPct}%</strong> del total de unidades vendidas.</li>
    <li>✔️ <strong>Zona líder:</strong> La mayor cantidad de solicitudes provienen de la zona <strong>${topZ}</strong>, sumando un volumen de <strong>${topZCount}</strong> pedidos registrados.</li>
    <li>✔️ <strong>Vendedor destacado:</strong> El empleado <strong>${topSell}</strong> es el más activo del equipo comercial, habiendo registrado <strong>${topSellCount}</strong> ventas con éxito.</li>
    <li>✔️ <strong>Ticket promedio:</strong> El valor medio de facturación por pedido para la selección actual es de <strong>$${parseFloat(avgOrder).toLocaleString('es-EC', { minimumFractionDigits: 2 })}</strong>.</li>
  `;
}

// Renderizado de Gráficos Filtrados
function renderFilteredCharts(data) {
  // A. Agrupación por producto (Barras)
  const productMap = {};
  data.forEach(o => {
    productMap[o.producto] = (productMap[o.producto] || 0) + parseFloat(o.total);
  });
  
  if (chartInstances.topProducts) chartInstances.topProducts.destroy();
  chartInstances.topProducts = new Chart(document.getElementById('topProductsChart'), {
    type: 'bar',
    data: {
      labels: Object.keys(productMap),
      datasets: [{
        label: 'Ventas ($)',
        data: Object.values(productMap),
        backgroundColor: 'rgba(56, 189, 248, 0.75)',
        borderColor: 'rgba(56, 189, 248, 1)',
        borderWidth: 1.5,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: { display: true, text: 'Ventas Totales por Tipo de Producto ($)', color: '#f1f5f9', font: { size: 13, weight: 'bold' } }
      },
      scales: {
        y: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#94a3b8' } },
        x: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#94a3b8' } }
      }
    }
  });

  // B. Agrupación por mes (Línea)
  const monthMap = {};
  data.forEach(o => {
    const m = o.fecha.slice(0, 7); // YYYY-MM
    monthMap[m] = (monthMap[m] || 0) + parseFloat(o.total);
  });
  const sortedMonths = Object.keys(monthMap).sort();
  const sortedVals = sortedMonths.map(k => monthMap[k]);

  if (chartInstances.salesMonth) chartInstances.salesMonth.destroy();
  chartInstances.salesMonth = new Chart(document.getElementById('salesMonthChart'), {
    type: 'line',
    data: {
      labels: sortedMonths,
      datasets: [{
        label: 'Ventas ($)',
        data: sortedVals,
        borderColor: 'rgba(52, 211, 153, 1)',
        backgroundColor: 'rgba(52, 211, 153, 0.15)',
        fill: true,
        tension: 0.3,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: 'Historial Temporal de Ventas ($)', color: '#f1f5f9', font: { size: 13, weight: 'bold' } },
        legend: { labels: { color: '#94a3b8' } }
      },
      scales: {
        y: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#94a3b8' } },
        x: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#94a3b8' } }
      }
    }
  });

  // C. Agrupación por zona (Barras horizontales)
  const zoneMap = {};
  data.forEach(o => {
    zoneMap[o.zona] = (zoneMap[o.zona] || 0) + 1; // cantidad de pedidos
  });
  const sortedZones = Object.keys(zoneMap).sort((a,b) => zoneMap[b] - zoneMap[a]);
  const sortedZoneVals = sortedZones.map(k => zoneMap[k]);

  if (chartInstances.salesZone) chartInstances.salesZone.destroy();
  chartInstances.salesZone = new Chart(document.getElementById('salesZoneChart'), {
    type: 'bar',
    data: {
      labels: sortedZones,
      datasets: [{
        label: 'Pedidos por Zona',
        data: sortedZoneVals,
        backgroundColor: [
          'rgba(244, 63, 94, 0.75)',
          'rgba(245, 158, 11, 0.75)',
          'rgba(52, 211, 153, 0.75)',
          'rgba(56, 189, 248, 0.75)',
          'rgba(167, 139, 250, 0.75)'
        ],
        borderWidth: 0,
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: 'y', // Convertir en barras horizontales
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: { display: true, text: 'Distribución Geográfica de Pedidos', color: '#f1f5f9', font: { size: 13, weight: 'bold' } }
      },
      scales: {
        y: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#94a3b8' } },
        x: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#94a3b8' } }
      }
    }
  });
}

// Lógica de Pestañas de Gráficos
const chartTabButtons = document.querySelectorAll('.chart-tab-btn');
const chartTabContents = document.querySelectorAll('.chart-tab-content');

chartTabButtons.forEach(btn => {
  btn.onclick = () => {
    chartTabButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    const targetTab = btn.getAttribute('data-chart-tab');
    chartTabContents.forEach(content => {
      if (content.id === targetTab) {
        content.classList.remove('hidden');
      } else {
        content.classList.add('hidden');
      }
    });
  };
});

// ==================== REPORTES (EXCEL Y PDF) ====================
const exportCsvBtn = document.getElementById('exportCsvBtn');
const exportPdfBtn = document.getElementById('exportPdfBtn');

if (exportCsvBtn) {
  exportCsvBtn.onclick = () => {
    // Generar archivo CSV de los pedidos filtrados actualmente
    const yearVal = filterYear.value;
    const monthVal = filterMonth.value;
    const zoneVal = filterZone.value;
    const productVal = filterProduct.value;

    const filtered = allOrdersData.filter(o => {
      if (yearVal && o.fecha.split('-')[0] !== yearVal) return false;
      if (monthVal && o.fecha.split('-')[1] !== monthVal) return false;
      if (zoneVal && o.zona !== zoneVal) return false;
      if (productVal && o.producto !== productVal) return false;
      return true;
    });

    if (filtered.length === 0) {
      alert('No hay datos filtrados para exportar.');
      return;
    }

    // Cabeceras del CSV
    let csvContent = '\uFEFF'; // Añadir BOM para caracteres especiales (tildes, etc) en Excel
    csvContent += 'Fecha,Producto,Zona de Distribucion,Cantidad,Precio Unitario ($),Total ($),Vendedor\r\n';

    filtered.forEach(o => {
      const row = [
        o.fecha,
        `"${o.producto}"`,
        `"${o.zona}"`,
        o.cantidad,
        o.precio_uni,
        o.total,
        `"${o.vendedor}"`
      ].join(',');
      csvContent += row + '\r\n';
    });

    // Crear el archivo descargable
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `reporte_ventas_produblock_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
}

if (exportPdfBtn) {
  exportPdfBtn.onclick = () => {
    // Abrir la ventana de impresión nativa (usa las reglas CSS @media print para limpiar la maqueta)
    window.print();
  };
}
