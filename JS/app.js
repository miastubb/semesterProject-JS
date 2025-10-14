//import additional js files//
import { addToCart, getCartCount, getCart, saveCart, setCartQty, removeFromCart, clearCart } from "./cart.js";
import { updateCartBadge } from "./ui.js";

const ENDPOINT = "https://v2.api.noroff.dev/rainy-days"; //uploading noroff api

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,

});
updateCartBadge(getCartCount());
window.addEventListener("cart:updated", () => updateCartBadge(getCartCount()));

async function fetchProducts() {
  const res = await fetch(ENDPOINT, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { data } = await res.json();              
  return data.map(mapRainyDays);
}

function mapRainyDays(p) {
  const g = String(p.gender || "").toLowerCase();
  const gender = g.includes("female") ? "women" : g.includes("male") ? "men" : "unisex";
  return { //normalize gender into to "women", "men", and "unisex"
    id: p.id,
    title: p.title,
    price: Number(p.discountedPrice ?? p.price),
    image: p.image?.url,
    gender,
  };
}
//render helpers//
function buildCard(p) {
  return `
    <article class="card" data-id="${p.id}">
      <img src="${p.image}" alt="${p.title}" loading="lazy" />
      <h3 class="card__title">${p.title}</h3>
      <p class="price">${USD.format(p.price)}</p>
      <small class="tag">${p.gender}</small>
      <button class="primary add-to-cart" data-id="${p.id}">Add to cart</button>
    </article>
  `;
}
function renderProducts(listEl, products) {
  if (!products?.length) {
   listEl.innerHTML = `<p class="notice">No products matched your filters.</p>`;
   return;
  }
  listEl.innerHTML = products.map(buildCard).join("");
}

//filtering//
function getFilters() {
  const gender = (document.getElementById("filter-gender")?.value || "").trim().toLowerCase();
  const q = (document.getElementById("filter-search")?.value || "").trim().toLowerCase();
  return { gender, q };
}

function applyFilters(raw) {
  const { gender, q } = getFilters();
  return raw.filter((p) => {
    const matchGender = !gender || p.gender === gender || (gender === "women" && p.gender === "unisex") || (gender === "men" && p.gender === "unisex")
  ? true
  : false;

  const matchQuery = !q || p.title.toLowerCase().includes(q);
  return matchGender && matchQuery;
  });
}

//boot + events//
let ALL_PRODUCTS = [];

(async function boot() {
  updateCartBadge(getCartCount());
  window.addEventListener("cart:updated", () => updateCartBadge(getCartCount()));

  const list = document.getElementById("list");
  if (!list) return;
  list.innerHTML = `<span class="spinner">Loading...</span>`;

  try {
    ALL_PRODUCTS = await fetchProducts();
    renderProducts(list, ALL_PRODUCTS);
    bindControls(list);
  } catch (err) {
    list.innerHTML = `<p class="error">Could not load products. ${err.message}</p>`;
  }
  })();

  function bindControls(listEl) {
    //aply button
    document.getElementById("apply-filters")?.addEventListener("click", () => {
      const filtered = applyFilters(ALL_PRODUCTS);
      renderProducts(listEl, filtered);
    });
  
    //clear button
    document.getElementById("clear-filters")?.addEventListener("click", () => {
      const g = document.getElementById("filter-gender");
        const s = document.getElementById("filter-search");
        if (g) g.value = "";
        if (s) s.value = "";
        renderProducts(listEl, ALL_PRODUCTS);
    });

    //live search as you type
    document.getElementById("filter-search")?.addEventListener("input", () => {
      const filtered = applyFilters(ALL_PRODUCTS);
      renderProducts(listEl, filtered);
    });

    //Add-to-cart (event delegation keeps it simple after re-renders)
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".add-to-cart");
      if (!btn) return;
      const id = btn.dataset.id;
      addToCart(id, 1);
      updateCartBadge(getCartCount());
      btn.disabled = true;
      const prev = btn.textContent;
      btn.textContent = "Added";
      setTimeout(() => { btn.textContent = prev; btn.disabled = false; }, 700);
    });
  }
  // Removed duplicate USD declaration

//cart page
(async function bootCartPage() {
  const root = document.getElementById("cart-root");
  if (!root) return; //not on cart.html

  const listEl = document.getElementById("cart-list");
   const subEl = document.getElementById("cart-subtotal");
   const taxEl = document.getElementById("cart-tax");
   const totEl = document.getElementById("cart-total");

  let catalog = [];
  try {
    catalog = await fetchProducts();
  } catch {
    listEl.innerHTML = `<p class="error">Could not load products. Please try again later.</p>`;
    return;
  }
  const byId = new Map(catalog.map(p => [p.id, p]));

  function enrich() {
    return getCart()
    .map(({ id, qty }) => {
      const p = byId.get(id);
      if (!p) return null;//product dissapeared from catalog
      const price= Number(p.price ?? p.discountedPrice ?? 0);
      return {
        id, qty,
        title:p.title,
        image: typeof p.image === "string" ? p.image : (p.image?.url || ""),
        price,
        lineTotal: price * qty,
      };
    })
    .filter(Boolean);
}

function render() {
  const lines = enrich();

  if (!lines.length) {
      listEl.innerHTML = `<p>Your cart is empty.</p>`;
      subEl.textContent = USD.format(0);
      taxEl.textContent = USD.format(0);
      totEl.textContent = USD.format(0);
      return;
    }
      listEl.innerHTML = lines.map(l => `
      <div class="cart-line" data-id="${l.id}">
        <img src="${l.image}" alt="${l.title}">
        <div>
          <h3 class="cart-line__title">${l.title}</h3>
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
    `).join("");

    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    const tax = 0; // set your tax calculation if needed
    const total = subtotal + tax;

    subEl.textContent = USD.format(subtotal);
    taxEl.textContent = USD.format(tax);
    totEl.textContent = USD.format(total);
  }
   document.addEventListener("input", (e) => {
    const input = e.target.closest(".cart-line input[type='number']");
    if (!input) return;
    const wrap = input.closest(".cart-line");
    const id = wrap?.dataset.id;
    setCartQty(id, input.value);
    render();
  });

  // + / − buttons
  document.addEventListener("click", (e) => {
    const minus = e.target.closest(".cart-line .decr");
    const plus  = e.target.closest(".cart-line .incr");
    const remove = e.target.closest(".cart-line .remove");
    const clearBtn = e.target.closest("#cart-clear");

    if (minus || plus) {
      const wrap = e.target.closest(".cart-line");
      const id = wrap?.dataset.id;
      const qtyInput = wrap.querySelector("input[type='number']");
      let next = Math.max(1, parseInt(qtyInput.value || "1", 10) + (minus ? -1 : 1));
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
