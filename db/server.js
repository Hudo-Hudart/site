require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const cors = require('cors');
const mysql = require('mysql2');
const sharp = require('sharp');

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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'multipart/form-data']
}));
app.use(express.json());
// После строки с app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Добавьте эту строку



// === Пути и статика ===
const PROJECT_ROOT = path.join(__dirname, '..');;
app.use(express.static(path.join(PROJECT_ROOT, 'public')));
app.use('/js', express.static(path.join(PROJECT_ROOT, 'js')));
app.use('/css', express.static(path.join(PROJECT_ROOT, 'css')));
app.use('/images', express.static(path.join(PROJECT_ROOT, 'images')));
app.use('/uploads', express.static(path.join(PROJECT_ROOT, 'public', 'uploads')));

// === Multer для загрузки изображений ===




const categoriesStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(PROJECT_ROOT, 'public', 'images', 'categories');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `temp_${Date.now()}${path.extname(file.originalname)}`);
  }
});

const categoriesUpload = multer({ 
  storage: categoriesStorage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

const upload = multer({
  dest: path.join(PROJECT_ROOT, 'public', 'uploads'),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// В начало server.js добавить конфигурацию
const CAROUSEL_CONFIG = {
  UPLOAD_DIR: path.join(PROJECT_ROOT, 'public', 'images', 'carousel'),
  TARGET_WIDTH: 1920,
  TARGET_HEIGHT: 1080,
  QUALITY: 80,
  FORMAT: 'webp'
};

// Создать директорию при старте
fs.mkdirSync(CAROUSEL_CONFIG.UPLOAD_DIR, { recursive: true });

// Настройка Multer для карусели
const carouselStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, CAROUSEL_CONFIG.UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, `temp_${Date.now()}${path.extname(file.originalname)}`);
  }
});

