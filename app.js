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
    speed: 1200,
    pagination: {
      el: '.hero-section .swiper-pagination',
      clickable: true,
    },
    navigation: {
      nextEl: '.hero-section .swiper-button-next',
      prevEl: '.hero-section .swiper-button-prev',
    },
    effect: 'fade',
    fadeEffect: {
      crossFade: true,
    },
    on: {
      slideChange: function () {
        document.querySelectorAll('.hero-video').forEach(function (v) { v.pause(); });
      },
      slideChangeTransitionEnd: function () {
        var activeSlide = this.slides[this.activeIndex];
        var video = activeSlide.querySelector('.hero-video');
        if (video) { video.load(); video.play(); }
      },
    },
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
  var cartItems = [];
  var cartCountNum = 0;
  var cartCountEl = document.querySelector('.cart-count');
  var cartTotalEl = document.getElementById('cartTotal');
  var cartBody = document.getElementById('cartBody');
  var cartItemsContainer = document.getElementById('cartItems');
  var cartEmpty = document.getElementById('cartEmpty');
  var fbtSection = document.getElementById('fbtSection');

  function updateCartUI() {
    // Update count
    cartCountNum = cartItems.length;
    if (cartCountEl) cartCountEl.textContent = cartCountNum;

    // Update total
    var total = 0;
    cartItems.forEach(function (item) { total += item.price; });
    if (cartTotalEl) cartTotalEl.textContent = 'Rs. ' + total.toLocaleString('en-IN');

    // Show/hide empty state
    if (cartItems.length === 0) {
      if (cartEmpty) cartEmpty.style.display = '';
      if (cartItemsContainer) cartItemsContainer.innerHTML = '';
      if (fbtSection) fbtSection.style.display = 'none';
      return;
    }
    if (cartEmpty) cartEmpty.style.display = 'none';
    if (fbtSection) fbtSection.style.display = 'block';

    // Render cart items
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

    // Remove buttons
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

      // Feedback
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

  /* ===== HERO VIDEO SOUND TOGGLE ===== */
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