/* app.js - Storefront Core State and UI Logic */

// Global Product Catalog
const PRODUCT_CATALOG = [
  {
    id: 'sugar-pro-max',
    name: 'Sugar Pro Max - Advanced Sugar Balance Formula',
    price: 1090.00,
    originalPrice: 1499.00,
    image: 'images/sugar-pro-max-1.jpg',
    link: 'diacurex-powder.html'
  },
  {
    id: 'pachan-pro',
    name: 'Pachan Pro - Ayurvedic Digestive Powder',
    price: 1090.00,
    originalPrice: 1499.00,
    image: 'images/pachan-pro-main.png',
    link: 'digestive-health.html'
  },
  {
    id: 'painopill',
    name: 'Painopill Tablets - Ayurvedic Joint Care',
    price: 1090.00,
    originalPrice: 1140.00,
    image: 'images/joint-care-main.png',
    link: 'joint-care.html'
  }
];

// Cart State (Persisted in LocalStorage)
let cart = JSON.parse(localStorage.getItem('taiva_cart')) || [];

document.addEventListener('DOMContentLoaded', () => {
  initHeaderScroll();
  initMobileMenu();
  initSearch();
  initCartDrawer();
  initHeroSlider();
  initReviewSlider();
  initAccordions();
  initFAQ();
  initQuantityControls();
  
  // Render initial cart indicators
  updateCartUI();
  
  // Renders pages if specific elements exist
  initSearchPage();
  initCartPage();
});

/* --- Header Scroll Effect --- */
function initHeaderScroll() {
  const header = document.querySelector('header');
  if (!header) return;
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });
}

/* --- Mobile Menu Drawer --- */
function initMobileMenu() {
  const menuBtn = document.querySelector('.menu-btn');
  const closeBtn = document.querySelector('.mobile-nav-close');
  const drawer = document.querySelector('.mobile-nav-drawer');
  const overlay = document.querySelector('.overlay');
  
  if (!menuBtn || !drawer || !overlay) return;
  
  menuBtn.addEventListener('click', () => {
    drawer.classList.add('open');
    overlay.classList.add('open');
  });
  
  const closeMenu = () => {
    drawer.classList.remove('open');
    if (!document.querySelector('.cart-drawer').classList.contains('open')) {
      overlay.classList.remove('open');
    }
  };
  
  closeBtn.addEventListener('click', closeMenu);
  overlay.addEventListener('click', closeMenu);
}

/* --- Search Overlay --- */
function initSearch() {
  const searchBtn = document.querySelector('.search-btn');
  const closeSearchBtn = document.querySelector('.search-close');
  const searchOverlay = document.querySelector('.search-overlay');
  const searchInput = document.querySelector('.search-overlay input');
  const overlay = document.querySelector('.overlay');
  
  if (!searchBtn || !searchOverlay || !overlay) return;
  
  searchBtn.addEventListener('click', () => {
    searchOverlay.classList.add('open');
    overlay.classList.add('open');
    setTimeout(() => searchInput.focus(), 200);
  });
  
  const closeSearch = () => {
    searchOverlay.classList.remove('open');
    if (!document.querySelector('.mobile-nav-drawer').classList.contains('open') && 
        !document.querySelector('.cart-drawer').classList.contains('open')) {
      overlay.classList.remove('open');
    }
  };
  
  if (closeSearchBtn) closeSearchBtn.addEventListener('click', closeSearch);
  overlay.addEventListener('click', closeSearch);
  
  // Search Submission
  const searchForm = document.querySelector('.search-container');
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = searchInput.value.trim();
      if (val) {
        window.location.href = `search.html?q=${encodeURIComponent(val)}`;
      }
    });
  }
}

