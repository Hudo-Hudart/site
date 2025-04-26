const express = require('express');
const fs = require('fs');

const path = require('path');
const multer = require('multer');
const cors = require('cors');

const app = express();
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET','POST','PUT','DELETE'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());
// Конфигурация путей
const PROJECT_ROOT = path.join(__dirname, '..');
const STATIC_DIRS = {
  root: PROJECT_ROOT,
  client: path.join(PROJECT_ROOT, 'client'),
  public: path.join(PROJECT_ROOT, 'public'),
  js: path.join(PROJECT_ROOT, 'js'),
  css: path.join(PROJECT_ROOT, 'css'),
  images: path.join(PROJECT_ROOT, 'images'),
  uploads: path.join(PROJECT_ROOT, 'public', 'uploads'),
  data: path.join(PROJECT_ROOT, 'data')
  
};
const DATA_DIR = STATIC_DIRS.data; // Добавляем эту строку

// Создание директорий при необходимости
Object.values(STATIC_DIRS).forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['POST', 'GET'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// Настройка статических файлов
app.use(express.static(STATIC_DIRS.root)); // HTML-файлы
app.use('/js', express.static(path.join(PROJECT_ROOT, 'js')));
app.use('/css', express.static(path.join(PROJECT_ROOT, 'css')));
app.use('/images', express.static(path.join(PROJECT_ROOT, 'images')));
app.use('/data', express.static(path.join(PROJECT_ROOT, 'data')));

// Роуты для HTML-страниц
const pages = [
  '/', '/index.html',
  '/cart', '/cart.html',
  '/catalog', '/catalog.html',
  '/login', '/login.html',
  '/register', '/register.html',
  '/admin', '/admin.html',
  '/product', '/product.html'
];

pages.forEach(page => {
  app.get(page, (req, res) => {
      const pagePath = page.endsWith('.html') ? page : `${page}.html`;
      res.sendFile(path.join(__dirname, `../${pagePath}`));
  });
});

// Конфигурация Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = req.body.type || 'product';
    
    let uploadPath;
    if (type === 'category') {
      uploadPath = path.join(__dirname, '../images/categories');
    } else {
      uploadPath = path.join(__dirname, '../public/uploads');
    }

    // Проверка и логирование пути
    console.log('Upload path:', uploadPath);
    
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    console.log('Generated filename:', uniqueName);
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Разрешены только изображения (JPEG, PNG, WebP)'));
    }
  }
});

// API Endpoints

app.get('/api/reviews/:type', (req, res) => {
  try {
      const type = req.params.type;
      const validTypes = ['approved', 'pending'];
      if (!validTypes.includes(type)) {
          return res.status(400).json({ error: 'Invalid review type' });
      }

      const filePath = path.join(DATA_DIR, `${type}-reviews.json`);
      
      // Если файла нет - создаем пустой массив
      if (!fs.existsSync(filePath)) {
          fs.writeFileSync(filePath, JSON.stringify([]));
      }

      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      res.json(data);
  } catch (error) {
      console.error('Reviews error:', error);
      res.status(500).json({ error: 'Error reading reviews' });
  }
});
  // Добавить в секцию API Endpoints
  app.get('/api/reviews/:type', (req, res) => {
    try {
      const {type} = req.params;
      if (!['approved','pending'].includes(type)) {
        return res.status(400).json({error: 'Invalid review type'});
      }
      const filePath = path.join(DATA_DIR, `${type}-reviews.json`);
      if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, '[]');
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(500).json({error: 'Error reading reviews'});
    }
  });  // <-- не забыли закрыть этот колбэк!
  
  // Создание заказа (full)
  app.post('/api/orders', (req, res) => {
    try {
      const ordersFile = path.join(DATA_DIR, 'orders.json');
      const orders = fs.existsSync(ordersFile)
        ? JSON.parse(fs.readFileSync(ordersFile, 'utf8'))
        : [];
      orders.push({ id: Date.now(), status: 'new', ...req.body });
      fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2));
      res.status(201).json({success: true});
    } catch (err) {
      console.error(err);
      res.status(500).json({error: 'Order save failed'});
    }
  });
  
  // Создание quick-order
  app.post('/api/quick-orders', (req, res) => {
    try {
      const file = path.join(DATA_DIR, 'quick-orders.json');
      const arr = fs.existsSync(file)
        ? JSON.parse(fs.readFileSync(file, 'utf8'))
        : [];
      arr.push(req.body);
      fs.writeFileSync(file, JSON.stringify(arr, null, 2));
      res.status(201).json(req.body);
    } catch (err) {
      console.error(err);
      res.status(500).json({error: 'Quick order save failed'});
    }
  });
  
  // Получение всех заказов
  app.get('/api/orders', (req, res) => {
    
    try {
      const file = path.join(DATA_DIR, 'orders.json');
      const orders = fs.existsSync(file)
        ? JSON.parse(fs.readFileSync(file, 'utf8'))
        : [];
      res.json(orders);
    } catch (err) {
      console.error(err);
      res.status(500).json({error: 'Cannot load orders'});
    }
  });
  
  // Получение quick-orders
  app.get('/api/quick-orders', (req, res) => {
    try {
      const file = path.join(DATA_DIR, 'quick-orders.json');
      const arr = fs.existsSync(file)
        ? JSON.parse(fs.readFileSync(file, 'utf8'))
        : [];
      res.json(arr);
    } catch (err) {
      console.error(err);
      res.status(500).json({error: 'Cannot load quick orders'});
    }
  });
  



