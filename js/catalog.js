document.addEventListener('DOMContentLoaded', function() {
  const loading = document.getElementById('loading');
  const errorMessage = document.getElementById('error-message');
  const grid = document.getElementById('products-grid');

  if (!document.querySelector('.catalog-dropdown')) return;
  initDynamicCatalog();

  if (!loading || !errorMessage || !grid) return;

  loading.style.display = 'block';
  errorMessage.style.display = 'none';

  // 2. Загрузка данных
  loading.style.display = 'block';
  errorMessage.style.display = 'none';

  fetch('../data/products.json')
    .then(response => {
      if (!response.ok) throw new Error('Ошибка сети');
      return response.json();
    })
    .then(data => {
      const products = data.rows;      
      loading.style.display = 'none';
      renderProducts(products);
    })
    .catch(error => {
      loading.style.display = 'none';
      errorMessage.style.display = 'block';
      console.error('Ошибка:', error);
    });
});

// 3. Преобразование данных
function transformRow(row) {
  return {
    id: parseInt(row[0], 10),
    name: row[1],
    category_id: row[2],
    price: parseFloat(row[3]),
    rating: parseFloat(row[4]) || 0,
    image: row[5] || 'images/placeholder.png',
    weights: Array.isArray(row[9]) ? row[9] : [0.5, 1, 2]
  };
}

// 4. Отрисовка товаров
function renderProducts(products) {
  const grid = document.getElementById('products-grid');
  const transformedProducts = products.map(transformRow);

  grid.innerHTML = transformedProducts.map(product => `
    <div class="product-card" data-id="${product.id}">
      ${product.category_id === 0 ? `
        <div class="test-product-badge">Тестовый товар</div>
      ` : ''}

      <!-- Картинка -->
      <div class="image-container">
        <img 
          src="/images/${product.image}" 
          alt="${product.name}" 
          onerror="this.src='/images/placeholder.png'"
        >
      </div>

      <!-- Название товара -->
      <h3 class="product-name">${product.name}</h3>

      <!-- Рейтинг, если нужен именно блок звёзд или текст -->
      <div class="product-rating">
        ★ ${product.rating.toFixed(1)}
      </div>

      <!-- Вес, если нужно как кнопки: -->
      <div class="weight-block">
        <label class="weight-label">Вес, кг:</label>
        <div class="weight-options">
          ${product.weights.map(w => `
            <button class="weight-btn" data-weight="${w}">
              ${w}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Цена -->
      <p class="price">${product.price.toFixed(2)} ₽</p>

      <!-- (Необязательно) Счётчик количества -->
      <div class="quantity-counter">
        <button class="quantity-decrement">-</button>
        <span class="quantity">1</span>
        <button class="quantity-increment">+</button>
      </div>

      <!-- Блок действий: Купить / Сравнить / В избранное -->
      <div class="buy-actions">
        <div class="buy-left">
          <a href="#" class="add-to-cart">
            <img src="/images/cart.png" alt="Корзина" class="cart-icon-inline">
            Купить
          </a>
        </div>
        <div class="buy-right">
          <a href="#" title="Сравнить">
            <img src="/images/compet.png" alt="Сравнить">
          </a>
          <a href="#" class="add-to-favorites" title="В избранное">
            <img src="/images/heart.png" alt="Избранное">
          </a>
        </div>
      </div>
    </div>
  `).join('');

  // Назначаем обработчик клика на всю карточку, чтобы открыть страницу товара.
  grid.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', function(e) {
      // Если клик произошёл по управляющим элементам внутри карточки – не перенаправляем.
      if (e.target.closest('.add-to-cart') || 
       e.target.closest('.quantity-counter') || 
       e.target.closest('.weight-options') || 
       e.target.closest('.buy-actions')) return;

       const productId = card.dataset.id;
       if (!productId) {
           console.error('ID товара не найден в data-атрибуте');
           return;
       }
       window.location.href = `/product.html?id=${encodeURIComponent(productId)}`;
    });
  });

  // Вызываем функции для инициализации обработчиков для кнопок внутри карточек.
  setupEventHandlers(transformedProducts);
}

/**
 * Функция для рендера звёзд (пример).
 */
function renderStars(rating) {
  const fullStars = Math.floor(rating);
  const halfStar = (rating - fullStars) >= 0.5 ? 1 : 0;
  const emptyStars = 5 - fullStars - halfStar;
  
  let starsHTML = '';
  for (let i = 0; i < fullStars; i++) {
    starsHTML += '<span class="star full-star">★</span>';
  }
  if (halfStar) {
    starsHTML += '<span class="star half-star">★</span>';
  }
  for (let i = 0; i < emptyStars; i++) {
    starsHTML += '<span class="star empty-star">★</span>';
  }
  
  return starsHTML;
}




// 6. Обработчики событий (вынесены в отдельную функцию)
function setupEventHandlers(products) {
  // Счётчики количества
  document.querySelectorAll('.quantity-counter').forEach(counter => {
    const decrement = counter.querySelector('.decrement');
    const increment = counter.querySelector('.increment');
    const quantity = counter.querySelector('.quantity');
    
    if (!decrement || !increment || !quantity) return;

    let count = 1;
    decrement.addEventListener('click', () => {
      if (count > 1) quantity.textContent = --count;
    });
    increment.addEventListener('click', () => {
      quantity.textContent = ++count;
    });
  });

  // Кнопки веса
  document.querySelectorAll('.weight-options').forEach(block => {
    const buttons = block.querySelectorAll('.weight-btn');
    if (!buttons.length) return;
    
    // Активируем первую кнопку по умолчанию
    buttons[0].classList.add('active');
    
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  });

  // Добавление в корзину
  document.querySelectorAll('.add-to-cart').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      const card = e.target.closest('.product-card');
      if (!card) return;

      const activeWeightBtn = card.querySelector('.weight-btn.active');
      if (!activeWeightBtn) {
        console.error('Не выбран вес товара');
        return;
      }

      const productId = parseInt(card.dataset.id, 10);
      const quantity = parseInt(card.querySelector('.quantity').textContent, 10);
      const weight = parseFloat(activeWeightBtn.dataset.weight);
      const product = products.find(p => p.id === productId);

      if (product) {
        cart.addItem(product, quantity, weight);
        showAddedToCartMessage(product.name);
      }
    });
  });

  // Добавление обработчика для кнопки "В избранное"
  document.querySelectorAll('.add-to-favorites').forEach(btn => {
    btn.removeEventListener('click', favoritesHandler); // Удаляем старые обработчики
    btn.addEventListener('click', favoritesHandler);
  });

  function favoritesHandler(e) {
    e.preventDefault();
    const card = e.target.closest('.product-card');
    if (!card) return;

    const productId = parseInt(card.dataset.id, 10);
    const product = products.find(p => p.id === productId);
    if (!product) return;

    favorites.toggleFavorite(product);
    e.currentTarget.classList.toggle('active');
  }
}

// 7. Уведомление о добавлении
function showAddedToCartMessage(productName) {
  const notification = document.createElement('div');
  notification.className = 'cart-notification';
  notification.textContent = `✓ Добавлено: ${productName}`;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 2000);
}