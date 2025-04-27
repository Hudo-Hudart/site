console.log('Текущий пользователь:', JSON.parse(localStorage.getItem('currentUser')));
console.log('Токен:', localStorage.getItem('token'));

const logApiResponse = async (url, options) => {
    try {
      const start = Date.now();
      const res = await fetch(url, options);
      const time = Date.now() - start;
      console.log(`API ${url} → ${res.status} (${time}ms)`);
      return res;
    } catch (error) {
      console.error(`API ${url} → ERROR:`, error);
      throw error;
    }
  };
  

const checkUnauthorized = (response) => {
    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('currentUser');
      window.location.href = '/login.html';
      return true;
    }
    return false;
  };
  
  // Используйте в каждом fetch:
  //fetch(url, options)a
    //.then(response => {
      //if (checkUnauthorized(response)) return;
      // остальная обработка
    //});


document.addEventListener('DOMContentLoaded', () => {
    // Обновленные эндпоинты API согласно server.js
    const CONFIG = {
        ORDERS_DATA_URL:       '/api/orders',
        QUICK_ORDERS_DATA_URL: '/api/quick-orders',
        PRODUCTS_DATA_URL:     '/api/products',
        CATEGORIES_DATA_URL:   '/api/categories',
        UPLOAD_IMAGE_URL:      '/api/products',       // POST /api/products обрабатывает загрузку изображения через multer
        PENDING_REVIEWS_URL:   '/api/reviews/pending',
        APPROVED_REVIEWS_URL:  '/api/reviews/approved',
        SAVE_REVIEWS_URL:      '/api/reviews'         // POST /api/reviews создаёт новый отзыв
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

    // Переписанная функция сохранения отзыва
    const saveReview = async (reviewData) => {
        try {
            const response = await logApiResponse(CONFIG.SAVE_REVIEWS_URL, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    author_name: reviewData.author || 'Аноним',
                    email: reviewData.email,
                    phone: reviewData.phone,
                    rating: parseInt(reviewData.rating),
                    comment: reviewData.content,
                    product_id: reviewData.productId
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message);
            }

            return true;
        } catch (error) {
            console.error('Ошибка сохранения отзыва:', error);
            showError(`Ошибка: ${error.message}`);
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
        if (!user || user.role !== 'admin') {
          window.location.href = '/login.html';
          return false;
        }
        return true;
      };

    // Обновленная загрузка изображений
    const uploadImage = async (file) => {
        const formData = new FormData();
        formData.append('image', file);

        try {
            const response = await logApiResponse(CONFIG.UPLOAD_IMAGE_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: formData
            });
            
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            
            return { path: data.imageUrl };
            
        } catch (error) {
            console.error('Upload error:', error);
            showError('Ошибка загрузки изображения');
            throw error;
        }
    };

    const loadOrders = async () => {
        const previousState = {
            orders: [...state.orders],
            quickOrders: [...state.quickOrders]
        };
    
        async function loadReviews() {
            try {
              const headers = {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
              };
              const [pendingRes, approvedRes] = await Promise.all([
                fetch(CONFIG.PENDING_REVIEWS_URL,  { headers }),
                fetch(CONFIG.APPROVED_REVIEWS_URL, { headers })
              ]);
              if (!pendingRes.ok || !approvedRes.ok) {
                throw new Error('Ошибка загрузки отзывов');
              }
              state.pendingReviews  = await pendingRes.json();
              state.approvedReviews = await approvedRes.json();
            } catch (err) {
              console.error('loadReviews error:', err);
              state.pendingReviews  = [];
              state.approvedReviews = [];
              showError(err.message);
            }
          }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
    
            // Добавляем авторизацию и правильные заголовки
            const [ordersRes, quickOrdersRes] = await Promise.all([
                fetch(CONFIG.ORDERS_DATA_URL, { 
                    signal: controller.signal,
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                }),
                fetch(CONFIG.QUICK_ORDERS_DATA_URL, { 
                    signal: controller.signal,
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                })
            ]);
    
            clearTimeout(timeoutId);
    
            const processResponse = async (response, type) => {
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || `HTTP ${response.status} для ${type}`);
                }
            
                const data = await response.json();
                
                return data.map(order => {
                    // Общие поля для всех заказов
                    const base = {
                        id: order.id,
                        status: order.status,
                        total: parseFloat(order.total_amount || 0),
                        created_at: order.created_at
                    };
            
                    // Обработка обычных заказов
                    if (type === 'обычных заказов') {
                        return {
                            ...base,
                            customer: {
                                first_name: order.customer_fullname?.split(' ')[0] || 'Не указано',
                                last_name: order.customer_fullname?.split(' ').slice(1).join(' ') || '',
                                phone: order.customer_phone || '',
                                email: order.customer_email || '',
                                payment_method: order.payment_method || 'Не выбран',
                                delivery_cost: parseFloat(order.delivery_cost || 0)
                            },
                            items: (order.items || []).map(item => ({
                                id: item.product_variant_id,
                                name: item.title || `Товар #${item.product_variant_id}`,
                                price: parseFloat(item.price || 0),
                                quantity: item.quantity || 1,
                                weight: parseFloat(item.weight || 0)
                            }))
                        };
                    }
            
                    // Обработка быстрых заказов
                    return {
                        ...base,
                        customer: {
                            name: order.customer_name || 'Не указано',
                            phone: order.customer_phone || '',
                            street: order.street || '',
                            house: order.house_number || '',
                            comment: order.comment || ''
                        },
                        items: (order.items || []).map(item => ({
                            id: item.product_variant_id,
                            name: item.title || `Товар #${item.product_variant_id}`,
                            price: parseFloat(item.price || 0),
                            quantity: item.quantity || 1,
                            weight: parseFloat(item.weight || 0)
                        }))
                    };
                });
            };
    
            const [orders, quickOrders] = await Promise.all([
                processResponse(ordersRes, 'обычных заказов'),
                processResponse(quickOrdersRes, 'быстрых заказов')
            ]);
    
            // Валидация полученных данных
            const validateOrder = (order, type) => {
                const required = {
                    'обычных заказов': ['first_name', 'last_name', 'email'],
                    'быстрых заказов': ['name', 'phone', 'street']
                };
    
                return required[type].every(field => 
                    order.customer[field] && 
                    typeof order.customer[field] === 'string' &&
                    order.customer[field].trim().length > 0
                );
            };
    
            if (!orders.every(o => validateOrder(o, 'обычных заказов'))) {
                throw new Error('Неверный формат обычных заказов');
            }
            
            // И для быстрых заказов тоже поправим
            if (!quickOrders.every(o => validateOrder(o, 'быстрых заказов'))) {
                throw new Error('Неверный формат быстрых заказов');
            }
    
            state.orders = orders;
            state.quickOrders = quickOrders;
    
        } catch (error) {
            console.error('Ошибка загрузки заказов:', error);
            state.orders = previousState.orders;
            state.quickOrders = previousState.quickOrders;
            showError(error.message);
            throw error;
        } finally {
            renderOrdersSection('full');
            renderOrdersSection('quick-orders');
        }
    };

    // В начало блока с рендером заказов, прямо перед renderOrdersSection:
    const renderStatusControls = (order, type) => {
        // Соответствие статусов из таблиц БД
        const statusOptions = type === 'full' 
            ? ['new', 'processing', 'shipped', 'delivered', 'cancelled']
            : ['new', 'processing', 'completed', 'cancelled'];
    
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
                    <span class="order-id">#${order.id}</span>
                    <time class="order-date">
                        ${new Date(order.created_at).toLocaleDateString()}
                    </time>
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
    
    const handleStatusChange = async (e) => {
        const orderCard = e.target.closest('.order-card');
        const orderId = parseInt(orderCard.dataset.id);
        const orderType = orderCard.dataset.orderType;
        const newStatus = e.target.value;
        
        await updateOrderStatus(orderId, newStatus, orderType);
    };
    
    const getStatusText = (status) => {
        const statusMap = {
            new: 'Новый',
            processing: 'В обработке',
            shipped: 'Отправлен',
            delivered: 'Доставлен',
            completed: 'Завершен',
            cancelled: 'Отменен'
        };
        return statusMap[status] || status;
    };
    
    const formatCustomerInfo = (order, type) => {
        
        if (type === 'full') {
            return `
                ${order.customer.first_name} ${order.customer.last_name}<br>
                📞 ${order.customer.phone}<br>
                📧 ${order.customer.email}
            `;
        }
        return `
            👤 ${order.customer.name}<br>
            📞 ${order.customer.phone}<br>
            📍 ${order.customer.street} ${order.customer.house}
        `;
    };

    const calculateTotalWeight = items => 
        items.reduce((sum, item) => sum + (item.weight || 0), 0).toFixed(2);
    
    const renderOrderDetails = (order, type) => {
        const total = parseFloat(order.total).toFixed(2);
        const itemsHTML = order.items.map(item => `
            <div class="order-item">
                <span>${item.name}</span>
                <span>${item.quantity} × ${parseFloat(item.price).toFixed(2)} ₽</span>
                ${item.weight ? `<span class="weight">${item.weight} кг</span>` : ''}
            </div>
        `).join('');
    
        if (type === 'full') {
            return `
                <div class="order-details">
                    <div class="order-items">${itemsHTML}</div>
                    <div class="order-totals">
                        <p>Сумма: ${total} ₽</p>
                        <p>Способ оплаты: ${order.customer.payment_method}</p>
                        ${order.customer.delivery_cost > 0 ? 
                            `<p>Доставка: ${parseFloat(order.customer.delivery_cost).toFixed(2)} ₽</p>` : ''}
                        ${order.has_discount ? '<p class="discount">Скидка применена</p>' : ''}
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="order-details">
                <div class="order-items">${itemsHTML}</div>
                <div class="order-meta">
                ${order.customer.comment ? 
                    `<p class="comment">💬 ${order.customer.comment}</p>` : ''}
                <p class="total">Итого: ${total} ₽</p>
                ${order.items.some(i => i.weight) ? 
                    `<p class="weight-info">Общий вес: ${calculateTotalWeight(order.items)} кг</p>` : ''}
                </div>
            </div>
    `;
};
    
    const updateOrderStatus = async (orderId, newStatus, type) => {
        let targetOrders, orderIndex, select;
        try {
            const endpoint = type === 'full' 
                ? `${CONFIG.ORDERS_DATA_URL}/${orderId}`
                : `${CONFIG.QUICK_ORDERS_DATA_URL}/${orderId}`;
    
            const response = await logApiResponse(endpoint, {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ status: newStatus })
            });
    
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Ошибка сервера');
            }

            // В updateOrderStatus добавить:
            if (response.status === 401) {
                localStorage.removeItem('token');
                window.location.href = '/login.html';
                return;
            }
    
            // Обновляем локальное состояние
            targetOrders = type === 'full' ? state.orders : state.quickOrders;
        orderIndex = targetOrders.findIndex(o => o.id === orderId);
        
        if (orderIndex > -1) {
            targetOrders[orderIndex].status = newStatus;
            renderOrdersSection(type);
        }
    } catch (error) {
        console.error('Ошибка обновления статуса:', error);
        showError(`Ошибка: ${error.message}`);
        
        // Проверка существования переменных
        if (targetOrders && orderIndex !== undefined && orderIndex > -1) {
            const prevStatus = targetOrders[orderIndex].status;
            select = document.querySelector(`[data-id="${orderId}"] .status-select`);
            if (select) select.value = prevStatus;
        }
    }
};



        const renderReviews = () => {
            const createReviewCard = (review, isPending) => `
                <div class="review-card" data-id="${review.id}">
                    <div class="review-header">
                        <span class="review-author">${review.author_name}</span>
                        <div class="review-meta">
                            <span class="review-rating">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</span>
                            <time>${new Date(review.created_at).toLocaleDateString()}</time>
                        </div>
                    </div>
                    <p class="review-content">${review.comment}</p>
                    <div class="review-actions">
                        ${isPending ? `<button data-action="approve">✅ Одобрить</button>` : ''}
                        <button data-action="delete">🗑 Удалить</button>
                    </div>
                </div>
            `;
        
            DOM.pendingList.innerHTML = state.pendingReviews.map(r => 
                createReviewCard(r, true)).join('');
                
            DOM.approvedList.innerHTML = state.approvedReviews.map(r => 
                createReviewCard(r, false)).join('');
            
            DOM.reviewCounters.pending.textContent = state.pendingReviews.length;
            DOM.reviewCounters.approved.textContent = state.approvedReviews.length;
        }

    // Инициализация

    // Загрузка данных
    const loadInitialData = async () => {
        try {
            const headers = {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            };
    
            // Загрузка продуктов
            const productsRes = await logApiResponse(CONFIG.PRODUCTS_DATA_URL, { headers });
            if (checkUnauthorized(productsRes)) return;
            if (!productsRes.ok) throw new Error(`Ошибка загрузки товаров: ${productsRes.status}`);
            const productsData = (await productsRes.json()).data || [];
    
            // Загрузка категорий
            const categoriesRes = await logApiResponse(CONFIG.CATEGORIES_DATA_URL, { headers });
            if (checkUnauthorized(categoriesRes)) return;
            if (!categoriesRes.ok) throw new Error(`Ошибка загрузки категорий: ${categoriesRes.status}`);
            const categoriesData = await categoriesRes.json();
    
            // Обновление состояния
            state.products = transformProducts(productsData);
            state.flatCategories = categoriesData;
            state.categories = buildCategoryTree(categoriesData);
    
            console.log('Данные загружены:', { 
                products: state.products.slice(0, 3), 
                categories: state.categories.slice(0, 3) 
            });
    
        } catch (error) {
            console.error('Ошибка загрузки:', error);
            showError(`Ошибка инициализации: ${error.message}`);
            throw error;
        }
    };
    
    const transformProducts = (products) => {
        return products.map(product => ({
            id: product.id,
            title: product.title,
            categoryId: product.category_id,
            brand: product.brand || 'Не указан',
            ageGroup: product.age_group || '',
            sizeGroup: product.size_group || '',
            rating: parseFloat(product.rating) || 0,
            image: product.imageUrl || '/images/placeholder.webp',
            description: product.description || '',
            sku: product.sku || `SKU-${product.id}`,
            variants: (product.variants || []).map(v => ({
                id: v.variant_id,
                weight: parseFloat(v.weight),
                price: parseFloat(v.price),
                productId: product.id
            }))
        }));
    };
    
    const buildCategoryTree = (categories, parentId = null) => {
        return categories
            .filter(category => category.parent_id === parentId)
            .map(category => ({
                ...category,
                subcategories: buildCategoryTree(categories, category.id)
            }));
    };
    
    const flattenCategories = (categories, level = 0, parentId = null) => {
        return categories.reduce((acc, category) => {
            acc.push({
                id: category.id,
                name: category.name,
                parent_id: parentId,
                level
            });
            
            if (category.subcategories && category.subcategories.length > 0) {
                acc = acc.concat(flattenCategories(
                    category.subcategories,
                    level + 1,
                    category.id
                ));
            }
            return acc;
        }, []);
    };
    
    const updateCategorySelects = () => {
        const options = state.flatCategories.map(category => 
            `<option value="${category.id}">${'&nbsp;&nbsp;'.repeat(category.level)}${category.name}</option>`
        ).join('');
        
        DOM.categoryParentSelect.innerHTML = 
            `<option value="">Основная категория</option>${options}`;
        DOM.productCategorySelect.innerHTML = options;
    };
    
    const handleCategorySubmit = async (e) => {
        e.preventDefault();
        if (!checkAdminAccess()) {
            alert('Доступ запрещен!');
            window.location.href = '/login.html';
            return;
        }
    
        const formData = new FormData(e.target);
        const categoryData = {
            name: formData.get('name').trim(),
            parent_id: formData.get('parent') || null
        };
    
        try {
            const response = await logApiResponse(CONFIG.CATEGORIES_DATA_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(categoryData)
            });
    
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message);
            }
    
            // Получаем актуальный список категорий после создания
            const categoriesResponse = await logApiResponse(CONFIG.CATEGORIES_DATA_URL);
            if (!categoriesResponse.ok) throw new Error('Ошибка загрузки категорий');
            const updatedCategories = await categoriesResponse.json();
            
            // Обновляем состояние
            state.flatCategories = updatedCategories;
            state.categories = buildCategoryTree(updatedCategories);
            
            updateCategorySelects();
            renderCategories();
            e.target.reset();
            showSuccessMessage('Категория успешно добавлена!');
    
        } catch (error) {
            console.error('Ошибка:', error);
            showError(error.message);
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
                        
                        try {
                            // Получаем все ID для удаления
                            const idsToRemove = getCategoryChildrenIds(categoryId);
                            
                            // Удаляем категории через API
                            await Promise.all(idsToRemove.map(id => 
                                fetch(`${CONFIG.CATEGORIES_DATA_URL}/${id}`, {
                                    method: 'DELETE',
                                    headers: {
                                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                                    }
                                }).then(res => {
                                    if (!res.ok) throw new Error('Ошибка удаления категории');
                                })
                            ));
                
                            // Обновляем данные после удаления
                            const [categoriesRes, productsRes] = await Promise.all([
                                fetch(CONFIG.CATEGORIES_DATA_URL),
                                fetch(CONFIG.PRODUCTS_DATA_URL)
                            ]);
                            
                            const [updatedCategories, updatedProducts] = await Promise.all([
                                categoriesRes.json(),
                                productsRes.json()
                            ]);
                
                            // Обновляем состояние
                            state.flatCategories = updatedCategories;
                            state.categories = buildCategoryTree(updatedCategories);
                            state.products = transformProducts(updatedProducts);
                
                            renderAll();
                            updateCategorySelects();
                            
                        } catch (error) {
                            console.error('Ошибка:', error);
                            showError(error.message);
                        }
                        return;
                    }
                
                    // Удаление товара
                    const productRow = e.target.closest('.product-item');
                    if (productRow) {
                        const productId = parseInt(productRow.dataset.id);
                        if (!confirm('Удалить товар?')) return;
                        
                        try {
                            const response = await logApiResponse(`${CONFIG.PRODUCTS_DATA_URL}/${productId}`, {
                                method: 'DELETE',
                                headers: {
                                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                                }
                            });
                
                            if (!response.ok) {
                                const error = await response.json();
                                throw new Error(error.message);
                            }
                
                            // Обновляем список товаров
                            const productsRes = await logApiResponse(CONFIG.PRODUCTS_DATA_URL);
                            const updatedProducts = await productsRes.json();
                            state.products = transformProducts(updatedProducts);
                            
                            renderProducts();
                            
                        } catch (error) {
                            console.error('Ошибка:', error);
                            showError(error.message);
                        }
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
            title: formData.get('title').trim(),
            category_id: formData.get('category'),
            image: formData.get('image')
        };

        // Проверка обязательных полей
        if (!requiredFields.title) {
            alert('Введите название товара');
            form.title.focus();
            return;
        }
        if (!requiredFields.category_id || isNaN(requiredFields.category_id)) {
            alert('Выберите категорию');
            form.category.focus();
            return;
        }
        if (!requiredFields.image?.name) {
            alert('Загрузите изображение товара');
            form.image.focus();
            return;
        }

        // Проверка существования категории
        const categoryExists = state.flatCategories.some(
            c => c.id === parseInt(requiredFields.category_id)
        );
        if (!categoryExists) {
            alert('Выбранная категория не существует');
            return;
        }

        // Сбор данных для API
        const productData = new FormData();
        productData.append('title', requiredFields.title);
        productData.append('category_id', requiredFields.category_id);
        productData.append('image', requiredFields.image);
        
        // Опциональные поля
        const optionalFields = [
            'brand', 'age_group', 'size_group', 
            'description', 'sku', 'rating'
        ];
        
        optionalFields.forEach(field => {
            const value = formData.get(field);
            if (value) productData.append(field, value);
        });

        // Варианты товара
        const variants = formData.get('variants');
        if (variants) {
            try {
                JSON.parse(variants);
                productData.append('variants', variants);
            } catch (error) {
                alert('Ошибка в формате вариантов! Используйте JSON');
                form.variants.focus();
                return;
            }
        }

        // Отправка данных
        const response = await logApiResponse(CONFIG.PRODUCTS_DATA_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: productData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Ошибка сервера');
        }

        // Обновление списка товаров
        const productsRes = await logApiResponse(CONFIG.PRODUCTS_DATA_URL);
        const updatedProducts = await productsRes.json();
        state.products = transformProducts(updatedProducts);
        
        form.reset();
        showSuccessMessage('Товар успешно добавлен!');
        renderProducts();

    } catch (error) {
        console.error('Ошибка:', error);
        showError(error.message);
    }

                // Обработка вариантов товара
