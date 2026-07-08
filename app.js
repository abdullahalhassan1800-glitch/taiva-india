var cartItems = [];

document.addEventListener('DOMContentLoaded', function () {

  /* ===== MOBILE MENU ===== */
  const menuBtn = document.querySelector('.mobile-menu-btn');
  const mobileMenu = document.getElementById('mobileMenu');
  const menuOverlay = document.querySelector('.mobile-menu-overlay');
  const menuClose = document.querySelector('.mobile-menu-close');

  function openMenu() {
    mobileMenu.classList.add('active');
    menuOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    mobileMenu.classList.remove('active');
    menuOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  if (menuBtn) menuBtn.addEventListener('click', openMenu);
  if (menuClose) menuClose.addEventListener('click', closeMenu);
  if (menuOverlay) menuOverlay.addEventListener('click', closeMenu);

  /* ===== MOBILE SUBMENU ===== */
  const hasSubmenu = document.querySelectorAll('.has-submenu');
  hasSubmenu.forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      const submenu = this.nextElementSibling;
      if (submenu && submenu.classList.contains('mobile-submenu')) {
        submenu.classList.toggle('open');
        const icon = this.querySelector('.fa-angle-right');
        if (icon) {
          icon.style.transform = submenu.classList.contains('open') ? 'rotate(90deg)' : '';
        }
      }
    });
  });

  /* ===== HERO SWIPER ===== */
  const heroSwiper = new Swiper('.heroSwiper', {
    loop: true,
    speed: 400,
    autoplay: false,
    pagination: {
      el: '.hero-section .swiper-pagination',
      clickable: true,
    },
    navigation: {
      nextEl: '.hero-section .swiper-button-next',
      prevEl: '.hero-section .swiper-button-prev',
    },
  });

  /* ===== HERO VIDEO SOUND TOGGLE ===== */
  document.querySelector('.hero-section').addEventListener('click', function (e) {
    const btn = e.target.closest('.hero-sound-toggle');
    if (!btn) return;
    const slide = btn.closest('.hero-slide');
    const video = slide && slide.querySelector('video');
    if (!video) return;
    video.muted = !video.muted;
    btn.innerHTML = video.muted ? '&#128263;' : '&#128266;';
  });

  /* ===== HERO VIDEO PAUSE ON SWIPE ===== */
  heroSwiper.on('slideChangeTransitionStart', function () {
    document.querySelectorAll('.hero-section video').forEach(function (v) {
      v.pause();
    });
  });
  heroSwiper.on('slideChangeTransitionEnd', function () {
    const activeSlide = document.querySelector('.hero-section .swiper-slide-active');
    const video = activeSlide && activeSlide.querySelector('video');
    if (video) video.play();
  });

  /* ===== TESTIMONIAL SWIPER ===== */
  new Swiper('.testimonialSwiper', {
    loop: true,
    slidesPerView: 1,
    spaceBetween: 20,
    autoplay: {
      delay: 4000,
      disableOnInteraction: false,
    },
    pagination: {
      el: '.testimonials-section .swiper-pagination',
      clickable: true,
    },
    navigation: {
      nextEl: '.testimonials-section .swiper-button-next',
      prevEl: '.testimonials-section .swiper-button-prev',
    },
    breakpoints: {
      768: { slidesPerView: 2 },
      1024: { slidesPerView: 3 },
    },
  });

  /* ===== CART STATE ===== */
  var cartCountNum = 0;
  var cartCountEl = document.querySelector('.cart-count');
  var cartTotalEl = document.getElementById('cartTotal');
  var cartBody = document.getElementById('cartBody');
  var cartItemsContainer = document.getElementById('cartItems');
  var cartEmpty = document.getElementById('cartEmpty');
  var fbtSection = document.getElementById('fbtSection');

  function updateCartUI() {
    cartCountNum = cartItems.length;
    if (cartCountEl) cartCountEl.textContent = cartCountNum;

    var total = 0;
    cartItems.forEach(function (item) { total += item.price; });
    if (cartTotalEl) cartTotalEl.textContent = 'Rs. ' + total.toLocaleString('en-IN');

    if (cartItems.length === 0) {
      if (cartEmpty) cartEmpty.style.display = '';
      if (cartItemsContainer) cartItemsContainer.innerHTML = '';
      if (fbtSection) fbtSection.style.display = 'none';
      return;
    }
    if (cartEmpty) cartEmpty.style.display = 'none';
    if (fbtSection) fbtSection.style.display = 'block';

    var html = '';
    cartItems.forEach(function (item, idx) {
      html += '<div class="cart-item" data-index="' + idx + '">' +
        '<img src="' + item.image + '" alt="' + item.name + '" loading="lazy">' +
        '<div class="cart-item-info">' +
          '<span class="ci-name">' + item.name + '</span>' +
          '<span class="ci-price">Rs. ' + item.price.toLocaleString('en-IN') + '</span>' +
        '</div>' +
        '<button class="cart-item-remove" data-index="' + idx + '"><i class="fa-solid fa-trash-can"></i></button>' +
      '</div>';
    });
    if (cartItemsContainer) cartItemsContainer.innerHTML = html;

    document.querySelectorAll('.cart-item-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(this.getAttribute('data-index'));
        cartItems.splice(idx, 1);
        updateCartUI();
      });
    });
  }

  // Initial UI sync
  updateCartUI();

  function addToCart(productName, price, image) {
    cartItems.push({ name: productName, price: price, image: image });
    updateCartUI();
    openCartDrawer();
  }

  /* ===== ADD TO CART BUTTONS (product cards) ===== */
  document.querySelectorAll('.add-to-cart').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var card = this.closest('.product-card');
      var name = card ? card.querySelector('h3')?.textContent?.trim() : 'Product';
      var priceText = card ? card.querySelector('.current-price')?.textContent?.trim() : '0';
      var image = card ? card.querySelector('.product-image img')?.src : '';
      var m = priceText.match(/[\d,]+/);
      var price = m ? parseInt(m[0].replace(/,/g, '')) : 0;

      addToCart(name, price, image);

      var orig = this.textContent;
      this.textContent = 'Added!';
      this.style.background = '#198754';
      this.style.color = '#fff';
      this.style.borderColor = '#198754';
      var self = this;
      setTimeout(function () {
        self.textContent = orig;
        self.style.background = '';
        self.style.color = '';
        self.style.borderColor = '';
      }, 1500);
    });
  });

  /* ===== CART DRAWER OPEN/CLOSE ===== */
  var cartDrawer = document.getElementById('cartDrawer');
  var cartOverlay = document.getElementById('cartOverlay');
  var cartOpenBtn = document.getElementById('cartOpen');
  var cartCloseBtn = document.getElementById('cartClose');

  function openCartDrawer() {
    if (cartDrawer) cartDrawer.classList.add('open');
    if (cartOverlay) cartOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeCartDrawer() {
    if (cartDrawer) cartDrawer.classList.remove('open');
    if (cartOverlay) cartOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  if (cartOpenBtn) cartOpenBtn.addEventListener('click', openCartDrawer);
  if (cartCloseBtn) cartCloseBtn.addEventListener('click', closeCartDrawer);
  if (cartOverlay) cartOverlay.addEventListener('click', closeCartDrawer);

  /* ===== OFTEN BOUGHT TOGETHER ADD ===== */
  document.querySelectorAll('.fbt-add-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = this.closest('.fbt-item');
      var name = item.getAttribute('data-name');
      var price = parseInt(item.getAttribute('data-price'));
      var image = item.getAttribute('data-image');

      cartItems.push({ name: name, price: price, image: image });
      updateCartUI();

      this.textContent = 'Added';
      this.classList.add('added');
      var self = this;
      setTimeout(function () {
        self.textContent = 'Add';
        self.classList.remove('added');
      }, 1500);
    });
  });

  /* ===== ANNOUNCEMENT BAR DUPLICATE FOR INFINITE SCROLL ===== */
  const announceSlide = document.querySelector('.announcement-slide');
  if (announceSlide) {
    const clone = announceSlide.cloneNode(true);
    announceSlide.parentElement.appendChild(clone);
  }

  /* ===== NEWSLETTER FORM ===== */
  const newsletterForm = document.querySelector('.newsletter-form');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const input = this.querySelector('input');
      if (input && input.value.trim()) {
        this.innerHTML = '<p style="color:#fff;font-size:16px;">Thank you for subscribing!</p>';
      }
    });
  }

  /* ===== HERO VIDEO SOUND TOGGLE (fallback) ===== */
  const heroVideo = document.getElementById('heroVideo');
  const soundToggle = document.getElementById('soundToggle');
  if (heroVideo && soundToggle) {
    soundToggle.addEventListener('click', function () {
      if (heroVideo.muted) {
        heroVideo.muted = false;
        heroVideo.volume = 0.5;
        this.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
      } else {
        heroVideo.muted = true;
        this.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
      }
    });
  }
});

