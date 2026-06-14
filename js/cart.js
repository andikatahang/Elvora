// js/cart.js
// Cart implementation using localStorage for guest users.
// Alpine.store('cart') is the single source of truth for UI reactivity.
// On page load, restores cart from localStorage.

import { supabase } from './supabase.js';

const STORAGE_KEY = 'elvora_cart';

function loadFromStorage() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveToStorage(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

// Initialize Alpine store with persisted cart
function initCartStore() {
  if (!window.Alpine) return;

  const savedItems = loadFromStorage();

  Alpine.store('cart', {
    items: savedItems,
    get count() {
      return this.items.reduce((n, i) => n + i.qty, 0);
    },
    get total() {
      return this.items.reduce((t, i) => t + i.price * i.qty, 0);
    },
    get totalFormatted() {
      return 'Rp ' + this.total.toLocaleString('id-ID');
    },

    add({ productId, variantId = null, name, slug, price, image = '', colour = '', size = '' }) {
      const key = `${productId}|${variantId || ''}|${size}`;
      const existing = this.items.find(i => i.key === key);
      if (existing) {
        existing.qty += 1;
      } else {
        this.items.push({ key, productId, variantId, name, slug, price, image, colour, size, qty: 1 });
      }
      saveToStorage(this.items);
    },

    remove(key) {
      this.items = this.items.filter(i => i.key !== key);
      saveToStorage(this.items);
    },

    setQty(key, qty) {
      if (qty <= 0) { this.remove(key); return; }
      const item = this.items.find(i => i.key === key);
      if (item) item.qty = qty;
      saveToStorage(this.items);
    },

    clear() {
      this.items = [];
      saveToStorage([]);
    },
  });
}

// Re-init if Alpine already running, else wait for alpine:init
document.addEventListener('alpine:init', initCartStore);
if (window.Alpine) initCartStore();
