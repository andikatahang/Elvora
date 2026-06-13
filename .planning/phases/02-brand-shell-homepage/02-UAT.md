---
status: complete
phase: 02-brand-shell-homepage
source: 02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md, 02-04-SUMMARY.md
started: 2026-06-12T00:00:00Z
updated: 2026-06-13T00:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Nav & Footer on All Pages
expected: Open index.html, shop.html, about.html, and contact.html in a browser. Each page shows a navigation bar at the top and a charcoal footer at the bottom. admin.html has nav but NO footer.
result: pass
note: "Mobile drawer background color missing — formally tracked in Test 3"

### 2. Nav Scroll Behavior
expected: On any page, scroll down more than 80px. The nav background should become opaque (solid, no longer transparent). Scrolling back to the top should restore the transparent/glass effect.
result: skipped
reason: "Intentional design change — nav permanently frosted (bg-beige/92 backdrop-blur) to fix dark-hero contrast. User prefers this style."

### 3. Mobile Hamburger Menu
expected: Resize the browser to a mobile width (or use DevTools). A hamburger icon should appear in the nav. Tapping/clicking it opens a drawer/panel showing nav links. Tapping again (or a close button) dismisses it.
result: issue
reported: "Mobile drawer panel has no background color — blends into the main page background, making nav links hard/impossible to read."
severity: major

### 4. Homepage Hero Section
expected: The homepage (index.html) shows a full-width hero with the heading "Elevate Your Active Life" (with "Active Life" in italic rose text), a large lifestyle image, a "Discover the Collection" primary button (links to /shop.html), and a "Find Your Style" secondary button (links to /style-match.html).
result: issue
reported: "No heading 'Elevate Your Active Life' visible — only a large lifestyle image. Primary button reads 'SHOP COLLECTION' → /shop.html (label differs). Second button reads 'LOOKBOOK' → /lookbook.html (expected 'Find Your Style' → /style-match.html)."
severity: major

### 5. Marquee Strip & Featured Collections
expected: Below the hero, a marquee strip scrolls keywords continuously. Below that, 4 collection cards appear in an asymmetric grid (Padel card is larger, spanning 2 rows). Each card links to shop.html with a category parameter (e.g. ?category=padel).
result: issue
reported: "Marquee and grid structure work. Cards link by product type (leggings, jackets, tops, sport-hijab, socks) instead of activity category (padel, pilates, tennis, training)."
severity: minor

### 6. About Page Loads Correctly
expected: Opening about.html shows: a hero with "Designed for the Woman Who Moves" heading (italic rose on "Moves"), a brand narrative section with a "Shop the Collection" CTA, and a dark strip with 3 value headings ("Crafted with Intention", "For Every Practice", "Quietly Luxurious").
result: issue
reported: "Hero heading reads 'Built for her. Every Her.' with 'her' in italic rose. No 'Shop the Collection' CTA button. No dark strip with 3 value headings."
severity: major

### 7. Contact Page
expected: Opening contact.html shows a contact form (name, email, message + submit) plus contact info (email/Instagram). NOTE: Original spec expected FAQ accordion — updated to match actual implementation (contact form).
result: issue
reported: "Form and contact info present. An unnecessary 'subject' field exists in the form — user wants it removed."
severity: minor

### 8. Newsletter Signup
expected: On the homepage, scroll to the newsletter section. Enter an email and submit. A success message "You're on the list. Welcome to Elvora." should appear. Submit the same email again — it should show "You're already part of the inner circle." instead of an error.
result: issue
reported: "Submitting the newsletter form shows an error: 'something went wrong - please try again'. No success message."
severity: major

### 9. Best Sellers Section
expected: The homepage Best Sellers section either (a) loads 4 product cards from Supabase with name, price, and colour swatches, or (b) shows an animated skeleton loader while loading, or (c) shows a graceful error message if Supabase is unreachable. No blank section or console crash.
result: issue
reported: "Section shows static text 'Our best sellers are on their way.' with two links ('VIEW ALL' and 'EXPLORE THE FULL COLLECTION'). No product cards, no skeleton loader."
severity: minor

### 10. Testimonials Section
expected: The homepage Testimonials section either (a) loads testimonial cards with a quote, author name, and activity label, or (b) shows an animated skeleton loader while loading. No star ratings are shown. No blank section or JS crash.
result: pass

## Summary

total: 10
passed: 2
issues: 7
pending: 0
skipped: 1
blocked: 0

## Gaps

- truth: "Mobile drawer panel opens but has a visible background that separates it from the page content"
  status: failed
  reason: "User reported: mobile drawer panel has no background color — blends into the main page background"
  severity: major
  test: 3
  artifacts: []
  missing: []

- truth: "Hero shows heading 'Elevate Your Active Life', primary CTA 'Discover the Collection' → /shop.html, secondary CTA 'Find Your Style' → /style-match.html"
  status: failed
  reason: "User reported: no heading visible; primary button is 'SHOP COLLECTION' → /shop.html; secondary button is 'LOOKBOOK' → /lookbook.html"
  severity: major
  test: 4
  artifacts: []
  missing: []

- truth: "About page hero: 'Designed for the Woman Who Moves' heading, 'Shop the Collection' CTA, dark strip with 3 values"
  status: failed
  reason: "User reported: heading is 'Built for her. Every Her.'; no CTA button; no dark value strip"
  severity: major
  test: 6
  artifacts: []
  missing: []

- truth: "Best Sellers section shows product cards, skeleton loader, or graceful Supabase-unavailable message"
  status: failed
  reason: "User reported: static placeholder text 'Our best sellers are on their way.' with two CTAs. No dynamic loading or skeleton state."
  severity: minor
  test: 9
  artifacts: []
  missing: []

- truth: "Newsletter signup shows success message on submit; duplicate email shows friendly 'already subscribed' message"
  status: failed
  reason: "User reported: submitting any email shows 'something went wrong - please try again' error. Likely Supabase credentials absent locally — but error handling should degrade more gracefully."
  severity: major
  test: 8
  artifacts: []
  missing: []

- truth: "Contact form has name, email, and message fields only"
  status: failed
  reason: "User reported: unnecessary 'subject' field present — should be removed"
  severity: minor
  test: 7
  artifacts: []
  missing: []

- truth: "Collection cards link to shop.html by activity category: ?category=padel, ?category=pilates, ?category=tennis, ?category=training"
  status: failed
  reason: "User reported: cards link by product type (leggings, jackets, tops, sport-hijab, socks) not activity category"
  severity: minor
  test: 5
  artifacts: []
  missing: []