/* ===== CHECKOUT MODAL (global) ===== */
function openCheckout() {
  var existing = document.querySelector('.checkout-modal');
  if (existing) existing.remove();

  if (cartItems.length === 0) {
    var stored = localStorage.getItem('taiva_cart');
    if (stored) {
      var storedCart = JSON.parse(stored);
      storedCart.forEach(function (item) {
        cartItems.push({
          name: item.name,
          price: item.price * (item.qty || 1),
          image: item.image
        });
      });
    }
  }

  if (cartItems.length === 0) {
    alert('Your cart is empty!');
    return;
  }

  var subtotal = cartItems.reduce(function (t, item) { return t + item.price; }, 0);

  var modal = document.createElement('div');
  modal.className = 'checkout-modal';
  modal.innerHTML =
    '<div class="checkout-overlay"></div>' +
    '<div class="checkout-box">' +
      '<button class="checkout-close"><i class="fa-solid fa-xmark"></i></button>' +
      '<div class="checkout-steps">' +
        '<span class="checkout-step active" data-step="1">1. Shipping</span>' +
        '<span class="checkout-step" data-step="2">2. Payment</span>' +
      '</div>' +
      '<div class="checkout-body">' +
        '<div class="checkout-form step-1">' +
          '<h3>Shipping Details</h3>' +
          '<input type="text" placeholder="Full Name" required class="co-input" id="co-name">' +
          '<input type="tel" placeholder="Phone Number" required class="co-input" id="co-phone">' +
          '<input type="email" placeholder="Email Address" class="co-input" id="co-email">' +
          '<textarea placeholder="Address" required class="co-input" id="co-address" rows="2"></textarea>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
            '<input type="text" placeholder="City" required class="co-input" id="co-city">' +
            '<input type="text" placeholder="Pincode" required class="co-input" id="co-pincode">' +
          '</div>' +
          '<button class="btn btn-full btn-next" onclick="nextStep()" style="margin-top:16px">Continue to Payment</button>' +
        '</div>' +
        '<div class="checkout-form step-2" style="display:none">' +
          '<h3>Payment Method</h3>' +
          '<label class="co-radio"><input type="radio" name="payment" value="cod" checked onchange="toggleQR()"><span>Cash on Delivery</span></label>' +
          '<label class="co-radio"><input type="radio" name="payment" value="upi" onchange="toggleQR()"><span>UPI (GPay / PhonePe / Paytm)</span></label>' +
          '<label class="co-radio"><input type="radio" name="payment" value="card" onchange="toggleQR()"><span>Credit / Debit Card</span></label>' +
          '<div class="co-qr-area" style="display:none">' +
            '<img src="assets/images/upi-qr.png" alt="UPI QR Code" onerror="this.style.display=\'none\'">' +
            '<p>Scan with any UPI app</p>' +
            '<label class="co-confirm-pay" style="display:flex;align-items:center;gap:8px;margin-top:12px;font-size:0.9rem;cursor:pointer">' +
              '<input type="checkbox" id="co-pay-confirm" onchange="togglePlaceOrderBtn()">' +
              'I have completed the payment' +
            '</label>' +
          '</div>' +
          '<p style="font-size:0.8rem;color:var(--text-muted);margin:8px 0 0;text-align:center">Place Order will be enabled after payment is successful</p>' +
          '<div style="margin-top:12px;padding:16px;background:var(--bg-light);border-radius:8px">' +
            '<p style="margin:0;font-size:0.9rem">Order Total: <strong style="font-size:1.2rem;color:var(--primary-color)">\u20B9' + subtotal.toLocaleString('en-IN') + '.00</strong></p>' +
          '</div>' +
          '<button class="btn btn-accent btn-full" id="co-place-order" onclick="placeOrder()" style="margin-top:20px" disabled>Send Order via WhatsApp</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);
  setTimeout(function () { modal.classList.add('active'); }, 10);

  modal.querySelector('.checkout-close').onclick = function () { closeCheckout(); };
  modal.querySelector('.checkout-overlay').onclick = function () { closeCheckout(); };
  toggleQR();
}

