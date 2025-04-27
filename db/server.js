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

// === Разрешаем CORS и парсим JSON ===
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());



// === Пути и статика ===
const PROJECT_ROOT = path.join(__dirname, '..');;
app.use(express.static(path.join(PROJECT_ROOT, 'public')));
app.use('/js', express.static(path.join(PROJECT_ROOT, 'js')));
app.use('/css', express.static(path.join(PROJECT_ROOT, 'css')));
app.use('/images', express.static(path.join(PROJECT_ROOT, 'images')));
app.use('/uploads', express.static(path.join(PROJECT_ROOT, 'public', 'uploads')));

// === Multer для загрузки изображений ===
const upload = multer({
  dest: path.join(PROJECT_ROOT, 'public', 'uploads'),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// === HTML-страницы (SPA) ===
const htmlRoutes = [
  '/', '/index.html',
  '/cart', '/cart.html',
  '/catalog', '/catalog.html',
  '/login', '/login.html',
  '/register', '/register.html',
  '/admin', '/admin.html',
  '/product', '/product.html',
  '/new-order', '/new-order.html',
  '/favorite', '/favorite.html',
  '/order-success', '/order-success.html'
];
htmlRoutes.forEach(route => {
  app.get(route, (req, res) => {
    const file = route.endsWith('.html') ? route : `${route}.html`;
    res.sendFile(path.join(PROJECT_ROOT, file));
  });
});

/// === API: Пользователи ===
app.post('/api/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Проверка существования пользователя
    const [existing] = await db.query(
      'SELECT id FROM users WHERE email = ?', 
      [email]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Пользователь уже существует' });
    }

    // Создание нового пользователя
    const [result] = await db.execute(
      'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
      [email, password, 'user']
    );
    
    res.status(201).json({ id: result.insertId });
    
  } catch (e) {
    console.error('Ошибка регистрации:', e);
    res.status(500).json({ error: 'Ошибка регистрации' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Поиск пользователя
    const [[user]] = await db.query(
      `SELECT id, email, password_hash, role 
       FROM users WHERE email = ?`,
      [email]
    );
    
    // Проверка пароля
    if (!user || user.password_hash !== password) {
      return res.status(401).json({ error: 'Неверные данные' });
    }

    // Успешный ответ
    res.json({
      id: user.id,
      email: user.email,
      role: user.role
    });
    
  } catch (e) {
    console.error('Ошибка входа:', e);
    res.status(500).json({ error: 'Ошибка авторизации' });
  }
});

// === API: Категории ===
app.get('/api/categories', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT id, name, parent_id 
      FROM categories
    `);
    res.json(rows);
  } catch (e) {
    console.error('Ошибка получения категорий:', e);
    res.status(500).json({ error: 'Ошибка загрузки категорий' });
  }
});

app.post('/api/categories', async (req, res) => {
  try {
    const { name, parent_id } = req.body;
    
    const [result] = await db.execute(`
      INSERT INTO categories (name, parent_id)
      VALUES (?, ?)
    `, [name, parent_id || null]);
    
    res.status(201).json({ id: result.insertId });
    
  } catch (e) {
    console.error('Ошибка создания категории:', e);
    res.status(500).json({ error: 'Ошибка создания категории' });
  }
});

app.put('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, parent_id } = req.body;
    
    await db.execute(`
      UPDATE categories
      SET name = ?, parent_id = ?
      WHERE id = ?
    `, [name, parent_id || null, id]);
    
    res.json({ success: true });
    
  } catch (e) {
    console.error('Ошибка обновления категории:', e);
    res.status(500).json({ error: 'Ошибка обновления категории' });
  }
});

app.delete('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await db.execute(`
      DELETE FROM categories 
      WHERE id = ?
    `, [id]);
    
    res.json({ success: true });
    
  } catch (e) {
    console.error('Ошибка удаления категории:', e);
    res.status(500).json({ error: 'Ошибка удаления категории' });
  }
});


// === API: Товары ===
app.get('/api/products', async (req, res) => {
  try {
    // 1) Считываем параметры фильтрации и пагинации из query
    const {
      category   = '',
      brand      = '',
      ageGroup   = '',
      sizeGroup  = '',
      page       = 1,
      perPage    = 20
    } = req.query;

    // 2) Строим WHERE-условие на основе ненулевых фильтров
    const filters = [];
    const params  = [];

    if (category)  { filters.push('category_id = ?');   params.push(category); }
    if (brand)     { filters.push('brand = ?');         params.push(brand); }
    if (ageGroup)  { filters.push('age_group = ?');     params.push(ageGroup); }
    if (sizeGroup) { filters.push('size_group = ?');    params.push(sizeGroup); }

    const whereClause = filters.length
      ? `WHERE ${filters.join(' AND ')}`
      : '';

    // 3) Считаем общее число товаров для пагинации
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM products ${whereClause}`,
      params
    );
    const totalPages = Math.ceil(total / perPage);

    // 4) Выбираем нужную «страницу» товаров с учётом фильтров
    const offset = (Number(page) - 1) * Number(perPage);
    const [rows] = await db.query(
      `
      SELECT
        id,
        title,
        brand,
        age_group,
        size_group,
        description,
        sku,
        CAST(rating AS DECIMAL(3,2)) AS rating,
        category_id,
        image_url
      FROM products
      ${whereClause}
      LIMIT ? OFFSET ?
      `,
      [...params, Number(perPage), offset]
    );

    // 5) Подтягиваем варианты (variants) одним запросом
    const productIds = rows.map(r => r.id);
    let variantsRows = [];
    if (productIds.length > 0) {
      [variantsRows] = await db.query(
        `
        SELECT
          product_id,
          id AS variant_id,
          CAST(weight AS DECIMAL(8,2)) AS weight,
          CAST(price  AS DECIMAL(10,2)) AS price
        FROM product_variants
        WHERE product_id IN (?)
        `,
        [productIds]
      );
    }
    const variantsMap = variantsRows.reduce((acc, v) => {
      if (!acc[v.product_id]) acc[v.product_id] = [];
      acc[v.product_id].push(v);
      return acc;
    }, {});

    // 6) Формируем окончательный массив с imageUrl и variants
    const productsWithMeta = rows.map(p => ({
      id:           p.id,
      title:        p.title,
      brand:        p.brand,
      age_group:    p.age_group,
      size_group:   p.size_group,
      description:  p.description,
      sku:          p.sku,
      rating:       p.rating,
      category_id:  p.category_id,
      // сначала берём поле image_url из БД, иначе – шаблон
      imageUrl:     p.image_url || `/images/korm_${p.id}.jpg`,
      variants:     variantsMap[p.id] || []
    }));

    // 7) Отдаём клиенту и массив товаров, и число страниц
    res.json({
      data:       productsWithMeta,
      totalPages
    });

  } catch (e) {
    console.error('Ошибка загрузки товаров:', e);
    res.status(500).json({ error: 'Ошибка загрузки товаров' });
  }
});


