/* ============================================================
   OMS Admin — app.js (Shared Logic)
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
  // Auto-sync to Milesweb (primary)
  // Map webProducts -> web_products key to match what api.php reads
  var mc = ensureMilesConfig();
  if (mc && mc.enabled && mc.url && mc.token && (mc.autoSync !== false)) {
    var syncKey = key === 'webProducts' ? 'web_products' : key;
    milesSave(syncKey, data);
  }
  // Auto-sync to Sheets (secondary)
  var dc = getDriveConfig();
  if (dc && dc.enabled && dc.url && dc.token && (dc.autoSync !== false)) {
    var syncKey2 = key === 'webProducts' ? 'web_products' : key;
    driveSave(syncKey2, data);
  }
}

// ---- AUTH ----
function requireAuth() {
  if (!sessionStorage.getItem('taiva_admin')) {
    window.location.href = 'index.html';
  }
}
function getCurrentUser() {
  try { return JSON.parse(sessionStorage.getItem('taiva_admin')); } catch(e) { return null; }
}
function requireRole(roles) {
  var u = getCurrentUser();
  if (!u) { window.location.href = 'index.html'; return false; }
  if (roles && roles.indexOf(u.role) === -1) {
    window.location.href = 'dashboard.html';
    return false;
  }
  return true;
}
function canDelete() {
  var u = getCurrentUser();
  return u && (u.role === 'super_admin' || u.role === 'manager');
}
function login(username, password) {
  return (async function() {
    await syncUsersFromServer();
    var users = getUsers();
    var defaults = [
      { id:'USR001', username:'Admin', password:'Taiva@2026FB', name:'Super Admin', role:'super_admin', status:'active', createdAt:new Date().toISOString() },
      { id:'USR002', username:'Shivam', password:'Admin@123', name:'Shivam', role:'manager', status:'active', createdAt:new Date().toISOString() }
    ];
    var needsSave = false;
    defaults.forEach(function(d) {
      if (!users.some(function(u) { return u.username === d.username; })) {
        users.push(d); needsSave = true;
      }
    });
    if (needsSave) saveUsers(users);
    for (var i = 0; i < users.length; i++) {
      if (users[i].username === username && users[i].password === password && users[i].status === 'active') {
        var u = users[i];
        sessionStorage.setItem('taiva_admin', JSON.stringify({ user: u.username, name: u.name, role: u.role, id: u.id }));
        logActivity('login', 'User ' + u.username + ' logged in');
        return true;
      }
    }
    return false;
  })();
}

function mergeUsers(a, b) {
  var map = {};
  var i;
  for (i = 0; i < a.length; i++) if (a[i]) map[a[i].id || a[i].username] = a[i];
  for (i = 0; i < b.length; i++) if (b[i]) map[b[i].id || b[i].username] = b[i];
  return Object.keys(map).map(function(k) { return map[k]; });
}

async function syncUsersFromServer() {
  var mc = getMilesConfig();
  if (!mc || !mc.url || !mc.token) {
    mc = { url: 'https://taiva.in/Admin%20pannel/api.php', token: 'MilesToken@2026', enabled: true, autoSync: true };
    setMilesConfig(mc);
  }
  if (!mc || !mc.enabled || !mc.url || !mc.token) return false;
  try {
    var r = await milesLoad('users');
    if (!r || !r.success || !r.data) return false;
    var remote = [];
    try { remote = JSON.parse(r.data) || []; } catch(e) { remote = []; }
    if (!Array.isArray(remote) || !remote.length) return false;
    var local = [];
    try { local = getUsers(); } catch(e) { local = []; }
    localStorage.setItem('taiva_users', JSON.stringify(mergeUsers(remote, local)));
    return true;
  } catch(e) { return false; }
}
function logout() {
  sessionStorage.removeItem('taiva_admin');
  window.location.href = 'index.html';
}

// ---- PROFILE MENU (topbar avatar) ----
function profileRoleLabel(r) {
  var labels = { super_admin: 'Super Admin', manager: 'Manager', agent: 'Agent', viewer: 'Viewer' };
  return labels[r] || r || '';
}
function updateAvatarInitial() {
  var initial = document.getElementById('avatarInitial');
  if (!initial) return;
  var u = getCurrentUser();
  var letter = 'A';
  if (u) {
    letter = ((u.name || u.user || 'A').trim().charAt(0) || 'A').toUpperCase();
  }
  if (initial.textContent !== letter) initial.textContent = letter;
}
function toggleProfileMenu(e) {
  if (e) e.stopPropagation();
  var menu = document.getElementById('profileMenu');
  if (!menu) { buildProfileMenu(); menu = document.getElementById('profileMenu'); }
  if (!menu) return;
  menu.classList.toggle('show');
  updateAvatarInitial();
}
var _profileMenuListenersAdded = false;
function buildProfileMenu() {
  var existing = document.getElementById('profileMenu');
  if (existing) return existing;
  var menu = document.createElement('div');
  menu.className = 'profile-menu';
  menu.id = 'profileMenu';
  var u = getCurrentUser();
  var name = u ? (u.name || u.user || '') : '';
  var uname = u ? (u.user || '') : '';
  var role = u ? (u.role || '') : '';
  var initial = ((name || uname || 'A').trim().charAt(0) || 'A').toUpperCase();
  var email = '';
  try {
    var users = getUsers();
    for (var i = 0; i < users.length; i++) {
      if (users[i].username === uname && users[i].email) { email = users[i].email; break; }
    }
  } catch(e) {}
  menu.innerHTML =
    '<div class="profile-menu-header">' +
      '<div class="profile-avatar">' + escapeHtml(initial) + '</div>' +
      '<div>' +
        '<div class="profile-name">' + escapeHtml(name || 'Account') + '</div>' +
        '<div class="profile-username">@' + escapeHtml(uname) + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="profile-menu-row"><span style="font-size:12px;color:var(--text-muted);">Role</span>' + (role ? '<span class="role-badge role-' + escapeHtml(role) + '">' + escapeHtml(profileRoleLabel(role)) + '</span>' : '') + '</div>' +
    (email ? '<div class="profile-menu-row"><i class="fa-solid fa-envelope" style="color:var(--text-muted);width:16px;text-align:center;"></i>' + escapeHtml(email) + '</div>' : '') +
    '<div class="profile-menu-divider"></div>' +
    '<button type="button" class="profile-menu-btn" onclick="logout()"><i class="fa-solid fa-right-from-bracket"></i> Logout</button>';
  document.body.appendChild(menu);
  if (!_profileMenuListenersAdded) {
    _profileMenuListenersAdded = true;
    document.addEventListener('click', function(e) {
      var m = document.getElementById('profileMenu');
      var av = document.getElementById('adminAvatar');
      if (m && m.classList.contains('show') && (!av || !av.contains(e.target))) {
        m.classList.remove('show');
      }
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        var m = document.getElementById('profileMenu');
        if (m) m.classList.remove('show');
      }
    });
  }
}

// ---- USERS CRUD ----
function getUsers() {
  return getData('users', []);
}
function saveUsers(users) {
  setData('users', users);
}
function addUser(user) {
  var users = getUsers();
  user.id = 'USR' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2,4).toUpperCase();
  user.createdAt = new Date().toISOString();
  user.status = user.status || 'active';
  users.push(user);
  saveUsers(users);
  return user;
}
function updateUser(id, updates) {
  var users = getUsers();
  var allowedKeys = ['username', 'password', 'name', 'email', 'role', 'status', 'rights', 'phone'];
  for (var i = 0; i < users.length; i++) {
    if (users[i].id === id) {
      for (var k in updates) {
        if (allowedKeys.indexOf(k) !== -1 && updates.hasOwnProperty(k)) {
          users[i][k] = updates[k];
        }
      }
      saveUsers(users);
      return true;
    }
  }
  return false;
}
function deleteUser(id) {
  if (!canDelete()) return;
  saveUsers(getUsers().filter(function(u) { return u.id !== id; }));
}

var ALL_RIGHTS = ['own_orders_only', 'create_orders', 'view_reports', 'draft_access'];
function hasRight(u, right) {
  if (!u) return false;
  if (u.role === 'super_admin' || u.role === 'manager') return true;
  if (u.role !== 'agent') return false;
  if (!u.rights || !u.rights.length) return ALL_RIGHTS.indexOf(right) !== -1;
  return u.rights.indexOf(right) !== -1;
}

// ---- ACTIVITY LOG ----
function getActivity() {
  return getData('activity', []);
}
function saveActivity(log) {
  setData('activity', log);
}
function logActivity(action, details) {
  var u = getCurrentUser();
  var log = getActivity();
  log.unshift({
    id: 'ACT' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2,4).toUpperCase(),
    user: u ? u.name : 'Unknown',
    userId: u ? u.id : null,
    username: u ? u.user : 'unknown',
    action: action,
    details: details || '',
    timestamp: new Date().toISOString()
  });
  if (log.length > 500) log = log.slice(0, 500);
  saveActivity(log);
}
function formatActivityAction(action) {
  var map = {
    'login': 'Logged in',
    'logout': 'Logged out',
    'order_created': 'Created order',
    'order_status': 'Changed order status',
    'order_deleted': 'Deleted order',
    'product_created': 'Created product',
    'product_updated': 'Updated product',
    'product_deleted': 'Deleted product',
    'user_created': 'Created user',
    'user_updated': 'Updated user',
    'user_deleted': 'Deleted user',
    'backup': 'Backed up data',
    'restore': 'Restored data',
    'settings': 'Updated settings'
  };
  return map[action] || action;
}

// ---- THEME TOGGLE ----
function initTheme() {
  var savedTheme = localStorage.getItem('taiva_theme');
  if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
  var themeBtn = document.getElementById('themeToggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', function() {
      var html = document.documentElement;
      var theme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', theme);
      localStorage.setItem('taiva_theme', theme);
      themeBtn.innerHTML = theme === 'dark' ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    });
    if (savedTheme) themeBtn.innerHTML = savedTheme === 'dark' ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
  }
}

// ---- SIDEBAR ----
function updateSidebarBadge() {
  var badge = document.getElementById('orderBadge');
  if (!badge) return;
  var orders = getData('orders');
  badge.textContent = orders.length || '0';
}

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
  var iconClass = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-times-circle' : 'fa-info-circle';
  t.textContent = '';
  var icon = document.createElement('i');
  icon.className = 'fa-solid ' + iconClass;
  t.appendChild(icon);
  t.appendChild(document.createTextNode(' ' + msg));
  container.appendChild(t);
  setTimeout(function () { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; setTimeout(function () { t.remove(); }, 300); }, 3000);
}

// ---- MODALS ----
function openModal(id) {
  var overlay = document.getElementById('modalOverlay');
  var modal = document.getElementById(id);
  if (overlay) overlay.classList.add('active');
  if (modal) modal.classList.add('active');
}
function closeModal(id) {
  var overlay = document.getElementById('modalOverlay');
  var modal = document.getElementById(id);
  if (overlay) overlay.classList.remove('active');
  if (modal) modal.classList.remove('active');
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
  var val = Number(n);
  if (isNaN(val)) val = 0;
  return 'Rs. ' + val.toLocaleString('en-IN');
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
function orderDisplayNo(o) {
  if (o && o.orderNumber) return '#' + o.orderNumber;
  return '#' + (o ? o.id : '');
}
function getOrderNumberCounter() {
  var c = parseInt(localStorage.getItem('taiva_orderCounter'), 10);
  return isNaN(c) || c < 1000 ? 999 : c;
}
function nextOrderNumber() {
  var maxNum = 999;
  try {
    getOrders().forEach(function(o) {
      var n = parseInt(o.orderNumber, 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    });
  } catch(e) {}
  var c = getOrderNumberCounter();
  var next = Math.max(maxNum, c) + 1;
  localStorage.setItem('taiva_orderCounter', next);
  return next;
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

var _shiprocketRetryCount = 0;
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
    billing_address: (orderData.address || '') + (orderData.landmark ? ', ' + orderData.landmark : ''),
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
      if (resp.status === 401 && _shiprocketRetryCount < 1) {
        shiprocketToken = null;
        _shiprocketRetryCount++;
        return await createShiprocketOrder(orderData);
      }
      _shiprocketRetryCount = 0;
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
      { id: 'PROD001', name: 'Sugar Pro Max', price: 1090, originalPrice: 1499, image: 'https://taiva.in/images/sugar-pro-max-1.jpg', category: 'Sugar Control', stock: 50, sku: 'SPM-001', createdAt: new Date().toISOString() },
      { id: 'PROD002', name: 'Digestive Health', price: 1090, originalPrice: 1399, image: 'https://taiva.in/images/pachan-pro-main.png', category: 'Digestive', stock: 45, sku: 'DH-001', createdAt: new Date().toISOString() },
      { id: 'PROD003', name: 'Joint Care', price: 1040, originalPrice: 1140, image: 'https://taiva.in/images/joint-care-main.png', category: 'Joint Care', stock: 35, sku: 'JC-001', createdAt: new Date().toISOString() }
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

// ---- PAGINATION ----
var _paginationState = {};
function paginate(array, pageKey, perPage) {
  perPage = perPage || 10;
  var page = _paginationState[pageKey] || 1;
  var totalPages = Math.ceil(array.length / perPage) || 1;
  if (page > totalPages) page = totalPages;
  _paginationState[pageKey] = page;
  var start = (page - 1) * perPage;
  var items = array.slice(start, start + perPage);
  return { items: items, page: page, totalPages: totalPages, total: array.length };
}

function renderPagination(containerId, pageKey, totalPages, onPageChange) {
  var el = document.getElementById(containerId);
  if (!el || totalPages <= 1) { if (el) el.innerHTML = ''; return; }
  var page = _paginationState[pageKey] || 1;
  var html = '<div style="display:flex;align-items:center;gap:8px;justify-content:center;padding:12px;font-size:13px;">';
  html += '<button class="btn btn-sm" ' + (page <= 1 ? 'disabled' : '') + ' onclick="' + onPageChange + '(' + (page - 1) + ')"><i class="fa-solid fa-chevron-left"></i></button>';
  html += '<span>Page ' + page + ' of ' + totalPages + '</span>';
  html += '<button class="btn btn-sm" ' + (page >= totalPages ? 'disabled' : '') + ' onclick="' + onPageChange + '(' + (page + 1) + ')"><i class="fa-solid fa-chevron-right"></i></button>';
  html += '</div>';
  el.innerHTML = html;
}

function setPage(pageKey, page) {
  _paginationState[pageKey] = page;
}

// ---- DRIVE SYNC ----
var DRIVE_LAST_SYNC_KEY = 'taiva_driveLastSync';

function getDriveConfig() {
  try {
    var d = localStorage.getItem('taiva_driveConfig');
    return d ? JSON.parse(d) : null;
  } catch(e) { return null; }
}
function setDriveConfig(cfg) {
  localStorage.setItem('taiva_driveConfig', JSON.stringify(cfg));
}

function driveB64(s) {
  // Convert JSON string to base64 (ASCII-safe)
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  var result = '', i = 0, c1, c2, c3, b1, b2, b3, b4;
  while (i < s.length) {
    c1 = s.charCodeAt(i++);
    c2 = i < s.length ? s.charCodeAt(i++) : NaN;
    c3 = i < s.length ? s.charCodeAt(i++) : NaN;
    b1 = c1 >> 2;
    b2 = ((c1 & 3) << 4) | (c2 >> 4);
    b3 = isNaN(c2) ? 64 : ((c2 & 15) << 2) | (c3 >> 6);
    b4 = isNaN(c3) ? 64 : (c3 & 63);
    result += chars.charAt(b1) + chars.charAt(b2) + chars.charAt(b3) + chars.charAt(b4);
  }
  return result;
}

function driveAddParam(url, param, value) {
  var sep = url.indexOf('?') > -1 ? '&' : '?';
  return url + sep + param + '=' + encodeURIComponent(value);
}

function driveGet(url) {
  return fetch(url, {method:'GET', mode:'cors'}).then(function(r){
    if (!r.ok) return {success:false,error:'HTTP '+r.status};
    return r.json();
  });
}

function driveSave(key, data) {
  var dc = getDriveConfig();
  if (!dc || !dc.url || !dc.token) return Promise.resolve({success:false,error:'Not configured'});
  var fullKey = 'taiva_' + key;
  var payload = data !== undefined ? data : (function(){ try{return JSON.parse(localStorage.getItem(fullKey));}catch(e){return null;}})();
  if (payload === null || payload === undefined) return Promise.resolve({success:true, skipped:true});
  // Use POST body instead of GET URL to avoid truncation
  var url = dc.url + '?action=save&key=' + encodeURIComponent(fullKey) + '&token=' + encodeURIComponent(dc.token);
  return fetch(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({data: JSON.stringify(payload)})
  }).then(function(r){
    return r.json();
  }).then(function(r){
    if (r.success) localStorage.setItem(DRIVE_LAST_SYNC_KEY, new Date().toISOString());
    return r;
  }).catch(function(e){ return {success:false,error:e.message}; });
}

function driveLoad(key) {
  var dc = getDriveConfig();
  if (!dc || !dc.url || !dc.token) return Promise.resolve({success:false,error:'Not configured'});
  var url = driveAddParam(driveAddParam(driveAddParam(dc.url, 'action', 'load'), 'token', dc.token), 'key', key ? ('taiva_' + key) : '');
  return driveGet(url);
}

function driveBackupAll(progressCb) {
  var dc = getDriveConfig();
  if (!dc || !dc.url || !dc.token) return Promise.resolve({success:false,error:'Not configured'});
  var keys = ['products','orders','settings','drafts','abandoned','collections','giftCards','purchaseOrders','transfers','segments','users','web_products'];
  var results = [];
  var step = function(i) {
    if (i >= keys.length) {
      localStorage.setItem(DRIVE_LAST_SYNC_KEY, new Date().toISOString());
      var allOk = results.every(function(r){return r && (r.success || r.skipped);});
      return {success:allOk, results:results, error: allOk ? '' : (results.find(function(r){return r && !r.success && !r.skipped;}) || {}).error || 'Unknown'};
    }
    if (progressCb) progressCb(keys[i], i+1, keys.length);
    return driveSave(keys[i]).then(function(res){
      results.push(res);
      return step(i+1);
    });
  };
  return step(0);
}

function driveRestoreAll() {
  var dc = getDriveConfig();
  if (!dc || !dc.url || !dc.token) return Promise.resolve({success:false,error:'Not configured'});
  return driveLoad(null).then(function(resp){
    if (!resp.success) return resp;
    var count = 0;
    Object.keys(resp.data).forEach(function(k){
      if (resp.data[k] !== null) {
        try {
          localStorage.setItem(k, JSON.stringify(resp.data[k]));
          count++;
        } catch(e){}
      }
    });
    return {success:true,restored:count};
  });
}

function getDriveLastSync() {
  return localStorage.getItem(DRIVE_LAST_SYNC_KEY) || null;
}

function driveAuthorize() {
  var dc = getDriveConfig();
  if (!dc || !dc.url) return;
  var url = driveAddParam(driveAddParam(dc.url, 'action', 'load'), 'token', dc.token || '');
  window.open(url, '_blank');
}

// ---- MILESWEB SYNC ----
const MILES_TOKEN = 'MilesToken@2026';
const MILES_LAST_SYNC_KEY = 'taiva_milesLastSync';

function getMilesConfig() {
  try {
    var d = localStorage.getItem('taiva_milesConfig');
    return d ? JSON.parse(d) : null;
  } catch(e) { return null; }
}
function setMilesConfig(cfg) {
  localStorage.setItem('taiva_milesConfig', JSON.stringify(cfg));
}

function ensureMilesConfig() {
  var mc = getMilesConfig();
  var needsFix = false;
  if (!mc) { mc = {}; needsFix = true; }
  if (!mc.url || String(mc.url).indexOf(' ') !== -1) {
    mc.url = 'https://taiva.in/Admin%20pannel/api.php';
    needsFix = true;
  }
  if (!mc.token) { mc.token = 'MilesToken@2026'; needsFix = true; }
  if (mc.enabled !== true && mc.enabled !== false) { mc.enabled = true; needsFix = true; }
  if (mc.autoSync !== true && mc.autoSync !== false) { mc.autoSync = true; needsFix = true; }
  if (needsFix) setMilesConfig(mc);
  return mc;
}

function getMilesLastSync() {
  return localStorage.getItem(MILES_LAST_SYNC_KEY) || null;
}

async function milesSave(key, data) {
  var mc = getMilesConfig();
  if (!mc || !mc.url || !mc.token) return {success:false,error:'Not configured'};
  var fullKey = 'taiva_' + key;
  var payload = data !== undefined ? data : (function(){ try{return JSON.parse(localStorage.getItem(fullKey));}catch(e){return null;}})();
  if (payload === null || payload === undefined) return {success:true, skipped:true};
  try {
    var url = mc.url + '?action=save&key=' + encodeURIComponent(fullKey) + '&token=' + encodeURIComponent(mc.token);
    var res = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({data: JSON.stringify(payload)})
    });
    var json = await res.json();
    if (json.success) localStorage.setItem(MILES_LAST_SYNC_KEY, new Date().toISOString());
    return json;
  } catch(e) { return {success:false,error:e.message}; }
}

async function milesLoad(key) {
  var mc = getMilesConfig();
  if (!mc || !mc.url || !mc.token) return {success:false,error:'Not configured'};
  try {
    var url = mc.url + '?action=load&key=' + encodeURIComponent(key ? 'taiva_' + key : '') + '&token=' + encodeURIComponent(mc.token);
    var res = await fetch(url);
    return await res.json();
  } catch(e) { return {success:false,error:e.message}; }
}

async function milesBackupAll(progressCb) {
  var mc = getMilesConfig();
  if (!mc || !mc.url || !mc.token) return {success:false,error:'Not configured'};
  var keys = ['products','orders','settings','drafts','abandoned','collections','giftCards','purchaseOrders','transfers','segments','users','web_products'];
  var results = [];
  for (var i = 0; i < keys.length; i++) {
    if (progressCb) progressCb(keys[i], i+1, keys.length);
    var r = await milesSave(keys[i]);
    results.push(r);
  }
  var allOk = results.every(function(r){return r && (r.success || r.skipped);});
  localStorage.setItem(MILES_LAST_SYNC_KEY, new Date().toISOString());
  return {success:allOk, results:results, error: allOk ? '' : (results.find(function(r){return r && !r.success && !r.skipped;}) || {}).error || 'Unknown'};
}

async function milesRestoreAll() {
  var mc = getMilesConfig();
  if (!mc || !mc.url || !mc.token) return {success:false,error:'Not configured'};
  var keys = ['products','orders','settings','drafts','abandoned','collections','giftCards','purchaseOrders','transfers','segments','users','web_products'];
  var restored = 0;
  for (var i = 0; i < keys.length; i++) {
    var r = await milesLoad(keys[i]);
    if (r.success && r.data) {
      try {
        localStorage.setItem('taiva_' + keys[i], r.data);
        restored++;
      } catch(e){}
    }
  }
  return {success:true, restored:restored};
}
async function autoRestoreFromMilesweb() {
  var mc = getMilesConfig();
  if (!mc || !mc.url || !mc.token) {
    mc = { url: 'https://taiva.in/Admin%20pannel/api.php', token: 'MilesToken@2026', enabled: true, autoSync: true };
    setMilesConfig(mc);
  }
  try {
    var res = await milesRestoreAll();
    if (res.success && res.restored > 0) {
      showToast('Data synced from server! (' + res.restored + ' datasets)', 'success');
      return true;
    }
  } catch(e) {}
  return false;
}

// ---- REALTIME SYNC ----
var REALTIME_POLL_INTERVAL = 5000;
var realtimeTimer = null;
var realtimePolling = false;
var syncFailCount = 0;
var newOrderPopupQueue = [];
var newOrderPopupShown = false;

function canSeeNewOrderPopup() {
  var u = getCurrentUser();
  return u && (u.role === 'super_admin' || u.role === 'manager');
}

function startRealtimeSync() {
  if (window.location.pathname.indexOf('index.html') !== -1) return;
  if (realtimeTimer) clearInterval(realtimeTimer);
  realtimeTimer = setInterval(syncOrdersRealtime, REALTIME_POLL_INTERVAL);
  setTimeout(syncOrdersRealtime, 2000);
}

async function syncOrdersRealtime() {
  if (realtimePolling) return;
  var mc = ensureMilesConfig();
  if (!mc || !mc.enabled || !mc.url || !mc.token) return;
  realtimePolling = true;
  try {
    var res = await milesLoad('orders');
    if (!res || !res.success) {
      syncFailCount++;
      if (syncFailCount === 3 || syncFailCount % 30 === 0) {
        showToast('Sync failed: ' + (res && res.error ? res.error : 'server error'), 'error');
      }
      return;
    }
    syncFailCount = 0;
    var remote = [];
    try { remote = JSON.parse(res.data) || []; } catch(e) { remote = []; }
    if (!Array.isArray(remote)) remote = [];
    var local = getOrders();
    var localMap = {};
    var i;
    for (i = 0; i < local.length; i++) localMap[local[i].id] = local[i];
    var changed = false;
    var newOrders = [];
    var now = new Date().toISOString();
    for (i = 0; i < remote.length; i++) {
      var r = remote[i];
      if (!r || !r.id) continue;
      var l = localMap[r.id];
      var rTime = r.updatedAt || r.createdAt || '';
      var lTime = l ? (l.updatedAt || l.createdAt || '') : '';
      if (!l) {
        r.updatedAt = r.updatedAt || r.createdAt || now;
        local.unshift(r);
        localMap[r.id] = r;
        changed = true;
        newOrders.push(r);
      } else if (rTime > lTime) {
        localMap[r.id] = r;
        changed = true;
      }
    }
    if (changed) {
      _getOrdersSkipSync = true;
      setData('orders', local);
      _getOrdersSkipSync = false;
      if (newOrders.length) {
        showToast(newOrders.length + ' new order(s) synced', 'success');
        for (var n = 0; n < newOrders.length; n++) {
          addNotification({
            id: newOrders[n].id,
            title: 'New order ' + orderDisplayNo(newOrders[n]),
            meta: (newOrders[n].customerName || '-') + (newOrders[n].phone ? ' \u00B7 ' + newOrders[n].phone : ''),
            total: newOrders[n].total || 0,
            time: Date.now()
          });
        }
        if (canSeeNewOrderPopup()) {
          newOrderPopupQueue = newOrderPopupQueue.concat(newOrders);
          showNextNewOrderPopup();
        }
      }
      try {
        document.dispatchEvent(new CustomEvent('taiva:sync'));
      } catch(e) {
        document.dispatchEvent(new Event('taiva:sync'));
      }
    }
  } catch(e) {}
  finally { realtimePolling = false; }
}

// ---- NOTIFICATION BELL (topbar) ----
var notificationItems = [];
function notifSeenKey() {
  var u = getCurrentUser();
  return 'taiva_notif_seen_' + (u ? (u.user || 'anon') : 'anon');
}
function getNotifLastSeen() {
  try { return parseInt(localStorage.getItem(notifSeenKey()) || '0', 10); } catch (e) { return 0; }
}
function setNotifLastSeen(ts) {
  try { localStorage.setItem(notifSeenKey(), String(ts)); } catch (e) {}
}
function addNotification(item) {
  if (!item) return;
  notificationItems.unshift(item);
  if (notificationItems.length > 50) notificationItems.pop();
  updateNotificationDot();
}
function updateNotificationDot() {
  var lastSeen = getNotifLastSeen();
  var unread = 0;
  for (var i = 0; i < notificationItems.length; i++) {
    if ((notificationItems[i].time || 0) > lastSeen) unread++;
  }
  document.querySelectorAll('.notification-dot').forEach(function (d) {
    if (unread > 0) {
      d.style.display = 'flex';
      d.textContent = unread > 9 ? '9+' : unread;
    } else {
      d.style.display = 'none';
      d.textContent = '';
    }
  });
}
function initNotificationBell() {
  var bell = document.querySelector('.topbar-actions .fa-bell');
  if (!bell) return;
  var btn = bell.closest('button');
  if (!btn) return;
  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    toggleNotifications();
  });
  seedNotifications();
}
function seedNotifications() {
  var orders = getOrders();
  if (!orders || !orders.length) return;
  var dayMs = 24 * 60 * 60 * 1000;
  var now = Date.now();
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    var t = Date.parse(o.createdAt || o.updatedAt || '') || 0;
    if (t && (now - t) <= dayMs) {
      addNotification({
        id: o.id,
        title: 'New order ' + orderDisplayNo(o),
        meta: (o.customerName || '-') + (o.phone ? ' \u00B7 ' + o.phone : ''),
        total: o.total || 0,
        time: t
      });
    }
  }
  updateNotificationDot();
}
function buildNotifPanel() {
  var panel = document.getElementById('notifPanel');
  if (panel) return panel;
  panel = document.createElement('div');
  panel.id = 'notifPanel';
  panel.className = 'notif-panel';
  document.body.appendChild(panel);
  return panel;
}
function closeNotifPanels() {
  document.querySelectorAll('.notif-panel.show').forEach(function (p) { p.classList.remove('show'); });
}
function toggleNotifications() {
  var panel = buildNotifPanel();
  var open = panel.classList.contains('show');
  closeNotifPanels();
  if (open) return;
  renderNotifications();
  panel.classList.add('show');
  setNotifLastSeen(Date.now());
  updateNotificationDot();
}
function renderNotifications() {
  var panel = document.getElementById('notifPanel');
  if (!panel) return;
  var items = notificationItems.slice(0, 12);
  var seen = getNotifLastSeen();
  var rows = '';
  if (items.length) {
    rows = items.map(function (n) {
      return '<div class="notif-item' + ((n.time || 0) > seen ? ' unread' : '') + '" onclick="openOrderFromNotif(\'' + encodeURIComponent(n.id) + '\')">' +
        '<div class="notif-item-main"><i class="fa-solid fa-cart-shopping notif-item-ic"></i>' +
        '<div><div class="notif-item-title">' + escapeHtml(n.title) + '</div>' +
        '<div class="notif-item-meta">' + escapeHtml(n.meta) + ' \u00B7 ' + formatDateTime(new Date(n.time)) + '</div></div></div>' +
        '<div class="notif-item-total">' + formatCurrency(n.total) + '</div></div>';
    }).join('');
  } else {
    rows = '<div class="notif-empty"><i class="fa-regular fa-bell"></i><div>No new orders yet</div></div>';
  }
  panel.innerHTML = '<div class="notif-header"><span><i class="fa-solid fa-bell"></i> Notifications</span>' +
    (items.length ? '<button class="notif-viewall" onclick="window.location=\'orders.html\'">View all</button>' : '') +
    '</div>' + rows +
    '<div class="notif-footer"><button class="notif-clear" onclick="markAllRead()">Mark all as read</button></div>';
}
function openOrderFromNotif(id) {
  closeNotifPanels();
  window.location.href = 'orders-detail.html?id=' + id;
}
function markAllRead() {
  setNotifLastSeen(Date.now());
  updateNotificationDot();
  renderNotifications();
}
function initNotifications() {
  initNotificationBell();
  document.addEventListener('click', function (e) {
    var panel = document.getElementById('notifPanel');
    if (panel && panel.classList.contains('show')) {
      var btn = document.querySelector('.topbar-actions .fa-bell');
      if (btn && btn.closest('button') && btn.closest('button').contains(e.target)) return;
      if (panel.contains(e.target)) return;
      closeNotifPanels();
    }
  });
}

// ---- NEW ORDER POPUP (manager / super_admin) ----
function buildNewOrderPopup() {
  if (document.getElementById('newOrderOverlay')) return;
  var ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.id = 'newOrderOverlay';
  ov.style.display = 'none';
  ov.addEventListener('click', function(e) {
    if (e.target === ov) hideNewOrderPopup();
  });
  var m = document.createElement('div');
  m.className = 'modal';
  m.id = 'newOrderPopup';
  m.style.display = 'none';
  ov.appendChild(m);
  document.body.appendChild(ov);
}

function showNextNewOrderPopup() {
  if (newOrderPopupShown) return;
  if (!newOrderPopupQueue.length) return;
  newOrderPopupShown = true;
  var orders = newOrderPopupQueue.slice(0, 5);
  newOrderPopupQueue = newOrderPopupQueue.slice(orders.length);
  buildNewOrderPopup();
  var ov = document.getElementById('newOrderOverlay');
  var m = document.getElementById('newOrderPopup');
  var rows = orders.map(function(o) {
    return '<div class="nop-row" onclick="openOrderFromPopup(\'' + encodeURIComponent(o.id) + '\')">' +
      '<div><div class="nop-id">' + escapeHtml(orderDisplayNo(o)) + '</div>' +
      '<div class="nop-meta">' + escapeHtml(o.customerName || '-') + ' &middot; ' + escapeHtml(o.phone || '') + (o.city ? ' &middot; ' + escapeHtml(o.city) : '') + '</div></div>' +
      '<div class="nop-total">' + formatCurrency(o.total || 0) + '</div></div>';
  }).join('');
  m.innerHTML = '<div class="modal-header"><h2><i class="fa-solid fa-bell"></i> New Order' + (orders.length > 1 ? 's' : '') + '</h2><button class="modal-close" onclick="hideNewOrderPopup()">&times;</button></div>' +
    '<div class="modal-body">' +
    (orders.length > 1 ? '<p class="nop-note">' + orders.length + ' new orders received from another user.</p>' : '<p class="nop-note">A new order was created by an agent.</p>') +
    rows +
    '</div>' +
    '<div class="modal-footer">' +
    '<button class="btn" onclick="hideNewOrderPopup()">Close</button>' +
    '<button class="btn btn-accent" onclick="window.location=\'orders.html\'"><i class="fa-solid fa-list"></i> View All Orders</button>' +
    '</div>';
  ov.style.display = 'flex';
  m.style.display = 'block';
  playNewOrderBeep();
}

function hideNewOrderPopup() {
  newOrderPopupShown = false;
  var ov = document.getElementById('newOrderOverlay');
  if (ov) ov.style.display = 'none';
  showNextNewOrderPopup();
}

function openOrderFromPopup(id) {
  var ov = document.getElementById('newOrderOverlay');
  if (ov) ov.style.display = 'none';
  newOrderPopupShown = false;
  newOrderPopupQueue = [];
  window.location.href = 'orders-detail.html?id=' + id;
}

function playNewOrderBeep() {
  try {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    var ctx = new Ctx();
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.value = 0.15;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    setTimeout(function() { o.stop(); ctx.close(); }, 300);
  } catch(e) {}
}

// ---- CITY AUTOCOMPLETE ----
function initCityAutocomplete(inputId, stateId, pincodeId) {
  var input = document.getElementById(inputId);
  if (!input) return;

  var container = document.createElement('div');
  container.className = 'city-autocomplete-wrap';
  input.parentNode.insertBefore(container, input.nextSibling);

  var dropdown = document.createElement('div');
  dropdown.className = 'city-autocomplete-dropdown';
  container.appendChild(dropdown);

  var selectedIndex = -1, results = [];

  function getMatches(val) {
    if (!val || val.length < 1) return [];
    var v = val.toLowerCase().trim();
    var exact = [], starts = [], includes = [];

    INDIA_CITIES.forEach(function (item) {
      var cn = item.city.toLowerCase();
      if (cn === v) { exact.push(item); return; }
      if (cn.indexOf(v) === 0) { starts.push(item); return; }
      if (cn.indexOf(v) > 0) { includes.push(item); return; }
    });

    // Also match pincode
    if (/^\d{3,6}$/.test(v)) {
      INDIA_CITIES.forEach(function (item) {
        if (item.pincode.indexOf(v) === 0) {
          if (exact.indexOf(item) === -1 && starts.indexOf(item) === -1 && includes.indexOf(item) === -1) {
            includes.push(item);
          }
        }
      });
    }

    return exact.concat(starts).concat(includes).slice(0, 15);
  }

  function renderDropdown() {
    dropdown.innerHTML = '';
    if (results.length === 0 || selectedIndex < -1) { dropdown.classList.remove('active'); return; }

    results.forEach(function (item, i) {
      var div = document.createElement('div');
      div.className = 'city-autocomplete-item' + (i === selectedIndex ? ' selected' : '');
      div.innerHTML = '<span class="city-name">' + escapeHtml(item.city) + '</span><span class="city-meta">' + escapeHtml(item.state) + ' - ' + escapeHtml(item.pincode) + '</span>';
      div.addEventListener('mousedown', function (e) { e.preventDefault(); selectCity(item); });
      div.addEventListener('mouseenter', function () { selectedIndex = i; renderDropdown(); });
      dropdown.appendChild(div);
    });
    dropdown.classList.add('active');
  }

  function selectCity(item) {
    input.value = item.city;
    if (stateId) {
      var stateField = document.getElementById(stateId);
      if (stateField) stateField.value = item.state;
    }
    if (pincodeId) {
      var pincodeField = document.getElementById(pincodeId);
      if (pincodeField) pincodeField.value = item.pincode;
    }
    dropdown.classList.remove('active');
    results = [];
    selectedIndex = -1;
  }

  input.addEventListener('input', function () {
    results = getMatches(this.value);
    selectedIndex = results.length > 0 ? 0 : -1;
    renderDropdown();
  });

  input.addEventListener('keydown', function (e) {
    if (results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, results.length - 1);
      renderDropdown();
      var el = dropdown.children[selectedIndex];
      if (el) el.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      renderDropdown();
      var el = dropdown.children[selectedIndex];
      if (el) el.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        e.preventDefault();
        selectCity(results[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      dropdown.classList.remove('active');
      results = [];
      selectedIndex = -1;
    }
  });

  input.addEventListener('blur', function () {
    dropdown.classList.remove('active');
  });

  input.addEventListener('focus', function () {
    if (results.length > 0) dropdown.classList.add('active');
  });

  // Pincode API auto-fill
  if (pincodeId) {
    var pincodeField = document.getElementById(pincodeId);
    if (pincodeField) {
      var _timer;
      pincodeField.addEventListener('input', function () {
        clearTimeout(_timer);
        var val = this.value.trim();
        if (/^\d{6}$/.test(val)) {
          _timer = setTimeout(function () {
            lookupPincode(val, function (err, postOffices) {
              if (err || !postOffices || postOffices.length === 0) return;
              var seen = {}, options = [];
              postOffices.forEach(function (po) {
                var city = (po.District || '').trim();
                var state = (po.State || '').trim();
                if (!city || !state) return;
                var key = city + '|' + state;
                if (!seen[key]) { seen[key] = true; options.push({ city: city, state: state, pincode: val }); }
              });
              if (options.length === 0) return;
              if (options.length === 1) {
                document.getElementById(inputId).value = options[0].city;
                if (stateId) { var sf = document.getElementById(stateId); if (sf) sf.value = options[0].state; }
                pincodeField.value = options[0].pincode;
              } else {
                results = options; selectedIndex = 0; renderDropdown();
              }
            });
          }, 300);
        }
      });
    }
  }
}

// ---- PINCODE API LOOKUP ----
function lookupPincode(pincode, callback) {
  if (!/^\d{6}$/.test(pincode)) { callback(null, null); return; }
  var xhr = new XMLHttpRequest();
  xhr.open('GET', 'https://api.postalpincode.in/pincode/' + encodeURIComponent(pincode));
  xhr.onload = function() {
    if (xhr.status !== 200) { callback('Network error', null); return; }
    try {
      var resp = JSON.parse(xhr.responseText);
      if (resp && resp[0] && resp[0].Status === 'Success' && resp[0].PostOffice) {
        callback(null, resp[0].PostOffice);
      } else {
        callback(resp && resp[0] ? resp[0].Message : 'No data', null);
      }
    } catch(e) { callback('Parse error', null); }
  };
  xhr.onerror = function() { callback('Network error', null); };
  xhr.send();
}

// ---- ROLE-BASED SIDEBAR ----
function applyRoleGate() {
  var u = getCurrentUser();
  if (!u) return;
  var isSuper = u.role === 'super_admin';
  var isManager = u.role === 'manager';
  var isAgent = u.role === 'agent';
  document.querySelectorAll('.nav-role-restricted').forEach(function(el) {
    if (!isSuper) {
      el.style.display = 'none';
    }
  });
  document.querySelectorAll('.nav-role-manager').forEach(function(el) {
    if (!isSuper && !isManager) {
      el.style.display = 'none';
    }
  });
  document.querySelectorAll('.nav-role-agent').forEach(function(el) {
    if (!isSuper && !isManager && !isAgent) {
      el.style.display = 'none';
    }
  });
  if (isAgent) {
    var agentHidden = ['Products', 'Growth', 'Content', 'Markets'];
    document.querySelectorAll('.nav-item.has-submenu').forEach(function (item) {
      var labelEl = item.querySelector('.nav-label');
      if (labelEl && agentHidden.indexOf(labelEl.textContent) !== -1) {
        item.style.display = 'none';
        var sub = item.nextElementSibling;
        if (sub && sub.classList.contains('nav-sub')) sub.style.display = 'none';
      }
    });
    if (!hasRight(u, 'draft_access')) {
      document.querySelectorAll('.nav-sub a[href="orders-draft.html"], .nav-sub a[href="orders-abandoned.html"]').forEach(function(el) {
        el.style.display = 'none';
      });
    }
  }
}

// ---- WEB PRODUCTS SYNC ----
async function syncWebProductsToServer() {
  var mc = getMilesConfig();
  if (!mc || !mc.url || !mc.token) return {success: false, error: 'Milesweb not configured'};
  var webProducts = getData('webProducts', []);
  try {
    var url = mc.url + '?action=save&key=taiva_web_products&token=' + encodeURIComponent(mc.token);
    var res = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({data: JSON.stringify(webProducts)})
    });
    var json = await res.json();
    return json;
  } catch(e) {
    return {success: false, error: e.message};
  }
}

// ---- SHOPIFY-STYLE ORDER DATA LAYER ----
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function getUrlParam(name) {
  var m = new RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
  return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : null;
}

function newEventId() {
  return 'EVT' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 4).toUpperCase();
}

// -- Dual status derivation (legacy-compatible) --
function getPaymentStatus(o) {
  if (!o) return 'unpaid';
  if (o.paymentStatus) return o.paymentStatus;
  if (o.status === 'delivered') return 'paid';
  if (o.status === 'cancelled') return 'cancelled';
  return 'unpaid';
}
function getFulfillmentStatus(o) {
  if (!o) return 'unfulfilled';
  if (o.fulfillmentStatus) return o.fulfillmentStatus;
  if (o.status === 'shipped' || o.status === 'delivered') return 'fulfilled';
  if (o.status === 'cancelled') return 'cancelled';
  return 'unfulfilled';
}
function getPaymentLabel(s) {
  var map = { unpaid: 'Unpaid', paid: 'Paid', partially_refunded: 'Partially refunded', refunded: 'Refunded', cancelled: 'Cancelled', pending: 'Pending' };
  return map[s] || s;
}
function getFulfillmentLabel(s) {
  var map = { unfulfilled: 'Unfulfilled', partially_fulfilled: 'Partially fulfilled', fulfilled: 'Fulfilled', cancelled: 'Cancelled', on_hold: 'On hold' };
  return map[s] || s;
}
function paymentBadgeClass(s) {
  var map = { paid: 'badge-paid', partially_refunded: 'badge-partial-refund', refunded: 'badge-refunded', unpaid: 'badge-unpaid', cancelled: 'badge-cancelled' };
  return map[s] || 'badge-unpaid';
}
function fulfillmentBadgeClass(s) {
  var map = { fulfilled: 'badge-fulfilled', partially_fulfilled: 'badge-partial', unfulfilled: 'badge-unfulfilled', cancelled: 'badge-cancelled', on_hold: 'badge-hold' };
  return map[s] || 'badge-unfulfilled';
}
function riskBadgeClass(s) {
  var map = { low: 'badge-ok', medium: 'badge-low', high: 'badge-cancelled' };
  return map[s] || 'badge-ok';
}
function getOrderBadgesHtml(o) {
  var p = getPaymentStatus(o), f = getFulfillmentStatus(o);
  if (p === 'cancelled' && f === 'cancelled') {
    return '<span class="badge badge-cancelled"><i class="fa-solid fa-ban"></i> Cancelled</span>';
  }
  var r = '<span class="badge ' + paymentBadgeClass(p) + '" title="Payment status"><i class="fa-solid fa-money-bill-wave"></i> ' + getPaymentLabel(p) + '</span>';
  r += '<span class="badge ' + fulfillmentBadgeClass(f) + '" title="Fulfillment status"><i class="fa-solid fa-box"></i> ' + getFulfillmentLabel(f) + '</span>';
  if (o.riskLevel === 'high') r += '<span class="badge badge-cancelled"><i class="fa-solid fa-triangle-exclamation"></i> High risk</span>';
  else if (o.riskLevel === 'medium') r += '<span class="badge badge-low"><i class="fa-solid fa-triangle-exclamation"></i> Medium risk</span>';
  if (o.archived) r += '<span class="badge badge-draft"><i class="fa-solid fa-archive"></i> Archived</span>';
  return r;
}

// -- Order fetch with migration + persistence --
var _getOrdersSkipSync = false;
function getOrders() {
  var orders = getData('orders', []);
  var changed = false;
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    if (!o.paymentStatus || !o.fulfillmentStatus) {
      o.paymentStatus = getPaymentStatus(o);
      o.fulfillmentStatus = getFulfillmentStatus(o);
      changed = true;
    }
    if (o.status === 'cancelled' && (o.paymentStatus !== 'cancelled' || o.fulfillmentStatus !== 'cancelled')) {
      o.paymentStatus = 'cancelled';
      o.fulfillmentStatus = 'cancelled';
      changed = true;
    }
    if (!Array.isArray(o.timeline)) {
      o.timeline = [{
        id: newEventId(), action: 'created',
        details: 'Order ' + o.id + ' created',
        user: o.createdBy || 'System', timestamp: o.createdAt || new Date().toISOString()
      }];
      changed = true;
    }
    if (!Array.isArray(o.transactions)) o.transactions = [];
    if (!Array.isArray(o.fulfillments)) o.fulfillments = [];
    if (!Array.isArray(o.tags)) o.tags = [];
    if (!o.riskLevel) o.riskLevel = 'low';
    if (!o.updatedAt) { o.updatedAt = o.createdAt || new Date().toISOString(); changed = true; }
  }
  if (changed && !_getOrdersSkipSync) setData('orders', orders);
  return orders;
}

function saveOrders(orders) {
  var now = new Date().toISOString();
  for (var i = 0; i < orders.length; i++) {
    if (orders[i]) orders[i].updatedAt = orders[i].updatedAt || orders[i].createdAt || now;
  }
  setData('orders', orders);
}

function findOrder(id) {
  var orders = getOrders();
  for (var i = 0; i < orders.length; i++) if (orders[i].id === id) return orders[i];
  return null;
}

// -- Timeline helpers --
function addTimelineEvent(o, action, details) {
  if (!Array.isArray(o.timeline)) o.timeline = [];
  var u = getCurrentUser();
  o.timeline.unshift({
    id: newEventId(), action: action, details: details || '',
    user: u ? u.name : 'System', timestamp: new Date().toISOString()
  });
  return o;
}
function formatTimelineAction(action) {
  var map = {
    created: 'Order created', payment: 'Payment received', payment_marked: 'Payment marked as paid',
    capture: 'Payment captured', refund: 'Refund issued', cancelled: 'Order cancelled',
    fulfilled: 'Order fulfilled', shipped: 'Order shipped', delivered: 'Order delivered',
    note: 'Note added', staff_note: 'Staff note added', edited: 'Order edited',
    email_sent: 'Email sent', reminder: 'Reminder sent', recovered: 'Checkout recovered',
    tracking_added: 'Tracking added', duplicate: 'Order duplicated', archived: 'Order archived', restored: 'Order restored'
  };
  return map[action] || action;
}

// -- Transaction helpers --
function addOrderTransaction(o, type, amount, note) {
  if (!Array.isArray(o.transactions)) o.transactions = [];
  var u = getCurrentUser();
  o.transactions.unshift({
    id: newEventId(), type: type, amount: amount, note: note || '',
    user: u ? u.name : 'System', timestamp: new Date().toISOString()
  });
  return o;
}
function getOrderPaidAmount(o) {
  var paid = 0;
  (o.transactions || []).forEach(function (t) {
    if (t.type === 'payment' || t.type === 'capture') paid += (parseFloat(t.amount) || 0);
    if (t.type === 'refund') paid -= (parseFloat(t.amount) || 0);
  });
  return paid;
}

// -- Fulfillment helpers --
function addOrderFulfillment(o, carrier, tracking) {
  if (!Array.isArray(o.fulfillments)) o.fulfillments = [];
  o.fulfillments.unshift({
    id: newEventId(), carrier: carrier || '', tracking: tracking || '',
    timestamp: new Date().toISOString()
  });
  return o;
}

// -- Tag helpers --
function addOrderTag(o, tag) {
  tag = (tag || '').trim().replace(/^#/, '');
  if (!tag) return o;
  if (!Array.isArray(o.tags)) o.tags = [];
  if (o.tags.indexOf(tag) === -1) o.tags.push(tag);
  return o;
}
function removeOrderTag(o, tag) {
  if (!Array.isArray(o.tags)) return o;
  o.tags = o.tags.filter(function (t) { return t !== tag; });
  return o;
}
function renderTagsHtml(o, clickable) {
  var tags = getOrderTags(o);
  if (!tags.length) return '<span class="text-muted" style="font-size:12px;">No tags</span>';
  return tags.map(function (t) {
    return '<span class="order-tag"' + (clickable ? ' onclick="removeOrderTagById(\'' + escapeHtml(o.id) + '\',\'' + escapeHtml(t) + '\');return false;" title="Remove tag"' : '') + '>#' + escapeHtml(t) + '</span>';
  }).join(' ');
}
function getOrderTags(o) { return Array.isArray(o.tags) ? o.tags : []; }

// -- Bulk actions --
function bulkUpdateOrders(ids, updateFn) {
  var orders = getOrders();
  var changed = 0;
  for (var i = 0; i < orders.length; i++) {
    if (ids.indexOf(orders[i].id) !== -1) { updateFn(orders[i]); changed++; }
  }
  if (changed) saveOrders(orders);
  return changed;
}
function bulkSetStatus(ids, paymentStatus, fulfillmentStatus) {
  return bulkUpdateOrders(ids, function (o) {
    if (paymentStatus) { o.paymentStatus = paymentStatus; addTimelineEvent(o, paymentStatus === 'paid' ? 'payment_marked' : 'payment', 'Payment status set to ' + getPaymentLabel(paymentStatus)); }
    if (fulfillmentStatus) { o.fulfillmentStatus = fulfillmentStatus; addTimelineEvent(o, fulfillmentStatus === 'fulfilled' ? 'fulfilled' : 'shipped', 'Fulfillment status set to ' + getFulfillmentLabel(fulfillmentStatus)); }
  });
}

// -- CSV Export --
function exportOrdersCsv(orders) {
  var headers = ['Order ID', 'Date', 'Customer', 'Phone', 'Email', 'Items', 'Subtotal', 'Discount', 'Total', 'Payment Method', 'Payment Status', 'Fulfillment Status', 'Tags', 'Address'];
  var rows = orders.map(function (o) {
    var items = (o.items || []).map(function (i) { return i.name + ' x' + (i.qty || 1); }).join('; ');
    return [(o.orderNumber || o.id), o.createdAt, o.customerName, o.phone, o.email || '', items, o.subtotal || 0, o.discount || 0, o.total, o.paymentMethod || '', getPaymentLabel(getPaymentStatus(o)), getFulfillmentLabel(getFulfillmentStatus(o)), getOrderTags(o).join(', '), ((o.address || '') + ', ' + (o.city || '') + (o.landmark ? ', ' + o.landmark : ''))];
  });
  var csv = [headers].concat(rows).map(function (r) {
    return r.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(',');
  }).join('\r\n');
  var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'oms-orders-' + new Date().toISOString().split('T')[0] + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// -- Saved views --
function getSavedOrderViews() {
  var v = getData('orderViews', []);
  if (!Array.isArray(v)) v = [];
  return v;
}
function saveOrderView(name, filters) {
  var views = getSavedOrderViews();
  views.push({ id: 'VW' + Date.now().toString(36).toUpperCase(), name: name, filters: filters || {}, createdAt: new Date().toISOString() });
  setData('orderViews', views);
  return views;
}
function deleteOrderView(id) {
  setData('orderViews', getSavedOrderViews().filter(function (v) { return v.id !== id; }));
}

// -- Column prefs --
function getColumnPrefs() {
  var p = localStorage.getItem('taiva_orderColumns');
  try { return p ? JSON.parse(p) : null; } catch (e) { return null; }
}
function setColumnPrefs(prefs) { localStorage.setItem('taiva_orderColumns', JSON.stringify(prefs)); }

// -- Print --
function printOrderDoc(orderId, type) {
  window.open('orders-print.html?id=' + encodeURIComponent(orderId) + '&type=' + type, '_blank');
}

// -- Email notification (real via api.php sendOrderEmail) --
async function sendOrderNotification(order, template) {
  var mc = getMilesConfig();
  if (!mc || !mc.url) return { success: false, error: 'Milesweb not configured' };
  var settings = getData('settings', {});
  try {
    var url = mc.url + '?action=sendOrderEmail&token=' + encodeURIComponent(mc.token);
    var res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order: order, template: template || 'order_created',
        fromName: settings.emailFromName || 'OMS', fromEmail: settings.emailFrom || '', siteUrl: settings.siteUrl || ''
      })
    });
    var json = await res.json();
    if (json.success) {
      var templateLabels = { order_created: 'Order created', order_paid: 'Payment received', order_fulfilled: 'Order fulfilled', order_refunded: 'Refund issued', order_cancelled: 'Order cancelled', reminder: 'Reminder' };
      var label = templateLabels[template] || template || 'Order update';
      addTimelineEvent(order, 'email_sent', label + ' email sent to ' + (order.email || 'customer'));
    }
    return json;
  } catch (e) { return { success: false, error: e.message }; }
}

// -- Rollout status update for legacy orders on the fly --
function ensureOrderTimeline(o) {
  if (!Array.isArray(o.timeline) || o.timeline.length === 0) {
    o.timeline = [{
      id: newEventId(), action: 'created', details: 'Order ' + o.id + ' created',
      user: o.createdBy || 'System', timestamp: o.createdAt || new Date().toISOString()
    }];
  }
  return o;
}

// ---- GLOBAL SEARCH (topbar #globalSearch) ----
// Search orders by id/customer/phone/email from any page.
function initGlobalSearch() {
  var input = document.getElementById('globalSearch');
  if (!input) return;
  var wrap = input.closest('.topbar-search') || input.parentNode;
  var box = document.createElement('div');
  box.className = 'search-suggestions';
  box.id = 'globalSearchBox';
  wrap.appendChild(box);

  function matches(search) {
    return getOrders().filter(function (o) {
      var hay = (o.id + ' ' + (o.orderNumber || '') + ' ' + (o.customerName || '') + ' ' + (o.phone || '') + ' ' + (o.email || '')).toLowerCase();
      return hay.indexOf(search) !== -1;
    }).sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  }

  function renderDropdown() {
    var search = (input.value || '').replace(/^[#\s]+/, '').toLowerCase();
    if (!search) { box.classList.remove('open'); box.innerHTML = ''; return; }
    var list = matches(search).slice(0, 6);
    var html = '';
    if (list.length === 0) {
      html = '<div class="ss-empty">No orders found. Enter dabao to search all orders.</div>';
    } else {
      for (var i = 0; i < list.length; i++) {
        var o = list[i];
        html += '<div class="ss-item" onclick="window.location=\'orders-detail.html?id=' + encodeURIComponent(o.id) + '\'">' +
          '<span class="ss-id">' + escapeHtml(orderDisplayNo(o)) + '</span>' +
          '<span class="ss-meta">' + escapeHtml(o.customerName || '-') + ' &middot; ' + formatCurrency(o.total) + '</span>' +
          getOrderBadgesHtml(o) + '</div>';
      }
    }
    box.innerHTML = html;
    box.classList.add('open');
  }

  function hide() { box.classList.remove('open'); }

  function go() {
    var search = (input.value || '').replace(/^[#\s]+/, '').trim();
    if (!search) return;
    hide();
    var list = matches(search.toLowerCase());
    var exact = list.filter(function (o) { return o.id.toLowerCase() === search.toLowerCase(); });
    if (exact.length === 1) { window.location.href = 'orders-detail.html?id=' + encodeURIComponent(exact[0].id); return; }
    if (list.length === 1) { window.location.href = 'orders-detail.html?id=' + encodeURIComponent(list[0].id); return; }
    window.location.href = 'orders.html?search=' + encodeURIComponent(search);
  }

  input.addEventListener('input', renderDropdown);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') go();
    else if (e.key === 'Escape') hide();
  });
  document.addEventListener('mousedown', function (e) {
    if (wrap.contains(e.target)) return;
    if (box.contains(e.target)) return;
    hide();
  });
}

// ---- MOBILE PUSH (FCM via Capacitor) ----
function isNativeApp() {
  try {
    return !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
  } catch(e) { return false; }
}
function setupPushNotifications() {
  if (!isNativeApp()) return;
  try {
    var Push = window.Capacitor.Plugins.PushNotifications;
    if (!Push) return;
    Push.addListener('registration', function(data) {
      if (data && data.value) registerFcmToken(data.value);
    });
    Push.addListener('registrationError', function(err) {
      console.warn('Push registration error', err);
    });
    Push.addListener('notification', function(data) {
      try {
        if (data && data.notification) {
          showToast((data.notification.title || 'Notification') + (data.notification.body ? ' — ' + data.notification.body : ''), 'success');
        }
      } catch(e) {}
    });
    Push.checkPermissions().then(function(status) {
      if (status.receive === 'granted') {
        Push.register();
      } else {
        Push.requestPermissions().then(function(p) {
          if (p.receive === 'granted') Push.register();
        }).catch(function(){});
      }
    }).catch(function() {
      Push.requestPermissions().then(function(p) {
        if (p.receive === 'granted') Push.register();
      }).catch(function(){});
    });
  } catch(e) {}
}
async function registerFcmToken(fcmToken) {
  try {
    var mc = ensureMilesConfig();
    if (!mc || !mc.url || !mc.token || !fcmToken) return;
    var device = '';
    try { device = (navigator.userAgent || '').substring(0, 120); } catch(e) {}
    var url = mc.url + '?action=registerToken&token=' + encodeURIComponent(mc.token) + '&fcmToken=' + encodeURIComponent(fcmToken) + '&device=' + encodeURIComponent(device);
    var res = await fetch(url);
    var json = await res.json();
    if (json && json.success) {
      localStorage.setItem('taiva_fcmToken', fcmToken);
    }
  } catch(e) {}
}

// ---- CALLBACKS FOR PAGE SCRIPTS ----
// Each page can define its own initPage() function
document.addEventListener('DOMContentLoaded', function () {
  if (window.location.pathname.indexOf('index.html') === -1 && window.location.pathname !== '/') {
    requireAuth();
  }
  initTheme();
  initSidebar();
  updateSidebarBadge();
  applyRoleGate();
  seedInitialData();
  updateAvatarInitial();
  setupPushNotifications();
  initGlobalSearch();
  initNotifications();
  startRealtimeSync();
  // Restore last sync badge on sidebar if present
  var lastSync = getDriveLastSync();
  if (lastSync) {
    var el = document.getElementById('driveSyncStatus');
    if (el) { el.textContent = 'Last sync: ' + formatDateTime(lastSync); el.style.display = 'block'; }
  }
  if (typeof initPage === 'function') initPage();
});
