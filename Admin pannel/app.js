/* ============================================================
   Taiva Admin — app.js (Shared Logic)
   ============================================================ */

// ---- DATA HELPERS ----
function getData(key, defaults) {
  try {
    var d = localStorage.getItem('taiva_' + key);
    return d ? JSON.parse(d) : (defaults || []);
  } catch (e) { return defaults || []; }
}
function setData(key, data) {
  localStorage.setItem('taiva_' + key, JSON.stringify(data));
}

// ---- AUTH ----
function requireAuth() {
  if (!sessionStorage.getItem('taiva_admin')) {
    window.location.href = 'index.html';
  }
}
function login(username, password) {
  if (username === 'admin' && password === 'admin123') {
    sessionStorage.setItem('taiva_admin', JSON.stringify({ user: username, name: 'Admin' }));
    return true;
  }
  return false;
}
function logout() {
  sessionStorage.removeItem('taiva_admin');
  window.location.href = 'index.html';
}

// ---- SIDEBAR ----
function initSidebar() {
  var toggle = document.getElementById('sidebarToggle');
  var sidebar = document.getElementById('sidebar');
  if (toggle && sidebar) {
    toggle.addEventListener('click', function () {
      sidebar.classList.toggle('collapsed');
    });
  }
  // Mobile toggle
  var mobileToggle = document.getElementById('mobileToggle');
  if (mobileToggle && sidebar) {
    mobileToggle.addEventListener('click', function () {
      sidebar.classList.toggle('mobile-open');
    });
  }
  // Nav submenu toggle
  document.querySelectorAll('.nav-item.has-submenu').forEach(function (item) {
    item.addEventListener('click', function (e) {
      e.preventDefault();
      var sub = this.nextElementSibling;
      if (sub && sub.classList.contains('nav-sub')) {
        sub.classList.toggle('open');
        var arrow = this.querySelector('.nav-arrow');
        if (arrow) arrow.classList.toggle('open');
      }
    });
  });
  // Highlight active page
  var page = window.location.pathname.split('/').pop() || 'dashboard.html';
  document.querySelectorAll('.nav-item').forEach(function (a) {
    var href = a.getAttribute('href');
    if (href === page) a.classList.add('active');
    if (!page || page === 'index.html') {
      if (href === 'dashboard.html') a.classList.add('active');
    }
  });
}

// ---- TOAST ----
function showToast(msg, type) {
  type = type || 'success';
  var container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  var t = document.createElement('div');
  t.className = 'toast toast-' + type;
  t.innerHTML = '<i class="fa-solid ' + (type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-times-circle' : 'fa-info-circle') + '"></i> ' + msg;
  container.appendChild(t);
  setTimeout(function () { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; setTimeout(function () { t.remove(); }, 300); }, 3000);
}

// ---- MODALS ----
function openModal(id) {
  document.getElementById('modalOverlay').classList.add('active');
  document.getElementById(id).classList.add('active');
}
function closeModal(id) {
  document.getElementById('modalOverlay').classList.remove('active');
  document.getElementById(id).classList.remove('active');
}
function closeAllModals() {
  document.querySelectorAll('.modal').forEach(function (m) { m.classList.remove('active'); });
  var ov = document.getElementById('modalOverlay');
  if (ov) ov.classList.remove('active');
}
document.addEventListener('click', function (e) {
  if (e.target.classList.contains('modal-overlay')) closeAllModals();
});

// ---- FORMAT HELPERS ----
function formatCurrency(n) {
  return 'Rs. ' + Number(n).toLocaleString('en-IN');
}
function formatDate(d) {
  if (!d) return '-';
  var dt = new Date(d);
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatDateTime(d) {
  if (!d) return '-';
  var dt = new Date(d);
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function generateId() {
  return 'ORD' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 4).toUpperCase();
}
function generateSku() {
  return 'SKU-' + Math.random().toString(36).substr(2, 8).toUpperCase();
}

// ---- SHIPROCKET API ----
var shiprocketToken = null;

function getShiprocketSettings() {
  var s = getData('settings', {});
  return { email: s.shiprocketEmail || '', password: s.shiprocketPassword || '', proxy: s.corsProxy || '' };
}

async function authenticateShiprocket() {
  var s = getShiprocketSettings();
  if (!s.email || !s.password) {
    return { success: false, error: 'Shiprocket credentials not configured. Go to Settings.' };
  }
  try {
    var url = 'https://apiv2.shiprocket.in/v1/external/auth/login';
    var resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: s.email, password: s.password })
    });
    if (!resp.ok) {
      var errText = await resp.text();
      return { success: false, error: 'Shiprocket auth failed: ' + (errText || resp.statusText) };
    }
    var data = await resp.json();
    shiprocketToken = data.token;
    return { success: true, token: data.token };
  } catch (e) {
    // Try with CORS proxy
    if (s.proxy) {
      try {
        var proxyUrl = s.proxy + '?url=' + encodeURIComponent('https://apiv2.shiprocket.in/v1/external/auth/login');
        var resp2 = await fetch(proxyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: s.email, password: s.password })
        });
        if (!resp2.ok) return { success: false, error: 'Shiprocket auth failed (proxy)' };
        var data2 = await resp2.json();
        shiprocketToken = data2.token;
        return { success: true, token: data2.token };
      } catch (e2) {
        return { success: false, error: 'CORS error. Add proxy URL in Settings or use browser extension.' };
      }
    }
    return { success: false, error: 'CORS error: ' + e.message + '. Add proxy URL in Settings.' };
  }
}