/* --- Cart Drawer Logic --- */
function initCartDrawer() {
  const cartBtn = document.querySelector('.cart-btn');
  const closeCartBtn = document.querySelector('.cart-drawer-close');
  const cartDrawer = document.querySelector('.cart-drawer');
  const overlay = document.querySelector('.overlay');
  
  if (!cartBtn || !cartDrawer || !overlay) return;
  
  cartBtn.addEventListener('click', (e) => {
    e.preventDefault();
    openCartDrawer();
  });
  
  const closeCart = () => {
    cartDrawer.classList.remove('open');
    if (!document.querySelector('.mobile-nav-drawer').classList.contains('open')) {
      overlay.classList.remove('open');
    }
  };
  
  if (closeCartBtn) closeCartBtn.addEventListener('click', closeCart);
  overlay.addEventListener('click', closeCart);
}

function openCartDrawer() {
  const cartDrawer = document.querySelector('.cart-drawer');
  const overlay = document.querySelector('.overlay');
  if (cartDrawer && overlay) {
    cartDrawer.classList.add('open');
    overlay.classList.add('open');
    renderCartItems();
  }
}

/* --- Cart state modifier functions --- */
function addToCart(productId, qty = 1, customPrice) {
  const product = PRODUCT_CATALOG.find(p => p.id === productId);
  if (!product) return;
  
  const price = customPrice || product.price;
  const existingItemIndex = cart.findIndex(item => item.id === productId);
  if (existingItemIndex > -1) {
    cart[existingItemIndex].qty += qty;
    cart[existingItemIndex].price = price;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: price,
      image: product.image,
      link: product.link,
      qty: qty
    });
  }
  
  saveCart();
  updateCartUI();
  openCartDrawer();
}

function updateCartQty(productId, delta) {
  const index = cart.findIndex(item => item.id === productId);
  if (index === -1) return;
  
  cart[index].qty += delta;
  if (cart[index].qty <= 0) {
    cart.splice(index, 1);
  } else {
    const product = PRODUCT_CATALOG.find(p => p.id === productId);
    if (product) {
      cart[index].price = cart[index].qty >= 2 ? 980 : product.price;
    }
  }
  
  saveCart();
  updateCartUI();
  renderCartItems();
  
  // Also update the full cart page if we are on it
  if (document.querySelector('.cart-page-container')) {
    renderCartPageItems();
  }
}

function removeFromCart(productId) {
  cart = cart.filter(item => item.id !== productId);
  saveCart();
  updateCartUI();
  renderCartItems();
  
  // Also update the full cart page if we are on it
  if (document.querySelector('.cart-page-container')) {
    renderCartPageItems();
  }
}

function saveCart() {
  localStorage.setItem('taiva_cart', JSON.stringify(cart));
}

function updateCartUI() {
  // Update header badges
  const totalCount = cart.reduce((total, item) => total + item.qty, 0);
  const badges = document.querySelectorAll('.cart-count');
  badges.forEach(badge => {
    badge.textContent = totalCount;
  });
}

