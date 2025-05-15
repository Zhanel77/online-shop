const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

let users = [];
let products = [
  { id: 1, name: 'T-shirt', price: 19.99 },
  { id: 2, name: 'Jeans', price: 49.99 },
  { id: 3, name: 'Sneakers', price: 89.99 },
];
let nextUserId = 1;
let nextOrderId = 1;

// User registration (with initial balance $100)
app.post('/users/register', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });
  if (users.find(u => u.username === username)) {
    return res.status(400).json({ error: 'Username exists' });
  }
  const user = { id: nextUserId++, username, cart: [], balance: 100 };
  users.push(user);
  res.json({ message: 'User registered', userId: user.id, balance: user.balance });
});

// Get user profile (username and balance)
app.get('/users/:userId/profile', (req, res) => {
  const userId = parseInt(req.params.userId);
  const user = users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ username: user.username, balance: user.balance });
});

// List products
app.get('/products', (req, res) => {
  res.json(products);
});

// Add product to cart (with quantity support)
app.post('/users/:userId/cart', (req, res) => {
  const userId = parseInt(req.params.userId);
  const { productId, quantity = 1 } = req.body;
  const user = users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const product = products.find(p => p.id === productId);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  if (quantity < 1) return res.status(400).json({ error: 'Quantity must be at least 1' });

  // If product exists in cart, update quantity, else add new
  const cartItem = user.cart.find(item => item.productId === productId);
  if (cartItem) {
    cartItem.quantity += quantity;
  } else {
    user.cart.push({ productId, quantity });
  }

  res.json({ message: 'Product added to cart', cart: user.cart });
});

// Update cart item quantity
app.put('/users/:userId/cart', (req, res) => {
  const userId = parseInt(req.params.userId);
  const { productId, quantity } = req.body;
  const user = users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (quantity < 0) return res.status(400).json({ error: 'Quantity must be non-negative' });

  const cartItemIndex = user.cart.findIndex(item => item.productId === productId);
  if (cartItemIndex === -1) return res.status(404).json({ error: 'Product not in cart' });

  if (quantity === 0) {
    // Remove item if quantity 0
    user.cart.splice(cartItemIndex, 1);
  } else {
    user.cart[cartItemIndex].quantity = quantity;
  }
  res.json({ message: 'Cart updated', cart: user.cart });
});

// Update user balance
app.put('/users/:userId/balance', (req, res) => {
  const userId = parseInt(req.params.userId);
  const { balance } = req.body;
  if (balance == null || balance < 0) return res.status(400).json({ error: 'Balance must be non-negative' });
  const user = users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  user.balance = +balance.toFixed(2);
  res.json({ message: 'Balance updated', balance: user.balance });
});


// View cart with product details & totals
app.get('/users/:userId/cart', (req, res) => {
  const userId = parseInt(req.params.userId);
  const user = users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const detailedCart = user.cart.map(({ productId, quantity }) => {
    const product = products.find(p => p.id === productId);
    return {
      productId,
      name: product.name,
      price: product.price,
      quantity,
      totalPrice: +(product.price * quantity).toFixed(2),
    };
  });

  const totalAmount = detailedCart.reduce((sum, item) => sum + item.totalPrice, 0);
  res.json({ cart: detailedCart, totalAmount: +totalAmount.toFixed(2) });
});

// Checkout - deduct balance, clear cart
app.post('/users/:userId/checkout', (req, res) => {
  const userId = parseInt(req.params.userId);
  const user = users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.cart.length === 0) return res.status(400).json({ error: 'Cart empty' });

  const total = user.cart.reduce((sum, { productId, quantity }) => {
    const product = products.find(p => p.id === productId);
    return sum + product.price * quantity;
  }, 0);

  if (user.balance < total) return res.status(400).json({ error: 'Insufficient balance' });

  // Deduct balance and clear cart
  user.balance = +(user.balance - total).toFixed(2);
  const order = {
    orderId: nextOrderId++,
    userId: user.id,
    products: [...user.cart],
    total: +total.toFixed(2),
  };
  user.cart = [];

  res.json({ message: 'Order placed', order, remainingBalance: user.balance });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Online Shopping API running on http://localhost:${PORT}`);
});
