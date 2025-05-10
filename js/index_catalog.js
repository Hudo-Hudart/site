/*
 catalog.js — полная версия работы каталога через API и MySQL
 Подключения:
  - Загрузка категорий из /api/categories
  - Загрузка фильтров из /api/filters
  - Загрузка товаров из /api/products с учётом фильтров и пагинации
  - Добавление в корзину через /api/cart
  - Добавление в избранное через /api/favorites
*/

document.addEventListener('DOMContentLoaded', () => {
    const loading = document.getElementById('loading');
    const errorMessage = document.getElementById('error-message');
    const grid = document.getElementById('products-grid');
    const categorySelect = document.getElementById('filter-category');
    const brandSelect = document.getElementById('filter-brand');
    const ageSelect = document.getElementById('filter-age');
    const sizeSelect = document.getElementById('filter-size');
    const paginationContainer = document.getElementById('pagination');
  
    const filters = {
      category: '',
      brand: '',
      ageGroup: '',
      sizeGroup: '',
      page: 1,
      perPage: 20
    };
  
    if (!grid) return;
  
    initCatalog();
  
    document.addEventListener('DOMContentLoaded', () => {
      initCatalog();
    });
    
    async function initCatalog() {
      showLoading();
      errorMessage.style.display = 'none';
      
      // Проверяем, есть ли на странице select для категории
      const categorySelect = document.getElementById('filter-category');
      if (categorySelect) {
        // если да — подгружаем и рендерим категории и фильтры
        try {
          const categories = await fetchCategories();
          populateCategoryDropdown(categories); // внутрь использует categorySelect
    
          const filtersData = await fetchFilters();
          populateFilterSelect(document.getElementById('filter-brand'), filtersData.brands);
          populateFilterSelect(document.getElementById('filter-age'),   filtersData.ageGroups);
          populateFilterSelect(document.getElementById('filter-size'),  filtersData.sizeGroups);
    
          setupFilterListeners();
        } catch (e) {
          console.error('Ошибка инициализации фильтров:', e);
        }
      }
    
      // в любом случае — грузим товары через API
      await loadProducts();
      hideLoading();
    }
    
    
  
    function showLoading() { loading.style.display = 'block'; }
    function hideLoading() { loading.style.display = 'none'; }
    function showError(msg) {
      errorMessage.textContent = msg;
      errorMessage.style.display = 'block';
    }
  
    async function fetchCategories() {
      const res = await fetch('/api/categories');
      if (!res.ok) throw new Error('Не удалось загрузить категории');
      return res.json();
    }
  
    async function fetchFilters() {
      const res = await fetch('/api/filters');
      if (!res.ok) throw new Error('Не удалось загрузить фильтры');
      return res.json(); // { brands: [], ageGroups: [], sizeGroups: [] }
    }
  
    function populateCategoryDropdown(categories, parentId = null, level = 0) {
      categories
        .filter(cat => cat.parent_id === parentId)
        .forEach(cat => {
          const option = document.createElement('option');
          option.value = cat.id;
          option.textContent = `${'—'.repeat(level)} ${cat.name}`;
          categorySelect.appendChild(option);
          populateCategoryDropdown(categories, cat.id, level + 1);
        });
    }
  
    function populateFilterSelect(selectElem, items) {
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = 'Все';
      selectElem.appendChild(defaultOption);
      items.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item;
        opt.textContent = item;
        selectElem.appendChild(opt);
      });
    }
  
    function setupFilterListeners() {
      [categorySelect, brandSelect, ageSelect, sizeSelect].forEach(select => {
        select.addEventListener('change', () => {
          filters.page = 1;
          filters.category = categorySelect.value;
          filters.brand = brandSelect.value;
          filters.ageGroup = ageSelect.value;
          filters.sizeGroup = sizeSelect.value;
          loadProducts();
        });
      });
    }
  
    async function loadProducts() {
      showLoading();
      errorMessage.style.display = 'none';
    
      // 1. Собираем параметры
      const params = new URLSearchParams({
        category: filters.category,
        brand:    filters.brand,
        ageGroup: filters.ageGroup,
        sizeGroup:filters.sizeGroup,
        page:     filters.page,
        perPage:  filters.perPage
      });
    
      // 2. Fetch + JSON-парсинг — только здесь ловим ошибки загрузки
      let products, totalPages;
      try {
        const res = await fetch(`/api/products?${params.toString()}`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = await res.json();
        console.log('ответ /api/products:', json);
    
        products   = Array.isArray(json) ? json : (json.data || []);
        totalPages = Array.isArray(json) ? 1    : (json.totalPages ?? 1);
    
      } catch (err) {
        console.error('Ошибка загрузки товаров:', err);
        showError('Не удалось загрузить товары');
        hideLoading();
        return;    // выходим из функции — дальше не рендерим
      }
    
      // 3. Рендерим товары и пагинацию — ошибки здесь НЕ должны показывать сообщение об ошибке
      try {
        renderProducts(products);
        if (paginationContainer) {
          setupPagination(totalPages);
        }
      } catch (renderErr) {
        console.error('Ошибка рендера или пагинации:', renderErr);
        // ← не вызываем showError, просто логируем
      }
    
      // 4. Всегда скрываем лоадер
      hideLoading();
    }
    
    
  
    function renderProducts(products) {
      grid.innerHTML = '';
      products.forEach(p => {
        // Сразу парсим rating из строки в число
        const ratingNum = p.rating != null
          ? parseFloat(p.rating)
          : NaN;
        const ratingStr = Number.isFinite(ratingNum)
          ? ratingNum.toFixed(1)
          : '—';
    
        // Начальная цена (парсим строку в число)
        const initialPriceNum = p.variants[0]
          ? parseFloat(p.variants[0].price)
          : 0;
        const initialPriceStr = initialPriceNum.toFixed(2);
    
        const card = document.createElement('div');
        card.className = 'product-card';
        card.dataset.id = p.id;
        card.innerHTML = `
  <a href="/product.html?id=${p.id}" class="product-link" >
    <div class="image-container">
      <img src="${p.imageUrl}"
           onerror="this.onerror=null; this.src='/images/placeholder.png'"
           alt="${p.title}">
    </div>
   
  </a>
 <h3 class="product-name">${p.title}</h3>
  <div class="product-body">
    <div class="product-rating">★ ${ratingStr}</div>

    <div class="weight-quantity">
      <div class="weight-block">
        <label>Вес:</label>
        <div class="weight-options">
          ${p.variants.map((v, i) => `
            <button class="weight-btn${i===0?' selected':''}"
                    data-variant-id="${v.variant_id}"
                    data-price="${v.price}"
                    data-weight="${v.weight}">
              ${v.weight} ${v.weight_unit || 'кг'}
            </button>
          `).join('')}
        </div>
      </div>

      <div class="quantity-counter">
        <button class="quantity-decrement">−</button>
        <span class="quantity">1</span>
        <button class="quantity-increment">+</button>
      </div>
    </div>

    <div class="price-buy">
      <div class="buy-actions">
        <div class="price">${initialPriceStr} ₽</div>
        <a href="#" class="add-to-cart">Купить</a>
        <a href="#" class="add-to-favorites">❤</a>
      </div>
    </div>
  </div>
`;

        grid.appendChild(card);
      });
      setupEventHandlers();
    }
    
       
  
    function setupEventHandlers() {
      // Выбор веса
      grid.querySelectorAll('.weight-btn').forEach(btn => {
          btn.addEventListener('click', () => {
              const parent = btn.closest('.weight-options');
              parent.querySelectorAll('.weight-btn').forEach(b => b.classList.remove('selected'));
              btn.classList.add('selected');
              updatePrice(btn.closest('.product-card'));
          });
      });
  
      // Регулировка количества
      grid.querySelectorAll('.quantity-increment').forEach(btn => {
          btn.addEventListener('click', () => {
              const qtyElem = btn.parentElement.querySelector('.quantity');
              let qty = parseInt(qtyElem.textContent, 10);
              if (qty < 99) qtyElem.textContent = ++qty;
              updatePrice(btn.closest('.product-card'));
          });
      });
  
      grid.querySelectorAll('.quantity-decrement').forEach(btn => {
          btn.addEventListener('click', () => {
              const qtyElem = btn.parentElement.querySelector('.quantity');
              let qty = parseInt(qtyElem.textContent, 10);
              if (qty > 1) qtyElem.textContent = --qty;
              updatePrice(btn.closest('.product-card'));
          });
      });
  
      // Добавление в корзину
      grid.querySelectorAll('.add-to-cart').forEach(link => {
          link.addEventListener('click', e => {
              e.preventDefault();
              const card = link.closest('.product-card');
              const variantBtn = card.querySelector('.weight-btn.selected');
              
              if (!variantBtn) {
                  alert('Пожалуйста, выберите вес товара');
                  return;
              }
  
              const product = {
                  id: card.dataset.id,
                  variantId: variantBtn.dataset.variantId,
                  name: card.querySelector('.product-name').textContent.trim(),
                  price: parseFloat(variantBtn.dataset.price),
    weight: parseFloat(variantBtn.dataset.weight), // число вместо строки
    weightUnit: variantBtn.dataset.weight_unit || 'кг',
                  image: card.querySelector('img').src,
                  quantity: parseInt(card.querySelector('.quantity').textContent, 10)
              };
  
              try {
                  const cart = JSON.parse(localStorage.getItem('cart')) || [];
                  const existingItem = cart.find(item => 
                      item.variantId === product.variantId && item.id === product.id
                  );
  
                  if (existingItem) {
                      existingItem.quantity += product.quantity;
                  } else {
                      cart.push(product);
                  }
  
                  localStorage.setItem('cart', JSON.stringify(cart));
                  document.dispatchEvent(new CustomEvent('cart-updated'));
                  alert('Товар добавлен в корзину');
              } catch (err) {
                  console.error('Ошибка сохранения корзины:', err);
                  alert('Ошибка при добавлении в корзину');
              }
          });
      });
  
      // Добавление в избранное
      // catalog.js
  // catalog.js
  grid.querySelectorAll('.add-to-favorites').forEach(link => {
    link.addEventListener('click', e => {
        e.preventDefault();
        const card = link.closest('.product-card');
        const variantBtn = card.querySelector('.weight-btn.selected');
        
        if (!variantBtn) {
            alert('Пожалуйста, выберите вариант товара');
            return;
        }
  
        // Исправленный объект продукта
        const product = {
            id: card.dataset.id,
            variantId: variantBtn.dataset.variantId,
            name: card.querySelector('.product-name').textContent.trim(),
            price: parseFloat(variantBtn.dataset.price) || 0,
            weight: variantBtn.dataset.weight + ' ' + (variantBtn.dataset.weight_unit || 'кг'),
            image: card.querySelector('img')?.src || '/images/placeholder.png' // Важная правка
        };
  
        favorites.toggleFavorite(product);
        console.log('favorites.items =', favorites.items);
        console.log('localStorage[\'favorites\'] =', localStorage.getItem('favorites'));
  
        link.classList.toggle('active', 
            favorites.items.some(i => i.id === product.id)
        );
    });
  });
  } // Конец setupEventHandlers
    function updatePrice(card) {
      const variantBtn = card.querySelector('.weight-btn.selected');
      const pricePerUnit = parseFloat(variantBtn.dataset.price);
      const qty = parseInt(card.querySelector('.quantity').textContent, 10);
      const total = pricePerUnit * qty;
      card.querySelector('.price').textContent = `${total.toFixed(2)} ₽`;
    }
  
    function setupPagination(totalPages) {
      paginationContainer.innerHTML = '';
      const prev = document.createElement('button');
      prev.textContent = '«';
      prev.disabled = filters.page <= 1;
      prev.addEventListener('click', () => changePage(filters.page - 1));
      paginationContainer.appendChild(prev);
      for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        if (i === filters.page) btn.classList.add('active');
        btn.addEventListener('click', () => changePage(i));
        paginationContainer.appendChild(btn);
      }
      const next = document.createElement('button');
      next.textContent = '»';
      next.disabled = filters.page >= totalPages;
      next.addEventListener('click', () => changePage(filters.page + 1));
      paginationContainer.appendChild(next);
    }
  
    function changePage(page) {
      filters.page = page;
      loadProducts();
    }
  });
  