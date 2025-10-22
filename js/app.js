/**
 * app.js
 * Rainy Days — single-file, top-down JS with clear sections and comments.
 *
 * Responsibilities:
 * 1) Product list page (filters + add to cart)
 * 2) Cart page (quantity, remove, clear, totals)
 * 3) Checkout page (summary + simple validation + thank-you)
 *
 * Notes:
 * - DOM IDs are kept as-is 
 * - Product shape is normalized once (id, title, price, imageUrl, gender).
 * - All currency formatting goes through one Intl.NumberFormat (USD).
 */

// ──────────────────────────────────────────────────────────────────────────────
// Imports & Globals
// ──────────────────────────────────────────────────────────────────────────────

import {
  addToCart,
  getCartCount,
  getCart,
  setCartQty,
  removeFromCart,
  clearCart,
} from "./cart.js";
import { updateCartBadge } from "./ui.js";

const ENDPOINT = "https://v2.api.noroff.dev/rainy-days";

/** Currency formatter  */
const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

// Keep the badge in sync whenever cart changes anywhere in the app
updateCartBadge(getCartCount());
window.addEventListener("cart:updated", () => updateCartBadge(getCartCount()));

// ──────────────────────────────────────────────────────────────────────────────
// API: Fetch + Normalize
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Fetch products from Noroff v2 and return a normalized array
 * (shape used across list/cart/checkout UIs).
 * Throws on HTTP errors or unexpected shapes.
 */
async function fetchProducts() {
  try {
    const res = await fetch(ENDPOINT, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();
    const data = Array.isArray(json) ? json : json?.data;

    if (!Array.isArray(data)) throw new Error("Unexpected API response shape");

    return data.map(normalizeProduct);
  } catch (err) {
    throw new Error(`Failed to load products: ${err.message}`);
  }
}

/**
 * Normalize a product so the rest of the code never worries about backend quirks.
 * - gender → "women" | "men" | "unisex"
 * - imageUrl string fallback
 * - price number (uses discountedPrice if present)
 */
function normalizeProduct(p) {
  const g = String(p.gender || "").toLowerCase();
  const gender = g.includes("female") ? "women" : g.includes("male") ? "men" : "unisex";

  return {
    id: p.id,
    title: p.title ?? "Jacket",
    price: Number(p.discountedPrice ?? p.price ?? 0),
    imageUrl: p.image?.url || p.images?.[0]?.url || "",
    gender,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// List Page: Rendering & Filters
// Expected DOM on products page:
//   - #list (products container)
//   - #filter-gender (select) [optional]
//   - #filter-search (input)  [optional]
//   - #apply-filters (button) [optional]
//   - #clear-filters (button) [optional]
// ──────────────────────────────────────────────────────────────────────────────

/** Small template for a single product card */
function cardTemplate(p) {
  return `
    <article class="card" data-id="${p.id}">
      <img src="${p.imageUrl}" alt="${escapeHtml(p.title)}" loading="lazy" />
      <h3 class="card__title">${escapeHtml(p.title)}</h3>
      <p class="price">${USD.format(p.price)}</p>
      <small class="tag">${p.gender}</small>
      <button class="primary add-to-cart" data-id="${p.id}" aria-label="Add ${escapeHtml(p.title)} to cart">
        Add to cart
      </button>
    </article>
  `;
}

/** Render list or an empty-state message */
function renderProducts(listEl, products) {
  if (!products?.length) {
    listEl.innerHTML = `<p class="notice" role="status" aria-live="polite">No products matched your filters.</p>`;
    return;
  }
  listEl.innerHTML = products.map(cardTemplate).join("");
}

/** Read current filters (safe if the elements are missing) */
function getFilters() {
  const gender = (document.getElementById("filter-gender")?.value || "").trim().toLowerCase();
  const q = (document.getElementById("filter-search")?.value || "").trim().toLowerCase();
  return { gender, q };
}

/** Apply gender + query filters to a list (pure function) */
function applyFilters(raw) {
  const { gender, q } = getFilters();

  return raw.filter((p) => {
    // Gender: allow "unisex" to be included when "women" or "men" is selected
    const matchGender =
      !gender ||
      p.gender === gender ||
      (gender === "women" && p.gender === "unisex") ||
      (gender === "men" && p.gender === "unisex");

    const matchQuery = !q || p.title.toLowerCase().includes(q);

    return matchGender && matchQuery;
  });
}

/** Wire up filter controls and add-to-cart (event delegation) */
function bindListControls(listEl, allProducts) {
  // Apply button
  document.getElementById("apply-filters")?.addEventListener("click", () => {
    renderProducts(listEl, applyFilters(allProducts));
  });

  // Clear button
  document.getElementById("clear-filters")?.addEventListener("click", () => {
    const g = document.getElementById("filter-gender");
    const s = document.getElementById("filter-search");
    if (g) g.value = "";
    if (s) s.value = "";
    renderProducts(listEl, allProducts);
  });

  // Live search as you type 
  document.getElementById("filter-search")?.addEventListener("input", () => {
    renderProducts(listEl, applyFilters(allProducts));
  });

  // Add-to-cart via event delegation (survives re-renders)
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".add-to-cart");
    if (!btn) return;

    const id = btn.dataset.id;
    addToCart(id, 1);
    updateCartBadge(getCartCount());

    // Micro-feedback on the button
    btn.disabled = true;
    const prev = btn.textContent;
    btn.textContent = "Added";
    setTimeout(() => {
      btn.textContent = prev;
      btn.disabled = false;
    }, 700);
  });
}