const carouselUpload = multer({
  storage: carouselStorage,
 // limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    cb(null, allowedMimes.includes(file.mimetype));
  }
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
  '/order-success', '/index.html'
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
      SELECT 
        id, 
        name, 
        parent_id,
        CONCAT('/images/categories/', id, '.webp') AS iconUrl
      FROM categories
      ORDER BY parent_id ASC, name ASC
    `);
    res.json(rows);
  } catch (e) {
    console.error('Ошибка получения категорий:', e);
    res.status(500).json({ error: 'Ошибка загрузки категорий' });
  }
});

app.post('/api/categories', categoriesUpload.single('image'), async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { name, parent_id } = req.body;
    
    // Создаем категорию
    const [result] = await conn.execute(
      'INSERT INTO categories (name, parent_id) VALUES (?, ?)',
      [name, parent_id || null]
    );
    const categoryId = result.insertId;

    // Обработка изображения
    if (req.file) {
      const tempPath = req.file.path;
      const webpPath = path.join(
        path.dirname(tempPath),
        `${categoryId}.webp`
      );

      // Конвертируем в WebP
      await sharp(tempPath)
        .toFormat('webp')
        .toFile(webpPath);

      // Удаляем временный файл
      await fs.promises.unlink(tempPath);

      // Обновляем запись в БД
      await conn.execute(
        'UPDATE categories SET image_url = ? WHERE id = ?',
        [`/images/categories/${categoryId}.webp`, categoryId]
      );
    }

    await conn.commit();
    res.status(201).json({ id: categoryId });
  } catch (e) {
    await conn.rollback();
    
    // Удаляем временный файл при ошибке
    if (req.file) {
      await fs.promises.unlink(req.file.path).catch(console.error);
    }

    console.error('Ошибка создания категории:', e);
    res.status(500).json({ error: 'Ошибка создания категории' });
  } finally {
    conn.release();
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
    
    // Проверка на дочерние категории
    const [children] = await db.query(
      'SELECT id FROM categories WHERE parent_id = ?',
      [id]
    );
    
    if (children.length > 0) {
      return res.status(400).json({ 
        error: 'Нельзя удалить категорию с дочерними элементами' 
      });
    }

    await db.execute('DELETE FROM categories WHERE id = ?', [id]);
    res.json({ success: true });
    
  } catch (e) {
    console.error('Ошибка удаления категории:', e);
    res.status(500).json({ error: 'Ошибка удаления категории' });
  }
});


// === API: Товары ===
app.get('/api/products', async (req, res) => {
  try {
    const {
      category = '',
      brand = '',
      ageGroup = '',
      sizeGroup = '',
      page = 1,
      perPage = 20,
      sort = 'default'
    } = req.query;

    // 1. Обработка категорий с подкатегориями
    let categoryFilter = '';
    const params = [];
    
    if (category) {
      categoryFilter = `
        WITH RECURSIVE subcategories AS (
          SELECT id FROM categories WHERE id = ?
          UNION ALL
          SELECT c.id FROM categories c
          INNER JOIN subcategories s ON c.parent_id = s.id
        )
      `;
      params.push(category);
    }

    // 2. Базовый запрос с фильтрами
    const whereConditions = [];
    
    if (category) {
      whereConditions.push('p.category_id IN (SELECT id FROM subcategories)');
    }
    if (brand) {
      whereConditions.push('p.brand = ?');
      params.push(brand);
    }
    if (ageGroup) {
      whereConditions.push('p.age_group = ?');
      params.push(ageGroup);
    }
    if (sizeGroup) {
      whereConditions.push('p.size_group = ?');
      params.push(sizeGroup);
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    // 3. Сортировка
    let orderClause = 'ORDER BY ';
    switch(sort) {
      case 'price_asc':
        orderClause += 'min_price ASC';
        break;
      case 'price_desc':
        orderClause += 'min_price DESC'; // Сортируем по минимальной цене для всех вариантов
        break;
      default:
        orderClause += 'p.id';
    }

    // 4. Основной запрос
    const baseQuery = `
      ${categoryFilter}
      SELECT 
        p.id,
        p.title,
        p.brand,
        p.age_group,
        p.size_group,
        p.description,
        p.sku,
        CAST(p.rating AS DECIMAL(3,2)) AS rating,
        p.category_id,
        p.image_url,
        MIN(pv.price) AS min_price,
        MAX(pv.price) AS max_price
      FROM products p
      LEFT JOIN product_variants pv ON p.id = pv.product_id
      ${whereClause}
      GROUP BY p.id
      ${orderClause}
    `;

    // 5. Пагинация и выполнение
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM (${baseQuery}) AS filtered`,
      params
    );

    const paginatedQuery = `
      ${baseQuery}
      LIMIT ? OFFSET ?
    `;
    
    const offset = (Number(page) - 1) * Number(perPage);
    const [rows] = await db.query(paginatedQuery, [
      ...params,
      Number(perPage),
      offset
    ]);

    // 6. Загрузка вариантов
    const productIds = rows.map(r => r.id);
    let variantsRows = [];
    
    if (productIds.length > 0) {
      [variantsRows] = await db.query(`
        SELECT
          product_id,
          id AS variant_id,
          CAST(weight AS DECIMAL(8,2)) AS weight,
          CAST(price AS DECIMAL(10,2)) AS price
        FROM product_variants
        WHERE product_id IN (?)
      `, [productIds]);
    }

    const variantsMap = variantsRows.reduce((acc, v) => {
      acc[v.product_id] = acc[v.product_id] || [];
      acc[v.product_id].push(v);
      return acc;
    }, {});

    // 7. Формирование ответа
    const productsWithMeta = rows.map(p => ({
      id: p.id,
      title: p.title,
      brand: p.brand,
      age_group: p.age_group,
      size_group: p.size_group,
      description: p.description,
      sku: p.sku,
      rating: p.rating,
      category_id: p.category_id,
      imageUrl: p.image_url || `/images/korm_${p.id}.jpg`,
      variants: variantsMap[p.id] || [],
      price_range: {
        min: p.min_price,
        max: p.max_price
      }
    }));

    res.json({
      data: productsWithMeta,
      totalPages: Math.ceil(total / perPage)
    });

  } catch (e) {
    console.error('Ошибка загрузки товаров:', e);
    res.status(500).json({ error: 'Ошибка загрузки товаров' });
  }
});