function renderCartItems() {
  const container = document.querySelector('.cart-drawer-items');
  const footer = document.querySelector('.cart-drawer-footer');
  if (!container) return;
  
  if (cart.length === 0) {
    container.innerHTML = `
      <div class="cart-drawer-empty">
        <i class="fa-solid fa-bag-shopping"></i>
        <p>Your cart is empty</p>
        <a href="index.html" class="btn btn-secondary" style="margin-top: 16px;">Shop Our Products</a>
      </div>
    `;
    if (footer) footer.style.display = 'none';
    return;
  }
  
  if (footer) footer.style.display = 'block';
  
  let html = '';
  cart.forEach(item => {
    html += `
      <div class="cart-item">
        <div class="cart-item-img">
          <img src="${item.image}" alt="${item.name}">
        </div>
        <div class="cart-item-details">
          <h4 class="cart-item-title">${item.name}</h4>
          <div class="cart-item-price">₹${(item.price * item.qty).toLocaleString('en-IN')}.00</div>
          <div class="cart-item-controls">
            <div class="qty-selector">
              <button class="qty-btn" onclick="updateCartQty('${item.id}', -1)"><i class="fa-solid fa-minus"></i></button>
              <span class="qty-val">${item.qty}</span>
              <button class="qty-btn" onclick="updateCartQty('${item.id}', 1)"><i class="fa-solid fa-plus"></i></button>
            </div>
            <button class="cart-item-remove" onclick="removeFromCart('${item.id}')">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
  
  // Calculate Subtotal
  const subtotal = cart.reduce((total, item) => total + (item.price * item.qty), 0);
  const subtotalElement = document.querySelector('.cart-subtotal-val');
  if (subtotalElement) {
    subtotalElement.textContent = `₹${subtotal.toLocaleString('en-IN')}.00`;
  }
}

/* --- Hero Banner Slider --- */
function initHeroSlider() {
  const track = document.querySelector('.hero-slider .slides-track');
  const slides = document.querySelectorAll('.hero-slider .slide');
  if (slides.length === 0 || !track) return;
  
  let currentIdx = 0;
  let startX = 0;
  let isDragging = false;
  const prevBtn = document.querySelector('.slider-btn.prev');
  const nextBtn = document.querySelector('.slider-btn.next');
  const counterVal = document.querySelector('.slider-counter-val');
  
  const updateSlider = (index) => {
    currentIdx = (index + slides.length) % slides.length;
    track.style.transform = `translateX(-${currentIdx * 100}%)`;
    if (counterVal) {
      counterVal.textContent = `${currentIdx + 1} / ${slides.length}`;
    }
  };
  
  if (nextBtn) {
    nextBtn.addEventListener('click', () => updateSlider(currentIdx + 1));
  }
  if (prevBtn) {
    prevBtn.addEventListener('click', () => updateSlider(currentIdx - 1));
  }
  
  // Touch / swipe support
  const slider = document.querySelector('.hero-slider');
  slider.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    isDragging = true;
  }, { passive: true });
  
  slider.addEventListener('touchend', (e) => {
    if (!isDragging) return;
    isDragging = false;
    const endX = e.changedTouches[0].clientX;
    const diff = startX - endX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) updateSlider(currentIdx + 1);
      else updateSlider(currentIdx - 1);
    }
  }, { passive: true });
  
  // Auto slide change
  setInterval(() => {
    updateSlider(currentIdx + 1);
  }, 7000);
}

/* --- Testimonial Slider --- */
function initReviewSlider() {
  const track = document.querySelector('.reviews-track');
  const cards = document.querySelectorAll('.review-card');
  const dotsContainer = document.querySelector('.reviews-dots');
  const prevBtn = document.querySelector('.review-arrow-left');
  const nextBtn = document.querySelector('.review-arrow-right');
  if (!track || cards.length === 0 || !dotsContainer) return;

  let currentIdx = 0;

  function getPerView() {
    return window.innerWidth < 500 ? 1 : window.innerWidth < 768 ? 2 : 3;
  }

  function getMaxIdx(pv) {
    return Math.max(0, cards.length - pv);
  }

  let perView = getPerView();
  let maxIdx = getMaxIdx(perView);

  // Create dots
  function buildDots(pv) {
    dotsContainer.innerHTML = '';
    const totalDots = Math.ceil(cards.length / pv);
    for (let i = 0; i < totalDots; i++) {
      const dot = document.createElement('span');
      dot.className = i === 0 ? 'active' : '';
      dot.addEventListener('click', () => goTo(i * pv));
      dotsContainer.appendChild(dot);
    }
    return dotsContainer.querySelectorAll('span');
  }

  let dots = buildDots(perView);

  function goTo(index) {
    currentIdx = Math.max(0, Math.min(index, maxIdx));
    const gap = parseFloat(window.getComputedStyle(track).gap) || 24;
    const offset = (cards[0].offsetWidth + gap) * currentIdx;
    track.style.transform = `translateX(-${offset}px)`;
    dots.forEach(d => d.classList.remove('active'));
    const dotIdx = Math.floor(currentIdx / perView);
    if (dots[dotIdx]) dots[dotIdx].classList.add('active');
  }

  if (prevBtn) prevBtn.addEventListener('click', () => goTo(currentIdx - perView));
  if (nextBtn) nextBtn.addEventListener('click', () => goTo(currentIdx + perView));

  let autoSlide = setInterval(() => {
    const next = currentIdx + perView;
    if (next > maxIdx) goTo(0);
    else goTo(next);
  }, 5000);

  // Recalculate on resize
  window.addEventListener('resize', () => {
    clearInterval(autoSlide);
    perView = getPerView();
    maxIdx = getMaxIdx(perView);
    currentIdx = 0;
    dots = buildDots(perView);
    goTo(0);
    autoSlide = setInterval(() => {
      const next = currentIdx + perView;
      if (next > maxIdx) goTo(0);
      else goTo(next);
    }, 5000);
  });
}

/* --- Product Accordions --- */
function initAccordions() {
  const headers = document.querySelectorAll('.accordion-header');
  headers.forEach(header => {
    header.addEventListener('click', () => {
      const item = header.parentElement;
      const isActive = item.classList.contains('active');
      
      // Close other accordions
      document.querySelectorAll('.accordion-item').forEach(i => i.classList.remove('active'));
      
      if (!isActive) {
        item.classList.add('active');
      }
    });
  });
}

/* --- FAQ Accordion --- */
function initFAQ() {
  const faqHeaders = document.querySelectorAll('.faq-header');
  faqHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const item = header.parentElement;
      const isActive = item.classList.contains('active');
      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));
      if (!isActive) {
        item.classList.add('active');
      }
    });
  });
}

/* --- Quantity Selectors on Product Detail Pages --- */
function initQuantityControls() {
  const control = document.querySelector('.qty-control');
  if (!control) return;
  
  const minus = control.querySelector('.qty-btn.minus');
  const plus = control.querySelector('.qty-btn.plus');
  const val = control.querySelector('.qty-val');
  
  if (!minus || !plus || !val) return;
  
  function updatePrice(qty) {
    const priceEl = document.querySelector('.price-current');
    if (!priceEl || !priceEl.dataset.basePrice) return;
    const base = parseFloat(priceEl.dataset.basePrice);
    let total;
    if (qty === 1) total = base;
    else total = 980 * qty;
    priceEl.textContent = total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  
  minus.addEventListener('click', () => {
    let current = parseInt(val.textContent);
    if (current > 1) {
      current--;
      val.textContent = current;
      updatePrice(current);
    }
  });
  
  plus.addEventListener('click', () => {
    let current = parseInt(val.textContent);
    current++;
    val.textContent = current;
    updatePrice(current);
    if (current === 2) showPartyPopup();
  });
  
  // Bind direct Add to Cart click on product pages
  const addBtn = document.querySelector('.add-to-cart-action');
  if (addBtn) {
    addBtn.addEventListener('click', (e) => {
      const pid = e.target.dataset.productId;
      const count = parseInt(val.textContent);
      const usePrice = count >= 2 ? 980 : undefined;
      addToCart(pid, count, usePrice);
    });
  }
}

/* --- Search Page Handling --- */
function initSearchPage() {
  const resultsContainer = document.getElementById('search-results-grid');
  const queryHeading = document.getElementById('search-query-text');
  if (!resultsContainer) return;
  
  const params = new URLSearchParams(window.location.search);
  const q = params.get('q') || '';
  
  if (queryHeading) {
    queryHeading.textContent = `Search results for: "${q}"`;
  }
  
  const queryLower = q.toLowerCase().trim();
  const matches = PRODUCT_CATALOG.filter(p => 
    p.name.toLowerCase().includes(queryLower) || 
    p.id.toLowerCase().includes(queryLower)
  );
  
  if (matches.length === 0) {
    resultsContainer.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px 0;">
        <i class="fa-solid fa-magnifying-glass" style="font-size: 3rem; color: var(--border-color); margin-bottom: 16px;"></i>
        <p>No products found matching "${q}".</p>
        <a href="index.html" class="btn" style="margin-top: 16px;">Back to Shop</a>
      </div>
    `;
    return;
  }
  
  let html = '';
  matches.forEach(p => {
    const discount = Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100);
    html += `
      <div class="product-card">
        <span class="product-tag">${discount}% OFF</span>
        <div class="product-image-container">
          <a href="${p.link}">
            <img src="${p.image}" alt="${p.name}">
          </a>
        </div>
        <div class="product-info">
          <div class="product-stars">
            <i class="fa-solid fa-star"></i>
            <i class="fa-solid fa-star"></i>
            <i class="fa-solid fa-star"></i>
            <i class="fa-solid fa-star"></i>
            <i class="fa-solid fa-star"></i>
            <span>(4.9)</span>
          </div>
          <h3 class="product-title"><a href="${p.link}">${p.name}</a></h3>
          <div class="product-price">
            <span class="price-current">${p.price.toLocaleString('en-IN')}.00</span>
            <span class="price-original">${p.originalPrice.toLocaleString('en-IN')}.00</span>
          </div>
          <div class="product-action">
            <button class="btn btn-full" onclick="addToCart('${p.id}')">Add to Cart</button>
          </div>
        </div>
      </div>
    `;
  });
  
  resultsContainer.innerHTML = html;
}

