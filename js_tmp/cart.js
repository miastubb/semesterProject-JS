const KEY = "rainydays_cart_v1";
//read cart array from storage
export function getCart() {
  try {return JSON.parse(localStorage.getItem(KEY)) ||[]; }
  catch { return []; }
}
//save the cart back to storage
export function saveCart(items) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("cart:updated", {detail: {items} }));
}
//add a product or bump its quantity
export function addToCart(productId, qty = 1) {
  const items = getCart();
  const found = items.find(i => i.id === productId);
  if (found) found.qty += qty;
  else items.push({ id: productId, qty });
  saveCart(items);
}
//return the quantity across all lines
export function getCartCount() {
  return getCart().reduce((sum, i) => sum + i.qty, 0);
}

export function removeFromCart(productId) {
  const next = getCart().filter(i => i.id !== productId);
  saveCart(next); //must dispatch "cart:updated" inside saveCart

}

export function setCartQty(productId, qty) {
  const q = Math.max(1, Number(qty) || 1);
  const items = getCart();
  const row = items.find(i => i.id === productId);
  if (row) { row.qty = q;
  saveCart(items); //must dispatch "cart:updated" inside saveCart
}
}

export function clearCart() {
  saveCart([]); //must dispatch "cart:updated" inside saveCart
}