function toggleQR() {
  var qr = document.querySelector('.co-qr-area');
  if (!qr) return;
  var upi = document.querySelector('input[name="payment"][value="upi"]');
  qr.style.display = upi && upi.checked ? 'block' : 'none';
  var cod = document.querySelector('input[name="payment"][value="cod"]');
  var btn = document.getElementById('co-place-order');
  if (btn) {
    btn.textContent = cod && cod.checked ? 'Send Order via WhatsApp' : 'Place Order';
  }
  togglePlaceOrderBtn();
}

function togglePlaceOrderBtn() {
  var btn = document.getElementById('co-place-order');
  if (!btn) return;
  var upi = document.querySelector('input[name="payment"][value="upi"]');
  var chk = document.getElementById('co-pay-confirm');
  if (upi && upi.checked) {
    btn.disabled = !(chk && chk.checked);
  } else {
    btn.disabled = false;
  }
}

function closeCheckout() {
  var modal = document.querySelector('.checkout-modal');
  if (!modal) return;
  modal.classList.remove('active');
  setTimeout(function () { modal.remove(); }, 300);
}

function nextStep() {
  var name = document.getElementById('co-name').value.trim();
  var phone = document.getElementById('co-phone').value.trim();
  var address = document.getElementById('co-address').value.trim();
  var city = document.getElementById('co-city').value.trim();
  var pincode = document.getElementById('co-pincode').value.trim();

  if (!name || !phone || !address || !city || !pincode) {
    alert('Please fill in all required fields.');
    return;
  }

  document.querySelector('.step-1').style.display = 'none';
  document.querySelector('.step-2').style.display = 'block';
  document.querySelectorAll('.checkout-step').forEach(function (s) { s.classList.remove('active'); });
  document.querySelector('.checkout-step[data-step="2"]').classList.add('active');
}