// Добавить ПОСЛЕ существующих эндпоинтов /api/reviews/:type

// Обновление статусов отзывов (одобрение/удаление)
app.put('/api/reviews', (req, res) => {
  try {
    const { pending, approved } = req.body;
    
    // Валидация данных
    if (!Array.isArray(pending) || !Array.isArray(approved)) {
      return res.status(400).json({ error: 'Invalid data format' });
    }

    // Атомарное сохранение
    fs.writeFileSync(
      path.join(DATA_DIR, 'pending-reviews.json'),
      JSON.stringify(pending, null, 2)
    );
    
    fs.writeFileSync(
      path.join(DATA_DIR, 'approved-reviews.json'),
      JSON.stringify(approved, null, 2)
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving reviews:', error);
    res.status(500).json({ error: 'Failed to save reviews' });
  }
});

// Удаление отзыва
app.delete('/api/reviews/:type/:id', (req, res) => {
  try {
    const { type, id } = req.params;
    const filePath = path.join(DATA_DIR, `${type}-reviews.json`);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Review file not found' });
    }

    const reviews = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const updatedReviews = reviews.filter(r => r.id != id);
    
    fs.writeFileSync(filePath, JSON.stringify(updatedReviews, null, 2));
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

// Удалить дублирующий CORS middleware (оставить только один вызов)

// Добавить в самое начало секции API Endpoints (перед другими обработчиками)
// Добавьте ПЕРЕД всеми другими обработчиками маршрутов
app.post('/api/save-review', (req, res) => {
  try {
      const filePath = path.join(DATA_DIR, 'pending-reviews.json');
      let reviews = [];

      if (fs.existsSync(filePath)) {
          reviews = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }

      // Генерация ID
      const lastId = reviews.length > 0 
          ? Math.max(...reviews.map(r => r.id)) 
          : 0;
      const newId = lastId + 1;

      const newReview = {
          id: newId, // Инкрементный ID
          ...req.body,
          created_at: new Date().toISOString(),
          status: 'pending'
      };

      reviews.push(newReview);
      fs.writeFileSync(filePath, JSON.stringify(reviews, null, 2));

      res.json({ success: true });
  } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ success: false });
  }
});


// Убедитесь что CORS настроен правильно в самом начале


app.post('/api/save-data', (req, res) => {
  try {
    const { filename, data } = req.body;
    
    // Убрать проверку на reviews.json
    const filePath = path.join(DATA_DIR, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    
    res.json({ success: true });
  } catch (error) {
    console.error('Save error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/data/:filename', (req, res) => {
  try {
    const filePath = path.join(DATA_DIR, req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    res.json(data);
  } catch (error) {
    console.error('Read error:', error);
    res.status(500).json({ error: 'Error reading file' });
  }
});

app.post('/api/upload-image', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      console.error('No file received');
      return res.status(400).json({ error: 'Файл не был загружен' });
    }
    
    console.log('Received upload:', {
      type: req.body.type,
      originalname: req.file.originalname,
      filename: req.file.filename,
      path: req.file.path
    });

    const relativePath = req.body.type === 'category' 
      ? `/images/categories/${req.file.filename}`
      : `/uploads/${req.file.filename}`;

    console.log('Returning path:', relativePath);
    
    res.json({ success: true, path: relativePath });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: 'Ошибка загрузки файла',
      details: error.message
    });
  }
});

app.get('/data/categories.json', (req, res) => {
  res.sendFile(path.join(STATIC_DIRS.data, 'categories.json'));
});



// Fallback для SPA роутинга
app.get('*', (req, res) => {
  const allowedPaths = ['/js', '/css', '/images', '/public', '/uploads'];
  const isStaticFile = allowedPaths.some(p => req.path.startsWith(p));
  
  if (isStaticFile) {
    const filePath = path.join(PROJECT_ROOT, req.path);
    if (fs.existsSync(filePath)) return res.sendFile(filePath);
  }
  
  res.sendFile(path.join(PROJECT_ROOT, 'index.html'));
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
  Сервер запущен на порту ${PORT}
  Доступные пути:
  - HTML:       ${STATIC_DIRS.root}
  - JavaScript: ${STATIC_DIRS.js}
  - CSS:        ${STATIC_DIRS.css}
  - Изображения: ${STATIC_DIRS.images}
  - Загрузки:    ${STATIC_DIRS.uploads}
  `);
});

const INITIAL_REVIEW_FILES = ['pending-reviews.json', 'approved-reviews.json'];
INITIAL_REVIEW_FILES.forEach(file => {
    const filePath = path.join(DATA_DIR, file);
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify([]));
    }
});