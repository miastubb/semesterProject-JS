const KEY = "rainydays_cart_v1";

export function getCart() {
  try {return JSON.parse(localStorage.getItem(KEY)) ||[]; }
  catch { return[];}
}

export function saveCart(items) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("cart:updated", {detail: {items} }));
}

export function addToCart(productId, qty = 1) {
  const items = getCart();
  const found = items.find(i => i.id === productId);
  if (found) found.qty += qty;
  else items.push({ id: productId, qty });
  saveCart(items);
}

export function getCartCount() {
  return getCart().reduce((sum, i) => sum + i.qty, 0);
}