app.get('/api/products/:id', async (req, res) => {
  const productId = +req.params.id;
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [[product]] = await conn.query(`
      SELECT 
        id, title, brand, age_group,
        size_group, description, sku,
        CAST(rating AS DECIMAL(3,2)) AS rating,
        category_id, image_url
      FROM products WHERE id = ?
    `, [productId]);

    if (!product) return res.status(404).json({ error: 'Товар не найден' });

    const [variants] = await conn.query(`
      SELECT 
        id AS variant_id,
        CAST(weight AS DECIMAL(8,2)) AS weight,
        CAST(price AS DECIMAL(10,2)) AS price
      FROM product_variants 
      WHERE product_id = ?
    `, [productId]);

    await conn.commit();
    const productWithImage = {
      ...product,
      imageUrl: `/images/korm_${product.id}.jpg`,
      variants
    };
    res.json({ ...product, variants });

  } catch (e) {
    await conn.rollback();
    console.error('Ошибка загрузки товара:', e);
    res.status(500).json({ error: 'Ошибка загрузки товара' });
  } finally {
    conn.release();
  }
});

app.post('/api/products', upload.single('image'), async (req, res) => {
  const conn = await db.getConnection();
  
  try {
    await conn.beginTransaction();
    
    const { 
      title,
      brand = null,
      age_group = null,
      size_group = null,
      description = null,
      sku = null,
      rating = null,
      category_id,
      variants = '[]'
    } = req.body;

    // Валидация
    if (!title || !category_id) {
      throw new Error('Заполните обязательные поля: title и category_id');
    }

    // Вставка товара
    const [productResult] = await conn.execute(`
      INSERT INTO products (
        title, brand, age_group, size_group,
        description, sku, rating, category_id, image_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      title,
      brand,
      age_group,
      size_group,
      description,
      sku,
      rating ? parseFloat(rating) : null,
      category_id,
      req.file ? `/uploads/${req.file.filename}` : null
    ]);

    const productId = productResult.insertId;

    // Обработка вариантов
    const parsedVariants = JSON.parse(variants);
    for (const variant of parsedVariants) {
      await conn.execute(`
        INSERT INTO product_variants (product_id, weight, price)
        VALUES (?, ?, ?)
      `, [
        productId,
        parseFloat(variant.weight),
        parseFloat(variant.price)
      ]);
    }

    await conn.commit();
    res.status(201).json({ id: productId });

  } catch (e) {
    await conn.rollback();
    console.error('Ошибка создания товара:', e);
    res.status(500).json({ error: e.message || 'Ошибка создания товара' });
  } finally {
    conn.release();
  }
});

app.put('/api/products/:id', upload.single('image'), async (req, res) => {
  const productId = +req.params.id;
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const {
      title,
      brand = null,
      age_group = null,
      size_group = null,
      description = null,
      sku = null,
      rating = null,
      category_id,
      variants = '[]'
    } = req.body;

    // Обновление товара
    await conn.execute(`
      UPDATE products SET
        title = ?,
        brand = ?,
        age_group = ?,
        size_group = ?,
        description = ?,
        sku = ?,
        rating = ?,
        category_id = ?,
        image_url = COALESCE(?, image_url)
      WHERE id = ?
    `, [
      title,
      brand,
      age_group,
      size_group,
      description,
      sku,
      rating ? parseFloat(rating) : null,
      category_id,
      req.file ? `/uploads/${req.file.filename}` : null,
      productId
    ]);

    // Обновление вариантов
    await conn.execute(`
      DELETE FROM product_variants WHERE product_id = ?
    `, [productId]);

    const parsedVariants = JSON.parse(variants);
    for (const variant of parsedVariants) {
      await conn.execute(`
        INSERT INTO product_variants (product_id, weight, price)
        VALUES (?, ?, ?)
      `, [
        productId,
        parseFloat(variant.weight),
        parseFloat(variant.price)
      ]);
    }

    await conn.commit();
    res.json({ success: true });

  } catch (e) {
    await conn.rollback();
    console.error('Ошибка обновления товара:', e);
    res.status(500).json({ error: e.message || 'Ошибка обновления товара' });
  } finally {
    conn.release();
  }
});

app.delete('/api/products/:id', async (req, res) => {
  const productId = +req.params.id;
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    await conn.execute(`
      DELETE FROM product_variants WHERE product_id = ?
    `, [productId]);

    await conn.execute(`
      DELETE FROM products WHERE id = ?
    `, [productId]);

    await conn.commit();
    res.json({ success: true });

  } catch (e) {
    await conn.rollback();
    console.error('Ошибка удаления товара:', e);
    res.status(500).json({ error: 'Ошибка удаления товара' });
  } finally {
    conn.release();
  }
});

// === API: Локации ===
app.get('/api/locations', async (req, res) => {
  try {
    const [locations] = await db.query(`
      SELECT 
        id,
        name,
        CAST(delivery_cost AS DECIMAL(10,2)) AS delivery_cost,
        CAST(free_from_amount AS DECIMAL(12,2)) AS free_from_amount
      FROM locations
    `);
    res.json(locations);
  } catch (e) {
    console.error('Ошибка загрузки локаций:', e);
    res.status(500).json({ error: 'Ошибка загрузки данных о доставке' });
  }
});

// === API: Отзывы ===
app.get('/api/reviews/:type', async (req, res) => {
  const allowedTypes = ['pending', 'approved'];
  const type = req.params.type;
  
  if (!allowedTypes.includes(type)) {
    return res.status(400).json({ error: 'Неверный тип отзывов' });
  }

  try {
    const [reviews] = await db.query(`
      SELECT 
        id,
        author_name,
        email,
        phone,
        rating,
        comment,
        created_at,
        product_id
      FROM ${type === 'pending' ? 'reviews_pending' : 'reviews_approved'}
    `);
    
    res.json(reviews);
    
  } catch (e) {
    console.error('Ошибка загрузки отзывов:', e);
    res.status(500).json({ error: 'Ошибка загрузки отзывов' });
  }
});

app.post('/api/reviews', async (req, res) => {
  try {
    const { 
      author_name,
      email,
      phone = null,
      rating,
      comment,
      product_id 
    } = req.body;

    const [result] = await db.execute(`
      INSERT INTO reviews_pending (
        author_name,
        email,
        phone,
        rating,
        comment,
        product_id
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [author_name, email, phone, rating, comment, product_id]);

    res.status(201).json({ id: result.insertId });
    
  } catch (e) {
    console.error('Ошибка создания отзыва:', e);
    res.status(500).json({ error: 'Ошибка сохранения отзыва' });
  }
});

app.put('/api/reviews/:id/approve', async (req, res) => {
  const reviewId = +req.params.id;
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // Переносим отзыв в утвержденные
    await conn.execute(`
      INSERT INTO reviews_approved (
        author_name,
        email,
        phone,
        rating,
        comment,
        created_at,
        product_id
      )
      SELECT 
        author_name,
        email,
        phone,
        rating,
        comment,
        created_at,
        product_id
      FROM reviews_pending 
      WHERE id = ?
    `, [reviewId]);

    // Удаляем из ожидающих
    await conn.execute(`
      DELETE FROM reviews_pending 
      WHERE id = ?
    `, [reviewId]);

    await conn.commit();
    res.json({ success: true });
    
  } catch (e) {
    await conn.rollback();
    console.error('Ошибка одобрения отзыва:', e);
    res.status(500).json({ error: 'Ошибка модерации отзыва' });
  } finally {
    conn.release();
  }
});

