let currentUserId = null;
let userBalance = 0;

const registerSection = document.getElementById('register-section');
const productsSection = document.getElementById('products-section');
const cartSection = document.getElementById('cart-section');
const registerMsg = document.getElementById('register-msg');
const checkoutMsg = document.getElementById('checkout-msg');
const balanceDisplay = document.getElementById('balance-display');
const cartLink = document.getElementById('cart-link');

document.getElementById('register-btn').addEventListener('click', async () => {
  const username = document.getElementById('username').value.trim();
  registerMsg.textContent = '';
  if (!username) {
    registerMsg.textContent = 'Username is required';
    return;
  }
  const res = await fetch('/users/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  const data = await res.json();
  if (res.ok) {
    currentUserId = data.userId;
    userBalance = data.balance;
    registerMsg.textContent = `Registered! User ID: ${currentUserId}`;
    showSections();
    updateBalanceDisplay();
    loadProducts();
    loadCart();

    // Update Cart link with currentUserId
    if (cartLink) {
      cartLink.href = `cart.html?userId=${currentUserId}`;
    }
  } else {
    registerMsg.textContent = data.error || 'Error';
  }
});

function showSections() {
  registerSection.style.display = 'none';
  productsSection.style.display = 'block';
  cartSection.style.display = 'block';
  document.getElementById('profile-section').style.display = 'block';
}

function updateBalanceDisplay() {
  balanceDisplay.textContent = `Balance: $${userBalance.toFixed(2)}`;
}

async function loadProducts() {
  const res = await fetch('/products');
  const products = await res.json();
  const container = document.getElementById('products-list');
  container.innerHTML = '';
  products.forEach(p => {
    const div = document.createElement('div');
    div.className = 'product flex-row';
    div.innerHTML = `
      <div><strong>${p.name}</strong><br>Price: $${p.price.toFixed(2)}</div>
      <button onclick="addToCart(${p.id})">Add to Cart</button>
    `;
    container.appendChild(div);
  });
}

async function addToCart(productId) {
  if (!currentUserId) return alert('Register first');
  const res = await fetch(`/users/${currentUserId}/cart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId, quantity: 1 }),
  });
  const data = await res.json();
  if (res.ok) {
    loadCart();
  } else {
    alert(data.error || 'Failed to add to cart');
  }
}

async function loadCart() {
  if (!currentUserId) return;
  const res = await fetch(`/users/${currentUserId}/cart`);
  const data = await res.json();
  const container = document.getElementById('cart-list');
  checkoutMsg.textContent = '';

  if (data.cart.length === 0) {
    container.innerHTML = '<p>Your cart is empty.</p>';
    document.getElementById('checkout-btn').disabled = true;
    return;
  }

  container.innerHTML = '';
  data.cart.forEach(item => {
    const div = document.createElement('div');
    div.className = 'product flex-row';
    div.innerHTML = `
      <div>
        <strong>${item.name}</strong><br>
        Price: $${item.price.toFixed(2)}<br>
        Quantity: <input type="number" min="0" value="${item.quantity}" class="cart-item-quantity" onchange="updateQuantity(${item.productId}, this.value)" />
      </div>
      <div>Total: $${item.totalPrice.toFixed(2)}</div>
    `;
    container.appendChild(div);
  });

  const totalDiv = document.createElement('div');
  totalDiv.style.fontWeight = 'bold';
  totalDiv.style.textAlign = 'right';
  totalDiv.style.marginTop = '10px';
  totalDiv.textContent = `Total Amount: $${data.totalAmount.toFixed(2)}`;
  container.appendChild(totalDiv);

  // Enable or disable checkout button based on balance
  const canAfford = userBalance >= data.totalAmount;
  document.getElementById('checkout-btn').disabled = !canAfford;

  if (!canAfford) {
    checkoutMsg.textContent = 'Insufficient balance to checkout. Please remove some items.';
    checkoutMsg.style.color = 'red';
  } else {
    checkoutMsg.textContent = '';
    checkoutMsg.style.color = '';
  }
}

async function updateQuantity(productId, quantity) {
  quantity = Number(quantity);
  if (isNaN(quantity) || quantity < 0) return alert('Quantity must be a non-negative number');
  const res = await fetch(`/users/${currentUserId}/cart`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId, quantity }),
  });
  const data = await res.json();
  if (res.ok) {
    loadCart();
  } else {
    alert(data.error || 'Failed to update cart');
  }
}

document.getElementById('checkout-btn').addEventListener('click', async () => {
  if (!currentUserId) return alert('Register first');
  checkoutMsg.textContent = '';
  const res = await fetch(`/users/${currentUserId}/checkout`, { method: 'POST' });
  const data = await res.json();
  if (res.ok) {
    checkoutMsg.style.color = 'green';
    checkoutMsg.textContent = `Order placed! Total: $${data.order.total.toFixed(2)}. Remaining balance: $${data.remainingBalance.toFixed(2)}`;
    userBalance = data.remainingBalance;
    updateBalanceDisplay();
    loadCart();
  } else {
    checkoutMsg.style.color = 'red';
    if (data.error === 'Insufficient balance') {
      checkoutMsg.textContent = 'Checkout failed: Insufficient balance. Please remove items from your cart.';
    } else {
      checkoutMsg.textContent = data.error || 'Checkout failed';
    }
  }
});

const balanceInput = document.getElementById('balance-input');
const updateBalanceBtn = document.getElementById('update-balance-btn');
const balanceMsg = document.getElementById('balance-msg');
const checkoutBtn = document.getElementById('checkout-btn');

updateBalanceBtn.addEventListener('click', async () => {
  const newBalance = parseFloat(balanceInput.value);
  balanceMsg.textContent = '';
  if (isNaN(newBalance) || newBalance < 0) {
    balanceMsg.style.color = 'red';
    balanceMsg.textContent = 'Please enter a valid non-negative number';
    return;
  }
  if (!currentUserId) {
    balanceMsg.style.color = 'red';
    balanceMsg.textContent = 'No user logged in';
    return;
  }
  const res = await fetch(`/users/${currentUserId}/balance`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ balance: newBalance }),
  });
  const data = await res.json();
  if (res.ok) {
    userBalance = data.balance;
    updateBalanceDisplay();
    balanceMsg.style.color = 'green';
    balanceMsg.textContent = 'Balance updated successfully';
    loadCart();
  } else {
    balanceMsg.style.color = 'red';
    balanceMsg.textContent = data.error || 'Failed to update balance';
  }
});

// Checkout button cooldown timer (optional feature)
checkoutBtn.addEventListener('click', async () => {
  if (!currentUserId) return alert('Register first');
  checkoutMsg.textContent = '';

  // Disable button with countdown
  checkoutBtn.disabled = true;
  let countdown = 5;
  const originalText = checkoutBtn.textContent;
  checkoutBtn.textContent = `Please wait (${countdown})`;

  const timerId = setInterval(() => {
    countdown--;
    if (countdown > 0) {
      checkoutBtn.textContent = `Please wait (${countdown})`;
    } else {
      clearInterval(timerId);
      checkoutBtn.textContent = originalText;
      loadCart(); // re-enable button state based on cart & balance
    }
  }, 1000);

  const res = await fetch(`/users/${currentUserId}/checkout`, { method: 'POST' });
  const data = await res.json();
  if (res.ok) {
    checkoutMsg.style.color = 'green';
    checkoutMsg.textContent = `Order placed! Total: $${data.order.total.toFixed(2)}. Remaining balance: $${data.remainingBalance.toFixed(2)}`;
    userBalance = data.remainingBalance;
    updateBalanceDisplay();
    loadCart();
  } else {
    checkoutMsg.style.color = 'red';
    if (data.error === 'Insufficient balance') {
      checkoutMsg.textContent = 'Checkout failed: Insufficient balance. Please remove items from your cart.';
    } else {
      checkoutMsg.textContent = data.error || 'Checkout failed';
    }
  }
});