async function createShiprocketOrder(orderData) {
  // First ensure we have a token
  if (!shiprocketToken) {
    var auth = await authenticateShiprocket();
    if (!auth.success) return auth;
  }

  var payload = {
    order_id: orderData.id,
    order_date: new Date().toISOString().split('T')[0],
    pickup_location: 'Primary',
    billing_customer_name: orderData.customerName,
    billing_last_name: '',
    billing_address: orderData.address,
    billing_city: orderData.city,
    billing_pincode: orderData.pincode,
    billing_state: orderData.state || 'Uttar Pradesh',
    billing_country: 'India',
    billing_email: orderData.email || '',
    billing_phone: orderData.phone,
    shipping_is_billing: true,
    order_items: orderData.items.map(function (item) {
      return {
        name: item.name,
        sku: item.sku || 'NA',
        units: item.qty || 1,
        selling_price: item.price
      };
    }),
    payment_method: orderData.paymentMethod === 'cod' ? 'COD' : 'Prepaid',
    sub_total: orderData.total,
    length: 10,
    breadth: 10,
    height: 10,
    weight: 0.5
  };

  try {
    var resp = await fetch('https://apiv2.shiprocket.in/v1/external/orders/create/adhoc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + shiprocketToken
      },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      var errText = await resp.text();
      // If token expired, re-auth and retry once
      if (resp.status === 401) {
        shiprocketToken = null;
        return await createShiprocketOrder(orderData);
      }
      return { success: false, error: 'Shiprocket order failed: ' + (errText || resp.statusText) };
    }
    var data = await resp.json();
    return { success: true, shiprocket_order_id: data.order_id, response: data };
  } catch (e) {
    return { success: false, error: 'Shiprocket API error: ' + e.message };
  }
}

// ---- SEED DATA (if empty) ----
function seedInitialData() {
  var products = getData('products');
  if (products.length === 0) {
    products = [
      { id: 'PROD001', name: 'Sugar Pro Max', price: 1090, originalPrice: 1499, image: '../images/sugar-pro-max-1.jpg', category: 'Sugar Control', stock: 50, sku: 'SPM-001', createdAt: new Date().toISOString() },
      { id: 'PROD002', name: 'Digestive Health', price: 1090, originalPrice: 1399, image: '../images/pachan-pro-main.png', category: 'Digestive', stock: 45, sku: 'DH-001', createdAt: new Date().toISOString() },
      { id: 'PROD003', name: 'Joint Care', price: 1040, originalPrice: 1140, image: '../images/joint-care-main.png', category: 'Joint Care', stock: 35, sku: 'JC-001', createdAt: new Date().toISOString() }
    ];
    setData('products', products);
  }

  var orders = getData('orders');
  if (orders.length === 0) {
    orders = [
      { id: 'ORD001', customerName: 'Rahul Sharma', phone: '9876543210', email: 'rahul@email.com', address: '123, Green Park Colony', city: 'Delhi', pincode: '110001', state: 'Delhi', items: [{ name: 'Sugar Pro Max', price: 1090, qty: 1, sku: 'SPM-001' }], total: 1090, paymentMethod: 'cod', status: 'delivered', createdAt: new Date(Date.now() - 86400000 * 3).toISOString(), shiprocketId: null },
      { id: 'ORD002', customerName: 'Priya Mehta', phone: '9876543211', email: 'priya@email.com', address: '456, Lake View Apartments', city: 'Mumbai', pincode: '400001', state: 'Maharashtra', items: [{ name: 'Digestive Health', price: 1090, qty: 2, sku: 'DH-001' }], total: 2180, paymentMethod: 'cod', status: 'shipped', createdAt: new Date(Date.now() - 86400000 * 2).toISOString(), shiprocketId: null },
      { id: 'ORD003', customerName: 'Aman Verma', phone: '9876543212', email: '', address: '789, Sunrise Nagar', city: 'Lucknow', pincode: '226001', state: 'Uttar Pradesh', items: [{ name: 'Joint Care', price: 1040, qty: 1, sku: 'JC-001' }, { name: 'Sugar Pro Max', price: 1090, qty: 1, sku: 'SPM-001' }], total: 2130, paymentMethod: 'cod', status: 'processing', createdAt: new Date(Date.now() - 86400000).toISOString(), shiprocketId: null }
    ];
    setData('orders', orders);
  }
}

// ---- CALLBACKS FOR PAGE SCRIPTS ----
// Each page can define its own initPage() function
document.addEventListener('DOMContentLoaded', function () {
  if (window.location.pathname.indexOf('index.html') === -1 && window.location.pathname !== '/') {
    requireAuth();
  }
  initSidebar();
  seedInitialData();
  if (typeof initPage === 'function') initPage();
});
