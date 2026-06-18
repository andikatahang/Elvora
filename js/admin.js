// js/admin.js
// Admin SPA — guard, dispatcher, window exposure.
// All admin operations are protected by RLS is_admin() policies — client-side
// redirect is defence-in-depth, not the primary security control.

function adminApp() {
  return {
    // Guard state
    adminReady: false,

    // Navigation
    activeSection: 'products',

    // Products section
    products: [],
    productsLoading: false,
    showProductForm: false,
    editingProduct: null,

    // Orders section
    orders: [],
    ordersLoading: false,
    selectedOrderId: null,
    orderItems: [],
    loadingItems: false,

    // Testimonials section
    testimonials: [],
    testimonialsLoading: false,
    showTestimonialForm: false,
    editingTestimonial: null,

    // Content section
    contentLoading: false,
    bestSellers: [],
    collections: [],

    // ── Admin guard ─────────────────────────────────────────────────────────
    async init() {
      const { data: { user }, error } = await window.supabase.auth.getUser();
      if (error || !user) {
        window.location.replace('/index.html');
        return;
      }
      const role = user.app_metadata?.role;
      if (role !== 'admin') {
        window.location.replace('/index.html');
        return;
      }

      // Guard passed — hide loading screen, show shell
      const loadingEl = document.getElementById('admin-loading-screen');
      if (loadingEl) loadingEl.style.display = 'none';
      this.adminReady = true;

      // Set initial section from hash
      const hash = window.location.hash.replace('#', '');
      const validSections = ['products', 'orders', 'content', 'testimonials'];
      this.activeSection = validSections.includes(hash) ? hash : 'products';
      await this.loadSection(this.activeSection);

      // Listen for hash changes (browser back/forward)
      window.addEventListener('hashchange', async () => {
        const h = window.location.hash.replace('#', '');
        this.activeSection = validSections.includes(h) ? h : 'products';
        await this.loadSection(this.activeSection);
      });
    },

    // ── Navigation ───────────────────────────────────────────────────────────
    setSection(name) {
      window.location.hash = name;
      // hashchange handler in init() takes care of loading
    },

    // ── Section dispatcher ───────────────────────────────────────────────────
    async loadSection(name) {
      try {
        if (name === 'products') {
          this.productsLoading = true;
          this.products = await adminGetProducts();
          this.productsLoading = false;
        } else if (name === 'orders') {
          this.ordersLoading = true;
          this.orders = await adminGetOrders();
          this.ordersLoading = false;
        } else if (name === 'content') {
          this.contentLoading = true;
          this.bestSellers = await adminGetProducts();
          this.collections = await adminGetCollections();
          this.contentLoading = false;
        } else if (name === 'testimonials') {
          this.testimonialsLoading = true;
          this.testimonials = await adminGetTestimonials();
          this.testimonialsLoading = false;
        }
      } catch (err) {
        showToast(err.message, 'error');
        // Reset loading flags on error
        this.productsLoading = false;
        this.ordersLoading = false;
        this.contentLoading = false;
        this.testimonialsLoading = false;
      }
    },

    // ── Auth ─────────────────────────────────────────────────────────────────
    async doSignOut() {
      await window.supabase.auth.signOut();
      window.location.replace('/index.html');
    },

    // ── Product form ─────────────────────────────────────────────────────────
    openProductForm(product) {
      this.editingProduct = product;
      this.showProductForm = true;
    },

    // ── Testimonial form ─────────────────────────────────────────────────────
    openTestimonialForm(testimonial) {
      this.editingTestimonial = testimonial;
      this.showTestimonialForm = true;
    },

    // ── Order items toggle ───────────────────────────────────────────────────
    async toggleOrderItems(orderId) {
      if (this.selectedOrderId === orderId) {
        this.selectedOrderId = null;
        return;
      }
      this.selectedOrderId = orderId;
      this.loadingItems = true;
      try {
        this.orderItems = await adminGetOrderItems(orderId);
      } catch (err) {
        showToast(err.message, 'error');
        this.orderItems = [];
      }
      this.loadingItems = false;
    },
  };
}

// ── Data functions (stub — plan 07-03 to 07-06 will implement) ───────────────

async function adminGetProducts() {
  return [];
}

async function adminGetOrders(limit = 50) { // eslint-disable-line no-unused-vars
  return [];
}

async function adminGetOrderItems(orderId) { // eslint-disable-line no-unused-vars
  return [];
}

async function adminGetTestimonials() {
  return [];
}

async function adminGetCollections() {
  return [];
}

// ── Toast helper ─────────────────────────────────────────────────────────────

function showToast(message, type = 'success') {
  if (typeof Toastify === 'undefined') {
    console.warn('[admin] Toastify not loaded');
    return;
  }
  Toastify({
    text: message,
    duration: 3000,
    gravity: 'bottom',
    position: 'right',
    style: {
      background: type === 'error' ? '#c0392b' : 'var(--charcoal)',
      fontFamily: 'var(--font-body)',
      fontSize: '13px',
      borderRadius: '50px',
    },
  }).showToast();
}

// ── Window exposure ───────────────────────────────────────────────────────────

window.adminApp = adminApp;
window.adminGetProducts = adminGetProducts;
window.adminGetOrders = adminGetOrders;
window.adminGetOrderItems = adminGetOrderItems;
window.adminGetTestimonials = adminGetTestimonials;
window.adminGetCollections = adminGetCollections;
window.showToast = showToast;
