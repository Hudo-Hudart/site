exports.up = async function(db) {
    // Категории
    await db.query(`
      CREATE TABLE categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        parent_id INT NULL,
        FOREIGN KEY (parent_id) REFERENCES categories(id)
      ) ENGINE=InnoDB
        DEFAULT CHARSET=utf8mb4
        COLLATE=utf8mb4_unicode_ci;
    `);
  
    // Товары
    await db.query(`
      CREATE TABLE products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        brand VARCHAR(100),
        age_group VARCHAR(100),
        size_group VARCHAR(100),
        description TEXT,
        sku VARCHAR(100) UNIQUE,
        rating DECIMAL(3,2),
        category_id INT NOT NULL,
        FOREIGN KEY (category_id) REFERENCES categories(id)
      ) ENGINE=InnoDB
        DEFAULT CHARSET=utf8mb4
        COLLATE=utf8mb4_unicode_ci;
    `);
  
    // Варианты товаров (вес и цена)
    await db.query(`
      CREATE TABLE product_variants (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        weight DECIMAL(8,2) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (product_id) REFERENCES products(id)
      ) ENGINE=InnoDB
        DEFAULT CHARSET=utf8mb4
        COLLATE=utf8mb4_unicode_ci;
    `);
  
    // Пользователи
    await db.query(`
      CREATE TABLE users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('user','admin') NOT NULL DEFAULT 'user'
      ) ENGINE=InnoDB
        DEFAULT CHARSET=utf8mb4
        COLLATE=utf8mb4_unicode_ci;
    `);
  
    // Локации доставки
    await db.query(`
      CREATE TABLE locations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        delivery_cost DECIMAL(10,2) NOT NULL,
        free_from_amount DECIMAL(12,2) NOT NULL
      ) ENGINE=InnoDB
        DEFAULT CHARSET=utf8mb4
        COLLATE=utf8mb4_unicode_ci;
    `);
  
    // Отзывы, ожидающие модерацию
    await db.query(`
      CREATE TABLE reviews_pending (
        id INT AUTO_INCREMENT PRIMARY KEY,
        author_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(30),
        rating TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        product_id INT NOT NULL,
        FOREIGN KEY (product_id) REFERENCES products(id)
      ) ENGINE=InnoDB
        DEFAULT CHARSET=utf8mb4
        COLLATE=utf8mb4_unicode_ci;
    `);
  
    // Отмодерированные отзывы
    await db.query(`
      CREATE TABLE reviews_approved (
        id INT PRIMARY KEY,
        author_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(30),
        rating TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment TEXT NOT NULL,
        created_at DATETIME,
        product_id INT NOT NULL,
        FOREIGN KEY (product_id) REFERENCES products(id)
      ) ENGINE=InnoDB
        DEFAULT CHARSET=utf8mb4
        COLLATE=utf8mb4_unicode_ci;
    `);
  
    // Заказы
    await db.query(`
      CREATE TABLE orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        status ENUM('new','processing','shipped','delivered','cancelled') NOT NULL,
        location_id INT NOT NULL,
        customer_phone VARCHAR(30) NOT NULL,
        customer_fullname VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255) NOT NULL,
        payment_method ENUM('cash','card','online','pickup') NOT NULL,
        delivery_cost DECIMAL(10,2) NOT NULL,
        has_discount BOOLEAN DEFAULT FALSE,
        total_amount DECIMAL(12,2) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (location_id) REFERENCES locations(id)
      ) ENGINE=InnoDB
        DEFAULT CHARSET=utf8mb4
        COLLATE=utf8mb4_unicode_ci;
    `);
  
    // Позиции заказа
    await db.query(`
      CREATE TABLE order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        product_variant_id INT NOT NULL,
        quantity INT NOT NULL,
        weight DECIMAL(8,2) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (product_variant_id) REFERENCES product_variants(id)
      ) ENGINE=InnoDB
        DEFAULT CHARSET=utf8mb4
        COLLATE=utf8mb4_unicode_ci;
    `);
  
    // Быстрые заказы
    await db.query(`
      CREATE TABLE quick_orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        status ENUM('new','processing','completed','cancelled') NOT NULL,
        street VARCHAR(255) NOT NULL,
        house_number VARCHAR(50) NOT NULL,
        customer_name VARCHAR(255) NOT NULL,
        comment TEXT,
        total_amount DECIMAL(12,2) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
        DEFAULT CHARSET=utf8mb4
        COLLATE=utf8mb4_unicode_ci;
    `);
  
    // Позиции быстрых заказов
    await db.query(`
      CREATE TABLE quick_order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        quick_order_id INT NOT NULL,
        product_variant_id INT NOT NULL,
        quantity INT NOT NULL,
        weight DECIMAL(8,2) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (quick_order_id) REFERENCES quick_orders(id),
        FOREIGN KEY (product_variant_id) REFERENCES product_variants(id)
      ) ENGINE=InnoDB
        DEFAULT CHARSET=utf8mb4
        COLLATE=utf8mb4_unicode_ci;
    `);
  };
  
  exports.down = async function(db) {
    // Удаляем в обратном порядке зависимости
    await db.query('DROP TABLE IF EXISTS quick_order_items;');
    await db.query('DROP TABLE IF EXISTS quick_orders;');
    await db.query('DROP TABLE IF EXISTS order_items;');
    await db.query('DROP TABLE IF EXISTS orders;');
    await db.query('DROP TABLE IF EXISTS reviews_approved;');
    await db.query('DROP TABLE IF EXISTS reviews_pending;');
    await db.query('DROP TABLE IF EXISTS locations;');
    await db.query('DROP TABLE IF EXISTS users;');
    await db.query('DROP TABLE IF EXISTS product_variants;');
    await db.query('DROP TABLE IF EXISTS products;');
    await db.query('DROP TABLE IF EXISTS categories;');
  };
  