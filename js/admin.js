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
        // Сохраняем предыдущие данные для восстановления при ошибках
        const previousState = {
            orders: [...state.orders],
            quickOrders: [...state.quickOrders]
        };
    
        try {
            // Инициализируем таймер для отмены долгих запросов
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
    
            // Выполняем параллельные запросы с обработкой прерывания
            const [ordersRes, quickOrdersRes] = await Promise.all([
                fetch(CONFIG.ORDERS_DATA_URL, { 
                    signal: controller.signal 
                }),
                fetch(CONFIG.QUICK_ORDERS_DATA_URL, { 
                    signal: controller.signal 
                })
            ]);
    
            clearTimeout(timeoutId);
    
            // Обрабатываем каждый ответ отдельно
            const processResponse = async (response, type) => {
                if (!response.ok) {
                    const data = await response.json();
                    console.log('Received error data:', data);
                    throw new Error(`HTTP ${response.status} для ${type}`);
                }
            
                const contentType = response.headers.get('content-type') || '';
                const isJSON = /^(application\/json|text\/json)/.test(contentType);
                
                if (!isJSON) {
                    throw new TypeError(`Неверный Content-Type (${contentType}) для ${type}`);
                }
            
                const data = await response.json();
                console.log('Received data for', type, ':', data);

                // === Нормализация для обоих типов ===
    data.forEach((order, index) => {
        if (!order.id) order.id = `${type}-${Date.now()}-${index}`;
        if (!order.status) order.status = 'new';
        if (typeof order.total === 'string') {
            order.total = parseFloat(order.total.replace(',', '.'));
        }
    
          // 3) для быстрых: вычисляем total из items, если его нет
          if (type === 'быстрых заказов') {
            // Нормализация структуры клиента
            order.customer = order.customer || {};
            order.customer.name = order.customer.name || 'Не указано';
            order.customer.phone = order.customer.phone || 'Без телефона';
            
            // Вычисление total если отсутствует
            if (!order.total) {
                order.total = order.items.reduce((sum, item) => {
                    return sum + (Number(item.price) || 0) * (item.quantity || 1);
                }, 0);
            }
        } else { // Для обычных заказов
            // Нормализация имени
            if (order.customer?.name && !order.customer.first_name) {
                const [first, ...rest] = order.customer.name.split(' ');
                order.customer.first_name = first;
                order.customer.last_name = rest.join(' ') || '';
            }
        }
    });
            
                // Разные критерии валидации для разных типов заказов
                const isValid = data.every(item => {
                    // Общие обязательные поля для всех заказов
                    const baseCheck = item.id && item.customer && item.total !== undefined;
                    if (type === 'обычных заказов') {
                    return baseCheck &&
                            item.customer.first_name &&
                            item.customer.last_name &&
                            typeof item.total === 'number';
                    }
                    if (type === 'быстрых заказов') {
                    return baseCheck &&
                            item.customer.name &&
                            item.customer.phone &&
                            (typeof item.total === 'number' || !isNaN(item.total));
                    }
                    
                    return false;
                });
            
            
                if (!isValid) {
                    throw new Error(`Неверный формат данных для ${type}`);
                }
            
                return data;
            };
    
            // Параллельная обработка ответов
            const [orders, quickOrders] = await Promise.all([
                processResponse(ordersRes, 'обычных заказов'),
                processResponse(quickOrdersRes, 'быстрых заказов')
            ]);
    
            // Атомарное обновление состояния
            state.orders = orders;
            state.quickOrders = quickOrders;
    
        } catch (error) {
            console.error('Ошибка загрузки заказов:', error);
            
            // Восстанавливаем предыдущее состояние
            state.orders = previousState.orders;
            state.quickOrders = previousState.quickOrders;
    
            // Детализированные сообщения об ошибках
            const errorMessage = error.name === 'AbortError' 
                ? 'Превышено время ожидания загрузки'
                : `Не удалось загрузить заказы: ${error.message}`;
    
            showError(errorMessage);
    
            // Перевыбрасываем ошибку для внешней обработки
            throw error;
        } finally {
            if (document.getElementById('full-orders-section')) {
                renderOrdersSection('full');
            }
            if (document.getElementById('quick-orders-section')) {
                renderOrdersSection('quick-orders');
            }
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
        const sectionId = `${type}-section`;
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
        <div class="order-details">
            <div class="order-items">
                ${order.items.map(item => `
                    <div class="order-item">
                        <span>${item.name}</span>
                        <span>${item.quantity} × ${item.price.toFixed(2)} ₽</span>
                    </div>
                `).join('')}
            </div>
            <div class="order-meta">
                <p>Адрес: ${order.customer.street} ${order.customer.house}</p>
                ${order.customer.comment ? 
                    `<p>Комментарий: ${order.customer.comment}</p>` : ''}
                <p>Итого: ${order.total.toFixed(2)} ₽</p>
            </div>
        </div>
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
        setupEventListeners();
        renderAll();
        renderOrdersSection('full');
        renderOrdersSection('quick-orders');
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
            alert('Доступ запрещен! Недостаточно прав для выполнения операции');
            window.location.href = '/index.html';
            return;
        }
    
        const form = e.target;
        const formData = new FormData(form);
        const categoryName = formData.get('name').trim();
        const parentRaw = formData.get('parent');
        const parentCategoryId = parentRaw ? parseInt(parentRaw, 10) : null;
    
        if (!categoryName) {
            alert('Пожалуйста, введите название категории');
            form.name.focus();
            return;
        }
    
        try {
            // Загрузка текущих категорий
            const resp = await fetch(CONFIG.CATEGORIES_DATA_URL);
            if (!resp.ok) throw new Error('Ошибка загрузки категорий');
            const data = await resp.json();
    
            // Преобразование в плоский список
            const currentFlatCategories = flattenCategories(data.categories || []);
    
            // Проверка на дубликат
            const isDuplicate = currentFlatCategories.some(c =>
                c.name.toLowerCase() === categoryName.toLowerCase() &&
                c.parent_id === parentCategoryId
            );
            if (isDuplicate) throw new Error('Категория уже существует в этом разделе');
    
            // Определение уровня
            let level = 0;
            if (parentCategoryId !== null) {
                const parent = currentFlatCategories.find(c => c.id === parentCategoryId);
                if (!parent) throw new Error('Родительская категория не найдена');
                level = parent.level + 1;
            }
    
            // Создание новой категории
            const newCategory = {
                id: Date.now(),
                name: categoryName,
                parent_id: parentCategoryId,
                level,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
    
            // Обновление плоского списка
            const updatedFlat = [...currentFlatCategories, newCategory];
    
            // Построение иерархии
            const nestedCategories = buildCategoryTree(updatedFlat);
    
            // Сохранение
            await saveData('categories.json', {
                type: "hierarchical",
                categories: nestedCategories
            });
    
            // Обновление состояния
            state.flatCategories = updatedFlat;
            state.categories = nestedCategories;
            updateCategorySelects();
            renderCategories();
            form.reset();
            showSuccessMessage('Категория успешно добавлена!');
    
        } catch (error) {
            console.error('Ошибка:', error);
            showError(error.message);
            try {
                await loadInitialData();
                renderCategories();
            } catch (reloadError) {
                console.error('Ошибка восстановления:', reloadError);
                showError('Критическая ошибка! Перезагрузите страницу');
            }
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
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Save error:', error);
            showError('Ошибка сохранения данных');
            throw error;
        }
    };
      const showError = (message) => {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 3000);
      };

        const showSuccessMessage = (message) => {
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.textContent = message;
        document.body.appendChild(successDiv);
        setTimeout(() => successDiv.remove(), 3000);
        };

        // Добавление товара
        const handleProductSubmit = async (e) => {
            e.preventDefault();
            // Проверка прав администратора
            if (!checkAdminAccess()) {
                alert('Доступ запрещен! Недостаточно прав для выполнения операции');
                window.location.href = '/index.html';
                return;
            }
            const form = e.target;
            const formData = new FormData(form);
            try {
                // Валидация основных полей
                const requiredFields = {
                    name: formData.get('name').trim(),
                    price: formData.get('price'),
                    category: formData.get('category'),
                    image: formData.get('image')
                };
                // Проверка заполнения обязательных полей
                if (!requiredFields.name) {
                    alert('Введите название товара');
                    form.name.focus();
                    return;
                }
                if (!requiredFields.price || isNaN(requiredFields.price)) {
                    alert('Укажите корректную цену');
                    form.price.focus();
                    return;
                }
                if (!requiredFields.category || isNaN(requiredFields.category)) {
                    alert('Выберите категорию');
                    form.category.focus();
                    return;
                }
                if (!requiredFields.image || requiredFields.image.size === 0) {
                    alert('Загрузите изображение товара');
                    form.image.focus();
                    return;
                }
                // Проверка существования категории
                const categoryExists = state.flatCategories.some(
                    c => c.id === parseInt(requiredFields.category)
                );
                if (!categoryExists) {
                    alert('Выбранная категория не существует');
                    return;
                }
                // Загрузка изображения
                const uploadResult = await uploadImage(requiredFields.image);
                if (!uploadResult?.success || !uploadResult.path) {
                    throw new Error('Ошибка загрузки изображения');
                }
                // Обработка характеристик
                let specifications = {};
                const specsInput = formData.get('specifications').trim();
                if (specsInput) {
                    try {
                        specifications = JSON.parse(specsInput);
                    } catch (error) {
                        alert('Ошибка в формате характеристик! Используйте JSON');
                        form.specifications.focus();
                        return;
                    }
                }
                // Обработка весов
                const weights = formData.get('weights')
                    .split(',')
                    .map(w => parseFloat(w.trim()))
                    .filter(w => !isNaN(w) && w > 0);
                    // В handleProductSubmit
                const price = Number(formData.get('price'));
                if (Number.isNaN(price) || price <= 0) {
                    showError('Некорректная цена');
                    return;
                }
                // Создание объекта товара
                const newProduct = {
                    id: Date.now(),
                    name: requiredFields.name,
                    categoryId: parseInt(requiredFields.category),
                    price: parseFloat(requiredFields.price),
                    image: uploadResult.path,
                    description: formData.get('description').trim(),
                    sku: formData.get('sku').trim(),
                    specifications,
                    weights: weights.length > 0 ? weights : [1], // Значение по умолчанию
                    rating: 0,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
                // Проверка на дубликаты
                const isDuplicate = state.products.some(p => 
                    p.sku && p.sku === newProduct.sku || 
                    p.name.toLowerCase() === newProduct.name.toLowerCase()
                );
                if (isDuplicate) {
                    alert('Товар с таким названием или артикулом уже существует');
                    return;
                }
                // Обновление состояния
                const updatedProducts = [...state.products, newProduct];
                // Сохранение данных
                const saveResult = await saveData('products.json', {
                    type: "query results",
                    columns: [],
                    rows: updatedProducts.map(p => [
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
                if (!saveResult || !saveResult.success) {
                    throw new Error(saveResult?.error || 'Ошибка сохранения товара');
                }
                // Обновление глобального состояния
                state.products = updatedProducts;
                // Обновление интерфейса
                renderProducts();
                // Сброс формы и уведомление
                form.reset();
                showSuccessMessage('Товар успешно добавлен!');
            } catch (error) {
                console.error('Ошибка при добавлении товара:', error);
                showError(`Ошибка: ${error.message}`);
                // Восстановление предыдущих данных
                try {
                    await loadInitialData();
                    renderProducts();
                } catch (reloadError) {
                    console.error('Ошибка восстановления данных:', reloadError);
                    showError('Критическая ошибка! Перезагрузите страницу');
                }
            }
        };
///////////////////////////////////////////////
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
    const sanitize = (str) => str.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    DOM.productTableBody.innerHTML = products.map(product => {
        const safeName = sanitize(product.name);
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
        if (!checkAdminAccess()) {
            showError('Доступ запрещен!');
            return;
        }
        // Создаем копии для безопасного изменения
        let pending = [...state.pendingReviews];
        let approved = [...state.approvedReviews];
        let originalPending = [...state.pendingReviews];
        let originalApproved = [...state.approvedReviews];
        try {
            // Находим отзыв без мутации исходных данных
            const reviewIndex = pending.findIndex(r => r.id === reviewId);
            const isPending = reviewIndex > -1;
            const review = isPending 
                ? pending[reviewIndex] 
                : approved.find(r => r.id === reviewId);
            if (!review) {
                throw new Error('Отзыв не найден');
            }
            // Подтверждение для деструктивных действий
            if (action === 'delete' && !confirm('Удалить отзыв безвозвратно?')) {
                return;
            }
            // Обработка действий
            switch(action) {
                case 'approve':
                    if (!isPending) {
                        throw new Error('Отзыв уже одобрен');
                    }
                    // Создаем новый объект вместо мутации
                    const approvedReview = {
                        ...review,
                        approved_at: new Date().toISOString()
                    };
                    pending = pending.filter(r => r.id !== reviewId);
                    approved = [...approved, approvedReview];
                    break;
                case 'delete':
                    if (isPending) {
                        pending = pending.filter(r => r.id !== reviewId);
                    } else {
                        approved = approved.filter(r => r.id !== reviewId);
                    }
                    break;
                default:
                    throw new Error(`Неизвестное действие: ${action}`);
            }
            // Атомарное обновление состояния
            state.pendingReviews = pending;
            state.approvedReviews = approved;
            // Пакетное сохранение через отдельные запросы
            const saveRequests = [
                saveData('pending-reviews.json', pending),
                saveData('approved-reviews.json', approved)
            ];
            const results = await Promise.all(saveRequests);
            // Проверка результатов сохранения
            if (results.some(res => !res?.success)) {
                throw new Error('Ошибка синхронизации данных');
            }
            // Обновление UI только после успешного сохранения
            renderReviews();
        } catch (error) {
            console.error('Ошибка действия:', error);
            // Восстановление исходного состояния при ошибках
            state.pendingReviews = originalPending;
            state.approvedReviews = originalApproved;
            renderReviews();
            showError(`${error.message} (изменения отменены)`);
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
      switch(state.currentTab) {
        case 'full':
        case 'quick-orders':
            loadOrders()
                .then(() => renderOrdersSection(state.currentTab))
                .catch(console.error);
            break;
        case 'reviews':
            loadReviews().catch(console.error);
            break;
    }
    }
  };
    // Общий рендер
    const renderAll = async () => {
        renderCategories();
        renderProducts();
        await loadReviews();      // загружаем массив pending и approved
        renderReviews();          // рендерим оба раздела
    
        // --- заказы ---
        renderOrdersSection('full');   // отображаем "полные" заказы
        renderOrdersSection('quick');  // отображаем "быстрые" заказы
    };

    init();
});