/** Boot the products page (no-op on other pages) */
(async function bootListPage() {
  const list = document.getElementById("list");
  if (!list) return; // not on products page

  list.innerHTML = `<span class="spinner" aria-live="polite">Loading…</span>`;

  try {
    const products = await fetchProducts();
    renderProducts(list, products);
    bindListControls(list, products);
  } catch (err) {
    list.innerHTML = `<p class="error" role="alert">Could not load products. ${escapeHtml(err.message)}</p>`;
  }
})();

// ──────────────────────────────────────────────────────────────────────────────
/* Cart Page
   Expected DOM on cart.html:
   - #cart-root (presence check)
   - #cart-list
   - #cart-subtotal
   - #cart-tax
   - #cart-total
   - #cart-clear (button)
*/
// ──────────────────────────────────────────────────────────────────────────────

(async function bootCartPage() {
  const root = document.getElementById("cart-root");
  if (!root) return; // not on cart page

  const listEl = document.getElementById("cart-list");
  const subEl = document.getElementById("cart-subtotal");
  const taxEl = document.getElementById("cart-tax");
  const totEl = document.getElementById("cart-total");

  let catalog = [];
  try {
    catalog = await fetchProducts(); // normalized shape
  } catch {
    listEl.innerHTML = `<p class="error" role="alert">Could not load products. Please try again later.</p>`;
    return;
  }

  // Quick access by id
  const byId = new Map(catalog.map((p) => [p.id, p]));

  /** Merge cart lines with product data and compute line totals */
  function enrichLines() {
    return getCart()
      .map(({ id, qty }) => {
        const p = byId.get(id);
        if (!p) return null; // product disappeared from catalog
        return {
          id,
          qty,
          title: p.title,
          imageUrl: p.imageUrl,
          price: p.price,
          lineTotal: p.price * qty,
        };
      })
      .filter(Boolean);
  }

  /** Render the entire cart view  */
  function render() {
    const lines = enrichLines();

    if (!lines.length) {
      listEl.innerHTML = `<p>Your cart is empty.</p>`;
      subEl.textContent = USD.format(0);
      taxEl.textContent = USD.format(0);
      totEl.textContent = USD.format(0);
      return;
    }

    listEl.innerHTML = lines
      .map(
        (l) => `
      <div class="cart-line" data-id="${l.id}">
        <img src="${l.imageUrl}" alt="${escapeHtml(l.title)}">
        <div>
          <h3 class="cart-line__title">${escapeHtml(l.title)}</h3>
          <div class="cart-line__meta">${USD.format(l.price)} each</div>

          <div class="qty" role="group" aria-label="Change quantity">
            <button class="decr" aria-label="Decrease">−</button>
            <input type="number" min="1" value="${l.qty}" inputmode="numeric">
            <button class="incr" aria-label="Increase">+</button>
          </div>

          <div class="cart-line__actions">
            <button class="ghost remove">Remove</button>
          </div>
        </div>

        <div class="cart-line__total">${USD.format(l.lineTotal)}</div>
      </div>
    `
      )
      .join("");

    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    const tax = 0; // set your tax if needed
    const total = subtotal + tax;

    subEl.textContent = USD.format(subtotal);
    taxEl.textContent = USD.format(tax);
    totEl.textContent = USD.format(total);
  }

  // Quantity input (direct edit)
  document.addEventListener("input", (e) => {
    const input = e.target.closest(".cart-line input[type='number']");
    if (!input) return;
    const wrap = input.closest(".cart-line");
    const id = wrap?.dataset.id;
    const next = Math.max(1, parseInt(input.value || "1", 10));
    setCartQty(id, next);
    render();
  });

  // + / − / remove / clear buttons
  document.addEventListener("click", (e) => {
    const minus = e.target.closest(".cart-line .decr");
    const plus = e.target.closest(".cart-line .incr");
    const remove = e.target.closest(".cart-line .remove");
    const clearBtn = e.target.closest("#cart-clear");

    if (minus || plus) {
      const wrap = e.target.closest(".cart-line");
      const id = wrap?.dataset.id;
      const qtyInput = wrap.querySelector("input[type='number']");
      const delta = minus ? -1 : 1;
      const next = Math.max(1, parseInt(qtyInput.value || "1", 10) + delta);
      qtyInput.value = next;
      setCartQty(id, next);
      render();
      return;
    }

    if (remove) {
      const wrap = remove.closest(".cart-line");
      const id = wrap?.dataset.id;
      removeFromCart(id);
      render();
      return;
    }

    if (clearBtn) {
      clearCart();
      render();
      return;
    }
  });

  render();
})();

