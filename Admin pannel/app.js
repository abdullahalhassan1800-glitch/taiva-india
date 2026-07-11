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
  // Auto-sync to Milesweb (primary)
  var mc = getMilesConfig();
  if (mc && mc.enabled && mc.url && mc.token && (mc.autoSync !== false)) {
    milesSave(key, data);
  }
  // Auto-sync to Sheets (secondary)
  var dc = getDriveConfig();
  if (dc && dc.enabled && dc.url && dc.token && (dc.autoSync !== false)) {
    driveSave(key, data);
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
function login(username, password) {
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
}
function logout() {
  sessionStorage.removeItem('taiva_admin');
  window.location.href = 'index.html';
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
  for (var i = 0; i < users.length; i++) {
    if (users[i].id === id) {
      for (var k in updates) users[i][k] = updates[k];
      saveUsers(users);
      return true;
    }
  }
  return false;
}
function deleteUser(id) {
  saveUsers(getUsers().filter(function(u) { return u.id !== id; }));
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
  var url = dc.url + '?action=save&key=' + encodeURIComponent(fullKey) + '&data=' + encodeURIComponent(JSON.stringify(payload)) + '&token=' + encodeURIComponent(dc.token);
  return driveGet(url).then(function(r){
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
  var keys = ['products','orders','settings','drafts','abandoned','collections','giftCards','purchaseOrders','transfers','segments','users'];
  // Save each key separately with base64 encoding (smaller URLs)
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
  var keys = ['products','orders','settings','drafts','abandoned','collections','giftCards','purchaseOrders','transfers','segments','users'];
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
  var keys = ['products','orders','settings','drafts','abandoned','collections','giftCards','purchaseOrders','transfers','segments','users'];
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
      div.innerHTML = '<span class="city-name">' + item.city + '</span><span class="city-meta">' + item.state + ' - ' + item.pincode + '</span>';
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
  document.querySelectorAll('.nav-role-restricted').forEach(function(el) {
    if (u.role !== 'super_admin') {
      el.style.display = 'none';
    }
  });
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

// ---- CALLBACKS FOR PAGE SCRIPTS ----
// Each page can define its own initPage() function
document.addEventListener('DOMContentLoaded', function () {
  if (window.location.pathname.indexOf('index.html') === -1 && window.location.pathname !== '/') {
    requireAuth();
  }
  initSidebar();
  applyRoleGate();
  seedInitialData();
  // Restore last sync badge on sidebar if present
  var lastSync = getDriveLastSync();
  if (lastSync) {
    var el = document.getElementById('driveSyncStatus');
    if (el) { el.textContent = 'Last sync: ' + formatDateTime(lastSync); el.style.display = 'block'; }
  }
  if (typeof initPage === 'function') initPage();
});
