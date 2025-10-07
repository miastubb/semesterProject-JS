export function updateCartBadge(count) {
  const badge = document.querySelector(".cart-count");
  if (!badge) return;
  badge.textContent = String(count);
  badge.hidden = count <= 0;
}