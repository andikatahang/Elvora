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
    categories: [],
    productFormSaving: false,
    productForm: {
      name: '',
      slug: '',
      description: '',
      category_id: '',
      base_price: '',
      fabric_details: '',
      care_instructions: '',
      is_active: true,
      variants: [],
      imageFiles: [],
      imagePreviews: [],
      existingImages: [],
    },

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
          // Reset any open order detail when reloading the section
          this.selectedOrderId = null;
          this.orderItems = [];
        } catch (err) {
          console.error('[admin] Load orders error:', err);
          showToast('Gagal memuat orders: ' + err.message, 'error');
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
    async openProductForm(product) {
      if (this.categories.length === 0) {
        try {
          const { data } = await window.supabase
            .from('categories')
            .select('id, name')
            .order('name');
          this.categories = data || [];
        } catch (err) {
          showToast('Gagal memuat kategori: ' + err.message, 'error');
        }
      }

      if (product) {
        this.editingProduct = product;
        this.productForm = {
          name: product.name || '',
          slug: product.slug || '',
          description: product.description || '',
          category_id: product.category_id || '',
          base_price: product.base_price || '',
          fabric_details: product.fabric_details || '',
          care_instructions: product.care_instructions || '',
          is_active: product.is_active !== false,
          variants: (product.product_variants || []).map(v => ({
            id: v.id,
            colour: v.colour || '',
            size: v.size || '',
            colour_hex: v.colour_hex || '#888888',
            stock_quantity: v.stock_quantity || 0,
            sku: v.sku || '',
          })),
          imageFiles: [],
          imagePreviews: [],
          existingImages: (product.product_images || [])
            .sort((a, b) => a.display_order - b.display_order)
            .map(img => ({ id: img.id, url: img.url, alt_text: img.alt_text })),
        };
      } else {
        this.editingProduct = null;
        this.resetProductForm();
      }
      this.showProductForm = true;
    },

    resetProductForm() {
      this.productForm = {
        name: '', slug: '', description: '', category_id: '',
        base_price: '', fabric_details: '', care_instructions: '',
        is_active: true, variants: [], imageFiles: [], imagePreviews: [],
        existingImages: [],
      };
      this.productFormSaving = false;
    },

    addVariantRow() {
      this.productForm.variants.push({
        colour: '', size: '', colour_hex: '#888888', stock_quantity: 10
      });
    },

    removeVariantRow(index) {
      this.productForm.variants.splice(index, 1);
      this.productForm.variants = [...this.productForm.variants];
    },

    previewImages(event) {
      const files = Array.from(event.target.files);
      const oversized = files.filter(f => f.size > 5 * 1024 * 1024);
      if (oversized.length > 0) {
        showToast('Satu atau lebih file melebihi batas 5MB', 'error');
        event.target.value = '';
        return;
      }
      const invalidType = files.filter(f => !['image/jpeg','image/png','image/webp'].includes(f.type));
      if (invalidType.length > 0) {
        showToast('Hanya JPEG, PNG, WebP yang diizinkan', 'error');
        event.target.value = '';
        return;
      }
      this.productForm.imageFiles = files;
      this.productForm.imagePreviews = [];
      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = e => { this.productForm.imagePreviews = [...this.productForm.imagePreviews, e.target.result]; };
        reader.readAsDataURL(file);
      });
    },

    async removeExistingImage(imageId, index) {
      try {
        const { error } = await window.supabase
          .from('product_images')
          .delete()
          .eq('id', imageId);
        if (error) throw error;
        this.productForm.existingImages.splice(index, 1);
        this.productForm.existingImages = [...this.productForm.existingImages];
        showToast('Gambar dihapus');
      } catch (err) {
        showToast('Gagal menghapus gambar: ' + err.message, 'error');
      }
    },

    async saveProduct() {
      if (!this.productForm.name.trim()) { showToast('Nama produk wajib diisi', 'error'); return; }
      if (!this.productForm.category_id) { showToast('Kategori wajib dipilih', 'error'); return; }
      if (!this.productForm.base_price || this.productForm.base_price <= 0) { showToast('Harga wajib diisi', 'error'); return; }
      if (this.productForm.variants.length === 0) { showToast('Minimal satu variant diperlukan', 'error'); return; }

      for (const v of this.productForm.variants) {
        if (!v.colour || !v.size) { showToast('Setiap variant harus memiliki colour dan size', 'error'); return; }
      }

      this.productFormSaving = true;
      try {
        if (this.editingProduct) {
          await adminUpdateProduct(this.editingProduct.id, this.productForm);
          showToast('Produk berhasil diperbarui');
        } else {
          await adminCreateProduct(this.productForm);
          showToast('Produk berhasil dibuat');
        }
        this.showProductForm = false;
        this.resetProductForm();
        this.products = await adminGetProducts();
      } catch (err) {
        console.error('[admin] Save product error:', err);
        if (err.message && err.message.includes('duplicate') || err.code === '23505') {
          showToast('Slug sudah digunakan. Ubah nama produk.', 'error');
        } else {
          showToast('Gagal menyimpan produk: ' + err.message, 'error');
        }
      } finally {
        this.productFormSaving = false;
      }
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
      // Collapse if already open
      if (this.selectedOrderId === orderId) {
        this.selectedOrderId = null;
        this.orderItems = [];
        return;
      }

      this.selectedOrderId = orderId;
      this.orderItems = [];
      this.loadingItems = true;

      try {
        this.orderItems = await adminGetOrderItems(orderId);
      } catch (err) {
        console.error('[admin] Load order items error:', err);
        showToast('Gagal memuat order items: ' + err.message, 'error');
        this.selectedOrderId = null;
      } finally {
        this.loadingItems = false;
      }
    },
  };
}

