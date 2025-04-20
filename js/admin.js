document.addEventListener('DOMContentLoaded', () => {
    const CONFIG = {
        ORDERS_DATA_URL: 'http://localhost:3000/api/orders',
        QUICK_ORDERS_DATA_URL: 'http://localhost:3000/api/quick-orders',
        PRODUCTS_DATA_URL: 'http://localhost:3000/api/data/products.json',
        CATEGORIES_DATA_URL: 'http://localhost:3000/api/data/categories.json',
        SAVE_DATA_URL: 'http://localhost:3000/api/save-data',
        UPLOAD_IMAGE_URL: 'http://localhost:3000/api/upload-image',
        PENDING_REVIEWS_URL: 'http://localhost:3000/api/data/pending-reviews.json',
        APPROVED_REVIEWS_URL: 'http://localhost:3000/api/data/approved-reviews.json',
        SAVE_REVIEWS_URL: 'http://localhost:3000/api/reviews' // Новый эндпоинт
    };

    let state = {
        orders: [],
        quickOrders: [],
        products: [],
        categories: [],
        currentTab: 'categories',
        flatCategories: [],
        pendingReviews: [],
        approvedReviews: []
    };

    

    const saveReview = async (reviewData) => {
        try {
            // Получаем текущие отзывы
            const response = await fetch(CONFIG.PENDING_REVIEWS_URL);
            const currentReviews = await response.json();
    
            // Генерируем ID для нового отзыва
            const newId = Math.max(...currentReviews.map(r => r.id), 0) + 1;
            
            // Формируем полный объект отзыва
            const newReview = {
                ...reviewData,
                id: newId,
                created_at: new Date().toISOString(),
                status: 'pending',
                // Добавить недостающие поля
                author: reviewData.author || 'Аноним',
                content: reviewData.content,
                rating: parseInt(reviewData.rating)
              };
    
            // Обновляем список отзывов
            const updatedReviews = [...currentReviews, newReview];
    
            // Отправляем на сервер
            await fetch(CONFIG.SAVE_REVIEWS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedReviews)
            });
    
            return true;
        } catch (error) {
            console.error('Ошибка сохранения отзыва:', error);
            return false;
        }
    };

    const DOM = {
        tabs: document.querySelectorAll('.admin-tab'),
        categoryForm: document.getElementById('add-category-form'),
        categoryParentSelect: document.getElementById('category-parent'),
        categoryList: document.querySelector('.category-list'),
        productForm: document.getElementById('add-product-form'),
        productCategorySelect: document.getElementById('product-category'),
        productTableBody: document.querySelector('.product-table tbody'),
        searchInput: document.querySelector('.search-box input'),
        reviewsSection: document.getElementById('reviews-section'),
        pendingList: document.querySelector('.pending-list'),
        approvedList: document.querySelector('.approved-list'),
        reviewCounters: {
            pending: document.querySelector('.pending-column .counter-number'),
            approved: document.querySelector('.approved-column .counter-number')
          } //
    };

    const checkAdminAccess = () => {
        const user = JSON.parse(localStorage.getItem('currentUser'));
        return user?.role === 'admin';
      };


    const uploadImage = async (file) => {
        const formData = new FormData();
        formData.append('image', file);

        try {
            const response = await fetch(CONFIG.UPLOAD_IMAGE_URL, {
                method: 'POST',
                body: formData
            });
            return await response.json();
        } catch (error) {
            console.error('Upload error:', error);
            alert('Ошибка загрузки изображения');
        }
    };

    const loadOrders = async () => {
        try {
            const [ordersRes, quickOrdersRes] = await Promise.all([
                fetch(CONFIG.ORDERS_DATA_URL),
                fetch(CONFIG.QUICK_ORDERS_DATA_URL)
            ]);
            
            if (!ordersRes.ok || !quickOrdersRes.ok) {
                throw new Error(`HTTP error! status: ${ordersRes.status} ${quickOrdersRes.status}`);
            }
            
            const ordersContentType = ordersRes.headers.get('content-type') || '';
            const quickOrdersContentType = quickOrdersRes.headers.get('content-type') || '';
            
            // Смягчаем проверку типа содержимого
            if (!ordersContentType.includes('json') || !quickOrdersContentType.includes('json')) {
                throw new TypeError("Получен не JSON ответ");
            }
            
            state.orders = await ordersRes.json();
            state.quickOrders = await quickOrdersRes.json();
            
        } catch (error) {
            console.error('Ошибка загрузки заказов:', error);
            showError(`Не удалось загрузить заказы: ${error.message}`);
            state.orders = [];
            state.quickOrders = [];
        }
    };

    // В начало блока с рендером заказов, прямо перед renderOrdersSection:
