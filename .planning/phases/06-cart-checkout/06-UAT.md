---
status: diagnosed
phase: 06-cart-checkout
source: 06-01-SUMMARY.md, 06-02-SUMMARY.md, 06-03-SUMMARY.md, 06-04-SUMMARY.md, 06-05-SUMMARY.md
started: 2026-06-17T00:00:00Z
updated: 2026-06-17T00:00:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Nav Cart Icon Opens Drawer
expected: Open any page (e.g. homepage or shop). Click the cart icon in the nav bar (top-right, desktop). The mini cart drawer slides in from the right — it does NOT navigate to /cart.html. The drawer shows either an empty state ("Your bag is empty") or current cart items.
result: pass

### 2. Add to Bag from Product Page Opens Drawer
expected: Open a product detail page. Select a size/colour if required, then click "Add to Bag". The cart drawer slides in from the right showing the item just added — with its name, variant, quantity (1), price, and thumbnail image.
result: pass
note: Fixed 3 bugs during UAT (commits ea10065, 09a0f54, 647f383). Email receipt on confirmation is placeholder copy — transactional email is a v2 deferred item, not Phase 6 scope.

### 3. Quick-Add from Shop Page Opens Drawer
expected: Open the shop/catalog page. Find a product with a quick-add button. Click it. The cart drawer opens and shows the added item. No Toastify "Added to Bag" toast — the drawer itself is the feedback.
result: pass

### 4. Drawer Qty Stepper and Remove
expected: With at least one item in the drawer, click "+" → qty increments to 2, subtotal updates. Click "−" back to 1. Click the remove button → item disappears. If the last item, drawer shows the empty state.
result: pass

### 5. Cart Page — Empty State
expected: Navigate directly to /cart.html with an empty cart. Page shows an SVG bag icon, "Your bag is empty" heading, and a "Shop Now" button linking to /shop.html. No item list is visible.
result: pass
note: Fixed Alpine store race condition — $store.cart references now use optional chaining (commit a342da6)

### 6. Cart Page — Items, Qty Stepper, and Remove
expected: Add an item (from product or shop page), then navigate to /cart.html via the "View Full Bag" link in the drawer footer. Cart page shows the item with image, name, variant, qty stepper, remove button, line total, and an order summary sidebar with subtotal + "Proceed to Checkout" button.
result: pass

### 7. Checkout — 4 Steps Flow (Guest)
expected: From cart.html click "Proceed to Checkout". On checkout.html you see Step 1 (Shipping). Fill in first name, last name, address, email. Click Next → Step 2 (Review) shows order items. Click Next → Step 3 (Payment) shows a mock card form. Click "Place Order" → Step 4 (Confirmation) shows a short order reference (e.g. "AB12CD34") and "Thank you" message. Cart is cleared.
result: issue
reported: "Yes, but there is no receipt send to email that i fill. Make the Province, Postal Code, and Phone Number require to fill before continue step. Payment card field also require to filled."
severity: major

