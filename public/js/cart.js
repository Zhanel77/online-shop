// Helper: get query param userId
function getUserId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('userId') || localStorage.getItem('userId');
}

// Save userId to localStorage for session persistence
const currentUserId = getUserId();
if (!currentUserId) {
  alert('No userId found. Please register first.');
  window.location.href = 'index.html';
} else {
  localStorage.setItem('userId', currentUserId);
}

const cartList = document.getElementById('cart-list');
const checkoutBtn = document.getElementById('checkout-btn');
const checkoutMsg = document.getElementById('checkout-msg');
const userInfo = document.getElementById('user-info');

let userBalance = 0;

async function loadProfile() {
  const res = await fetch(`/users/${currentUserId}/profile`);
  if (res.ok) {
    const data = await res.json();
    userBalance = data.balance;
    userInfo.textContent = `User: ${data.username} | Balance: $${userBalance.toFixed(2)}`;
  } else {
    userInfo.textContent = 'Failed to load user profile.';
  }
}

async function loadCart() {
  checkoutMsg.textContent = '';
  const res = await fetch(`/users/${currentUserId}/cart`);
  if (!res.ok) {
    cartList.innerHTML = '<p>Failed to load cart.</p>';
    checkoutBtn.disabled = true;
    return;
  }
  const data = await res.json();
  if (data.cart.length === 0) {
    cartList.innerHTML = '<p>Your cart is empty.</p>';
    checkoutBtn.disabled = true;
    return;
  }

  cartList.innerHTML = '';
  data.cart.forEach(item => {
    const div = document.createElement('div');
    div.className = 'product flex-row';
    div.innerHTML = `
      <div>
        <strong>${item.name}</strong><br>
        Price: $${item.price.toFixed(2)}<br>
        Quantity: <input type="number" min="0" value="${item.quantity}" onchange="updateQuantity(${item.productId}, this.value)" />
      </div>
      <div>Total: $${item.totalPrice.toFixed(2)}</div>
    `;
    cartList.appendChild(div);
  });

  const totalDiv = document.createElement('div');
  totalDiv.style.fontWeight = 'bold';
  totalDiv.style.textAlign = 'right';
  totalDiv.style.marginTop = '10px';
  totalDiv.textContent = `Total Amount: $${data.totalAmount.toFixed(2)}`;
  cartList.appendChild(totalDiv);

  const canAfford = userBalance >= data.totalAmount;
  checkoutBtn.disabled = !canAfford;

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
  if (isNaN(quantity) || quantity < 0) {
    alert('Quantity must be a non-negative number');
    loadCart(); // revert invalid input
    return;
  }
  const res = await fetch(`/users/${currentUserId}/cart`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId, quantity }),
  });
  if (!res.ok) {
    alert('Failed to update cart');
  }
  loadCart();
}

checkoutBtn.addEventListener('click', async () => {
  checkoutMsg.textContent = '';
  checkoutBtn.disabled = true;
  const res = await fetch(`/users/${currentUserId}/checkout`, { method: 'POST' });
  const data = await res.json();
  if (res.ok) {
    checkoutMsg.style.color = 'green';
    checkoutMsg.textContent = `Order placed! Total: $${data.order.total.toFixed(2)}. Remaining balance: $${data.remainingBalance.toFixed(2)}`;
    userBalance = data.remainingBalance;
    loadProfile();
    loadCart();
  } else {
    checkoutMsg.style.color = 'red';
    if (data.error === 'Insufficient balance') {
      checkoutMsg.textContent = 'Checkout failed: Insufficient balance. Please remove items from your cart.';
    } else {
      checkoutMsg.textContent = data.error || 'Checkout failed';
    }
    checkoutBtn.disabled = false;
  }
});

window.onload = async () => {
  await loadProfile();
  await loadCart();
};