// === API: Фильтры товаров ===
app.get('/api/product-filters', async (req, res) => {
  try {
    // 1. Получаем уникальные бренды
    const [brandsResult] = await db.query(`
      SELECT DISTINCT brand 
      FROM products 
      WHERE brand IS NOT NULL AND brand != ''
      ORDER BY brand ASC
    `);

    // 2. Получаем уникальные возрастные группы
    const [ageGroupsResult] = await db.query(`
      SELECT DISTINCT age_group 
      FROM products 
      WHERE age_group IS NOT NULL AND age_group != ''
      ORDER BY age_group ASC
    `);

    // 3. Получаем уникальные размерные группы
    const [sizeGroupsResult] = await db.query(`
      SELECT DISTINCT size_group 
      FROM products 
      WHERE size_group IS NOT NULL AND size_group != ''
      ORDER BY size_group ASC
    `);

    // 4. Формируем ответ
    res.json({
      brands: brandsResult.map(item => item.brand),
      ageGroups: ageGroupsResult.map(item => item.age_group),
      sizeGroups: sizeGroupsResult.map(item => item.size_group)
    });

  } catch (e) {
    console.error('Ошибка загрузки фильтров:', e);
    res.status(500).json({ 
      error: 'Не удалось загрузить параметры фильтрации' 
    });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        p.*,
        pv.id AS variant_id,
        pv.weight,
        pv.price
      FROM products p
      LEFT JOIN product_variants pv ON p.id = pv.product_id
      WHERE p.id = ?
    `, [req.params.id]);

    if (rows.length === 0) return res.status(404).json({ error: 'Товар не найден' });

    const product = {
      id: rows[0].id,
      title: rows[0].title,
      brand: rows[0].brand,
      age_group: rows[0].age_group,
      size_group: rows[0].size_group,
      description: rows[0].description,
      sku: rows[0].sku,
      rating: rows[0].rating,
      imageUrl: `/images/korm_${rows[0].id}.jpg`, // Формируем путь к изображению
      variants: rows.map(row => ({
        variant_id: row.variant_id,
        weight: row.weight,
        price: row.price
      }))
    };

    res.json(product);
  } catch (e) {
    console.error('Ошибка загрузки товара:', e);
    res.status(500).json({ error: 'Ошибка загрузки товара' });
  }
});

app.post('/api/products', upload.single('image'), async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Парсим данные из формы
    const productData = JSON.parse(req.body.data);
    const { 
      title,
      category_id,
      price,
      sku,
      description,
      brand,
      age_group,
      size_group,
      rating,
      variants
    } = productData;

    // Валидация обязательных полей
    if (!title || !category_id || !price) {
      throw new Error('Не заполнены обязательные поля');
    }

    // Создаем запись товара
    const [productResult] = await conn.execute(`
      INSERT INTO products (
        title,
        category_id,
        brand,
        age_group,
        size_group,
        description,
        sku,
        rating
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      title,
      category_id,
      brand || null,
      age_group || null,
      size_group || null,
      description || null,
      sku || null,
      rating ? parseFloat(rating) : null
    ]);

    const productId = productResult.insertId;

    // Обработка изображения
    if (req.file) {
      const ext = path.extname(req.file.originalname);
      const newFilename = `korm_${productId}${ext}`;
      const targetPath = path.join(PROJECT_ROOT, 'public', 'images', newFilename);

      await fs.promises.rename(req.file.path, targetPath);
      
      await conn.execute(
        'UPDATE products SET image_url = ? WHERE id = ?',
        [`/images/${newFilename}`, productId]
      );
    }

    // Добавляем варианты
    for (const variant of JSON.parse(variants)) {
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
    res.status(201).json({ 
      id: productId,
      imageUrl: `/images/korm_${productId}${ext || '.jpg'}`
    });

  } catch (e) {
    await conn.rollback();
    
    // Удаляем загруженный файл при ошибке
    if (req.file) {
      await fs.promises.unlink(req.file.path).catch(console.error);
    }

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
        created_at
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
      comment
    } = req.body;

    const [result] = await db.execute(`
      INSERT INTO reviews_pending (
        author_name,
        email,
        phone,
        rating,
        comment
      ) VALUES (?, ?, ?, ?, ?)
    `, [author_name, email, phone, rating, comment]);

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

    await conn.execute(`
      INSERT INTO reviews_approved (
        author_name,
        email,
        phone,
        rating,
        comment,
        created_at
      )
      SELECT 
        author_name,
        email,
        phone,
        rating,
        comment,
        created_at
      FROM reviews_pending 
      WHERE id = ?
    `, [reviewId]);

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
// === API: Капусель ===//
// Добавляем после других GET-роутов
app.get('/api/carousel', async (req, res) => {
  try {
    const { for_admin } = req.query;
    let query = `SELECT 
                  id,
                  image_path,
                  title,
                  description,
                  sort_order,
                  is_active,
                  created_at,
                  updated_at
                FROM carousel`;

    // Для главной страницы
    if (!for_admin) {
      query += ' WHERE is_active = TRUE ORDER BY sort_order ASC';
    } 
    // Для админки
    else {
      query += ' ORDER BY created_at DESC';
    }

    const [slides] = await db.query(query);
    
    // Преобразование типов для полей
    const processed = slides.map(slide => ({
      ...slide,
      sort_order: Number(slide.sort_order),
      is_active: Boolean(slide.is_active),
      created_at: new Date(slide.created_at).toISOString(),
      updated_at: new Date(slide.updated_at).toISOString()
    }));

    res.json(processed);

  } catch (error) {
    console.error('Ошибка получения карусели:', error);
    res.status(500).json({ 
      error: 'Ошибка загрузки данных карусели',
      details: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

app.post('/api/carousel',
  carouselUpload.single('image'),
  async (req, res) => {
    console.log('1. Начало обработки запроса');
    console.log('   req.file:', req.file);
    console.log('   req.body:', req.body);

    if (!req.file) {
      return res.status(400).json({ error: 'Поле image обязательно' });
    }

    let conn;
    const tempPath = req.file.path;

    try {
      // 2. Получаем соединение
      conn = await db.getConnection();
      console.log('2. Подключение к БД получено');

      // 3. Начинаем транзакцию
      await conn.beginTransaction();
      console.log('3. Транзакция начата');

      // 4. Вставляем базовую запись и сразу получаем ID
      const title = req.body.title?.trim() || null;
      const description = req.body.description?.trim() || null;
      const [insertResult] = await conn.execute(
        'INSERT INTO carousel (title, description) VALUES (?, ?)',
        [title, description]
      );
      const slideId = insertResult.insertId;
      console.log('4. Запись создана, ID =', slideId);

      // 5. Генерируем имя и сохраняем через sharp
// 5. Генерируем имя
      const newFilename = `slide_${slideId}.${CAROUSEL_CONFIG.FORMAT}`;
      const targetPath = path.join(CAROUSEL_CONFIG.UPLOAD_DIR, newFilename);
      console.log('5. Обработка изображения:', tempPath, '→', targetPath);

      let imgBuffer;
      try {
        console.log('5.1 sharp: создаём буфер...');
        imgBuffer = await sharp(tempPath)
          /*.resize(CAROUSEL_CONFIG.TARGET_WIDTH, CAROUSEL_CONFIG.TARGET_HEIGHT, {
            fit: 'cover',
            position: 'center',
          })*/
          .toFormat(CAROUSEL_CONFIG.FORMAT, { quality: CAROUSEL_CONFIG.QUALITY })
          .toBuffer();
        console.log('5.2 sharp: буфер готов, размер =', imgBuffer.length);
      } catch (e) {
        console.error('Ошибка на стадии toBuffer:', e);
        throw e;
      }

      try {
        console.log('5.3 Записываем буфер в файл...');
        await fs.promises.writeFile(targetPath, imgBuffer);
        console.log('5.4 Файл сохранён вручную');
      } catch (e) {
        console.error('Ошибка при writeFile:', e);
        throw e;
      }

      console.log('6. Изображение сохранено на диск');

      // 7. Обновляем запись уже с путём к картинке
      const imagePath = `/images/carousel/${newFilename}`;
      const [updateResult] = await conn.execute(
        'UPDATE carousel SET image_path = ? WHERE id = ?',
        [imagePath, slideId]
      );
      if (updateResult.affectedRows === 0) {
        throw new Error(`Не могу обновить запись id=${slideId}`);
      }
      console.log('7. Запись обновлена, image_path =', imagePath);

      // 8. Фиксируем транзакцию
      await conn.commit();
      console.log('8. Транзакция зафиксирована');

      // 9. Удаляем временный файл
      await fs.promises.unlink(tempPath);
      console.log('9. Временный файл удалён');

      // 10. Отдаём клиенту свежую запись
      const [rows] = await db.query(
        'SELECT * FROM carousel WHERE id = ?',
        [slideId]
      );
      return res.status(201).json(rows[0]);

    } catch (err) {
      console.error('ОШИБКА в /api/carousel:', err.stack || err.message);

      // Откатим транзакцию, если нужно
      if (conn) {
        try {
          await conn.rollback();
          console.log('→ Транзакция откатена');
        } catch (rollbackErr) {
          console.error('Rollback error:', rollbackErr);
        }
      }

      // Удалим временный файл
      try {
        if (tempPath) await fs.promises.unlink(tempPath);
      } catch (unlinkErr) {
        console.error('Ошибка удаления временного файла:', unlinkErr);
      }

      return res.status(500).json({ error: err.message });
    } finally {
      if (conn) {
        try {
          await conn.release();
          console.log('→ Подключение освобождено');
        } catch (releaseErr) {
          console.error('Release error:', releaseErr);
        }
      }
    }
  }
);




app.delete('/api/carousel/:id', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Получаем информацию о слайде
    const [slides] = await conn.query(
      `SELECT image_path FROM carousel WHERE id = ?`,
      [req.params.id]
    );

    if (slides.length === 0) {
      throw new Error('Слайд не найден');
    }

    const imagePath = slides[0].image_path;

    // 2. Удаляем запись из БД
    await conn.execute(
      `DELETE FROM carousel WHERE id = ?`,
      [req.params.id]
    );

    // 3. Удаление файла, если это не дефолтный путь
    if (imagePath && !imagePath.startsWith('/images/SLIDE')) {
      const fullPath = path.join(
        PROJECT_ROOT, 
        'public',
        imagePath.startsWith('/') 
          ? imagePath.slice(1) 
          : imagePath
      );

      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
      } else {
        console.warn(`Файл не найден: ${fullPath}`);
      }
    }

    await conn.commit();
    res.json({ success: true });

  } catch (error) {
    await conn.rollback();
    
    const status = error.message.includes('не найден') ? 404 : 500;
    console.error('Ошибка удаления слайда:', error);

    res.status(status).json({
      error: error.message.includes('не найден') 
        ? error.message 
        : 'Ошибка при удалении слайда'
    });

  } finally {
    conn.release();
  }
});

// === API: Заказы ===

app.post('/api/orders', async (req, res) => {
  console.log('Received order payload:', JSON.stringify(req.body, null, 2));

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { customer, items, delivery_cost, has_discount, total_amount } = req.body;

    // Вставляем основной заказ
    const [orderResult] = await conn.execute(`
      INSERT INTO orders (
        status,
        location_id,
        customer_phone,
        customer_fullname,
        customer_email,
        payment_method,
        delivery_cost,
        has_discount,
        total_amount
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'new', // статус по умолчанию
      customer.location_id,
      customer.customer_phone,
      customer.customer_fullname,
      customer.customer_email,
      customer.payment_method,
      delivery_cost,
      has_discount,
      total_amount
    ]);

    const orderId = orderResult.insertId;

    // Вставляем позиции заказа
    for (const item of items) {
      await conn.execute(`
        INSERT INTO order_items (
          order_id,
          product_variant_id,
          quantity,
          weight,
          price
        ) VALUES (?, ?, ?, ?, ?)
      `, [
        orderId,
        item.product_variant_id,
        item.quantity,
        item.weight,
        item.price
      ]);
    }

    await conn.commit();
    res.status(201).json({ id: orderId });

  } catch (e) {
    await conn.rollback();
    console.error('Ошибка создания заказа:', e);
    res.status(500).json({ error: e.message || 'Ошибка создания заказа' });
  } finally {
    conn.release();
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    // 1. Получаем основные данные заказов
    const [orders] = await db.query(`
      SELECT 
        o.*
      FROM orders o
      ORDER BY o.created_at DESC
    `);

    // 2. Для каждого заказа получаем его позиции
    const ordersWithItems = await Promise.all(
      orders.map(async order => {
        const [items] = await db.query(`
          SELECT 
            oi.product_variant_id,
            oi.quantity,
            oi.weight,
            oi.price,
            p.title           AS product_name,
            CONCAT(v.weight, ' кг') AS variant_name
          FROM order_items oi
          JOIN product_variants v ON v.id             = oi.product_variant_id
          JOIN products         p ON p.id             = v.product_id
          WHERE oi.order_id = ?
        `, [order.id]);
        
        return {
          ...order,
          items: items.map(item => ({
            product_variant_id: item.product_variant_id,
            product_name:      item.product_name,
            variant_name:      item.variant_name,
            quantity:          item.quantity,
            weight:            Number(item.weight),
            price:             Number(item.price)
          }))
        };
        
      })
    );
    
    res.json(ordersWithItems);
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
        qo.*
      FROM quick_orders qo
      ORDER BY qo.created_at DESC
    `);

    const ordersWithItems = await Promise.all(
      quickOrders.map(async order => {
        const [items] = await db.query(`
          SELECT 
            qi.product_variant_id,
            qi.quantity,
            qi.weight,
            qi.price,
            p.title           AS product_name,
            CONCAT(qi.weight, ' кг') AS variant_name
          FROM quick_order_items qi
          JOIN product_variants v ON v.id             = qi.product_variant_id
          JOIN products         p ON p.id             = v.product_id
          WHERE qi.quick_order_id = ?
          ORDER BY qi.id 
        `, [order.id]);
        
        return {
          ...order,
          items: items.map(item => ({
            product_variant_id: item.product_variant_id,
            product_name:       item.product_name,
            variant_name:       item.variant_name,
            quantity:           item.quantity,
            weight:             Number(item.weight),
            price:              Number(item.price)
          }))
        };
        
      })
    );
    console.log('⬅️ GET /api/quick-orders — returning:', JSON.stringify(ordersWithItems, null, 2));
    res.json(ordersWithItems);
  } catch (e) {
    console.error('Ошибка загрузки быстрых заказов:', e);
    res.status(500).json({ error: 'Ошибка получения быстрых заказов' });
  }
});

app.post('/api/quick-orders', async (req, res) => {
  console.log('➡️ POST /api/quick-orders — body:', JSON.stringify(req.body, null, 2));
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

    // 1) Создаём сам быстрый заказ
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

    // 2) Пробегаем по позициям, резолвим настоящий variant_id и вставляем
    for (const item of items) {
      console.log(`   🔹 resolving variant for item:`, item);

      // ищем вариант в БД по весу+цене
      const [[variantRow]] = await conn.query(
        `SELECT id
           FROM product_variants
          WHERE weight = ?
            AND price  = ?
          LIMIT 1
        `,
        [ parseFloat(item.weight) || 0, parseFloat(item.price) ]
      );

      const resolvedVariantId = variantRow?.id || item.product_variant_id;
      if (!variantRow) {
        console.warn(`   ⚠️ Не найден variant по весу=${item.weight}, price=${item.price}, fallback to client id=${item.product_variant_id}`);
      }

      // вставляем позицию
      await conn.execute(
        `INSERT INTO quick_order_items (
           quick_order_id,
           product_variant_id,
           quantity,
           weight,
           price
         ) VALUES (?, ?, ?, ?, ?)`,
        [
          quickOrderId,
          resolvedVariantId,
          item.quantity,
          parseFloat(item.weight) || 0,
          parseFloat(item.price)
        ]
      );
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
// этот middleware сработает для любого запроса, начинающегося с /api, 
// но без проблем с парсингом паттерна
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API route not found' });
});


// После всех ваших app.use и до app.listen
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  if (err instanceof multer.MulterError) {
    // например, превышен размер или неверный формат
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: err.message });
});


// === Запуск сервера ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on http://localhost:${PORT}`));
