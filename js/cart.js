// js/cart.js
// Cart functions — stub only.
// Guest cart: localStorage. Authenticated cart: Supabase cart_items. Merge on login.
import { supabase } from './supabase.js';

export async function getCart() {
  // TODO: Phase 6
}

export async function addToCart(productId, variantId, quantity) {
  // TODO: Phase 6
}

export async function removeFromCart(cartItemId) {
  // TODO: Phase 6
}

export async function updateQuantity(cartItemId, quantity) {
  // TODO: Phase 6
}

export async function clearCart() {
  // TODO: Phase 6
}
