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
      if (name === 'products') {
        this.productsLoading = true;
        try {
          this.products = await adminGetProducts();
        } catch (err) {
          showToast('Gagal memuat produk: ' + err.message, 'error');
        } finally {
          this.productsLoading = false;
        }
      } else if (name === 'orders') {
        this.ordersLoading = true;
        try {
          this.orders = await adminGetOrders();
        } catch (err) {
          showToast('Gagal memuat pesanan: ' + err.message, 'error');
        } finally {
          this.ordersLoading = false;
        }
      } else if (name === 'content') {
        this.contentLoading = true;
        try {
          this.bestSellers = await adminGetProducts();
          this.collections = await adminGetCollections();
        } catch (err) {
          showToast('Gagal memuat konten: ' + err.message, 'error');
        } finally {
          this.contentLoading = false;
        }
      } else if (name === 'testimonials') {
        this.testimonialsLoading = true;
        try {
          this.testimonials = await adminGetTestimonials();
        } catch (err) {
          showToast('Gagal memuat testimoni: ' + err.message, 'error');
        } finally {
          this.testimonialsLoading = false;
        }
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

    // ── Delete product ───────────────────────────────────────────────────────
    async deleteProduct(id, name) {
      const confirmed = window.confirm(
        `Hapus produk "${name}"?\n\nTindakan ini akan menghapus produk, semua varian, dan gambar secara permanen.`
      );
      if (!confirmed) return;

      try {
        await adminDeleteProduct(id);
        // Refresh product list after successful delete
        this.products = await adminGetProducts();
        showToast(`Produk "${name}" berhasil dihapus`);
      } catch (err) {
        console.error('[admin] Delete product error:', err);
        showToast(`Gagal menghapus produk: ${err.message}`, 'error');
      }
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

// ── Data functions ────────────────────────────────────────────────────────────

async function adminGetProducts() {
  // Requires products_admin_select RLS policy from migration 007
  // Returns ALL products including is_active=false (drafts)
  const { data, error } = await window.supabase
    .from('products')
    .select(`
      id,
      name,
      slug,
      base_price,
      is_active,
      is_best_seller,
      category_id,
      description,
      fabric_details,
      care_instructions,
      created_at,
      categories(id, name),
      product_images(id, url, alt_text, display_order),
      product_variants(id, colour, colour_hex, size, stock_quantity, sku)
    `)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function adminDeleteProduct(id) {
  // Step 1: Fetch product_images to get Storage paths for cleanup
  const { data: images, error: imgFetchErr } = await window.supabase
    .from('product_images')
    .select('id, url')
    .eq('product_id', id);
  if (imgFetchErr) throw imgFetchErr;

  // Step 2: Delete from Storage (product-images bucket)
  // URL format: https://{project}.supabase.co/storage/v1/object/public/product-images/products/{id}/...
  if (images && images.length > 0) {
    const storagePaths = images
      .map(img => {
        const match = img.url.match(/\/product-images\/(.+)$/);
        return match ? match[1] : null;
      })
      .filter(Boolean);

    if (storagePaths.length > 0) {
      // Storage delete errors are non-blocking — log but continue
      const { error: storageErr } = await window.supabase.storage
        .from('product-images')
        .remove(storagePaths);
      if (storageErr) {
        console.warn('[admin] Storage cleanup error (non-blocking):', storageErr.message);
      }
    }
  }

  // Step 3: Delete product_images rows from DB
  const { error: imgDelErr } = await window.supabase
    .from('product_images')
    .delete()
    .eq('product_id', id);
  if (imgDelErr) throw imgDelErr;

  // Step 4: Delete product_variants rows
  const { error: varDelErr } = await window.supabase
    .from('product_variants')
    .delete()
    .eq('product_id', id);
  if (varDelErr) throw varDelErr;

  // Step 5: Delete the product itself
  const { error: prodDelErr } = await window.supabase
    .from('products')
    .delete()
    .eq('id', id);
  if (prodDelErr) throw prodDelErr;
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
