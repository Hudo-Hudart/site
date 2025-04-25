require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');
const cors = require('cors');
const mysql = require('mysql2');

// === Настройка MySQL через пул соединений ===
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'petshop',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
}).promise();

const app = express();
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// === Пути и статика ===
const PROJECT_ROOT = __dirname;
app.use(express.static(PROJECT_ROOT)); // HTML, index.html и др.
app.use('/js',      express.static(path.join(PROJECT_ROOT, 'js')));
app.use('/css',     express.static(path.join(PROJECT_ROOT, 'css')));
app.use('/images',  express.static(path.join(PROJECT_ROOT, 'images')));
app.use('/uploads', express.static(path.join(PROJECT_ROOT, 'public', 'uploads')));

// === Multer для загрузки изображений ===
const upload = multer({
  dest: path.join(PROJECT_ROOT, 'public', 'uploads'),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// === HTML-страницы (SPA) ===
['/', '/index.html',
 '/cart', '/cart.html',
 '/catalog', '/catalog.html',
 '/login', '/login.html',
 '/register', '/register.html',
 '/admin', '/admin.html',
 '/product', '/product.html',
 '/new-order', '/new-order.html',
 '/favorite', '/favorite.html',
 '/order-success', '/order-success.html']
.forEach(route => {
  app.get(route, (req, res) => {
    const file = route.endsWith('.html') ? route : `${route}.html`;
    res.sendFile(path.join(PROJECT_ROOT, file));
  });
});

// === API: Пользователи ===
app.post('/api/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [exists] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (exists.length) return res.status(400).json({ error: 'Пользователь уже существует' });
    const [r] = await db.execute(
      'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
      [email, password, 'user']
    );
    res.status(201).json({ id: r.insertId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Регистрация не удалась' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [[user]] = await db.query(
      'SELECT id, email, password_hash, role FROM users WHERE email = ?', [email]
    );
    if (!user || user.password_hash !== password) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }
    res.json({ id: user.id, email: user.email, role: user.role });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Ошибка при входе' });
  }
});

// === API: Категории ===
app.get('/api/categories', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, name, parent_id FROM categories');
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Не удалось загрузить категории' });
  }
});

app.post('/api/categories', async (req, res) => {
  try {
    const { name, parent_id } = req.body;
    const [r] = await db.execute(
      'INSERT INTO categories (name, parent_id) VALUES (?, ?)',
      [name, parent_id || null]
    );
    res.status(201).json({ id: r.insertId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Не удалось создать категорию' });
  }
});

app.put('/api/categories/:id', async (req, res) => {
  try {
    const { name, parent_id } = req.body;
    await db.execute(
      'UPDATE categories SET name = ?, parent_id = ? WHERE id = ?',
      [name, parent_id || null, req.params.id]
    );
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Не удалось обновить категорию' });
  }
});

app.delete('/api/categories/:id', async (req, res) => {
  try {
    await db.execute('DELETE FROM categories WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Не удалось удалить категорию' });
  }
});

// === API: Товары ===
app.get('/api/products', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, title, brand, age_group, size_group, description, sku, rating, category_id FROM products'
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Не удалось загрузить товары' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const id = +req.params.id;
    const [[product]] = await db.query('SELECT * FROM products WHERE id = ?', [id]);
    if (!product) return res.status(404).json({ error: 'Товар не найден' });
    const [variants] = await db.query(
      'SELECT id AS variant_id, weight, price FROM product_variants WHERE product_id = ?',
      [id]
    );
    res.json({ ...product, variants });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Не удалось загрузить товар' });
  }
});

app.post('/api/products', upload.single('image'), async (req, res) => {
  try {
    const { title, brand, age_group, size_group, description, sku, rating, category_id, variants } = req.body;
    const [r] = await db.execute(
      'INSERT INTO products (title, brand, age_group, size_group, description, sku, rating, category_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [title, brand, age_group, size_group, description, sku, rating, category_id]
    );
    const pid = r.insertId;
    JSON.parse(variants).forEach(async v => {
      await db.execute(
        'INSERT INTO product_variants (product_id, weight, price) VALUES (?, ?, ?)',
        [pid, v.weight, v.price]
      );
    });
    res.status(201).json({ id: pid });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Не удалось создать товар' });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const { title, brand, age_group, size_group, description, sku, rating, category_id } = req.body;
    await db.execute(
      'UPDATE products SET title=?, brand=?, age_group=?, size_group=?, description=?, sku=?, rating=?, category_id=? WHERE id=?',
      [title, brand, age_group, size_group, description, sku, rating, category_id, req.params.id]
    );
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Не удалось обновить товар' });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    await db.execute('DELETE FROM product_variants WHERE product_id = ?', [req.params.id]);
    await db.execute('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Не удалось удалить товар' });
  }
});

