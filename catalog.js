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

  async function initCatalog() {
    try {
      showLoading();
      const [categories, filterData] = await Promise.all([
        fetchCategories(),
        fetchFilters()
      ]);
      populateCategoryDropdown(categories);
      populateFilterSelect(brandSelect, filterData.brands);
      populateFilterSelect(ageSelect, filterData.ageGroups);
      populateFilterSelect(sizeSelect, filterData.sizeGroups);
      setupFilterListeners();
      await loadProducts();
    } catch (err) {
      console.error(err);
      showError('Ошибка при инициализации каталога');
    } finally {
      hideLoading();
    }
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
    const params = new URLSearchParams({
      category: filters.category,
      brand: filters.brand,
      ageGroup: filters.ageGroup,
      sizeGroup: filters.sizeGroup,
      page: filters.page,
      perPage: filters.perPage
    });
    try {
      const res = await fetch(`/api/products?${params.toString()}`);
      if (!res.ok) throw new Error('Ошибка при загрузке товаров');
      const { data: products, totalPages } = await res.json();
      renderProducts(products);
      setupPagination(totalPages);
    } catch (err) {
      console.error(err);
      showError('Не удалось загрузить товары');
    } finally {
      hideLoading();
    }
  }

  function renderProducts(products) {
    grid.innerHTML = '';
    products.forEach(p => {
      const card = document.createElement('div');
      card.className = 'product-card';
      card.dataset.id = p.id;
      card.innerHTML = `
        <div class="image-container">
          <img src="${p.imageUrl || '/images/placeholder.png'}" alt="${p.title}" />
        </div>
        <h3 class="product-name">${p.title}</h3>
        <div class="product-rating">★ ${p.rating ? p.rating.toFixed(1) : '—'}</div>
        <div class="weight-block">
          <label>Вес:</label>
          <div class="weight-options">
            ${p.variants.map((v, i) => `
              <button class="weight-btn${i===0?' selected':''}" data-variant-id="${v.id}" data-price="${v.price}" data-weight="${v.weight}">
                ${v.weight} ${v.weight_unit || 'г'}
              </button>
            `).join('')}
          </div>
        </div>
        <p class="price">${p.variants[0] ? p.variants[0].price.toFixed(2) : '0.00'} ₽</p>
        <div class="quantity-counter">
          <button class="quantity-decrement">-</button>
          <span class="quantity">1</span>
          <button class="quantity-increment">+</button>
        </div>
        <div class="buy-actions">
          <a href="#" class="add-to-cart">Купить</a>
          <a href="#" class="add-to-favorites">❤</a>
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
      link.addEventListener('click', async e => {
        e.preventDefault();
        const card = link.closest('.product-card');
        const variantBtn = card.querySelector('.weight-btn.selected');
        const variantId = variantBtn.dataset.variantId;
        const quantity = parseInt(card.querySelector('.quantity').textContent, 10);
        try {
          const res = await fetch('/api/cart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ variantId, quantity })
          });
          if (!res.ok) throw new Error();
          alert('Товар добавлен в корзину');
        } catch {
          alert('Ошибка при добавлении в корзину');
        }
      });
    });
    // Добавление в избранное
    grid.querySelectorAll('.add-to-favorites').forEach(link => {
      link.addEventListener('click', async e => {
        e.preventDefault();
        const productId = link.closest('.product-card').dataset.id;
        try {
          const res = await fetch('/api/favorites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId })
          });
          if (!res.ok) throw new Error();
          link.classList.toggle('favorited');
        } catch {
          alert('Ошибка при добавлении в избранное');
        }
      });
    });
  }

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