// ── Slug helper ───────────────────────────────────────────────────────────────

function toSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ── Product create/update ─────────────────────────────────────────────────────

async function adminCreateProduct(formData) {
  const slug = formData.slug || toSlug(formData.name);

  const { data: product, error: productErr } = await window.supabase
    .from('products')
    .insert({
      name: formData.name.trim(),
      slug: slug,
      description: formData.description.trim(),
      category_id: formData.category_id,
      base_price: Number(formData.base_price),
      fabric_details: formData.fabric_details || null,
      care_instructions: formData.care_instructions || null,
      is_active: formData.is_active !== false,
      is_best_seller: false,
    })
    .select('id')
    .single();
  if (productErr) throw productErr;
  const productId = product.id;

  if (formData.variants.length > 0) {
    const variantRows = formData.variants.map((v, i) => ({
      product_id: productId,
      colour: v.colour.trim(),
      colour_hex: v.colour_hex || '#888888',
      size: v.size,
      stock_quantity: Number(v.stock_quantity) || 0,
      sku: `${slug}-${v.colour.toLowerCase().replace(/\s+/g,'-')}-${v.size.toLowerCase()}-${i}`,
    }));
    const { error: varErr } = await window.supabase
      .from('product_variants')
      .insert(variantRows);
    if (varErr) throw varErr;
  }

  for (let i = 0; i < formData.imageFiles.length; i++) {
    const file = formData.imageFiles[i];
    const ext = file.name.split('.').pop().toLowerCase();
    const path = `products/${productId}/${Date.now()}-${i}.${ext}`;
    const { error: upErr } = await window.supabase.storage
      .from('product-images')
      .upload(path, file, { cacheControl: '3600', upsert: false });
    if (upErr) throw upErr;

    const { data: { publicUrl } } = window.supabase.storage
      .from('product-images')
      .getPublicUrl(path);

    const { error: imgErr } = await window.supabase
      .from('product_images')
      .insert({
        product_id: productId,
        url: publicUrl,
        alt_text: formData.name,
        display_order: i,
      });
    if (imgErr) throw imgErr;
  }

  return productId;
}

async function adminUpdateProduct(productId, formData) {
  const slug = formData.slug || toSlug(formData.name);

  const { error: prodErr } = await window.supabase
    .from('products')
    .update({
      name: formData.name.trim(),
      slug: slug,
      description: formData.description.trim(),
      category_id: formData.category_id,
      base_price: Number(formData.base_price),
      fabric_details: formData.fabric_details || null,
      care_instructions: formData.care_instructions || null,
      is_active: formData.is_active !== false,
    })
    .eq('id', productId);
  if (prodErr) throw prodErr;

  const { error: delVarErr } = await window.supabase
    .from('product_variants')
    .delete()
    .eq('product_id', productId);
  if (delVarErr) throw delVarErr;

  if (formData.variants.length > 0) {
    const variantRows = formData.variants.map((v, i) => ({
      product_id: productId,
      colour: v.colour.trim(),
      colour_hex: v.colour_hex || '#888888',
      size: v.size,
      stock_quantity: Number(v.stock_quantity) || 0,
      sku: `${slug}-${v.colour.toLowerCase().replace(/\s+/g,'-')}-${v.size.toLowerCase()}-${i}`,
    }));
    const { error: varErr } = await window.supabase
      .from('product_variants')
      .insert(variantRows);
    if (varErr) throw varErr;
  }

  const existingCount = (formData.existingImages || []).length;
  for (let i = 0; i < formData.imageFiles.length; i++) {
    const file = formData.imageFiles[i];
    const ext = file.name.split('.').pop().toLowerCase();
    const path = `products/${productId}/${Date.now()}-${i}.${ext}`;
    const { error: upErr } = await window.supabase.storage
      .from('product-images')
      .upload(path, file, { cacheControl: '3600', upsert: false });
    if (upErr) throw upErr;

    const { data: { publicUrl } } = window.supabase.storage
      .from('product-images')
      .getPublicUrl(path);

    const { error: imgErr } = await window.supabase
      .from('product_images')
      .insert({
        product_id: productId,
        url: publicUrl,
        alt_text: formData.name,
        display_order: existingCount + i,
      });
    if (imgErr) throw imgErr;
  }
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

async function adminGetOrders(limit = 50) {
  // Requires orders_admin_select RLS policy from migration 007.
  // Without it, Supabase returns [] silently — empty state in the UI
  // will prompt the admin to check the migration.
  const { data, error } = await window.supabase
    .from('orders')
    .select(`
      id,
      created_at,
      status,
      subtotal,
      guest_email,
      user_id,
      shipping_address
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

async function adminGetOrderItems(orderId) {
  // Uses snapshot columns (product_name, variant_label, unit_price) stored at
  // checkout time — consistent even if the original product is later edited/deleted.
  const { data, error } = await window.supabase
    .from('order_items')
    .select(`
      id,
      product_name,
      variant_label,
      unit_price,
      quantity
    `)
    .eq('order_id', orderId)
    .order('id', { ascending: true });

  if (error) throw error;
  return data || [];
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
window.adminCreateProduct = adminCreateProduct;
window.adminUpdateProduct = adminUpdateProduct;
window.toSlug = toSlug;
window.adminGetProducts = adminGetProducts;
window.adminGetOrders = adminGetOrders;
window.adminGetOrderItems = adminGetOrderItems;
window.adminGetTestimonials = adminGetTestimonials;
window.adminGetCollections = adminGetCollections;
window.showToast = showToast;
