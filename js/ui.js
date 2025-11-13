export function updateCartBadge(count) {
  const badge = document.querySelector(".cart-count"); //This lets app.js add items and refresh the number shown in the header. 
  if (!badge) return;
  badge.textContent = String(count);//render the number
  badge.hidden = count <= 0;
}

