/*
 catalog.js — полная версия работы каталога через API и MySQL
 Подключения:
  - Загрузка категорий из /api/categories
  - Загрузка фильтров из /api/filters
  - Загрузка товаров из /api/products с учётом фильтров и пагинации
  - Добавление в корзину через /api/cart
  - Добавление в избранное через /api/favorites
*/

// сюда выгрузим полный массив категорий
let allCategories = [];


document.addEventListener('DOMContentLoaded', () => {
  // находим тот самый .loading-products, который уже есть в разметке
  const loading = document.querySelector('.loading-products');
  // если хотите общий блок ошибок — добавьте в HTML 
  // <div id="error-message" class="error-message"></div>
  const errorMessage = document.getElementById('error-message');

  const grid = document.getElementById('products-grid');
  const categorySelect = document.getElementById('filter-category');
  const brandSelect = document.getElementById('filter-brand');
  const ageSelect = document.getElementById('filter-age');
  const sizeSelect = document.getElementById('filter-size');
  const paginationContainer = document.getElementById('pagination');
  const sortSelect = document.getElementById('sort-select'); // Добавлено

  const filters = {
    category: '',
    brand: '',
    ageGroup: '',
    sizeGroup: '',
    page: 1,
    perPage: 20,
    sort: 'default' // Добавлено
  };

  if (!grid) return;

  initCatalog();

  
// catalog.js (обновляем initCatalog)
/**
 * Инициализация каталога:
 *  — Загружает категории и фильтры
 *  — Рендерит главную панель категорий
 *  — Если в URL есть category, поднимает фильтр и открывает подпанель при необходимости
 *  — Запускает отрисовку товаров
 */
/**
 * Инициализация каталога:
 *  – Сначала грузим и сразу рендерим категории (убираем плейсхолдер)
 *  – Параллельно грузим «бренды», «возраст» и «размер»
 *  – Если в URL есть category, сразу показываем/подсвечиваем её
 *  – Вешаем слушатели и грузим товары
 */
async function initCatalog() {
  // Показываем общий лоадер страницы
  showLoading();
  errorMessage.style.display = 'none';

  // Селектор контейнера «дерева» категорий
  const tree = document.getElementById('filter-category');

  // 1. Плейсхолдер «Загрузка категорий...» (если есть) убираем
  const placeholder = tree.querySelector('.loading-categories');
  if (placeholder) placeholder.remove();

  // 2. Подгружаем категории первым запросом
  try {
    const categories = await fetchCategories();
    allCategories = categories;           // сохраняем глобально
    renderMainCategories();               // рендерим корневые
  } catch (err) {
    console.error('Не удалось загрузить категории:', err);
    // Если хотите показать текст ошибки прямо в сайдбаре:
    if (tree) {
      tree.innerHTML = '<div class="error">Не удалось загрузить категории</div>';
    }
    // Пробрасываем дальше — чтобы система показала общий error-message
    throw err;
  }

  // 3. Параллельно подгружаем данные для остальных фильтров
  let filtersData;
  try {
    filtersData = await fetchFilters();
  } catch (err) {
    console.error('Не удалось загрузить остальные фильтры:', err);
    throw err;
  }

  // 4. Берём параметр category из URL (если есть)
// 4. Берём параметр category из URL (если есть)
const urlParams = new URLSearchParams(window.location.search);
const categoryParam = urlParams.get('category');
if (categoryParam) {
  const category = allCategories.find(c => c.id == categoryParam);
  if (category) {
    // Устанавливаем фильтр
    filters.category = categoryParam;
    
    if (category.parent_id) {
      // Если это подкатегория - показываем родительскую панель
      renderSubcategories(category.parent_id);
      document.getElementById('filter-category').classList.add('show-sub');
    }
    
    // Помечаем активную категорию и применяем фильтр
    const categoryElement = document.querySelector(`[data-id="${categoryParam}"]`);
    if (categoryElement) {
      categoryElement.classList.add('active');
      
      // Если это подкатегория - помечаем и родительскую категорию
      if (category.parent_id) {
        const parentElement = document.querySelector(`[data-id="${category.parent_id}"]`);
        if (parentElement) {
          parentElement.classList.add('active-parent');
        }
      }
    }
  }
}

  // 5. Рендерим выпадающие селекты: бренд, возраст, размер
  populateFilterSelect(brandSelect, filtersData.brands);
  populateFilterSelect(ageSelect,   filtersData.ageGroups);
  populateFilterSelect(sizeSelect,  filtersData.sizeGroups);

  // 6. Вешаем все слушатели (категории + остальные фильтры + сортировку)
  setupFilterListeners();

  // 7. Грузим товары с учётом текущих фильтров
  try {
    await loadProducts();
  } catch (err) {
    console.error('Ошибка при загрузке товаров после инициализации:', err);
  } finally {
    hideLoading();
  }
}


  
  

function showLoading() {
  if (loading) loading.style.display = 'block';
}
function hideLoading() {
  if (loading) loading.style.display = 'none';
}
function showError(msg) {
  if (errorMessage) {
    errorMessage.textContent = msg;
    errorMessage.style.display = 'block';
  }
}


  async function fetchCategories() {
    const res = await fetch('/api/categories');
    if (!res.ok) throw new Error('Не удалось загрузить категории');
    return res.json();
  }

  async function fetchFilters() {
    const res = await fetch('/api/product-filters'); // Было /api/filters
    if (!res.ok) throw new Error('Не удалось загрузить фильтры');
    return res.json();
  }

/**
 * Рендерит в .main-panel все корневые категории (parent_id === null)
 */
function renderMainCategories() {
  const tree = document.getElementById('filter-category');
  if (!tree) {
    console.error('Контейнер категорий не найден');
    return;
  }
  
  const ul = tree.querySelector('.main-panel ul');
  if (!ul) {
    console.error('Элемент списка категорий не найден');
    return;
  }
  
  ul.innerHTML = ''; 

  const mainCategories = allCategories.filter(cat => !cat.parent_id);
  
  if (mainCategories.length === 0) {
    ul.innerHTML = '<li>Категории не найдены</li>';
    return;
  }

  mainCategories.forEach(cat => {
    const li = document.createElement('li');
    li.className = 'category-item';
    li.dataset.id = cat.id;
    
    li.innerHTML = `
      <div class="category-content">
        <img src="${cat.iconUrl}" 
             alt="${cat.name}" 
             class="category-icon"
             onerror="this.src='/images/placeholder.png'">
        <span class="category-label">${cat.name}</span>
        <svg class="category-arrow" viewBox="0 0 24 24">
          <path d="M7 10l5 5 5-5"/>
        </svg>
      </div>
    `;
    
    ul.appendChild(li);
  });
}


/**
 * Рендерит в .sub-panel подкатегории для переданного parentId
 */
function renderSubcategories(parentId) {
  const tree = document.getElementById('filter-category');
  const ul = tree.querySelector('.sub-panel ul');
  ul.innerHTML = ''; // очищаем

  allCategories
    .filter(cat => String(cat.parent_id) === String(parentId))
    .forEach(cat => {
      const li = document.createElement('li');
      li.classList.add('subcategory-item');
      li.dataset.id = cat.id;
      li.textContent = cat.name;
      ul.appendChild(li);
    });
}

  function isCatalogPage() {
    const path = window.location.pathname.toLowerCase();
    return path.endsWith('catalog.html') || path.endsWith('catalog/');
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

/**
 * Навешивает обработчики:
 *  – на навигацию по категориям (две панели)
 *  – на изменение остальных фильтров и сортировки
 */
function setupFilterListeners() {
  const tree = document.getElementById('filter-category');
  if (!tree) {
    console.warn('Контейнер категорий не найден');
    return;
  }

  function applyCategoryFilter(categoryId) {
    // 1. Проверяем валидность категории
    const category = allCategories.find(c => c.id == categoryId);
    if (!category) {
      console.error(`Категория с ID ${categoryId} не найдена`);
      showError('Выбранная категория не существует');
      return;
    }
  
    // 2. Проверяем, не выбрана ли уже эта категория
    if (filters.category === categoryId) {
      // Если фильтр уже применен - обновляем товары (на случай изменения данных)
      loadProducts();
      return;
    }
  
    // 3. Сбрасываем сопутствующие данные
    filters.page = 1;
    filters.brand = '';
    filters.ageGroup = '';
    filters.sizeGroup = '';
  
    // 4. Обновляем фильтр и URL
    filters.category = categoryId;
    const params = new URLSearchParams(window.location.search);
    
    // Сохраняем другие параметры кроме категории
    const preserveParams = ['sort', 'perPage'];
    preserveParams.forEach(param => {
      if (params.has(param)) params.delete(param);
    });
    
    params.set('category', categoryId);
    window.history.replaceState(null, '', `?${params.toString()}`);
  
    // 5. Обновляем UI фильтров
    if (brandSelect) brandSelect.value = '';
    if (ageSelect) ageSelect.value = '';
    if (sizeSelect) sizeSelect.value = '';
  
    // 6. Визуальная обратная связь
    const categoryName = category.name;
    showTempMessage(`Применён фильтр: "${categoryName}"`);
  
    // 7. Обновляем подсветку в дереве категорий
    updateCategoryHighlight(category);
  
    // 8. Загружаем товары с задержкой для анимации
    setTimeout(() => {
      loadProducts();
    }, 300);
  }
  
  // Вспомогательная функция для подсветки
  function updateCategoryHighlight(category) {
    // Сбрасываем все активные состояния
    document.querySelectorAll('.category-item, .subcategory-item').forEach(el => {
      el.classList.remove('active', 'active-parent');
    });
  
    // Помечаем текущую категорию
    const currentElement = document.querySelector(`[data-id="${category.id}"]`);
    if (currentElement) {
      currentElement.classList.add('active');
      
      // Если это подкатегория - помечаем родителя
      if (category.parent_id) {
        const parentElement = document.querySelector(`[data-id="${category.parent_id}"]`);
        if (parentElement) {
          parentElement.classList.add('active-parent');
          // Открываем подменю
          document.getElementById('filter-category').classList.add('show-sub');
          renderSubcategories(category.parent_id);
        }
      }
    }
  }
  
  function navigateToCatalog(categoryId) {
    // Плавный переход с анимацией загрузки
    document.body.classList.add('page-transition');
    setTimeout(() => {
      window.location.href = `catalog.html?category=${categoryId}`;
    }, 300);
  }

  // Делегированный обработчик для .main-panel
// Делегированный обработчик для .main-panel
const mainPanelList = tree.querySelector('.main-panel ul');
if (mainPanelList) {
 
  mainPanelList.addEventListener('click', e => {
    if (e.detail >= 3) return;
    const arrow = e.target.closest('.category-arrow');
    const item = e.target.closest('.category-item');
    if (!item) return;

    const catId = item.dataset.id;
    const hasChildren = allCategories.some(
      cat => String(cat.parent_id) === String(catId)
    );

    if (arrow && hasChildren) {
      // Открываем подкатегории при клике на стрелку (существующая логика)
      renderSubcategories(catId);
      tree.classList.add('show-sub');
      
      // Прокрутка к началу списка (если нужно)
      const subPanel = tree.querySelector('.sub-panel');
      if (subPanel) {
        subPanel.scrollTop = 0;
      }
    } 
    else if (!arrow) {
      const catId = item.dataset.id;
      const currentCategory = allCategories.find(c => c.id == catId);
      const hasChildren = allCategories.some(c => c.parent_id == catId);
  
      if (isCatalogPage()) {
          // Логика для страницы каталога
          if (filters.category === catId) {
              // Второй клик - снимаем фильтр
              filters.category = '';
              document.querySelectorAll('.category-item, .subcategory-item')
                  .forEach(el => el.classList.remove('active', 'active-parent'));
              tree.classList.remove('show-sub');
          } else {
              // Первый клик - применяем фильтр
              filters.category = catId;
              document.querySelectorAll('.category-item, .subcategory-item')
                          .forEach(el => el.classList.remove('active', 'active-parent'));
              item.classList.add('active');
              const parentCategory = allCategories.find(c => c.id === currentCategory.parent_id);
              if (parentCategory) {
                const parentElement = document.querySelector(`[data-id="${parentCategory.id}"]`);
                if (parentElement) parentElement.classList.add('active-parent');
              }
              // Сбрасываем подкатегории если есть дети, но не показываем панель
              if (hasChildren) {
                  renderSubcategories(catId);
                  tree.classList.remove('show-sub'); // Не показываем подкатегории
              }
          }
  
          // Обновляем URL и загружаем товары
          const params = new URLSearchParams(window.location.search);
          filters.category ? params.set('category', filters.category) : params.delete('category');
          window.history.replaceState(null, '', `?${params.toString()}`);
          loadProducts();
          
      } else {
          // Переход на каталог с фильтром
          navigateToCatalog(catId);
      }
  }
    
    
    
    
  });
}

  // Кнопка «Назад» в подпанели — закрывает подпанель
  const backBtn = tree.querySelector('.sub-panel .back-button');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      tree.classList.remove('show-sub');
    });
  } else {
    console.warn('Кнопка назад в подпанели не найдена');
  }

  // Клик по подкатегории — применяем фильтр
  const subList = tree.querySelector('.sub-panel ul');
  if (subList) {
    subList.addEventListener('click', e => {
      const sub = e.target.closest('.subcategory-item');
      if (!sub) return;
      
      const categoryId = sub.dataset.id;
      if (isCatalogPage()) {
        // На каталоге - стандартная логика
        filters.category = categoryId;
        filters.page = 1;
        const params = new URLSearchParams(window.location.search);
        params.set('category', filters.category);
        history.replaceState(null, '', `?${params.toString()}`);
        
        // Обновляем подсветку
        document.querySelectorAll('.subcategory-item').forEach(el => 
          el.classList.remove('active')
        );
        sub.classList.add('active');
        
        loadProducts();
      } else {
        // На других страницах - переход
        window.location.href = `catalog.html?category=${categoryId}`;
      }
    });
  }

  // Остальные фильтры: бренд, возраст, размер
  const filterElements = [
    { element: brandSelect, prop: 'brand' },
    { element: ageSelect,   prop: 'ageGroup' },
    { element: sizeSelect,  prop: 'sizeGroup' }
  ];
  filterElements.forEach(({ element, prop }) => {
    if (!element) {
      console.warn(`Filter element for ${prop} not found!`);
      return;
    }
    element.addEventListener('change', function() { // Важно использовать обычную функцию!
      filters[prop] = this.value;
      filters.page = 1;
      
      // Закрываем родительский <details>
      const details = this.closest('details.filter-group');
      if (details) {
        details.open = false; // Убираем атрибут open
      }
      
      loadProducts();
      
    });
  });

  // Сортировка
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      filters.sort = sortSelect.value;
      filters.page = 1;
      loadProducts();
    });
  } else {
    console.warn('Элемент сортировки не найден');
  }
}





  async function loadProducts() {
    showLoading();
    errorMessage.style.display = 'none';
  
    // 1. Собираем параметры
    const params = new URLSearchParams({
      category: filters.category,
      brand:    filters.brand,
      ageGroup: filters.ageGroup,
      sizeGroup: filters.sizeGroup,
      page:     filters.page,
      perPage:  filters.perPage,
      sort:     filters.sort // Добавлено
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
      <a href="/product.html?id=${p.id}" class="product-link">
        <div class="image-container">
          <img src="${p.imageUrl}"
               onerror="this.onerror=null;this.src='/images/placeholder.png'"
               alt="${p.title}">
        </div>
        
      </a>
      <h3 class="product-name" style="text-decoration: none">${p.title}</h3>
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
                weight: parseFloat(variantBtn.dataset.weight), // сохраняем как число
                weightUnit: variantBtn.dataset.weight_unit || 'кг', // сохраняем единицы отдельно
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


