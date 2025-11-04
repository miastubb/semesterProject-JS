export function updateCartBadge(count) {
  const badge = document.querySelector(".cart-count"); //This lets app.js add items and refresh the number shown in the header. 
  if (!badge) return;
  badge.textContent = String(count);//render the number
  badge.hidden = count <= 0;
}
function displayError(message) {
  let errorContainer = document.querySelector(".error-container");

  if (!errorContainer) {
    errorContainer = document.createElement("div");
    errorContainer.classList.add("error-message");
    document.body.prepend(errorContainer);
  }

  errorContainer.textContent = message;
  errorContainer.computedStyleMap.color = "white";
  errorContainer.style.backgroundColor = "#c0392b";
  errorContainer.style.padding = "1rem";
  errorContainer.style.textAlign = "center";
  errorContainer.style.fontWeight = "bold";
}