app.delete('/api/reviews/:type/:id', async (req, res) => {
  const allowedTypes = ['pending', 'approved'];
  const { type, id } = req.params;
  
  if (!allowedTypes.includes(type)) {
    return res.status(400).json({ error: 'Неверный тип отзывов' });
  }

  try {
    await db.execute(`
      DELETE FROM ${type === 'pending' ? 'reviews_pending' : 'reviews_approved'} 
      WHERE id = ?
    `, [id]);
    
    res.json({ success: true });
    
  } catch (e) {
    console.error('Ошибка удаления отзыва:', e);
    res.status(500).json({ error: 'Ошибка удаления отзыва' });
  }
});


// === API: Заказы ===
app.get('/api/orders', async (req, res) => {
  try {
    const [orders] = await db.query(`
      SELECT 
        id,
        status,
        location_id,
        customer_phone,
        customer_fullname,
        customer_email,
        payment_method,
        CAST(delivery_cost AS DECIMAL(10,2)) AS delivery_cost,
        has_discount,
        CAST(total_amount AS DECIMAL(12,2)) AS total_amount,
        created_at
      FROM orders
      ORDER BY created_at DESC
    `);
    res.json(orders);
  } catch (e) {
    console.error('Ошибка загрузки заказов:', e);
    res.status(500).json({ error: 'Ошибка получения заказов' });
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    const [orders] = await db.query(`
      SELECT 
        o.*,
        JSON_ARRAYAGG(JSON_OBJECT(
          'product_variant_id', i.product_variant_id,
          'quantity', i.quantity,
          'weight', i.weight,
          'price', i.price
        )) AS items
      FROM orders o
      LEFT JOIN order_items i ON o.id = i.order_id
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `);
    
    orders.forEach(o => o.items = JSON.parse(o.items || '[]'));
    res.json(orders);
  } catch (e) {
    console.error('Ошибка загрузки заказов:', e);
    res.status(500).json({ error: 'Ошибка получения заказов' });
  }
});


