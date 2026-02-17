/**
 * Mock API Server
 *
 * Simulates a REST API with:
 * - Artificial delays to demonstrate caching benefits
 * - Request logging to show coalescing
 * - v1 and v2 endpoints with different response shapes
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';

const app = express();
const PORT = 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const mfeSource = req.headers['x-mfe-source'] || 'unknown';
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] ${req.method} ${req.path}`);
  console.log(`  └─ MFE Source: ${mfeSource}`);
  console.log(`  └─ Headers:`, JSON.stringify(req.headers, null, 2).split('\n').slice(0, 5).join('\n'));
  next();
});

// Simulated delay to demonstrate caching
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper to safely parse int from params
const parseId = (value: string | undefined): number => parseInt(value ?? '0', 10);

// ============================================================
// In-Memory Database
// ============================================================

let requestCount = 0;

const users = new Map([
  [1, { id: 1, name: 'Alice Johnson', email: 'alice@example.com', avatar: 'https://i.pravatar.cc/150?u=alice', createdAt: '2024-01-15T10:00:00Z' }],
  [2, { id: 2, name: 'Bob Smith', email: 'bob@example.com', avatar: 'https://i.pravatar.cc/150?u=bob', createdAt: '2024-02-20T14:30:00Z' }],
  [3, { id: 3, name: 'Carol White', email: 'carol@example.com', avatar: 'https://i.pravatar.cc/150?u=carol', createdAt: '2024-03-10T09:15:00Z' }],
]);

const userStatsV2 = new Map([
  [1, { bio: 'Software engineer passionate about MFE architecture', preferences: { theme: 'dark', notifications: true }, stats: { totalOrders: 15, totalSpent: 1250.00 } }],
  [2, { bio: 'Product manager with 10 years experience', preferences: { theme: 'light', notifications: false }, stats: { totalOrders: 8, totalSpent: 680.50 } }],
  [3, { bio: 'UX designer focused on accessibility', preferences: { theme: 'dark', notifications: true }, stats: { totalOrders: 22, totalSpent: 2100.75 } }],
]);

const orders = new Map([
  [101, { id: 101, userId: 1, status: 'delivered', items: [{ productId: 1, productName: 'Laptop Stand', quantity: 1, price: 79.99 }], total: 79.99, createdAt: '2024-03-01T10:00:00Z', updatedAt: '2024-03-05T14:00:00Z' }],
  [102, { id: 102, userId: 1, status: 'shipped', items: [{ productId: 2, productName: 'Mechanical Keyboard', quantity: 1, price: 149.99 }], total: 149.99, createdAt: '2024-03-10T11:00:00Z', updatedAt: '2024-03-12T09:00:00Z' }],
  [103, { id: 103, userId: 2, status: 'processing', items: [{ productId: 3, productName: 'USB-C Hub', quantity: 2, price: 45.00 }], total: 90.00, createdAt: '2024-03-15T16:00:00Z', updatedAt: '2024-03-15T16:00:00Z' }],
  [104, { id: 104, userId: 1, status: 'pending', items: [{ productId: 4, productName: 'Monitor Light Bar', quantity: 1, price: 59.99 }], total: 59.99, createdAt: '2024-03-18T08:00:00Z', updatedAt: '2024-03-18T08:00:00Z' }],
]);

const products = new Map([
  [1, { id: 1, name: 'Laptop Stand', description: 'Ergonomic aluminum laptop stand', price: 79.99, stock: 50, category: 'Accessories', imageUrl: 'https://picsum.photos/seed/laptop-stand/200' }],
  [2, { id: 2, name: 'Mechanical Keyboard', description: 'RGB mechanical keyboard with Cherry MX switches', price: 149.99, stock: 30, category: 'Peripherals', imageUrl: 'https://picsum.photos/seed/keyboard/200' }],
  [3, { id: 3, name: 'USB-C Hub', description: '7-in-1 USB-C hub with HDMI', price: 45.00, stock: 100, category: 'Accessories', imageUrl: 'https://picsum.photos/seed/usb-hub/200' }],
  [4, { id: 4, name: 'Monitor Light Bar', description: 'LED monitor light bar with touch controls', price: 59.99, stock: 25, category: 'Lighting', imageUrl: 'https://picsum.photos/seed/light-bar/200' }],
]);

let nextUserId = 4;
let nextOrderId = 105;
let nextItemId = 6;

// Simple items for demo - showcases coalescing clearly
const items = new Map([
  [1, { id: 1, name: 'MacBook Pro', description: 'Powerful laptop for developers', price: 2499.99 }],
  [2, { id: 2, name: 'iPhone 15', description: 'Latest smartphone from Apple', price: 999.99 }],
  [3, { id: 3, name: 'AirPods Pro', description: 'Premium wireless earbuds', price: 249.99 }],
  [4, { id: 4, name: 'iPad Air', description: 'Versatile tablet for work and play', price: 599.99 }],
  [5, { id: 5, name: 'Apple Watch', description: 'Smartwatch with health tracking', price: 399.99 }],
]);

// ============================================================
// Helper Functions
// ============================================================

function paginate<T>(items: T[], page: number, limit: number) {
  const start = (page - 1) * limit;
  const data = items.slice(start, start + limit);
  return {
    data,
    total: items.length,
    page,
    limit,
    totalPages: Math.ceil(items.length / limit),
  };
}

// ============================================================
// API Routes - V1
// ============================================================

// GET /api/v1/users
app.get('/api/v1/users', async (req: Request, res: Response) => {
  requestCount++;
  console.log(`  └─ Request #${requestCount} - Fetching users list (v1)`);

  await delay(500); // Simulate network latency

  const page = parseInt(String(req.query.page ?? '1'), 10);
  const limit = parseInt(String(req.query.limit ?? '10'), 10);
  const search = req.query.search as string | undefined;

  let userList = Array.from(users.values());

  if (search) {
    userList = userList.filter(
      (u) =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
    );
  }

  res.json(paginate(userList, page, limit));
});

// GET /api/v1/users/:id
app.get('/api/v1/users/:id', async (req: Request, res: Response) => {
  requestCount++;
  const id = parseId(req.params.id);
  console.log(`  └─ Request #${requestCount} - Fetching user ${id} (v1)`);

  await delay(300);

  const user = users.get(id);
  if (!user) {
    res.status(404).json({ message: 'User not found', code: 'USER_NOT_FOUND' });
    return;
  }

  res.json(user);
});

// POST /api/v1/users
app.post('/api/v1/users', async (req: Request, res: Response) => {
  requestCount++;
  console.log(`  └─ Request #${requestCount} - Creating user (v1)`);

  await delay(400);

  const { name, email } = req.body;
  const newUser = {
    id: nextUserId++,
    name,
    email,
    avatar: `https://i.pravatar.cc/150?u=${email}`,
    createdAt: new Date().toISOString(),
  };

  users.set(newUser.id, newUser);
  userStatsV2.set(newUser.id, {
    bio: '',
    preferences: { theme: 'light', notifications: true },
    stats: { totalOrders: 0, totalSpent: 0 },
  });

  console.log(`  └─ Created user: ${newUser.name} (ID: ${newUser.id})`);
  res.status(201).json(newUser);
});

// PATCH /api/v1/users/:id
app.patch('/api/v1/users/:id', async (req: Request, res: Response) => {
  requestCount++;
  const id = parseId(req.params.id);
  console.log(`  └─ Request #${requestCount} - Updating user ${id} (v1)`);

  await delay(400);

  const user = users.get(id);
  if (!user) {
    res.status(404).json({ message: 'User not found', code: 'USER_NOT_FOUND' });
    return;
  }

  const updated = { ...user, ...req.body };
  users.set(id, updated);

  console.log(`  └─ Updated user: ${updated.name}`);
  res.json(updated);
});

// DELETE /api/v1/users/:id
app.delete('/api/v1/users/:id', async (req: Request, res: Response) => {
  requestCount++;
  const id = parseId(req.params.id);
  console.log(`  └─ Request #${requestCount} - Deleting user ${id} (v1)`);

  await delay(300);

  if (!users.has(id)) {
    res.status(404).json({ message: 'User not found', code: 'USER_NOT_FOUND' });
    return;
  }

  users.delete(id);
  userStatsV2.delete(id);
  res.status(204).send();
});

// ============================================================
// API Routes - V2 (Enhanced)
// ============================================================

// GET /api/v2/users/:id - Returns extended user data
app.get('/api/v2/users/:id', async (req: Request, res: Response) => {
  requestCount++;
  const id = parseId(req.params.id);
  console.log(`  └─ Request #${requestCount} - Fetching user ${id} (v2 - enhanced)`);

  await delay(350);

  const user = users.get(id);
  const stats = userStatsV2.get(id);

  if (!user || !stats) {
    res.status(404).json({ message: 'User not found', code: 'USER_NOT_FOUND' });
    return;
  }

  // V2 returns extended data
  const v2User = {
    ...user,
    ...stats,
  };

  res.json(v2User);
});

// ============================================================
// Order Routes
// ============================================================

// GET /api/v1/orders
app.get('/api/v1/orders', async (req: Request, res: Response) => {
  requestCount++;
  console.log(`  └─ Request #${requestCount} - Fetching orders list`);

  await delay(400);

  const page = parseInt(String(req.query.page ?? '1'), 10);
  const limit = parseInt(String(req.query.limit ?? '10'), 10);
  const userId = req.query.userId ? parseInt(String(req.query.userId), 10) : undefined;
  const status = req.query.status as string | undefined;

  let orderList = Array.from(orders.values());

  if (userId) {
    orderList = orderList.filter((o) => o.userId === userId);
  }
  if (status) {
    orderList = orderList.filter((o) => o.status === status);
  }

  res.json(paginate(orderList, page, limit));
});

// GET /api/v1/orders/:id
app.get('/api/v1/orders/:id', async (req: Request, res: Response) => {
  requestCount++;
  const id = parseId(req.params.id);
  console.log(`  └─ Request #${requestCount} - Fetching order ${id}`);

  await delay(300);

  const order = orders.get(id);
  if (!order) {
    res.status(404).json({ message: 'Order not found', code: 'ORDER_NOT_FOUND' });
    return;
  }

  res.json(order);
});

// GET /api/v1/users/:userId/orders
app.get('/api/v1/users/:userId/orders', async (req: Request, res: Response) => {
  requestCount++;
  const userId = parseId(req.params.userId);
  console.log(`  └─ Request #${requestCount} - Fetching orders for user ${userId}`);

  await delay(400);

  const userOrders = Array.from(orders.values()).filter((o) => o.userId === userId);
  res.json(userOrders);
});

// POST /api/v1/orders
app.post('/api/v1/orders', async (req: Request, res: Response) => {
  requestCount++;
  console.log(`  └─ Request #${requestCount} - Creating order`);

  await delay(500);

  const { userId, items } = req.body;

  // Calculate order details
  const orderItems = items.map((item: { productId: number; quantity: number }) => {
    const product = products.get(item.productId);
    return {
      productId: item.productId,
      productName: product?.name || 'Unknown Product',
      quantity: item.quantity,
      price: product?.price || 0,
    };
  });

  const total = orderItems.reduce(
    (sum: number, item: { price: number; quantity: number }) => sum + item.price * item.quantity,
    0
  );

  const newOrder = {
    id: nextOrderId++,
    userId,
    status: 'pending' as const,
    items: orderItems,
    total,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  orders.set(newOrder.id, newOrder);

  // Update user stats for v2
  const userStats = userStatsV2.get(userId);
  if (userStats) {
    userStats.stats.totalOrders++;
    userStats.stats.totalSpent += total;
  }

  console.log(`  └─ Created order #${newOrder.id} for user ${userId}`);
  res.status(201).json(newOrder);
});

// PATCH /api/v1/orders/:id/status
app.patch('/api/v1/orders/:id/status', async (req: Request, res: Response) => {
  requestCount++;
  const id = parseId(req.params.id);
  console.log(`  └─ Request #${requestCount} - Updating order ${id} status`);

  await delay(300);

  const order = orders.get(id);
  if (!order) {
    res.status(404).json({ message: 'Order not found', code: 'ORDER_NOT_FOUND' });
    return;
  }

  const { status } = req.body;
  order.status = status;
  order.updatedAt = new Date().toISOString();

  console.log(`  └─ Order #${id} status -> ${status}`);
  res.json(order);
});

// ============================================================
// Product Routes
// ============================================================

// GET /api/v1/products
app.get('/api/v1/products', async (req: Request, res: Response) => {
  requestCount++;
  console.log(`  └─ Request #${requestCount} - Fetching products list`);

  await delay(300);

  const page = parseInt(String(req.query.page ?? '1'), 10);
  const limit = parseInt(String(req.query.limit ?? '10'), 10);

  res.json(paginate(Array.from(products.values()), page, limit));
});

// GET /api/v1/products/:id
app.get('/api/v1/products/:id', async (req: Request, res: Response) => {
  requestCount++;
  const id = parseId(req.params.id);
  console.log(`  └─ Request #${requestCount} - Fetching product ${id}`);

  await delay(200);

  const product = products.get(id);
  if (!product) {
    res.status(404).json({ message: 'Product not found', code: 'PRODUCT_NOT_FOUND' });
    return;
  }

  res.json(product);
});

// ============================================================
// Items Routes (SLOW - for demonstrating coalescing)
// ============================================================

// GET /api/v1/items - SLOW endpoint (3-4 seconds) to demonstrate coalescing
app.get('/api/v1/items', async (req: Request, res: Response) => {
  requestCount++;
  const mfeSource = req.headers['x-mfe-source'] || 'unknown';
  console.log(`  └─ Request #${requestCount} - Fetching items list (SLOW - 3.5s delay)`);
  console.log(`  └─ Source MFE: ${mfeSource}`);

  // SLOW! This makes coalescing very visible
  await delay(3500);

  res.json({
    data: Array.from(items.values()),
    total: items.size,
    fetchedAt: new Date().toISOString(),
  });
});

// GET /api/v1/items/stats - Stats endpoint for the demo
app.get('/api/v1/items/stats', async (req: Request, res: Response) => {
  requestCount++;
  console.log(`  └─ Request #${requestCount} - Fetching items stats (SLOW - 3s delay)`);

  await delay(3000);

  const itemList = Array.from(items.values());
  const totalValue = itemList.reduce((sum, item) => sum + item.price, 0);

  res.json({
    totalItems: items.size,
    totalValue: totalValue.toFixed(2),
    averagePrice: (totalValue / items.size).toFixed(2),
    fetchedAt: new Date().toISOString(),
  });
});

// POST /api/v1/items - Add new item
app.post('/api/v1/items', async (req: Request, res: Response) => {
  requestCount++;
  console.log(`  └─ Request #${requestCount} - Creating item`);

  await delay(500);

  const { name, description, price } = req.body;
  const newItem = {
    id: nextItemId++,
    name,
    description,
    price: Number(price),
  };

  items.set(newItem.id, newItem);

  console.log(`  └─ Created item: ${newItem.name} (ID: ${newItem.id})`);
  res.status(201).json(newItem);
});

// PATCH /api/v1/items/:id - Update item
app.patch('/api/v1/items/:id', async (req: Request, res: Response) => {
  requestCount++;
  const id = parseId(req.params.id);
  console.log(`  └─ Request #${requestCount} - Updating item ${id}`);

  await delay(500);

  const item = items.get(id);
  if (!item) {
    res.status(404).json({ message: 'Item not found', code: 'ITEM_NOT_FOUND' });
    return;
  }

  const updated = { ...item, ...req.body, price: req.body.price ? Number(req.body.price) : item.price };
  items.set(id, updated);

  console.log(`  └─ Updated item: ${updated.name}`);
  res.json(updated);
});

// DELETE /api/v1/items/:id - Delete item
app.delete('/api/v1/items/:id', async (req: Request, res: Response) => {
  requestCount++;
  const id = parseId(req.params.id);
  console.log(`  └─ Request #${requestCount} - Deleting item ${id}`);

  await delay(500);

  if (!items.has(id)) {
    res.status(404).json({ message: 'Item not found', code: 'ITEM_NOT_FOUND' });
    return;
  }

  const deleted = items.get(id);
  items.delete(id);
  console.log(`  └─ Deleted item: ${deleted?.name}`);
  res.status(204).send();
});

// ============================================================
// Debug Endpoints
// ============================================================

// GET /api/stats - Returns server statistics
app.get('/api/stats', (_req: Request, res: Response) => {
  res.json({
    totalRequests: requestCount,
    users: users.size,
    orders: orders.size,
    products: products.size,
  });
});

// POST /api/reset - Resets the request counter
app.post('/api/reset', (_req: Request, res: Response) => {
  requestCount = 0;
  console.log('\n[RESET] Request counter reset to 0');
  res.json({ message: 'Request counter reset', requestCount: 0 });
});

// ============================================================
// Start Server
// ============================================================

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    MOCK API SERVER                           ║
╠══════════════════════════════════════════════════════════════╣
║  Server running at: http://localhost:${PORT}                   ║
║                                                              ║
║  Endpoints:                                                  ║
║    GET    /api/v1/users          - List users (v1)           ║
║    GET    /api/v1/users/:id      - Get user (v1)             ║
║    GET    /api/v2/users/:id      - Get user (v2 - enhanced)  ║
║    POST   /api/v1/users          - Create user               ║
║    PATCH  /api/v1/users/:id      - Update user               ║
║    DELETE /api/v1/users/:id      - Delete user               ║
║                                                              ║
║    GET    /api/v1/orders         - List orders               ║
║    GET    /api/v1/orders/:id     - Get order                 ║
║    GET    /api/v1/users/:id/orders - Get user's orders       ║
║    POST   /api/v1/orders         - Create order              ║
║    PATCH  /api/v1/orders/:id/status - Update order status    ║
║                                                              ║
║    GET    /api/v1/products       - List products             ║
║    GET    /api/v1/products/:id   - Get product               ║
║                                                              ║
║    GET    /api/v1/items          - List items (SLOW 3.5s!)   ║
║    GET    /api/v1/items/stats    - Item stats (SLOW 3s!)     ║
║    POST   /api/v1/items          - Create item               ║
║    PATCH  /api/v1/items/:id      - Update item               ║
║    DELETE /api/v1/items/:id      - Delete item               ║
║                                                              ║
║  Debug:                                                      ║
║    GET    /api/stats             - Server statistics         ║
║    POST   /api/reset             - Reset request counter     ║
╚══════════════════════════════════════════════════════════════╝
  `);
});