const variantsInput = formData.get('variants');
let variants = [];
try {
    if (variantsInput) {
        variants = JSON.parse(variantsInput);
        if (!Array.isArray(variants)) {
            throw new Error('Варианты должны быть массивом');
        }
    }
} catch (error) {
    alert('Ошибка в формате вариантов! Используйте JSON-массив объектов с weight и price');
    form.variants.focus();
    return;
}

// Проверка наличия вариантов
if (variants.length === 0) {
    // Создаем вариант по умолчанию если нет ввода
    variants.push({ weight: 1, price: parseFloat(formData.get('price')) });
}

// Создание объекта товара для API
const productData = {
    title: formData.get('title').trim(),
    category_id: parseInt(formData.get('category')),
    description: formData.get('description').trim() || null,
    sku: formData.get('sku').trim() || null,
    brand: formData.get('brand').trim() || null,
    age_group: formData.get('age_group').trim() || null,
    size_group: formData.get('size_group').trim() || null,
    rating: formData.get('rating') ? parseFloat(formData.get('rating')) : null,
    variants: variants.map(v => ({
        weight: parseFloat(v.weight),
        price: parseFloat(v.price)
    }))
};

try {
    // Отправка данных через FormData для поддержки файлов
    const formPayload = new FormData();
  formPayload.append('data', JSON.stringify(productData));
    
    const imageFile = formData.get('image');
    if (imageFile) {
        formPayload.append('image', imageFile);
    }

    const response = await logApiResponse(CONFIG.PRODUCTS_DATA_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formPayload
    });

    if (!response.ok) {
        const errorData = await response.json();
        // Обработка ошибок дубликатов из сервера
        if (errorData.error.includes('sku')) {
            throw new Error('Товар с таким артикулом уже существует');
        }
        throw new Error(errorData.error || 'Ошибка сохранения товара');
    }

    // Успешное создание - обновляем данные
    const [productsRes, categoriesRes] = await Promise.all([
        fetch(CONFIG.PRODUCTS_DATA_URL),
        fetch(CONFIG.CATEGORIES_DATA_URL)
    ]);
    
    const [productsData, categoriesData] = await Promise.all([
        productsRes.json(),
        categoriesRes.json()
    ]);

    // Обновление глобального состояния
    state.products = transformProducts(productsData);
    state.flatCategories = categoriesData;
    state.categories = buildCategoryTree(categoriesData);

    // Обновление интерфейса
    renderProducts();
    updateCategorySelects();
    
    // Сброс формы и уведомление
    form.reset();
    showSuccessMessage('Товар успешно добавлен!');

} catch (error) {
    console.error('Ошибка при добавлении товара:', error);
    showError(error.message);
    
    // Восстановление данных с сервера при ошибке
    try {
        const [productsRes, categoriesRes] = await Promise.all([
            fetch(CONFIG.PRODUCTS_DATA_URL),
            fetch(CONFIG.CATEGORIES_DATA_URL)
        ]);
        
        state.products = transformProducts(await productsRes.json());
        state.flatCategories = await categoriesRes.json();
        state.categories = buildCategoryTree(state.flatCategories);
        
        renderProducts();
    } catch (reloadError) {
        console.error('Ошибка восстановления данных:', reloadError);
        showError('Ошибка синхронизации данных. Обновите страницу');
    }
}
///////////////////////////////////////////////
    // Поиск товаров
    const handleSearch = async (e) => {
        const term = e.target.value.toLowerCase();
        try {
          const response = await logApiResponse(
            `${CONFIG.PRODUCTS_DATA_URL}?search=${encodeURIComponent(term)}`,
            { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }
          );
          if (!response.ok) throw new Error('Ошибка поиска');
      
          const searchJson = await response.json();
          const filteredProducts = Array.isArray(searchJson) ? searchJson : searchJson.data;
          renderProducts(filteredProducts);
        } catch (error) {
          console.error('Ошибка поиска:', error);
          showError('Ошибка при выполнении поиска');
        }
      };
      
    
      const renderProducts = (products = state.products) => {
        try {
            const categoryMap = state.flatCategories.reduce((acc, c) => {
                acc[c.id] = c.name;
                return acc;
            }, {});
    
            DOM.productTableBody.innerHTML = products.map(product => {
                const firstVariant = product.variants?.[0] || {};
                return `
                    <tr class="product-item" data-id="${product.id}">
                        <td>${product.id}</td>
                        <td>${product.title || 'Без названия'}</td>
                        <td>${categoryMap[product.categoryId] || 'Без категории'}</td>
                        <td>${firstVariant.price ? parseFloat(firstVariant.price).toFixed(2) : '0.00'} ₽</td>
                        <td>
                            <button class="edit-product-btn" data-id="${product.id}">
                                Редактировать
                            </button>
                        </td>
                    </tr>
                `;
            }).join('') || '<tr><td colspan="5">Нет товаров</td></tr>';
    
            console.log('Отрендерено товаров:', products.length);
            
        } catch (error) {
            console.error('Ошибка рендера товаров:', error);
            DOM.productTableBody.innerHTML = '<tr><td colspan="5">Ошибка загрузки</td></tr>';
        }
    };
    
    // Вспомогательная функция для экранирования HTML
    const escapeHTML = (str) => {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    };
      
    
      const handleReviewAction = async (action, reviewId) => {
        if (!checkAdminAccess()) {
            showError('Доступ запрещен!');
            return;
        }
    
        try {
            // Определяем текущий статус отзыва
            const isPending = state.pendingReviews.some(r => r.id === reviewId);
            const reviewType = isPending ? 'pending' : 'approved';
    
            // Подтверждение для деструктивных действий
            if (action === 'delete' && !confirm('Удалить отзыв безвозвратно?')) return;
    
            // Формируем запросы в зависимости от действия
            let response;
            switch(action) {
                case 'approve':
                    if (!isPending) throw new Error('Можно одобрять только отзывы из ожидания');
                    response = await logApiResponse(`${CONFIG.SAVE_REVIEWS_URL}/${reviewId}/approve`, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        }
                    });
                    break;
    
                case 'delete':
                    response = await logApiResponse(`${CONFIG.SAVE_REVIEWS_URL}/${reviewType}/${reviewId}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        }
                    });
                    break;
    
                default:
                    throw new Error('Неизвестное действие');
            }
    
            // Проверка ответа сервера
            if (checkUnauthorized(response)) return;
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Ошибка операции');
            }
    
            // Локальное обновление состояния без перезагрузки
            if (action === 'approve') {
                const approvedReview = state.pendingReviews.find(r => r.id === reviewId);
                state.pendingReviews = state.pendingReviews.filter(r => r.id !== reviewId);
                state.approvedReviews.push(approvedReview);
            } else {
                if (isPending) {
                    state.pendingReviews = state.pendingReviews.filter(r => r.id !== reviewId);
                } else {
                    state.approvedReviews = state.approvedReviews.filter(r => r.id !== reviewId);
                }
            }
    
            // Обновление счетчиков и отображения
            DOM.reviewCounters.pending.textContent = state.pendingReviews.length;
            DOM.reviewCounters.approved.textContent = state.approvedReviews.length;
            renderReviews();
    
        } catch (error) {
            console.error('Ошибка модерации:', error);
            showError(`Ошибка: ${error.message}`);
            
            // Восстановление через перезагрузку данных
            try {
                const [pendingRes, approvedRes] = await Promise.all([
                    fetch(CONFIG.PENDING_REVIEWS_URL),
                    fetch(CONFIG.APPROVED_REVIEWS_URL)
                ]);
                
                state.pendingReviews = await pendingRes.json();
                state.approvedReviews = await approvedRes.json();
                renderReviews();
                
            } catch (reloadError) {
                console.error('Ошибка восстановления:', reloadError);
                showError('Критическая ошибка! Перезагрузите страницу');
            }
        }
    };       // Обновление состояния отзывов через API
    state.pendingReviews = pending;
    state.approvedReviews = approved;
    
    try {
        // Для approve: отправка PUT запроса
        if (action === 'approve') {
            const response = await logApiResponse(`/api/reviews/${reviewId}/approve`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            if (!response.ok) throw new Error('Ошибка одобрения отзыва');
        }
        
        // Для delete: отправка DELETE запроса
        if (action === 'delete') {
            const type = originalPending.some(r => r.id === reviewId) ? 'pending' : 'approved';
            const response = await logApiResponse(`/api/reviews/${type}/${reviewId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            if (!response.ok) throw new Error('Ошибка удаления отзыва');
        }
    
        // Обновление данных после успешного запроса
        const [pendingRes, approvedRes] = await Promise.all([
            fetch('/api/reviews/pending'),
            fetch('/api/reviews/approved')
        ]);
        
        state.pendingReviews = await pendingRes.json();
        state.approvedReviews = await approvedRes.json();
        
        renderReviews();
    } catch (error) {
        console.error('Ошибка:', error);
        // Восстановление состояния через API при ошибке
        const [pendingRes, approvedRes] = await Promise.all([
            fetch('/api/reviews/pending'),
            fetch('/api/reviews/approved')
        ]);
        
        state.pendingReviews = await pendingRes.json();
        state.approvedReviews = await approvedRes.json();
        
        renderReviews();
        showError(`${error.message} (изменения отменены)`);
    }
    
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
    
    const setupEventListeners = () => {
        DOM.tabs.forEach(tab => tab.addEventListener('click', handleTabSwitch));
        DOM.categoryForm.addEventListener('submit', handleCategorySubmit);
        DOM.productForm.addEventListener('submit', handleProductSubmit);
        DOM.searchInput.addEventListener('input', handleSearch);
        document.addEventListener('click', handleDelete);
    
        // Обработчик отправки отзывов
        const reviewForm = document.getElementById('reviewForm');
        if (reviewForm) {
            reviewForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                
                try {
                    const response = await logApiResponse('/api/reviews', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        },
                        body: JSON.stringify({
                            author_name: formData.get('name'),
                            email: formData.get('email'),
                            phone: formData.get('phone'),
                            rating: parseInt(formData.get('rating')),
                            comment: formData.get('content'),
                            product_id: parseInt(formData.get('product_id')) // Добавлен product_id
                        })
                    });
    
                    if (!response.ok) {
                        const error = await response.json();
                        throw new Error(error.error || 'Ошибка отправки отзыва');
                    }
    
                    alert('Отзыв успешно отправлен на модерацию!');
                    e.target.reset();
                } catch (error) {
                    console.error('Ошибка:', error);
                    alert(error.message);
                }
            });
        }
        setupReviewEventListeners();
    };
    
    const handleTabSwitch = async (e) => {
        const tab = e.target;
        if (!tab?.dataset.tab) return;
    
        DOM.tabs.forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.admin-section').forEach(section => {
            section.classList.remove('active');
        });
    
        tab.classList.add('active');
        state.currentTab = tab.dataset.tab;
        
        const activeSection = document.getElementById(`${state.currentTab}-section`);
        if (activeSection) {
            activeSection.classList.add('active');
    
            switch(state.currentTab) {
                case 'full':
                case 'quick-orders':
                    try {
                        const endpoint = state.currentTab === 'full' 
                            ? '/api/orders' 
                            : '/api/quick-orders';
                        
                        const response = await logApiResponse(endpoint, {
                            headers: {
                                'Authorization': `Bearer ${localStorage.getItem('token')}`
                            }
                        });
                        
                        if (!response.ok) throw new Error('Ошибка загрузки заказов');
                        const orders = await response.json();
                        
                        renderOrdersSection(state.currentTab, orders);
                    } catch (error) {
                        console.error('Ошибка:', error);
                        showError('Ошибка загрузки заказов');
                    }
                    break;
                    
                case 'reviews':
                    try {
                        const [pendingRes, approvedRes] = await Promise.all([
                            fetch('/api/reviews/pending'),
                            fetch('/api/reviews/approved')
                        ]);
                        
                        state.pendingReviews = await pendingRes.json();
                        state.approvedReviews = await approvedRes.json();
                        
                        renderReviews();
                    } catch (error) {
                        console.error('Ошибка:', error);
                        showError('Ошибка загрузки отзывов');
                    }
                    break;
            }
        }
    };
    
    const renderAll = async () => {
        try {
          const [
            productsRes,
            categoriesRes,
            pendingRes,
            approvedRes,
            ordersRes,
            quickOrdersRes
          ] = await Promise.all([
            fetch(CONFIG.PRODUCTS_DATA_URL),
            fetch(CONFIG.CATEGORIES_DATA_URL),
            fetch(CONFIG.PENDING_REVIEWS_URL),
            fetch(CONFIG.APPROVED_REVIEWS_URL),
            fetch(CONFIG.ORDERS_DATA_URL),
            fetch(CONFIG.QUICK_ORDERS_DATA_URL)
          ]);
      
          // Продукты
          const productsJson = await productsRes.json();
          const productsData = Array.isArray(productsJson) ? productsJson : productsJson.data;
          state.products       = transformProducts(productsData);
      
          // Остальные сущности
          state.flatCategories = await categoriesRes.json();
          state.categories     = buildCategoryTree(state.flatCategories);
          state.pendingReviews = await pendingRes.json();
          state.approvedReviews= await approvedRes.json();
          state.orders         = await ordersRes.json();
          state.quickOrders    = await quickOrdersRes.json();
      
          // Рендер всех табов
          renderCategories();
          renderProducts();
          renderReviews();
          renderOrdersSection('full');
          renderOrdersSection('quick-orders');
      
        } catch (error) {
          console.error('Ошибка инициализации:', error);
          showError('Ошибка загрузки данных');
        }
      };
      
    
      async function init() {
        const user = JSON.parse(localStorage.getItem('currentUser'));
        if (!user || user.role !== 'admin') {
            window.location.href = '/login.html';
            return;
        }
        await loadInitialData();
        await loadOrders();
        await loadReviews();
        setupOrderListeners();
        setupEventListeners();
        await renderAll();
        updateCategorySelects();
        renderReviews();
    }

    init();
}
}); // ← Добавлено в самом конце файла