// === API: Локации ===
app.get('/api/locations', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, name, delivery_cost, free_from_amount FROM locations');
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Не удалось загрузить локации' });
  }
});

// === API: Отзывы ===
app.get('/api/reviews/:type', async (req, res) => {
  const t = req.params.type;
  if (!['pending','approved'].includes(t)) return res.status(400).json({ error: 'Неверный тип' });
  const table = t === 'pending' ? 'reviews_pending' : 'reviews_approved';
  try {
    const [rows] = await db.query(`SELECT id, author_name, email, phone, rating, comment, created_at, product_id FROM ${table}`);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Не удалось загрузить отзывы' });
  }
});

app.post('/api/reviews', async (req, res) => {
  try {
    const { author_name, email, phone, rating, comment, product_id } = req.body;
    const [r] = await db.execute(
      'INSERT INTO reviews_pending (author_name, email, phone, rating, comment, created_at, product_id) VALUES (?, ?, ?, ?, ?, NOW(), ?)',
      [author_name, email, phone, rating, comment, product_id]
    );
    res.status(201).json({ id: r.insertId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Не удалось сохранить отзыв' });
  }
});

app.put('/api/reviews/:id/approve', async (req, res) => {
  const id = +req.params.id;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[rev]] = await conn.query('SELECT * FROM reviews_pending WHERE id = ?', [id]);
    if (!rev) { await conn.rollback(); return res.status(404).json({ error: 'Отзыв не найден' }); }
    const { author_name, email, phone, rating, comment, created_at, product_id } = rev;
    await conn.execute(
      'INSERT INTO reviews_approved (id, author_name, email, phone, rating, comment, created_at, product_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, author_name, email, phone, rating, comment, created_at, product_id]
    );
    await conn.execute('DELETE FROM reviews_pending WHERE id = ?', [id]);
    await conn.commit();
    res.json({ success: true });
  } catch (e) {
    await conn.rollback();
    console.error(e);
    res.status(500).json({ error: 'Не удалось одобрить отзыв' });
  } finally {
    conn.release();
  }
});

app.delete('/api/reviews/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  const table = type === 'pending' ? 'reviews_pending' : 'reviews_approved';
  try {
    await db.execute(`DELETE FROM ${table} WHERE id = ?`, [id]);
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Не удалось удалить отзыв' });
  }
});

// === API: Заказы ===
app.get('/api/orders', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM orders ORDER BY created_at DESC');
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Не удалось загрузить заказы' });
  }
});

app.post('/api/orders', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { customer, items, total, delivery_cost, has_discount, status = 'new' } = req.body;
    const [r] = await conn.execute(
      'INSERT INTO orders (status, location_id, customer_phone, customer_fullname, customer_email, payment_method, delivery_cost, has_discount, total_amount, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
      [status, customer.location_id || null, customer.phone, customer.name, customer.email, customer.payment_method || 'pickup', delivery_cost || 0, has_discount ? 1 : 0, total]
    );
    const oid = r.insertId;
    for (const it of items) {
      await conn.execute(
        'INSERT INTO order_items (order_id, product_variant_id, quantity, weight, price) VALUES (?, ?, ?, ?, ?)',
        [oid, it.id, it.quantity, it.weight || 0, it.price]
      );
    }
    await conn.commit();
    res.status(201).json({ id: oid });
  } catch (e) {
    await conn.rollback();
    console.error(e);
    res.status(500).json({ error: 'Не удалось создать заказ' });
  } finally {
    conn.release();
  }
});

// === 404 для API ===
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

// === Запуск сервера ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on http://localhost:${PORT}`));