function placeOrder() {
  var payment = document.querySelector('input[name="payment"]:checked');
  var method = payment ? payment.value : 'cod';
  var methods = { cod: 'Cash on Delivery', upi: 'UPI', card: 'Card' };

  var name = document.getElementById('co-name').value.trim();
  var phone = document.getElementById('co-phone').value.trim();
  var email = document.getElementById('co-email').value.trim();
  var address = document.getElementById('co-address').value.trim();
  var city = document.getElementById('co-city').value.trim();
  var pincode = document.getElementById('co-pincode').value.trim();

  var orderItems = '';
  var total = 0;
  cartItems.forEach(function (item, i) {
    orderItems += (i + 1) + '. ' + item.name + ' - Rs. ' + item.price + '\n';
    total += item.price;
  });

  var msg = 'NEW COD ORDER\n========================\n' +
    'Name: ' + name + '\n' +
    'Phone: ' + phone + '\n' +
    'Email: ' + (email || '-') + '\n' +
    'Address: ' + address + ', ' + city + ' - ' + pincode + '\n' +
    '========================\n' +
    orderItems +
    '========================\n' +
    'Total: Rs. ' + total.toLocaleString('en-IN') + '\n' +
    'Payment: Cash on Delivery';

  window.open('https://wa.me/919582908080?text=' + encodeURIComponent(msg), '_blank');

  if (typeof confetti === 'function') {
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
    setTimeout(function () { confetti({ particleCount: 80, spread: 60, origin: { y: 0.4, x: 0.3 } }); }, 200);
    setTimeout(function () { confetti({ particleCount: 80, spread: 60, origin: { y: 0.4, x: 0.7 } }); }, 400);
  }

  var body = document.querySelector('.checkout-body');
  body.innerHTML =
    '<div style="text-align:center;padding:40px 20px">' +
      '<div style="font-size:3rem;margin-bottom:16px">\u2705</div>' +
      '<h3 style="color:var(--primary-color);margin-bottom:8px">Order Placed Successfully!</h3>' +
      '<p style="color:var(--text-muted);margin-bottom:4px">Payment: ' + (methods[method] || 'COD') + '</p>' +
      '<p style="color:var(--text-muted);font-size:0.85rem">Thank you for shopping with Taiva!</p>' +
    '</div>';

  document.querySelectorAll('.checkout-step').forEach(function (s) { s.classList.remove('active'); });

  cartItems = [];
  localStorage.removeItem('taiva_cart');
  updateCartUI();

  setTimeout(function () { closeCheckout(); }, 4000);
}
