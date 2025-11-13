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

//__________________________________________________________________
//Small DOM helpers
//________________________________________________________________________
function el(tag, attrs = {}, ...children) {
const node = document.createElement(tag);
for (const [k, v] of Object.entries(attrs || {})) {
if (v === null || v === undefined) continue;
if (k === "class" || k === "className") node.className = String(v);
else if (k === "dataset" && v && typeof v === "object") {
for (const [dk, dv] of Object.entries(v)) node.dataset[dk] = String(dv);
} else if (k in node) {
try { node[k] = v; } catch { node.setAttribute(k, String(v)); }
} else {
node.setAttribute(k, String(v));
}
}
for (const c of children.flat()) {
node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
}
return node;
}


/** Replace children efficiently. */
function replace(elm, ...kids) {
const frag = document.createDocumentFragment();
for (const k of kids.flat()) frag.appendChild(k);
elm.replaceChildren(frag);
}

function displayError(message) {
  let bar = document.querySelector(".error-bar");
  if (!bar) {
    bar = el(
      "div",
      { class: "error-bar", role: "alert", "aria-live": "polite" },
      message
    );
  Object.assign(bar.style, {
    backgroundColor: "#c0392b",
    color: "white",
    padding: "1rem",
    textAlign: "center",
    fontWeight: "700",
  });
  document.body.prepend(bar);
  } else {
    bar.textContent = message;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// API: Fetch + Normalize
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

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
    displayError(`Error fetching products: ${err.message}`);

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
    sizes: Array.isArray(p.sizes) ? p.sizes.map((s) => String(s).toUpperCase()) : [],
    id: p.id,
    title: p.title ?? "jacket",
    price: Number(p.discountedPrice ?? p.price ?? 0),
    imageUrl: p.image?.url || p.images?.[0]?.url || "",
    gender,
    description: p.description ?? "",
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
function cardElement(p) {
const img = el("img", { src: p.imageUrl, alt: p.title, loading: "lazy" });

const mediaLink = el(
  "a",
  { href: `product.html?id=${p.id}`, class: "card__media" },
  img
);
const titleLink = el(
  "a",
  { href: `product.html?id=${p.id}` },
  p.title
);
const title = el("h3", { class: "card__title" }, titleLink);
const price = el("p", { class: "price" }, USD.format(p.price));
const tag = el("small", { class: "tag" }, p.gender);
const btn = el(
  "button",
  {
    class: "primary add-to-cart",
    dataset: { id: p.id },
    "aria-label": `Add ${p.title} to cart`,
  },
  "Add to cart"
);


return el(
  "article",
  { class: "card", dataset: { id: p.id } },
  mediaLink,
  title,
  price,
  tag,
  btn
);
}
/** Render list or an empty-state message */
function renderProducts(listEl, products) {
if (!products?.length) {
const notice = el(
"p",
{ class: "notice", role: "status", ariaLive: "polite" },
"No products matched your filters."
);
replace(listEl, notice);
return;
}
const frag = document.createDocumentFragment();
for (const p of products) frag.appendChild(cardElement(p));
listEl.replaceChildren(frag);
}

/** Read current filters (safe if the elements are missing) */
function getFilters() {
  const size = (document.getElementById("filter-size")?.value || "").trim().toUpperCase();
  const gender = (document.getElementById("filter-gender")?.value || "").trim().toLowerCase();
  const q = (document.getElementById("filter-search")?.value || "").trim().toLowerCase();
  return { size, gender, q };
}


/** Apply gender + query filters to a list (pure function) */
function applyFilters(raw) {
  const { gender, q, size } = getFilters();
  
  return raw.filter((p) => {
    // Gender: allow "unisex" to be included when "women" or "men" is selected
    const matchGender =
      !gender ||
      p.gender === gender ||
      (gender === "women" && p.gender === "unisex") ||
      (gender === "men" && p.gender === "unisex");

    const matchQuery = !q || p.title.toLowerCase().includes(q);
    const matchSize = !size || (Array.isArray(p.sizes) && p.sizes.includes(size));

    return matchGender && matchQuery && matchSize;
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
    const z = document.getElementById("filter-size");
    if (g) g.value = "";
    if (s) s.value = "";
    if (z) z.value = "";
    renderProducts(listEl, allProducts);
  });
  // Live search as you type 
  document.getElementById("filter-search")?.addEventListener("input", () => {
    renderProducts(listEl, applyFilters(allProducts));
  });
     // Live size change
document.getElementById("filter-size")?.addEventListener("change", () => {
  renderProducts(listEl, applyFilters(allProducts));
});
}


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


/** Boot the products page (no-op on other pages) */
(async function bootListPage() {
  const list = document.getElementById("list");
  if (!list) return; // not on products page

  const spinner = el("span", { class: "spinner", ariaLive: "polite" }, "Loading…");
replace(list, spinner);


try {
const products = await fetchProducts();
renderProducts(list, products);
bindListControls(list, products);
} catch (err) {
const msg = el(
"p",
{ class: "error", role: "alert" },
`Could not load products. ${err.message}`
);
replace(list, msg);
}
})();

// ──────────────────────────────────────────────────────────────────────────────
//product page: single product details
// ──────────────────────────────────────────────────────────────────────────────
(async function bootProductPage() {
  const root = document.getElementById("product-root");
  if (!root) return;

  // Step 1: Check for ID in URL
  const params = new URLSearchParams(location.search);
  const id = params.get("id");

  if (!id) {
    root.innerHTML = `<p class="error" role="alert">No product ID specified. <a href="products.html">Go back to products</a></p>`;
    return;
  }

  // Step 2: Loading state
  root.textContent = "Loading product…";

  try {
    // Step 3: Fetch single product
    const res = await fetch(`${ENDPOINT}/${encodeURIComponent(id)}`, {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const { data } = await res.json();
    if (!data) throw new Error("Unexpected response format.");

    const p = normalizeProduct(data);

    const backLink = el(
      "a", { href: "products.html" },
      "← Back to products"
    );
    const img = el("img", {
      src: p.imageUrl,
      alt: data.image?.alt || p.title,
      loading: "eager",
    });
    const media = el("div", { class: "product-detail__media" }, img);

    const title = el("h1", {class: "product-detail__title" }, p.title);
    const price = el("p", { class: "price" }, USD.format(p.price));
    const desc = el(
      "p",
      { class: "product-detail__description" },
      p.description || "No description available."
    );

// Size picker. one radio per size available
    const sizeFieldset = el(
      "fieldset",
      { class: "size-picker" },
      el("legend", {}, "Select Size:"),
      ...p.sizes.map((sz) =>
        el(
          "label",
          { class: "size-option" },
          el("input", {
            type: "radio",
            name: "size",
            value: sz,
          }),
          sz
        )
      )
    );

    const addBtn = el("button", { class: "primary", id: "detail-add" }, "Add to cart");
    const msg = el("p", { id: "detail-msg", role: "alert", hidden: true });


    const body = el(
      "div",
      { class: "product-detail__body" },
      title,
      price,
      desc,
      sizeFieldset,
      addBtn,
      msg,
    );

    const view = el(
      "article",
      { class: "product-detail", dataset: { id: p.id } },
      backLink,
      media,
      body,
    );
    replace(root, view);

    addBtn.addEventListener("click", () => {
      const chosen = root.querySelector("input[name='size']:checked")?.value;
      if (!chosen) {
        msg.textContent = "please choose a size";
        msg.hidden = false;
        return;
      }
      
      msg.hidden = true;
      addToCart(p.id, 1);
      updateCartBadge(getCartCount());

      addBtn.disabled = true;
      const prev = addBtn.textContent;
      addBtn.textContent = "Added";
      setTimeout(() => {
        addBtn.textContent = prev;
        addBtn.disabled = false;
      }, 800);
    });


  } catch (err) {
    // Step 5: Handle network or data errors
    root.innerHTML = `
      <p class="error" role="alert">
        Could not load product. ${err.message}
      </p>
      <p><a href="products.html">Return to product list</a></p>
    `;
    console.error("Error loading product:", err);
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

  const backLink = el(
    "a",
    { href: "products.html", class: "back-link" },
    el("i", { class: "fa-solid fa-arrow-left", ariaHidden: "true" }),
    " Back to products"
  );
  root.prepend(backLink);
  
  const listEl = document.getElementById("cart-list");
  const subEl = document.getElementById("cart-subtotal");
  const taxEl = document.getElementById("cart-tax");
  const totEl = document.getElementById("cart-total");

  let catalog = [];
  try {
    catalog = await fetchProducts(); // normalized shape
  } catch {
    replace(
listEl,
el("p", { class: "error", role: "alert" }, "Could not load products. Please try again later.")
);
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
/** Build one cart-line element */
function cartLineElement(l) {
  const img = el("img", { src: l.imageUrl, alt: l.title, loading: "lazy" });

  const title = el("h3", { class: "cart-line__title" }, l.title);
  const meta = el("div", { class: "cart-line__meta" }, USD.format(l.price));

  const qty = el(
    "div",
    { class: "cart-line__qty" },
    el("button", { class: "ghost decr", type: "button", "aria-label": "Decrease quantity" }, "−"),
    el("input", { type: "number", min: 1, value: String(l.qty) }),
    el("button", { class: "ghost incr", type: "button", "aria-label": "Increase quantity" }, "+")
  );

  const actions = el(
    "div",
    { class: "cart-line__actions" },
    el("button", { class: "ghost remove", type: "button" }, "Remove")
  );

  const left = el("div", { class: "cart-line__left" }, title, meta, qty, actions);
  const total = el("div", { class: "cart-line__total" }, USD.format(l.lineTotal));

  return el("div", { class: "cart-line", dataset: { id: l.id } }, img, left, total);
}


/** Render the entire cart view */
function render() {
const lines = enrichLines();


if (!lines.length) {
replace(listEl, el("p", {}, "Your cart is empty."));
subEl.textContent = USD.format(0);
taxEl.textContent = USD.format(0);
totEl.textContent = USD.format(0);
return;
}


const frag = document.createDocumentFragment();
for (const l of lines) frag.appendChild(cartLineElement(l));
listEl.replaceChildren(frag);


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

   const frag = document.createDocumentFragment();
for (const l of lines) {
const row = el(
"div",
{ class: "cart-line", dataset: { id: l.id } },
el("img", { src: l.imageUrl, alt: l.title }),
el(
"div",
{},
el("h3", { class: "cart-line__title" }, l.title),
el("div", { class: "cart-line__meta" }, `${USD.format(l.price)} x ${l.qty}`)
),
el("div", { class: "cart-line__total" }, USD.format(l.lineTotal))
);
frag.appendChild(row);
}
listEl.replaceChildren(frag);


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

    const notice = el(
"div",
{ class: "notice", role: "status", ariaLive: "polite" },
el("h2", {}, "Thank You!"),
el("p", {}, "Your order has been placed. A confirmation is on its way."),
el("a", { class: "primary", href: "products.html" }, "Continue Shopping")
);


replace(root, notice);
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