// ──────────────────────────────────────────────────────────────────────────────
/* Checkout Page
   Expected DOM on checkout.html:
   - #checkout-root (presence check)
   - #checkout-list
   - #co-subtotal
   - #co-tax
   - #co-total
   - #checkout-form
   - #checkout-error
*/
// ──────────────────────────────────────────────────────────────────────────────

(function bootCheckoutPage() {
  const root = document.getElementById("checkout-root");
  if (!root) return; // not on checkout page

  const listEl = document.getElementById("checkout-list");
  const subEl = document.getElementById("co-subtotal");
  const taxEl = document.getElementById("co-tax");
  const totEl = document.getElementById("co-total");
  const form = document.getElementById("checkout-form");
  const errEl = document.getElementById("checkout-error");

  const items = getCart();
  if (!items.length) {
    listEl.innerHTML = `<p>Your cart is empty.</p>`;
    subEl.textContent = USD.format(0);
    taxEl.textContent = USD.format(0);
    totEl.textContent = USD.format(0);
    if (form) form.querySelector("button[type='submit']").disabled = true;
    return;
  }

  // Build the summary from the live catalog (prices/images kept fresh)
  fetchProducts().then((catalog) => {
    const byId = new Map(catalog.map((p) => [p.id, p]));
    const lines = items
      .map(({ id, qty }) => {
        const p = byId.get(id);
        if (!p) return null;
        return {
          id,
          qty,
          title: p.title,
          imageUrl: p.imageUrl,
          price: p.price,
          lineTotal: p.price * qty,
        };
      })
      .filter(Boolean);

    listEl.innerHTML = lines
      .map(
        (l) => `
      <div class="cart-line" data-id="${l.id}">
        <img src="${l.imageUrl}" alt="${escapeHtml(l.title)}">
        <div>
          <h3 class="cart-line__title">${escapeHtml(l.title)}</h3>
          <div class="cart-line__meta">${USD.format(l.price)} x ${l.qty}</div>
        </div>
        <div class="cart-line__total">${USD.format(l.lineTotal)}</div>
      </div>
    `
      )
      .join("");

    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    const tax = 0;
    const total = subtotal + tax;

    subEl.textContent = USD.format(subtotal);
    taxEl.textContent = USD.format(tax);
    totEl.textContent = USD.format(total);
  });

  // Lightweight client-side validation
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      errEl.hidden = true;

      if (!form.checkValidity()) {
        errEl.textContent = "Please complete the required fields.";
        errEl.hidden = false;
        return;
      }

      clearCart();

      root.innerHTML = `
        <div class="notice" role="status" aria-live="polite">
          <h2>Thank You!</h2>
          <p>Your order has been placed. A confirmation is on its way.</p>
          <a class="primary" href="products.html">Continue Shopping</a>
        </div>
      `;
    });
  }
})();

// ──────────────────────────────────────────────────────────────────────────────
// Tiny util: safe text output for HTML
// ──────────────────────────────────────────────────────────────────────────────

function escapeHtml(s = "") {
  return String(s).replace(/[&<>"']/g, (c) => {
    const m = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return m[c];
  });
}