// Обновление статуса обычного заказа
app.patch('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    await db.execute(
      'UPDATE orders SET status = ? WHERE id = ?',
      [status, id]
    );
    res.json({ success: true });
  } catch (e) {
    console.error('Ошибка обновления заказа:', e);
    res.status(500).json({ error: 'Ошибка обновления заказа' });
  }
});

// Обновление статуса быстрого заказа
app.patch('/api/quick-orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    await db.execute(
      'UPDATE quick_orders SET status = ? WHERE id = ?',
      [status, id]
    );
    res.json({ success: true });
  } catch (e) {
    console.error('Ошибка обновления быстрого заказа:', e);
    res.status(500).json({ error: 'Ошибка обновления быстрого заказа' });
  }
});

// === API: Быстрые заказы ===
app.get('/api/quick-orders', async (req, res) => {
  try {
    const [quickOrders] = await db.query(`
      SELECT 
        id,
        status,
        street,
        house_number,
        customer_name,
        CAST(total_amount AS DECIMAL(12,2)) AS total_amount,
        created_at
      FROM quick_orders
      ORDER BY created_at DESC
    `);
    res.json(quickOrders);
  } catch (e) {
    console.error('Ошибка загрузки быстрых заказов:', e);
    res.status(500).json({ error: 'Ошибка получения быстрых заказов' });
  }
});

app.post('/api/quick-orders', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { 
      street,
      house_number,
      customer_name,
      customer_phone,
      comment = '',
      total_amount,
      status = 'new',
      items
    } = req.body;

    // Создание быстрого заказа
    const [quickOrderResult] = await conn.execute(`
      INSERT INTO quick_orders (
        status,
        street,
        house_number,
        customer_name,
        customer_phone,
        comment,
        total_amount
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      status,
      street,
      house_number,
      customer_name,
      customer_phone,
      comment,
      parseFloat(total_amount)
    ]);

    const quickOrderId = quickOrderResult.insertId;

    // Добавление позиций
    for (const item of items) {
      await conn.execute(`
        INSERT INTO quick_order_items (
          quick_order_id,
          product_variant_id,
          quantity,
          weight,
          price
        ) VALUES (?, ?, ?, ?, ?)
      `, [
        quickOrderId,
        item.id,
        item.quantity,
        parseFloat(item.weight) || 0,
        parseFloat(item.price)
      ]);
    }

    await conn.commit();
    res.status(201).json({ id: quickOrderId });

  } catch (e) {
    await conn.rollback();
    console.error('Ошибка создания быстрого заказа:', e);
    res.status(500).json({ error: e.message || 'Ошибка создания быстрого заказа' });
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