/* --- Cart Page Handling --- */
function initCartPage() {
  const container = document.querySelector('.cart-page-container');
  if (!container) return;
  
  renderCartPageItems();
}

function renderCartPageItems() {
  const itemsContainer = document.getElementById('cart-items-list');
  const summaryBox = document.querySelector('.cart-summary-box');
  
  if (!itemsContainer) return;
  
  if (cart.length === 0) {
    itemsContainer.innerHTML = `
      <div style="text-align: center; padding: 40px 0;">
        <i class="fa-solid fa-cart-shopping" style="font-size: 3rem; color: var(--border-color); margin-bottom: 16px;"></i>
        <p style="margin-bottom: 20px;">Your shopping cart is currently empty.</p>
        <a href="index.html" class="btn">Continue Shopping</a>
      </div>
    `;
    if (summaryBox) summaryBox.style.display = 'none';
    return;
  }
  
  if (summaryBox) summaryBox.style.display = 'block';
  
  let html = '';
  cart.forEach(item => {
    html += `
      <div class="cart-item" style="border-bottom: 1px solid var(--border-color); padding: 20px 0; gap: 24px;">
        <div class="cart-item-img" style="width: 100px; height: 100px;">
          <img src="${item.image}" alt="${item.name}">
        </div>
        <div class="cart-item-details">
          <h4 class="cart-item-title" style="font-size: 1.05rem; margin-bottom: 8px;"><a href="${item.link}">${item.name}</a></h4>
          <div class="cart-item-price" style="font-size: 1rem; margin-bottom: 12px;">₹${(item.price * item.qty).toLocaleString('en-IN')}.00</div>
          <div class="cart-item-controls">
            <div class="qty-selector">
              <button class="qty-btn" onclick="updateCartQty('${item.id}', -1)"><i class="fa-solid fa-minus"></i></button>
              <span class="qty-val">${item.qty}</span>
              <button class="qty-btn" onclick="updateCartQty('${item.id}', 1)"><i class="fa-solid fa-plus"></i></button>
            </div>
            <button class="cart-item-remove" onclick="removeFromCart('${item.id}')">
              <i class="fa-regular fa-trash-can" style="margin-right: 6px;"></i> Remove
            </button>
          </div>
        </div>
      </div>
    `;
  });
  
  itemsContainer.innerHTML = html;
  
  // Calculate Totals
  const subtotal = cart.reduce((total, item) => total + (item.price * item.qty), 0);
  const total = subtotal; // Simulating free shipping
  
  const subtotalElement = document.getElementById('cart-subtotal-price');
  const totalElement = document.getElementById('cart-total-price');
  
  if (subtotalElement) subtotalElement.textContent = `₹${subtotal.toLocaleString('en-IN')}.00`;
  if (totalElement) totalElement.textContent = `₹${total.toLocaleString('en-IN')}.00`;
}

