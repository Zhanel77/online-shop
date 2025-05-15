const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB (change the URI to your MongoDB connection string)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/online-shop';

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define Schemas and Models

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
});

const cartItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, default: 1 },
});

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  balance: { type: Number, default: 100 },
  cart: [cartItemSchema],
});

const Product = mongoose.model('Product', productSchema);
const User = mongoose.model('User', userSchema);

// Initialize products if none exist
async function initProducts() {
  const count = await Product.countDocuments();
  if (count === 0) {
    await Product.insertMany([
      { name: 'T-shirt', price: 19.99 },
      { name: 'Jeans', price: 49.99 },
      { name: 'Sneakers', price: 89.99 },
    ]);
    console.log('Sample products added.');
  }
}

initProducts();

// Routes

// User registration
app.post('/users/register', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(400).json({ error: 'Username exists' });

    const user = new User({ username });
    await user.save();
    res.json({ message: 'User registered', userId: user._id, balance: user.balance });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Get user profile (username and balance)
app.get('/users/:userId/profile', async (req, res) => {
  const userId = req.params.userId;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ username: user.username, balance: user.balance });
  } catch {
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// List products
app.get('/products', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Add product to cart (with quantity support)
app.post('/users/:userId/cart', async (req, res) => {
  const userId = req.params.userId;
  const { productId, quantity = 1 } = req.body;
  if (quantity < 1) return res.status(400).json({ error: 'Quantity must be at least 1' });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    // Check if product already in cart
    const cartItem = user.cart.find(item => item.product.equals(productId));
    if (cartItem) {
      cartItem.quantity += quantity;
    } else {
      user.cart.push({ product: productId, quantity });
    }
    await user.save();

    res.json({ message: 'Product added to cart', cart: user.cart });
  } catch {
    res.status(500).json({ error: 'Failed to add to cart' });
  }
});

// Update cart item quantity or remove if quantity=0
app.put('/users/:userId/cart', async (req, res) => {
  const userId = req.params.userId;
  const { productId, quantity } = req.body;

  if (quantity == null || quantity < 0) return res.status(400).json({ error: 'Quantity must be non-negative' });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const cartItemIndex = user.cart.findIndex(item => item.product.equals(productId));
    if (cartItemIndex === -1) return res.status(404).json({ error: 'Product not in cart' });

    if (quantity === 0) {
      user.cart.splice(cartItemIndex, 1);
    } else {
      user.cart[cartItemIndex].quantity = quantity;
    }

    await user.save();
    res.json({ message: 'Cart updated', cart: user.cart });
  } catch {
    res.status(500).json({ error: 'Failed to update cart' });
  }
});

// Update user balance
app.put('/users/:userId/balance', async (req, res) => {
  const userId = req.params.userId;
  const { balance } = req.body;
  if (balance == null || balance < 0) return res.status(400).json({ error: 'Balance must be non-negative' });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.balance = +balance.toFixed(2);
    await user.save();
    res.json({ message: 'Balance updated', balance: user.balance });
  } catch {
    res.status(500).json({ error: 'Failed to update balance' });
  }
});

// View cart with product details & totals
app.get('/users/:userId/cart', async (req, res) => {
  const userId = req.params.userId;

  try {
    const user = await User.findById(userId).populate('cart.product');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const detailedCart = user.cart.map(({ product, quantity }) => ({
      productId: product._id,
      name: product.name,
      price: product.price,
      quantity,
      totalPrice: +(product.price * quantity).toFixed(2),
    }));

    const totalAmount = detailedCart.reduce((sum, item) => sum + item.totalPrice, 0);
    res.json({ cart: detailedCart, totalAmount: +totalAmount.toFixed(2) });
  } catch {
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

// Checkout - deduct balance, clear cart
app.post('/users/:userId/checkout', async (req, res) => {
  const userId = req.params.userId;

  try {
    const user = await User.findById(userId).populate('cart.product');
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.cart.length === 0) return res.status(400).json({ error: 'Cart empty' });

    const total = user.cart.reduce((sum, { product, quantity }) => sum + product.price * quantity, 0);

    if (user.balance < total) return res.status(400).json({ error: 'Insufficient balance' });

    user.balance = +(user.balance - total).toFixed(2);
    const order = {
      orderId: new Date().getTime(), // simple order id
      userId: user._id,
      products: user.cart.map(({ product, quantity }) => ({
        productId: product._id,
        name: product.name,
        quantity,
        price: product.price,
      })),
      total: +total.toFixed(2),
    };

    user.cart = []; // clear cart
    await user.save();

    res.json({ message: 'Order placed', order, remainingBalance: user.balance });
  } catch {
    res.status(500).json({ error: 'Checkout failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Online Shopping API running on http://localhost:${PORT}`);
});
