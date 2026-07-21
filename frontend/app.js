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

// --- Helper fetch con cabecera de rol ---
async function fetchWithAuth(url, options = {}) {
  const role = sessionStorage.getItem('userRole') || '';
  const headers = {
    ...options.headers,
    'X-User-Role': role
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
    document.getElementById('admin-controls-wrapper').classList.add('hidden');
    loadCharts();
  } else if (role === 'admin') {
    orderFormSection.classList.remove('hidden');
    dashboard.classList.remove('hidden');
    document.getElementById('admin-controls-wrapper').classList.remove('hidden');
    
    // Cambiar etiquetas del perfil admin
    const vRole = document.getElementById('vendedor-role');
    if (vRole) { vRole.textContent = 'Admin'; vRole.style.background = 'rgba(167, 139, 250, 0.15)'; vRole.style.color = '#a78bfa'; }
    const aRole = document.getElementById('analista-role');
    if (aRole) { aRole.textContent = 'Admin'; aRole.style.background = 'rgba(167, 139, 250, 0.15)'; aRole.style.color = '#a78bfa'; }

    loadHistory();
    loadCharts();
    loadUsersList();
  }
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

// --- Cargar Historial de Pedidos (con opción de editar) ---
let loadedOrdersList = [];

async function loadHistory() {
  const historyBody = document.getElementById('historyBody');
  const emptyHistoryMsg = document.getElementById('emptyHistoryMsg');
  const historyTable = document.getElementById('historyTable');
  
  try {
    const resp = await fetchWithAuth(`${api}/orders`);
    if (!resp.ok) throw new Error('Error al cargar historial');
    const orders = await resp.json();
    loadedOrdersList = orders; // guardar copia
    
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
  document.getElementById('order-zone').value = order.zona;
  document.getElementById('order-qty').value = order.cantidad;
  document.getElementById('order-price').value = order.precio_uni;

  // Hacer scroll hacia el formulario
  document.getElementById('orderForm').scrollIntoView({ behavior: 'smooth' });
};

function resetOrderForm() {
  editOrderId = null;
  formActionTitle.textContent = 'Registrar Pedido';
  submitOrderBtn.textContent = 'Guardar Registro de Pedido';
  cancelEditBtn.classList.add('hidden');
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

    const orderData = {
      fecha: document.getElementById('order-date').value,
      producto: document.getElementById('order-product').value,
      zona: document.getElementById('order-zone').value,
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
        if (currentRole === 'admin') {
          loadCharts();
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

// --- GESTIÓN DE USUARIOS (SOLO ADMINISTRADOR) ---
async function loadUsersList() {
  const body = document.getElementById('usersListBody');
  if (!body) return;

  try {
    const resp = await fetchWithAuth(`${api}/users`);
    if (!resp.ok) throw new Error('Error al cargar usuarios');
    const users = await resp.json();

    body.innerHTML = '';
    users.forEach(u => {
      const tr = document.createElement('tr');
      
      // Botón de acción dependiendo del estado
      let actionBtnHTML = '';
      if (u.username !== 'admin') {
        if (u.status === 'pending') {
          actionBtnHTML = `<button class="btn-action btn-approve" onclick="changeUserStatus(${u.id}, 'active')">✔️ Aprobar</button>`;
        } else if (u.status === 'active') {
          actionBtnHTML = `<button class="btn-action btn-disable" onclick="changeUserStatus(${u.id}, 'inactive')">❌ Bloquear</button>`;
        } else if (u.status === 'inactive') {
          actionBtnHTML = `<button class="btn-action btn-approve" onclick="changeUserStatus(${u.id}, 'active')">✔️ Activar</button>`;
        }
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

// Crear usuario desde panel de Administrador
const adminCreateUserForm = document.getElementById('adminCreateUserForm');
const adminUserMsg = document.getElementById('adminUserMsg');

if (adminCreateUserForm) {
  adminCreateUserForm.onsubmit = async (e) => {
    e.preventDefault();
    adminUserMsg.textContent = 'Creando usuario...';
    adminUserMsg.style.color = '#fff';

    const userData = {
      username: document.getElementById('admin-u-name').value,
      password: document.getElementById('admin-u-pass').value,
      role: document.getElementById('admin-u-role').value,
      status: 'active' // admin los crea activos directamente
    };

    try {
      const resp = await fetchWithAuth(`${api}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      if (resp.ok) {
        adminUserMsg.textContent = '¡Usuario creado y activado!';
        adminUserMsg.style.color = 'var(--accent)';
        adminCreateUserForm.reset();
        loadUsersList();
      } else {
        const data = await resp.json();
        adminUserMsg.textContent = data.msg || 'Error al crear usuario';
        adminUserMsg.style.color = 'var(--danger)';
      }
    } catch (err) {
      adminUserMsg.textContent = 'Error de conexión';
      adminUserMsg.style.color = 'var(--danger)';
    }
  };
}

// --- Lógica de pestañas del dashboard ---
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabButtons.forEach(btn => {
  btn.onclick = () => {
    tabButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    const targetTab = btn.getAttribute('data-tab');
    tabContents.forEach(content => {
      if (content.id === targetTab) {
        content.classList.remove('hidden');
      } else {
        content.classList.add('hidden');
      }
    });
  };
});

// --- Carga y Renderizado de Gráficos ---
let chartInstances = {};

async function loadCharts() {
  const noDataMsg = document.getElementById('noDataMsg');
  const chartsWrapper = document.getElementById('charts-wrapper');
  const tabsContainer = document.querySelector('.tabs-container');

  try {
    const tpResp = await fetchWithAuth(`${api}/top_products`);
    if (!tpResp.ok) throw new Error('Error al obtener productos');
    const tp = await tpResp.json();
    
    if (Object.keys(tp).length === 0) {
      chartsWrapper.classList.add('hidden');
      tabsContainer.classList.add('hidden');
      noDataMsg.classList.remove('hidden');
      return;
    }

    chartsWrapper.classList.remove('hidden');
    tabsContainer.classList.remove('hidden');
    noDataMsg.classList.add('hidden');

    // Renderizar gráfico de Producto (Barras)
    if (chartInstances.topProducts) chartInstances.topProducts.destroy();
    chartInstances.topProducts = new Chart(document.getElementById('topProductsChart'), {
      type: 'bar',
      data: {
        labels: Object.keys(tp),
        datasets: [{
          label: 'Total vendido ($)',
          data: Object.values(tp),
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
          title: { display: true, text: 'Ventas Totales por Tipo de Producto ($)', color: '#f1f5f9', font: { size: 14, weight: 'bold' } }
        },
        scales: {
          y: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#94a3b8' } },
          x: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#94a3b8' } }
        }
      }
    });

    // 2. Obtener datos por mes
    const smResp = await fetchWithAuth(`${api}/sales_by_month`);
    if (!smResp.ok) throw new Error('Error al obtener ventas por mes');
    const sm = await smResp.json();
    
    if (chartInstances.salesMonth) chartInstances.salesMonth.destroy();
    chartInstances.salesMonth = new Chart(document.getElementById('salesMonthChart'), {
      type: 'line',
      data: {
        labels: Object.keys(sm),
        datasets: [{
          label: 'Monto mensual ($)',
          data: Object.values(sm),
          borderColor: 'rgba(46, 204, 113, 1)',
          backgroundColor: 'rgba(46, 204, 113, 0.15)',
          fill: true,
          tension: 0.3,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: 'Historial Temporal de Ventas ($)', color: '#f1f5f9', font: { size: 14, weight: 'bold' } },
          legend: { labels: { color: '#94a3b8' } }
        },
        scales: {
          y: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#94a3b8' } },
          x: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#94a3b8' } }
        }
      }
    });

    // 3. Obtener datos por zona
    const szResp = await fetchWithAuth(`${api}/sales_by_zone`);
    if (!szResp.ok) throw new Error('Error al obtener zonas');
    const sz = await szResp.json();
    
    if (chartInstances.salesZone) chartInstances.salesZone.destroy();
    chartInstances.salesZone = new Chart(document.getElementById('salesZoneChart'), {
      type: 'pie',
      data: {
        labels: Object.keys(sz),
        datasets: [{
          data: Object.values(sz),
          backgroundColor: [
            'rgba(244, 63, 94, 0.8)',
            'rgba(241, 196, 15, 0.8)',
            'rgba(52, 211, 153, 0.8)',
            'rgba(56, 189, 248, 0.8)',
            'rgba(167, 139, 250, 0.8)'
          ],
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: 'Distribución Geográfica de Ventas ($)', color: '#f1f5f9', font: { size: 14, weight: 'bold' } },
          legend: { labels: { color: '#94a3b8' } }
        }
      }
    });

  } catch (error) {
    console.error('Error cargando gráficas:', error);
  }
}