/* --- Party Popup for Qty 2 --- */
function showPartyPopup() {
  const existing = document.querySelector('.party-popup');
  if (existing) existing.remove();

  // Fire confetti
  if (typeof confetti === 'function') {
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    setTimeout(() => confetti({ particleCount: 50, spread: 100, origin: { y: 0.5 } }), 200);
  }

  const popup = document.createElement('div');
  popup.className = 'party-popup';
  popup.innerHTML = `
    <div class="party-overlay"></div>
    <div class="party-content">
      <button class="party-close"><i class="fa-solid fa-xmark"></i></button>
      <div class="party-emoji">🎉</div>
      <h3>Bundle Deal Activated!</h3>
      <p>Get 2 for just ₹1,960 <span style="color: var(--primary-color); font-weight:600;">(Save ₹220)</span></p>
    </div>
  `;
  document.body.appendChild(popup);
  setTimeout(() => popup.classList.add('active'), 10);
  popup.querySelector('.party-close').addEventListener('click', () => {
    popup.classList.remove('active');
    setTimeout(() => popup.remove(), 400);
  });
  setTimeout(() => {
    popup.classList.remove('active');
    setTimeout(() => popup.remove(), 400);
  }, 4000);
}

/* --- Checkout Modal --- */
function openCheckout() {
  const existing = document.querySelector('.checkout-modal');
  if (existing) existing.remove();

  if (cart.length === 0) {
    alert('Your cart is empty!');
    return;
  }

  let step = 1;
  const subtotal = cart.reduce((t, i) => t + (i.price * i.qty), 0);

  const modal = document.createElement('div');
  modal.className = 'checkout-modal';
  modal.innerHTML = `
    <div class="checkout-overlay"></div>
    <div class="checkout-box">
      <button class="checkout-close"><i class="fa-solid fa-xmark"></i></button>
      <div class="checkout-steps">
        <span class="checkout-step active" data-step="1">1. Shipping</span>
        <span class="checkout-step" data-step="2">2. Payment</span>
      </div>
      <div class="checkout-body">
        <div class="checkout-form step-1">
          <h3>Shipping Details</h3>
          <input type="text" placeholder="Full Name" required class="co-input" id="co-name">
          <input type="tel" placeholder="Phone Number" required class="co-input" id="co-phone">
          <input type="email" placeholder="Email Address" class="co-input" id="co-email">
          <textarea placeholder="Address" required class="co-input" id="co-address" rows="2"></textarea>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <input type="text" placeholder="City" required class="co-input" id="co-city">
            <input type="text" placeholder="Pincode" required class="co-input" id="co-pincode">
          </div>
          <button class="btn btn-full btn-next" onclick="nextStep()" style="margin-top:16px">Continue to Payment</button>
        </div>
        <div class="checkout-form step-2" style="display:none">
          <h3>Payment Method</h3>
          <label class="co-radio"><input type="radio" name="payment" value="cod" checked onchange="toggleQR()"><span>Cash on Delivery</span></label>
          <label class="co-radio"><input type="radio" name="payment" value="upi" onchange="toggleQR()"><span>UPI (GPay / PhonePe / Paytm)</span></label>
          <label class="co-radio"><input type="radio" name="payment" value="card" onchange="toggleQR()"><span>Credit / Debit Card</span></label>
          <div class="co-qr-area" style="display:none">
            <img src="assets/images/upi-qr.png" alt="UPI QR Code" onerror="this.style.display='none'">
            <p>Scan with any UPI app</p>
            <label class="co-confirm-pay" style="display:flex;align-items:center;gap:8px;margin-top:12px;font-size:0.9rem;cursor:pointer">
              <input type="checkbox" id="co-pay-confirm" onchange="togglePlaceOrderBtn()">
              I have completed the payment
            </label>
          </div>
          <p style="font-size:0.8rem;color:var(--text-muted);margin:8px 0 0;text-align:center">Place Order will be enabled after payment is successful</p>
          <div style="margin-top:12px;padding:16px;background:var(--bg-light);border-radius:8px">
            <p style="margin:0;font-size:0.9rem">Order Total: <strong style="font-size:1.2rem;color:var(--primary-color)">₹${subtotal.toLocaleString('en-IN')}.00</strong></p>
          </div>
          <button class="btn btn-accent btn-full" id="co-place-order" onclick="placeOrder()" style="margin-top:20px" disabled>Place Order</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add('active'), 10);

  modal.querySelector('.checkout-close').onclick = () => closeCheckout();
  modal.querySelector('.checkout-overlay').onclick = () => closeCheckout();
}

function toggleQR() {
  const qr = document.querySelector('.co-qr-area');
  if (!qr) return;
  const upi = document.querySelector('input[name="payment"][value="upi"]');
  const cod = document.querySelector('input[name="payment"][value="cod"]');
  qr.style.display = upi && upi.checked ? 'block' : 'none';
  togglePlaceOrderBtn();
}

function togglePlaceOrderBtn() {
  const btn = document.getElementById('co-place-order');
  if (!btn) return;
  const upi = document.querySelector('input[name="payment"][value="upi"]');
  const chk = document.getElementById('co-pay-confirm');
  if (upi && upi.checked) {
    btn.disabled = !(chk && chk.checked);
  } else {
    btn.disabled = false;
  }
}

function closeCheckout() {
  const modal = document.querySelector('.checkout-modal');
  if (!modal) return;
  modal.classList.remove('active');
  setTimeout(() => modal.remove(), 300);
}

function nextStep() {
  const name = document.getElementById('co-name').value.trim();
  const phone = document.getElementById('co-phone').value.trim();
  const address = document.getElementById('co-address').value.trim();
  const city = document.getElementById('co-city').value.trim();
  const pincode = document.getElementById('co-pincode').value.trim();

  if (!name || !phone || !address || !city || !pincode) {
    alert('Please fill in all required fields.');
    return;
  }

  document.querySelector('.step-1').style.display = 'none';
  document.querySelector('.step-2').style.display = 'block';
  document.querySelectorAll('.checkout-step').forEach(s => s.classList.remove('active'));
  document.querySelector('.checkout-step[data-step="2"]').classList.add('active');
}

function placeOrder() {
  const payment = document.querySelector('input[name="payment"]:checked');
  const method = payment ? payment.value : 'cod';
  const methods = { cod: 'Cash on Delivery', upi: 'UPI', card: 'Card' };

  // Fire confetti
  if (typeof confetti === 'function') {
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
    setTimeout(() => confetti({ particleCount: 80, spread: 60, origin: { y: 0.4, x: 0.3 } }), 200);
    setTimeout(() => confetti({ particleCount: 80, spread: 60, origin: { y: 0.4, x: 0.7 } }), 400);
  }

  // Show success
  const body = document.querySelector('.checkout-body');
  body.innerHTML = `
    <div style="text-align:center;padding:40px 20px">
      <div style="font-size:3rem;margin-bottom:16px">✅</div>
      <h3 style="color:var(--primary-color);margin-bottom:8px">Order Placed Successfully!</h3>
      <p style="color:var(--text-muted);margin-bottom:4px">Payment: ${methods[method] || 'COD'}</p>
      <p style="color:var(--text-muted);font-size:0.85rem">Thank you for shopping with Taiva!</p>
    </div>
  `;
  document.querySelectorAll('.checkout-step').forEach(s => s.classList.remove('active'));

  // Clear cart
  cart = [];
  saveCart();
  updateCartUI();

  setTimeout(() => closeCheckout(), 4000);
}