const renderStatusControls = (order, type) => {
    const statusOptions = ['new', 'processing', 'completed', 'cancelled'];
    return `
      <div class="order-controls">
        <select class="status-select">
          ${statusOptions.map(status => `
            <option value="${status}" ${order.status === status ? 'selected' : ''}>
              ${getStatusText(status)}
            </option>
          `).join('')}
        </select>
      </div>
    `;
  };
  

    const renderOrdersSection = (type) => {
        const orders = type === 'full' ? state.orders : state.quickOrders;
        const sectionId = `${type}-orders-section`;
        const container = document.getElementById(sectionId);
        if (!container) return;
      
        container.innerHTML = `
          <div class="orders-grid">
            ${orders.map(order => `
              <div class="order-card"
                   data-id="${order.id}"
                   data-order-type="${type}">
                <div class="order-meta">
                  <span class="order-status ${order.status}">
                    ${getStatusText(order.status)}
                  </span>
                </div>
                <div class="order-customer">
                  ${formatCustomerInfo(order, type)}
                </div>
                ${renderOrderDetails(order, type)}
                ${renderStatusControls(order, type)}
              </div>
            `).join('')}
          </div>
        `;
      
        container.querySelectorAll('.status-select').forEach(select => {
          select.addEventListener('change', handleStatusChange);
        });
      };
      

    // Новая функция для обработки изменения статуса
