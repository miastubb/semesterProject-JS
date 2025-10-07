import { addToCart, getCartCount } from "./cart.js";
import { updateCartBadge } from "./ui.js";

const ENDPOINT = "https://v2.api.noroff.dev/rainy-days";

async function fetchProducts() {
  const res = await fetch(ENDPOINT, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { data } = await res.json();              
  return data.map(mapRainyDays);
}

function mapRainyDays(p) {
  const g = String(p.gender || "").toLowerCase();
  const gender = g.includes("female") ? "women" : g.includes("male") ? "men" : "unisex";
  return {
    id: p.id,
    title: p.title,
    price: p.discountedPrice ?? p.price,
    image: p.image?.url,
    gender,
  };
}

(async function bootProducts() {
  const list = document.getElementById("list");
  if (!list) return;
  list.innerHTML = "Loading…";
  const products = await fetchProducts();
  list.innerHTML = products.map(p => `
    <article class="card" data-id="${p.id}">
      <img src="${p.image}" alt="${p.title}" loading="lazy" />
      <h3>${p.title}</h3>
      <p class="price">NOK ${p.price}</p>
      <small>${p.gender}</small>
      <button class="primary add-to-cart" data-id="${p.id}">Add to cart</button>
    </article>
  `).join("");
})();


updateCartBadge(getCartCount());

window.addEventListener("cart:updated", () => {
  updateCartBadge(getCartCount());
});

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".add-to-cart");
  if (!btn) return;

  const id = btn.dataset.id;
  addToCart(id, 1);

  updateCartBadge(getCartCount());

  btn.disabled = true;
  const prev = btn.textContent;
  btn.textContent = "added";
  setTimeout(() => {btn.textContent = prev; btn.disabled = false; }, 700);
});