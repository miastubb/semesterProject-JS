//import additional js files//
import { addToCart, getCartCount } from "./cart.js";
import { updateCartBadge } from "./ui.js";

const ENDPOINT = "https://v2.api.noroff.dev/rainy-days"; //uploading noroff api

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
    price: p.discountedPrice ?? p.price, 
    image: p.image?.url,
    gender,
  };
}
//attempt to load and display products on pages that have #list

(async function bootProducts() {
  const list = document.getElementById("list");//target container for product card
  if (!list) return; //not a product listing page, nothing to do
  list.innerHTML = "Loading…";
  const products = await fetchProducts();
  //render each product as a card with an add to cart button
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

/**keep the header cart accurate, on initial load plus whenever 
 * any part of the app use: "cart;updated"*/
updateCartBadge(getCartCount());

window.addEventListener("cart:updated", () => {
  updateCartBadge(getCartCount());
});

document.addEventListener("click", (e) => { //watches for clicks that bubble up from any .add-to-cart button//
  const btn = e.target.closest(".add-to-cart");//Reads the product data-id, calls addToCart(id, 1).Updates the badge immediately.//
  if (!btn) return;

  const id = btn.dataset.id;
  addToCart(id, 1);//update storage//

  updateCartBadge(getCartCount());

  btn.disabled = true;
  const prev = btn.textContent;
  btn.textContent = "added";
  setTimeout(() => {btn.textContent = prev; btn.disabled = false; }, 700);
});
/*
document.addEventListener('DOMContentLoaded', () => {
  const filterButtons = document.querySelectorAll('.filter-btn');
  const products = document.querySelectorAll('product');

   filterButtons.forEach(button => {
    button.addEventListener('click', (event) => {
      const selctedCategory = event.target.dataset.category;

        products.forEach(product => {
                const productCategory = product.dataset.category;
                 if (selectedCategory === 'all' || productCategory === selectedCategory) {
                    product.style.display = 'block'; // Show the product
                } else {
                    product.style.display = 'none'; // Hide the product
                }
    });
  });            trying to make a filter, code is clean but does nothing(incomplete/incorrect)
  });
}); */
