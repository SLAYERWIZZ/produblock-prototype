const api = '/api';

const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const logoutBtn2 = document.getElementById('logoutBtn2');
const loginSection = document.getElementById('login-section');
const dashboard = document.getElementById('dashboard');
const orderFormSection = document.getElementById('order-form-section');
const loginMsg = document.getElementById('loginMsg');

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
      loginMsg.style.color = '#e74c3c';
    }
  } catch (error) {
    loginMsg.textContent = 'Error de conexión con el servidor';
    loginMsg.style.color = '#e74c3c';
  }
};

function handleLogout() {
  sessionStorage.clear();
  location.reload();
}

if (logoutBtn) logoutBtn.onclick = handleLogout;
if (logoutBtn2) logoutBtn2.onclick = handleLogout;

function initSession(role) {
  if (role === 'vendedor') {
    orderFormSection.classList.remove('hidden');
    dashboard.classList.add('hidden');
    loadHistory();
  } else if (role === 'analista') {
    orderFormSection.classList.add('hidden');
    dashboard.classList.remove('hidden');
    loadCharts();
  } else if (role === 'admin') {
    orderFormSection.classList.remove('hidden');
    dashboard.classList.remove('hidden');
    loadHistory();
    loadCharts();
  }
}

// --- Cargar Historial de Pedidos ---
async function loadHistory() {
  const historyBody = document.getElementById('historyBody');
  const emptyHistoryMsg = document.getElementById('emptyHistoryMsg');
  const historyTable = document.getElementById('historyTable');
  
  try {
    const resp = await fetchWithAuth(`${api}/orders`);
    if (!resp.ok) throw new Error('Error al cargar historial');
    const orders = await resp.json();
    
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
        <td>${order.producto}</td>
        <td>${order.zona}</td>
        <td>${order.cantidad}</td>
        <td>$${parseFloat(order.precio_uni).toFixed(2)}</td>
        <td style="font-weight: 600; color: var(--accent);">$${parseFloat(order.total).toFixed(2)}</td>
      `;
      historyBody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
  }
}

// --- Guardar Pedido ---
const orderForm = document.getElementById('orderForm');
const orderMsg = document.getElementById('orderMsg');

if (orderForm) {
  orderForm.onsubmit = async (e) => {
    e.preventDefault();
    orderMsg.textContent = 'Guardando pedido...';
    orderMsg.style.color = '#fff';

    const orderData = {
      fecha: document.getElementById('order-date').value,
      producto: document.getElementById('order-product').value,
      zona: document.getElementById('order-zone').value,
      cantidad: parseInt(document.getElementById('order-qty').value),
      precio_uni: parseFloat(document.getElementById('order-price').value)
    };

    try {
      const resp = await fetchWithAuth(`${api}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });
      const data = await resp.json();

      if (resp.ok) {
        orderMsg.textContent = `¡Pedido guardado! Total: $${data.total}`;
        orderMsg.style.color = 'var(--accent)';
        orderForm.reset();
        if (dateInput) dateInput.value = today; // restaurar fecha de hoy
        
        // Recargar historial
        loadHistory();
        
        // Si es admin, refrescar las gráficas también
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

// --- Lógica de pestañas del dashboard ---
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabButtons.forEach(btn => {
  btn.onclick = () => {
    // Activar botón
    tabButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // Activar contenido
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
    // 1. Obtener datos por producto
    const tpResp = await fetchWithAuth(`${api}/top_products`);
    if (!tpResp.ok) throw new Error('Error al obtener productos');
    const tp = await tpResp.json();
    
    // Verificar si la base está completamente vacía
    if (Object.keys(tp).length === 0) {
      // Ocultar wrapper y pestañas, mostrar mensaje
      chartsWrapper.classList.add('hidden');
      tabsContainer.classList.add('hidden');
      noDataMsg.classList.remove('hidden');
      return;
    }

    // Mostrar wrapper y pestañas, ocultar mensaje
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
          backgroundColor: 'rgba(52, 152, 219, 0.65)',
          borderColor: 'rgba(52, 152, 219, 1)',
          borderWidth: 1.5,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: { display: true, text: 'Ventas Totales por Tipo de Producto ($)', color: '#e2e8f0', font: { size: 14 } }
        },
        scales: {
          y: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#a0aec0' } },
          x: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#a0aec0' } }
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
          title: { display: true, text: 'Historial Temporal de Ventas ($)', color: '#e2e8f0', font: { size: 14 } },
          legend: { labels: { color: '#cbd5e0' } }
        },
        scales: {
          y: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#a0aec0' } },
          x: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#a0aec0' } }
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
            'rgba(231, 76, 60, 0.8)',
            'rgba(241, 196, 15, 0.8)',
            'rgba(46, 204, 113, 0.8)',
            'rgba(52, 152, 219, 0.8)',
            'rgba(155, 89, 182, 0.8)'
          ],
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: 'Distribución Geográfica de Ventas ($)', color: '#e2e8f0', font: { size: 14 } },
          legend: { labels: { color: '#cbd5e0' } }
        }
      }
    });

  } catch (error) {
    console.error('Error cargando gráficas:', error);
  }
}