### 8. Checkout — Authenticated User
expected: Log in first, then add an item and go to checkout. Step 1 has first name / last name pre-filled from profile. No email field is required (or it's hidden). Complete all steps. Order confirmation appears with reference. Cart is empty afterwards.
result: issue
reported: "When added items to cart after login, the items disappear for no reasons, and the product detail page reveal code"
severity: blocker

### 9. Cart Sync — Guest to Authenticated
expected: While logged out, add 1–2 items to cart. Log in. The items that were in the guest cart are still present in the cart (merged into your account) — they were not lost when you signed in.
result: issue
reported: "No, the bag is empty after log in using google. The items in the cart disappear while adding after log in. if not log in, there is no problem. Account that register/login using Google not saved into supabase. And the first-name, last-name, username not saving."
severity: blocker

## Summary

total: 9
passed: 6
issues: 3
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Guest cart items are merged and visible after logging in with Google"
  status: failed
  reason: "User reported: bag is empty after logging in with Google — guest cart items are lost on sign-in"
  severity: blocker
  test: 9
  root_cause: "Same as cart-overwrite bug (test 8). loadCartFromSupabase() in components.js line 28 replaces Alpine.store('cart').items wholesale (cart.js line 160) without merging local items — guest items added before login are wiped when the (empty) Supabase cart is loaded."
  artifacts:
    - path: "js/components.js"
      issue: "line 28: loadCartFromSupabase called eagerly on SIGNED_IN before merging local cart"
    - path: "js/cart.js"
      issue: "line 160: items array replaced wholesale instead of merged"
  missing:
    - "Merge local cart items with Supabase rows instead of replacing"
  debug_session: ""

- truth: "Google OAuth user profile (first_name, last_name, username) is saved to Supabase on sign-in"
  status: failed
  reason: "User reported: account registered/logged in using Google is not saved into Supabase, and first-name, last-name, username are not saving"
  severity: blocker
  test: 9
  root_cause: "No Supabase database trigger on auth.users to create user_profiles row automatically. Profile row is only created client-side inside account.html loadProfile() — so any Google OAuth user who navigates to a page other than account.html first will have no profile row at all."
  artifacts:
    - path: "js/auth.js"
      issue: "signInWithOAuth() at lines 42–53 does not write to user_profiles — correct, but no fallback trigger exists"
    - path: "supabase/migrations/"
      issue: "No handle_new_user() trigger function exists anywhere in codebase"
  missing:
    - "Supabase DB trigger: AFTER INSERT ON auth.users → handle_new_user() to create user_profiles row from raw_user_meta_data"
  debug_session: ""

- truth: "Cart items persist after logging in — items added while authenticated do not disappear"
  status: failed
  reason: "User reported: items added to cart after login disappear for no reason"
  severity: blocker
  test: 8
  root_cause: "loadCartFromSupabase() is called at components.js line 28 inside initAuth() the moment a logged-in user is detected. It resolves and at cart.js line 160 sets Alpine.store('cart').items = items (wholesale replace). Any item added to the store between page load and this async call resolving is wiped. Compounded by components.js registering onAuthStateChange twice (lines 49 + 51) causing INITIAL_SESSION to fire twice."
  artifacts:
    - path: "js/components.js"
      issue: "lines 49–51: dual registration of alpine:init listener AND direct if(window.Alpine) call — causes initAuth/onAuthChange to run twice"
    - path: "js/components.js"
      issue: "line 28: eager loadCartFromSupabase() call races against user adding items"
    - path: "js/cart.js"
      issue: "line 160: Alpine.store('cart').items = items replaces array without merge"
  missing:
    - "Remove eager loadCartFromSupabase call from initAuth(); rely solely on INITIAL_SESSION handler"
    - "In loadCartFromSupabase(), merge Supabase rows with existing local items instead of replacing"
  debug_session: ""

- truth: "Product detail page renders UI correctly when user is logged in — no raw code visible"
  status: failed
  reason: "User reported: product detail page reveals code (raw JS rendered as page text) when logged in"
  severity: blocker
  test: 8
  root_cause: "components.js registers both an alpine:init listener AND a direct if(window.Alpine) branch (lines 49–51), causing registerStores(), initAuth(), and Alpine.initTree() on injected nav/drawer HTML to run twice. The double Alpine.initTree() call on already-initialised trees conflicts with the product page's own x-data scope and can leave it in a broken parse state. Prior unescaped-quote fixes (commits ea10065, 09a0f54) resolved the original cause; this is the remaining trigger."
  artifacts:
    - path: "js/components.js"
      issue: "lines 49–51: dual registration causes registerStores()/initAuth()/Alpine.initTree(navRoot) to execute twice"
  missing:
    - "Guard the direct if(window.Alpine) branch so registerStores()/initAuth() only ever run once"
  debug_session: ""

- truth: "Clicking Next on Step 1 (Shipping) is blocked unless Province, Postal Code, and Phone Number are filled"
  status: failed
  reason: "User reported: Province, Postal Code, and Phone Number are not required — user can skip them and proceed to next step"
  severity: major
  test: 7
  root_cause: "checkout.html Step 1 validation does not include Province, Postal Code, and Phone Number in its required-field check before allowing Next."
  artifacts:
    - path: "checkout.html"
      issue: "Step 1 Next button handler missing required validation for province, postal_code, phone fields"
  missing:
    - "Add province, postal_code, phone to required fields list in Step 1 validation"
  debug_session: ""

- truth: "Clicking Place Order on Step 3 (Payment) is blocked unless all card fields are filled"
  status: failed
  reason: "User reported: Payment card fields are not required — user can place order without filling them"
  severity: major
  test: 7
  root_cause: "checkout.html Step 3 Place Order handler does not validate that card number, expiry, and CVV fields are filled."
  artifacts:
    - path: "checkout.html"
      issue: "Place Order click handler missing validation for card_number, expiry, cvv fields"
  missing:
    - "Add card_number, expiry, cvv to required fields validation in Step 3 before allowing Place Order"
  debug_session: ""

- truth: "Product detail page loads and renders correctly — Alpine state (product, loading, uniqueColours, etc.) is available"
  status: failed
  reason: "User reported: SyntaxError: Unexpected token '}' + ReferenceError for all variables. Page renders raw JS function body text instead of the product UI."
  severity: blocker
  test: 2
  root_cause: "product.html line 199: this.\\$nextTick — backslash before $ is invalid JS in identifier position. Alpine evaluates the entire x-data attribute as JS; the \\$ caused SyntaxError which aborted the entire x-data parse."
  artifacts:
    - path: "product.html"
      issue: "line 199: this.\\$nextTick → fixed to this.$nextTick (commit ea10065)"
  missing: []
  debug_session: ""