const handleStatusChange = async (e) => {
    const orderCard = e.target.closest('.order-card');
    const orderId = orderCard.dataset.id;
    const orderType = orderCard.closest('[data-order-type]').dataset.orderType;
    const newStatus = e.target.value;
    
    await updateOrderStatus(orderId, newStatus, orderType);
};
    
    // 4. Добавляем вспомогательные методы
    const getStatusText = (status) => {
        const statusMap = {
            new: 'Новый',
            processing: 'В обработке',
            completed: 'Завершен',
            cancelled: 'Отменен'
        };
        return statusMap[status] || status;
    };
    
    const formatCustomerInfo = (order, type) => {
        if (type === 'full') {
            return `
                ${order.customer.first_name} ${order.customer.last_name}<br>
                ${order.customer.phone}<br>
                ${order.customer.email || ''}
            `;
        }
        return `
            ${order.customer.name}<br>
            ${order.customer.phone}<br>
            ${order.customer.street} ${order.customer.house}
        `;
    };
    
    const renderOrderDetails = (order, type) => {
        if (type === 'full') {
            return `
                <div class="order-items">
                    ${order.items.map(item => `
                        <div class="order-item">
                            <span>${item.name}</span>
                            <span>${item.quantity} × ${item.price.toFixed(2)} ₽</span>
                        </div>
                    `).join('')}
                </div>
                <div class="order-totals">
                    <p>Сумма: ${order.total} ₽</p>
                    <p>Способ оплаты: ${order.customer.payment_method}</p>
                    ${order.customer.delivery_cost > 0 ? 
                        `<p>Доставка: ${order.customer.delivery_cost} ₽</p>` : ''}
                </div>
            `;
        }
        return `
            <p>Комментарий: ${order.customer.comment || '—'}</p>
        `;
    };
    
    const setupOrderListeners = () => {
        document.addEventListener('click', async (e) => {
          if (e.target.classList.contains('status-select')) {
            const orderCard = e.target.closest('.order-card');
            const orderId = orderCard.dataset.id;
            const orderType = orderCard.dataset.orderType;
            const newStatus = e.target.value;
            await updateOrderStatus(orderId, newStatus, orderType);
          }
      
          if (e.target.classList.contains('export-csv')) {
            const orderType = e.target.dataset.orderType;
            exportToCSV(orderType);
          }
        });
      
        document.addEventListener('input', (e) => {
          if (e.target.classList.contains('order-search')) {
            const searchTerm = e.target.value.toLowerCase();
            const orderType = e.target.dataset.orderType;
            filterOrders(searchTerm, orderType);
          }
        });
      };
      
  
    // 6. Добавляем бизнес-логику
    const updateOrderStatus = async (orderId, newStatus, type) => {
        try {
            const endpoint = type === 'full' 
                ? `${CONFIG.ORDERS_DATA_URL}/${orderId}`
                : `${CONFIG.QUICK_ORDERS_DATA_URL}/${orderId}`;
    
            const response = await fetch(endpoint, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
    
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText);
            }
    
            // Обновляем локальное состояние
            const targetOrders = type === 'full' ? state.orders : state.quickOrders;
            const orderIndex = targetOrders.findIndex(o => o.id === orderId);
            if (orderIndex > -1) {
                targetOrders[orderIndex].status = newStatus;
            }
    
            renderOrdersSection(type);
        } catch (error) {
            console.error('Ошибка обновления статуса:', error);
            showError(`Ошибка обновления статуса: ${error.message}`);
        }
    };
    
    const filterOrders = (searchTerm, type) => {
        const filtered = (type === 'full' ? state.orders : state.quickOrders)
            .filter(order => 
                order.customer.phone.toLowerCase().includes(searchTerm)
            );
        
        this.renderFilteredOrders(filtered, type);
    };

    const loadReviews = async () => {
        try {
            const [pendingRes, approvedRes] = await Promise.all([
              fetch(CONFIG.PENDING_REVIEWS_URL),
              fetch(CONFIG.APPROVED_REVIEWS_URL)
            ]);
            
            if (!pendingRes.ok || !approvedRes.ok) throw new Error('Ошибка сервера');
            
            state.pendingReviews = await pendingRes.json();
            state.approvedReviews = await approvedRes.json();
            
          } catch (error) {
            console.error('Ошибка загрузки отзывов:', error);
            alert('Не удалось загрузить отзывы');
            throw error;
          }
    };

    const renderReviews = () => {
        // В функции renderReviews()
    time.innerHTML = new Date(review.created_at.replace(' ', 'T')).toLocaleDateString();
        // Шаблонизатор для карточек
        const createReviewCard = (review, isPending) => `
            <div class="review-card" data-id="${review.id}">
                <div class="review-header">
                    <span class="review-author">${review.author}</span>
                    <div class="review-meta">
                        <span class="review-rating">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</span>
                        <time>${new Date(review.created_at).toLocaleDateString()}</time>
                    </div>
                </div>
                <p class="review-content">${review.content}</p>
                <div class="review-actions">
                    ${isPending ? `<button data-action="approve">✅ Одобрить</button>` : ''}
                    <button data-action="delete">🗑 Удалить</button>
                </div>
            </div>
        `;
        
        // Очистка и заполнение списков
        DOM.pendingList.innerHTML = state.pendingReviews.map(r => 
            createReviewCard(r, true)).join('');
            
        DOM.approvedList.innerHTML = state.approvedReviews.map(r => 
            createReviewCard(r, false)).join('');
        
        // Обновление счетчиков
        DOM.reviewCounters.pending.textContent = state.pendingReviews.length;
        DOM.reviewCounters.approved.textContent = state.approvedReviews.length;
    };

    // Инициализация
    const init = async () => {
        await loadInitialData();
        await loadOrders(); // Добавляем загрузку заказов
        setupOrderListeners(); // Добавляем новые обработчики
        renderAll();
        renderOrdersSection('full');
        renderOrdersSection('quick');
        updateCategorySelects();
    };

    // Загрузка данных
    const loadInitialData = async () => {
        try {
            const [productsRes, categoriesRes] = await Promise.all([
                fetch(CONFIG.PRODUCTS_DATA_URL),
                fetch(CONFIG.CATEGORIES_DATA_URL)
            ]);

            const productsData = await productsRes.json();
            const categoriesData = await categoriesRes.json();

            state.products = transformProducts(productsData.rows);
            state.flatCategories = flattenCategories(categoriesData.categories);
            state.categories = buildCategoryTree(state.flatCategories);

        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
            alert('Не удалось загрузить данные');
        }
    };

    // Преобразование продуктов
    const transformProducts = (rows) => {
        return rows.map(row => ({
            id: row[0],
            name: row[1],
            categoryId: row[2],
            price: row[3],
            rating: row[4],
            image: row[5],
            description: row[6] || '',
            sku: row[7] || '',
            specifications: row[8] || {},
            weights: row[9] || []
        }));
    };

    // Построение дерева категорий
    const buildCategoryTree = (categories, parentId = null) => {
        return categories
            .filter(category => category.parent_id === parentId)
            .map(category => ({
                ...category,
                subcategories: buildCategoryTree(categories, category.id)
            }));
    };

    // Преобразование в плоский список с уровнями
    const flattenCategories = (categories, level = 0, parentId = null) => {
        return categories.reduce((acc, category) => {
            const newCategory = { 
                ...category, 
                level,
                parent_id: parentId
            };
            acc.push(newCategory);
            if (category.subcategories) {
                acc = acc.concat(flattenCategories(
                    category.subcategories, 
                    level + 1, 
                    category.id
                ));
            }
            return acc;
        }, []);
    };

    // Обновление селектов категорий
    const updateCategorySelects = () => {
        const options = state.flatCategories.map(category => 
            `<option value="${category.id}">${'&nbsp;&nbsp;'.repeat(category.level)}${category.name}</option>`
        ).join('');
        
        DOM.categoryParentSelect.innerHTML = 
            `<option value="">Основная категория</option>${options}`;
        
        DOM.productCategorySelect.innerHTML = options;
    };

    // Добавление категории
    const handleCategorySubmit = async (e) => {
        e.preventDefault();
        if (!checkAdminAccess()) {
            alert('Доступ запрещен!');
            window.location.reload();
            return;
          }
        const formData = new FormData(e.target);
        
        // Валидация данных
        const categoryName = formData.get('name');
        if (!categoryName) {
            alert('Введите название категории');
            return;
        }
    
        const parentId = formData.get('parent') 
            ? parseInt(formData.get('parent')) 
            : null;
    
        // Генерация уникального ID
        const newId = Date.now();
    
        const newCategory = {
            id: newId,
            parent_id: parentId,
            name: categoryName,
            level: parentId ? 
                (state.flatCategories.find(c => c.id === parentId)?.level + 1 || 0) 
                : 0,
            subcategories: []
        };
    
        // Обновление состояния
        state.flatCategories.push(newCategory);
        state.categories = buildCategoryTree(state.flatCategories);
        
        // Сохранение
        try {
            await saveData('categories.json', {
                type: "hierarchical",
                categories: state.categories
            });
            renderCategories();
            updateCategorySelects();
            e.target.reset();
        } catch (error) {
            console.error('Ошибка сохранения:', error);
            alert('Ошибка сохранения категории');
        }
    };


    // Рендер категорий
    const renderCategories = () => {
        const renderCategory = (category, level = 0) => `
            <div class="category-item" data-id="${category.id}">
                <div class="category-header" style="padding-left: ${level * 30}px">
                    <span class="category-name">${category.name}</span>
                    <button class="delete-button">Удалить</button>
                </div>
                ${category.subcategories?.map(sub => 
                    renderCategory(sub, level + 1)
                ).join('') || ''}
            </div>
        `;

        DOM.categoryList.innerHTML = state.categories.map(category => 
            renderCategory(category)
        ).join('');
    };

    const handleDelete = async (e) => {

        if (!checkAdminAccess()) {
            alert('Доступ запрещен!');
            window.location.reload();
            return;
          }

        if (!e.target.classList.contains('delete-button')) return;
    
        // Удаление категории
        const categoryItem = e.target.closest('.category-item');

          

        if (categoryItem) {
            const categoryId = parseInt(categoryItem.dataset.id);
            if (!confirm('Удалить категорию и все подкатегории?')) return;
    
            const idsToRemove = getCategoryChildrenIds(categoryId);
            state.flatCategories = state.flatCategories.filter(c => 
                !idsToRemove.includes(c.id)
            );
            state.categories = buildCategoryTree(state.flatCategories);
            state.products = state.products.filter(p => 
                !idsToRemove.includes(p.categoryId)
            );
            
            // Сохраняем изменения
            await Promise.all([
                saveData('categories.json', { 
                    type: "hierarchical", 
                    categories: state.categories 
                }),
                saveData('products.json', {
                    type: "query results",
                    columns: [],
                    rows: state.products.map(p => [
                        p.id,
                        p.name,
                        p.categoryId,
                        p.price,
                        p.rating || 0,
                        p.image.split('/').pop()
                    ])
                })
            ]);
            
            renderAll();
            updateCategorySelects();
            return; // Важно: прерываем выполнение после удаления категории
        }
    
        // Удаление товара
        const productRow = e.target.closest('.product-item');
        if (productRow) {
            const productId = parseInt(productRow.dataset.id);
            if (!confirm('Удалить товар?')) return;
            
            state.products = state.products.filter(p => p.id !== productId);
            
            // Сохраняем изменения
            await saveData('products.json', {
                type: "query results",
                columns: [],
                rows: state.products.map(p => [
                    p.id,
                    p.name,
                    p.categoryId,
                    p.price,
                    p.rating || 0,
                    p.image.split('/').pop()
                ])
            });
            
            renderProducts();
        }
    };

    // Получение ID всех потомков
    const getCategoryChildrenIds = (parentId) => {
        const children = state.flatCategories.filter(c => c.parent_id === parentId);
        return children.reduce((acc, child) => {
            acc.push(child.id);
            acc.push(...getCategoryChildrenIds(child.id));
            return acc;
        }, [parentId]);
    };


    const saveData = async (filename, data) => {
        try {
          const response = await fetch(CONFIG.SAVE_DATA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename, data })
          });
          return await response.json();
        } catch (error) {
          console.error('Save error:', error);
          alert('Ошибка сохранения данных');
        }
      };
    
      const showError = (message) => {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 3000);
      };

        // Добавление товара
        const handleProductSubmit = async (e) => {
            e.preventDefault();
            if (!checkAdminAccess()) {
              alert('Доступ запрещен!');
              return;
            }
          
            const categorySelect = document.getElementById('product-category');
            const categoryValue = categorySelect.value;
            
            if (!categoryValue || isNaN(categoryValue)) {
                alert('Выберите корректную категорию!');
                return;
            }
            const categoryId = parseInt(categoryValue);
        
            // Остальной код обработки...
            const formData = new FormData(e.target);



    // Загрузка изображения
    let imagePath = '';
    try {
        const uploadResult = await uploadImage(formData.get('image'));
        if (!uploadResult?.success) throw new Error();
        imagePath = uploadResult.path;
    } catch (error) {
        alert('Ошибка загрузки изображения');
        return;
    }

    // Обработка характеристик
    let specs = {};
    try {
        specs = JSON.parse(formData.get('specifications'));
    } catch (error) {
        alert('Ошибка в формате характеристик! Используйте JSON');
        return;
    }
    
    // Обработка весов
    const weights = formData.get('weights')
        .split(',')
        .map(w => parseFloat(w.trim()))
        .filter(w => !isNaN(w));



    // Создание объекта товара
    const newProduct = {
        id: Date.now(),
        name: formData.get('name'),
        categoryId: parseInt(formData.get('category')),
        price: parseFloat(formData.get('price')),
        image: imagePath,
        description: formData.get('description'),
        sku: formData.get('sku'),
        specifications: specs,
        weights: weights,
        rating: 0
    };

    // Обновление состояния
    state.products.push(newProduct);

    // Сохранение
    try {
        await saveData('products.json', {
            type: "query results",
            columns: [],
            rows: state.products.map(p => [
                p.id,
                p.name,
                p.categoryId,
                p.price,
                p.rating,
                p.image.split('/').pop(),
                p.description,
                p.sku,
                p.specifications,
                p.weights
            ])
        });
        renderProducts();
        e.target.reset();
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        alert('Ошибка сохранения товара');
    }
};




    // Поиск товаров
    const handleSearch = (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = state.products.filter(product => 
            product.name.toLowerCase().includes(term)
        );
        renderProducts(filtered);
    };

    // Рендер товаров
    const renderProducts = (products = state.products) => {
    // В функции renderProducts()
// … внутри renderProducts …
DOM.productTableBody.innerHTML = products.map(product => {
    const category = state.flatCategories.find(c => c.id === product.categoryId);
    const specsKeys = Object.keys(product.specifications);
    const specsValues = Object.values(product.specifications);

    // Построим <table> для specs
    const specsTable = specsKeys.length
      ? `
      <table class="nested-specs-table">
        <thead>
          <tr>
            ${specsKeys.map(key => `<th>${key}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          <tr>
            ${specsValues.map(val => `<td>${val}</td>`).join('')}
          </tr>
        </tbody>
      </table>`
      : '<span>—</span>';

    return `
      <tr class="product-item" data-id="${product.id}">
        <td>${product.id}</td>
        <td>
          <img src="/images/${product.image}"
               class="product-thumb"
               alt="${product.name}"
               onerror="this.src='/images/placeholder.png'">
        </td>
        <td>${product.name}</td>
        <td>${product.sku}</td>
        <td>${category?.name || 'Без категории'}</td>
        <td>${product.price.toFixed(2)} ₽</td>
        <td>${specsTable}</td>
        <td><button class="delete-button">Удалить</button></td>
      </tr>
    `;
}).join('');

};

    // ДОБАВИТЬ ПЕРЕД ФУНКЦИЕЙ setupEventListeners
const handleReviewAction = async (action, reviewId) => {
    try {
      // 1. Находим отзыв в обоих массивах
      const allReviews = [...state.pendingReviews, ...state.approvedReviews];
      const review = allReviews.find(r => r.id === reviewId);
      
      if (!review) {
        throw new Error('Отзыв не найден');
      }
  
      // 2. Выполняем действие
      switch(action) {
        case 'approve':
            delete review.status; // Добавить удаление статуса
          // Перенос из pending в approved
          state.pendingReviews = state.pendingReviews.filter(r => r.id !== reviewId);
          state.approvedReviews.push(review);
          break;
  
        case 'delete':
          // Удаление из текущего списка
          if (state.pendingReviews.some(r => r.id === reviewId)) {
            state.pendingReviews = state.pendingReviews.filter(r => r.id !== reviewId);
          } else {
            state.approvedReviews = state.approvedReviews.filter(r => r.id !== reviewId);
          }
          break;
  
        default:
          throw new Error('Неизвестное действие');
      }
  
      // 3. Сохраняем изменения
      const response = await fetch(CONFIG.SAVE_REVIEWS_URL, {
        method: 'POST', // Изменено с POST на PUT
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pending: state.pendingReviews,
          approved: state.approvedReviews
        })
      });
  
      if (!response.ok) throw new Error('Ошибка сохранения');
  
      // 4. Обновляем интерфейс
      renderReviews();
      
    } catch (error) {
      console.error('Ошибка действия:', error);
      alert(error.message);
      // Восстанавливаем актуальные данные
      await loadReviews();
    }
  };

  const setupReviewEventListeners = () => {
    DOM.reviewsSection.addEventListener('click', async (e) => {
      const button = e.target.closest('[data-action]');
      if (!button) return;
      
      const card = button.closest('.review-card');
      const reviewId = parseInt(card.dataset.id);
      const action = button.dataset.action;
  
      await handleReviewAction(action, reviewId);
    });
  };

    // Настройка обработчиков
    const setupEventListeners = () => {
        DOM.tabs.forEach(tab => tab.addEventListener('click', handleTabSwitch));
        DOM.categoryForm.addEventListener('submit', handleCategorySubmit);
        DOM.productForm.addEventListener('submit', handleProductSubmit);
        DOM.searchInput.addEventListener('input', handleSearch);
        document.addEventListener('click', handleDelete);
        const reviewForm = document.getElementById('reviewForm');
        if (reviewForm) {
            reviewForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = new FormData(e.target);
                const reviewData = {
                    author: formData.get('name'),
                    email: formData.get('email'),
                    phone: formData.get('phone'),
                    rating: parseInt(formData.get('rating')),
                    content: formData.get('content')
                };

                if (await saveReview(reviewData)) {
                    alert('Отзыв успешно отправлен на модерацию!');
                    e.target.reset();
                } else {
                    alert('Ошибка при отправке отзыва');
                }
            });
        }
        setupReviewEventListeners(); // Обработчики для админ-панели отзывов
    };

    // Переключение вкладок
    // ЗАМЕНИТЬ существующую функцию на эту:
const handleTabSwitch = (e) => {
    const tab = e.target;
    if (!tab || !tab.dataset.tab) return;
  
    // Снять активное состояние со всех вкладок
    DOM.tabs.forEach(t => t.classList.remove('active'));
    
    // Скрыть все секции
    document.querySelectorAll('.admin-section').forEach(section => {
      section.classList.remove('active');
    });
  
    // Активировать выбранную вкладку
    tab.classList.add('active');
    state.currentTab = tab.dataset.tab;
  
    // Показать соответствующую секцию
    const activeSection = document.getElementById(`${state.currentTab}-section`);
    if (activeSection) {
      activeSection.classList.add('active');
  
      // Если это вкладка отзывов - обновить данные
      if (state.currentTab === 'reviews') {
        loadReviews()
          .then(renderReviews)
          .catch(error => {
            console.error('Ошибка загрузки отзывов:', error);
            alert('Не удалось загрузить отзывы');
          });
      }
    }
  };


    

    // Общий рендер
    const renderAll = () => {
        renderCategories();
        renderProducts();
    };

    init();
});