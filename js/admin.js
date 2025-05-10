// admin.js
const AdminManager = (() => {
    const utils = {
      showMessage(message, type = 'error', duration = 5000) {
        const messageEl = document.createElement('div');
        messageEl.className = `${type}-message`;
        messageEl.textContent = message;
        document.body.prepend(messageEl);
        setTimeout(() => messageEl.remove(), duration);
      },
  
      handleLoading(container, show = true) {
        const loader = container.querySelector('.loading-overlay') || 
          this.createLoader(container);
        loader.style.display = show ? 'flex' : 'none';
      },
  
      createLoader(container) {
        const loader = document.createElement('div');
        loader.className = 'loading-overlay';
        loader.innerHTML = '<div class="loader"></div>';
        container.appendChild(loader);
        return loader;
      }
    };
  
    const API = {
      async request(method, path, data) {
        try {
         // Добавляем проверку авторизации перед каждым запросом
        const user = JSON.parse(localStorage.getItem('currentUser'));
        if (!user || user.role !== 'admin') {
          window.location.href = '/login.html';
          return;
        }
          // базовые опции без заголовков
          const options = { 
            method,
            credentials: 'include' // Важно для сессионных кук
          };
    
          if (data) {
            if (data instanceof FormData) {
              options.body = data;
            } else {
              options.headers = { 'Content-Type': 'application/json' };
              options.body = JSON.stringify(data);
            }
          }
    
          const response = await fetch(`/api${path}`, options);
          if (response.status === 401) {
            window.location.href = '/login.html';
            return;
          }
          if (!response.ok) {
            // прочитаем статус и текст ошибки от сервера
            const text = await response.text();
            console.error(`${method} error:`, response.status, text);

            throw new Error(`Ошибка ${response.status}: ${text}`);
          }
    
          // если DELETE вернул 204 No Content, просто выходим без JSON.parse
          if (response.status === 204) return;
          return await response.json();
        } catch (error) {
          utils.showMessage(error.message);
          throw error;
        }
      },
    
      get(path)    { return this.request('GET',    path); },
      post(path,d) { return this.request('POST',   path, d); },
      put(path,d)  { return this.request('PUT',    path, d); },
      patch(path,d) { return this.request('PATCH',  path, d); },
      delete(path) { return this.request('DELETE', path); }
    };
    
    const Orders = {
      currentOrderType: 'full',
      statusColors: {
        new: '#4a90e2',
        processing: '#f5a623',
        shipped: '#7ed321',
        delivered: '#50e3c2',
        cancelled: '#d0021b',
        completed: '#b8e986'
      },

      async init() {
        await this.loadOrders('full');
        await this.loadOrders('quick');
        this.setupEventHandlers();
      },

      async loadOrders(type = 'full') {
        let container; // Объявляем переменную вне блока try
        try {
          const endpoint = type === 'full' ? '/orders' : '/quick-orders';
          container = type === 'full' 
            ? document.getElementById('full-section') 
            : document.getElementById('quick-orders-section');
            
          utils.handleLoading(container, true);
          
          const orders = await API.get(endpoint);
          this.renderOrders(orders, type);

          
          this.addExportButton(container, type);
        } catch (error) {
          console.error(`Ошибка загрузки заказов (${type}):`, error);
          utils.showMessage(`Не удалось загрузить ${type === 'full' ? 'обычные' : 'быстрые'} заказы`, 'error');
        } finally {
          utils.handleLoading(container, false);
        }
      },

      renderOrders(orders, type) {
        const container = type === 'full' 
          ? document.querySelector('#full-section .orders-container') 
          : document.querySelector('#quick-orders-section .quick-orders-container');
          
          container.innerHTML = `
          <table class="orders-table">
            <thead>
              <tr>
                ${type === 'full' ? `
                  <th>ID</th>
                  <th>Дата</th>
                  <th>Клиент</th>
                  <th>Телефон</th>
                  <th>Сумма</th>
                  <th>Статус</th>
                  <th>Действия</th>
                ` : `
                  <th>ID</th>
                  <th>Адрес</th>
                  <th>Имя</th>
                  <th>Телефон</th>
                  <th>Сумма</th>
                  <th>Статус</th>
                  <th>Действия</th>
                `}
              </tr>
            </thead>
            <tbody>
              ${orders.map(order => `
                <tr class="order-row" data-id="${order.id}" data-type="${type}">
                  <td>${order.id}</td>
                  ${type === 'full' ? `
                    <td>${this.formatDate(order.created_at)}</td>
                    <td>${order.customer_fullname}</td>
                    <td>${order.customer_phone}</td>
                  ` : `
                    <td>${order.street}, ${order.house_number}</td>
                    <td>${order.customer_name}</td>
                    <td>${order.customer_phone}</td>
                  `}
                  <td>${Number(order.total_amount).toFixed(2)} ₽</td>
                  <td>${this.getStatusBadge(order.status)}</td>
                  <td>
                    <button class="details-btn">🔍 Подробности</button>

                  </td>
                </tr>
                <tr class="order-details" data-id="${order.id}" data-type="${type}">
                  <td colspan="7">
                    <div class="details-content">
                      ${this.renderOrderDetails(order, type)}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      },
    

      renderOrderDetails(order, type) {
        if (type === 'full') {
          return `
            <div class="details-section">
              <h4>Информация о заказе #${order.id}</h4>
              <p>Email: ${order.customer_email}</p>
              <p>Метод оплаты: ${order.payment_method}</p>
              <p>Стоимость доставки: ${Number(order.delivery_cost).toFixed(2)} ₽</p>
              <p>Скидка: ${order.has_discount ? 'Да' : 'Нет'}</p>
              ${order.items?.length ? `
                <div class="order-items">
                  <h5>Позиции:</h5>
                  <ul>
                    ${order.items.map(item => `
                      <li>
                        ${item.product_name}
                        (${item.variant_name})
                        — ${item.quantity} × ${Number(item.price).toFixed(2)} ₽
                      </li>
                    `).join('')}
                  </ul>
                </div>
              ` : '<p>Нет позиций в заказе.</p>'}
              <div class="status-controls">
                <select class="status-select" data-id="${order.id}">
                  ${Object.keys(this.statusColors)
                    .filter(s => s !== 'completed')
                    .map(s => `<option ${s === order.status ? 'selected' : ''}>${s}</option>`)
                    .join('')}
                </select>
                <button class="save-status-btn" data-id="${order.id}">Сохранить</button>
              </div>
            </div>
          `;
        }
      
        // Для быстрых заказов
        return `
          <div class="details-section">
            <h4>Быстрый заказ #${order.id}</h4>
            <p>Комментарий: ${order.comment || 'нет'}</p>
            ${order.items?.length ? `
              <div class="order-items">
                <h5>Позиции:</h5>
                <ul>
                  ${order.items.map(item => `
                    <li>
                      ${item.product_name}
                      (${item.variant_name})
                      — ${item.quantity} × ${Number(item.price).toFixed(2)} ₽
                     
                    </li>
                  `).join('')}
                </ul>
              </div>
            ` : '<p>Нет позиций в быстром заказе.</p>'}
            <div class="status-controls">
              <select class="status-select" data-id="${order.id}">
                ${['new', 'processing', 'completed', 'cancelled']
                  .map(s => `<option ${s === order.status ? 'selected' : ''}>${s}</option>`)
                  .join('')}
              </select>
              <button class="save-status-btn" data-id="${order.id}">Сохранить</button>
            </div>
          </div>
        `;
      },
      

      getStatusBadge(status) {
        return `<span class="status-badge" style="background: ${this.statusColors[status]}">
          ${status}
        </span>`;
      },

      formatDate(dateString) {
        const options = { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        };
        return new Date(dateString).toLocaleDateString('ru-RU', options);
      },

      addExportButton(container, type) {
        // Удаляем старую кнопку, если есть
        const oldBtn = container.parentNode.querySelector('.export-btn');
        if (oldBtn) oldBtn.remove();
      
        const exportBtn = document.createElement('button');
        exportBtn.className = 'export-btn';
        exportBtn.textContent = 'Экспорт в CSV';
        exportBtn.onclick = () => this.exportToCSV(type);
        
        // Вставляем перед таблицей заказов
        const ordersTable = container.querySelector('.orders-table');
        if (ordersTable) {
          container.insertBefore(exportBtn, ordersTable);
        }
      },

      async exportToCSV(type) {
        try {
          const orders = await API.get(type === 'full' ? '/orders' : '/quick-orders');
          const csvContent = this.convertToCSV(orders, type);
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const link = document.createElement('a');
          
          link.href = URL.createObjectURL(blob);
          link.download = `${type}-orders-${new Date().toISOString().slice(0,10)}.csv`;
          link.click();
          
          utils.showMessage('Экспорт завершен', 'success');
        } catch (error) {
          console.error('Ошибка экспорта:', error);
          utils.showMessage('Ошибка при экспорте данных', 'error');
        }
      },

      convertToCSV(orders, type) {
        const headers = type === 'full' 
          ? ['ID', 'Дата', 'Клиент', 'Телефон', 'Email', 'Сумма', 'Статус']
          : ['ID', 'Адрес', 'Имя', 'Телефон', 'Сумма', 'Статус'];
        
        const rows = orders.map(order => {
          return type === 'full' 
            ? [
                order.id,
                `"${this.formatDate(order.created_at)}"`,
                `"${order.customer_fullname}"`,
                order.customer_phone,
                order.customer_email,
                order.total_amount,
                order.status
              ]
            : [
                order.id,
                `"${order.street}, ${order.house_number}"`,
                `"${order.customer_name}"`,
                order.customer_phone,
                order.total_amount,
                order.status
              ];
        });

        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      },

      setupEventHandlers() {
        // Раскрытие/скрытие деталей заказа
        document.querySelectorAll('.admin-section').forEach(section => {
          section.addEventListener('click', (e) => {
            const row = e.target.closest('.order-row');
            if (!row) return;

            // Заменяем строку поиска details
          const details = document.querySelector(
            `.order-details[data-id="${row.dataset.id}"][data-type="${row.dataset.type}"]`
          );
            details.classList.toggle('active');
          });
        });

        // Обработка изменения статуса
        // В секции Orders.setupEventHandlers()
        document.querySelectorAll('.status-select').forEach(select => {
          select.addEventListener('change', async (e) => {
            const orderId = e.target.dataset.id;
            const newStatus = e.target.value;
            const type = e.target.closest('.order-details') 
              ? 'full' 
              : 'quick';

            try {
              // Правильный endpoint с /api
              const endpoint = `/${type === 'full' ? 'orders' : 'quick-orders'}/${orderId}`;
              await API.patch(endpoint, { status: newStatus });
              
              const badge = document.querySelector(`.order-row[data-id="${orderId}"] .status-badge`);
              badge.textContent = newStatus;
              badge.style.background = this.statusColors[newStatus];
              
              utils.showMessage('Статус обновлен', 'success');
            } catch (error) {
              console.error('Ошибка обновления статуса:', error);
              utils.showMessage('Ошибка обновления статуса', 'error');
            }
          });
        });
      }
    };

    const Categories = {
      init() {
        this.loadCategories();
        this.setupCategoryForm();
      },
  
      async loadCategories() {
        try {
          const categories = await API.get('/categories');
          this.renderCategories(categories);
          this.updateParentSelect(categories);
        } catch (error) {
          console.error('Ошибка загрузки категорий:', error);
        }
      },
  
      renderCategories(categories) {
        const container = document.querySelector('.category-list');
        container.innerHTML = '<h2>Существующие категории</h2>';
        
        const tree = this.buildTree(categories);
        const list = this.createCategoryList(tree);
        container.appendChild(list);
      },
  
      buildTree(categories, parentId = null) {
        return categories
          .filter(cat => cat.parent_id === parentId)
          .map(cat => ({
            ...cat,
            children: this.buildTree(categories, cat.id)
          }));
      },
  
      createCategoryList(categories, level = 0) {
        const ul = document.createElement('ul');
        ul.className = `category-tree level-${level}`;
  
        categories.forEach(cat => {
          const li = document.createElement('li');
          li.innerHTML = `
            <div class="category-item">
              <span>${cat.name}</span>
              <div class="category-actions">
                <button class="edit-btn" data-id="${cat.id}">✏️</button>
                <button class="delete-btn" data-id="${cat.id}">🗑️</button>
              </div>
            </div>
          `;
  
          if (cat.children.length > 0) {
            li.appendChild(this.createCategoryList(cat.children, level + 1));
          }
  
          ul.appendChild(li);
        });
  
        return ul;
      },
  
      updateParentSelect(categories) {
        const select = document.getElementById('category-parent');
        select.innerHTML = '<option value="">Основная категория</option>';
        
        categories.forEach(cat => {
          const option = document.createElement('option');
          option.value = cat.id;
          option.textContent = cat.name;
          select.appendChild(option);
        });
      },
  
      setupCategoryForm() {
        // сразу после Categories.init() или в самом начале setupCategoryForm:
        const parentSelect = document.getElementById('category-parent');
        const imgWrapper = document.getElementById('category-image-wrapper');

        parentSelect.addEventListener('change', () => {
          const isRoot = parentSelect.value === '';
          imgWrapper.style.display = isRoot ? 'block' : 'none';
          imgWrapper.querySelector('input').required = isRoot;
        });
        // Инициализировать состояние при загрузке
        parentSelect.dispatchEvent(new Event('change'));

        const form = document.getElementById('add-category-form');
        form.dataset.action = '/categories';
        
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const formData = new FormData(form);
          
          try {
            await API.post('/categories', Object.fromEntries(formData));
            this.loadCategories();
            form.reset();
          } catch (error) {
            console.error('Ошибка создания категории:', error);
          }
        });
      },
  
      collectDescendants(categories, parentId) {
        const directChildren = categories.filter(c => c.parent_id === parentId);
        let all = [];
        for (const child of directChildren) {
          all.push(child.id);
          all = all.concat(this.collectDescendants(categories, child.id));
        }
        return all;
      },
    
      setupDeleteHandlers() {
        document.addEventListener('click', async (e) => {
          if (!e.target.closest('.delete-btn')) return;
    
          const categoryId = +e.target.dataset.id;
          const categoryName = e.target.closest('.category-item')
                                   .querySelector('span').textContent;
    
          if (!confirm(`Удалить категорию "${categoryName}" и все её подкатегории?`)) {
            return;
          }
    
          try {
            // 1. Получаем полный список категорий
            const categories = await API.get('/categories');
            // 2. Собираем всех потомков
            const descendants = this.collectDescendants(categories, categoryId);
            // 3. Удаляем сначала потомков, затем саму категорию
            //    Можно делать последовательно, чтобы не было конфликтов FK
            for (const id of descendants) {
              await API.delete(`/categories/${id}`);
            }
            // и только после этого удаляем родителя
            await API.delete(`/categories/${categoryId}`);
    
            this.loadCategories();
            utils.showMessage('Категория и все её подкатегории удалены', 'success');
    
          } catch (error) {
            console.error(error);
            utils.showMessage('Ошибка при каскадном удалении', 'error');
          }
        });
      }
    };

    const Products = {
      currentPage: 1,
      perPage: 20,
      searchQuery: '',
  
      async init() {
        await this.loadCategories();
        this.setupProductForm();
        this.setupSearch();
        this.loadProducts();
        this.setupDeleteHandlers();
      },
  
      async loadCategories() {
        try {
          const categories = await API.get('/categories');
          this.renderCategoryOptions(categories);
        } catch (error) {
          console.error('Ошибка загрузки категорий:', error);
        }
      },
  
      renderCategoryOptions(categories) {
        const select = document.getElementById('product-category');
        select.innerHTML = '<option value="" disabled selected>Выберите категорию</option>';
        
        categories.forEach(cat => {
          const option = document.createElement('option');
          option.value = cat.id;
          option.textContent = cat.name;
          select.appendChild(option);
        });
      },
  
      setupProductForm() {
        const form = document.getElementById('add-product-form');
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const formData = new FormData(form);
          
          try {
            // Преобразование данных формы
            const specs = this.parseSpecifications(formData.get('specifications'));
            const variants = this.parseVariants(formData.get('weights'), formData.get('price'));
            
            const productData = {
              title: formData.get('title'),
              category_id: formData.get('category_id'),
              price: formData.get('price'),
              sku: formData.get('sku'),
              description: formData.get('description'),
              brand: formData.get('brand'),
              age_group: formData.get('age_group'),
              size_group: formData.get('size_group'),
              specifications: JSON.stringify(specs),
              variants: JSON.stringify(variants)
            };
  
            // Создаем новый FormData для отправки файла
            const uploadData = new FormData();
            uploadData.append('image', formData.get('image'));
            uploadData.append('data', JSON.stringify(productData));
  
            await API.post('/products', uploadData);
            this.loadProducts();
            form.reset();
            utils.showMessage('Товар успешно добавлен', 'success');
          } catch (error) {
            console.error('Ошибка создания товара:', error);
          }
        });
      },
  
      parseSpecifications(text) {
        return text.split(',')
          .map(pair => pair.trim().split(':'))
          .reduce((acc, [key, value]) => {
            if (key && value) acc[key.trim()] = value.trim();
            return acc;
          }, {});
      },
  
      parseVariants(weights, basePrice) {
        return weights.split(',')
          .map(w => parseFloat(w.trim()))
          .filter(w => !isNaN(w))
          .map(weight => ({
            weight,
            price: parseFloat(basePrice) * weight
          }));
      },
  
      async loadProducts() {
        try {
          const params = {
            page: this.currentPage,
            perPage: this.perPage,
            search: this.searchQuery
          };
      
          // Исправленный запрос с обработкой поиска
          const response = await API.get(`/products?${new URLSearchParams(params)}`);
          
          // Проверка структуры ответа
          if (!response.data || !response.totalPages) {
            throw new Error('Неверный формат ответа от сервера');
          }
      
          this.renderProducts(response.data);
          this.renderPagination(response.totalPages);
          
        } catch (error) {
          console.error('Ошибка загрузки товаров:', error);
          utils.showMessage('Ошибка загрузки товаров');
        }
      },
  
      renderProducts(products) {
        const tbody = document.querySelector('#products-section tbody');
        tbody.innerHTML = '';
  
        products.forEach(product => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${product.id}</td>
            <td>
              <img src="${product.imageUrl}" 
                   alt="${product.title}" 
                   class="product-thumbnail">
            </td>
            <td>${product.title}</td>
            <td>${product.sku || '-'}</td>
            <td>${this.getCategoryName(product.category_id)}</td>
            <td>${product.variants?.[0]?.price ? Number(product.variants[0].price).toFixed(2) : '0.00'} ₽</td>            <td>${this.formatSpecifications(product.specifications)}</td>
            <td>
              <button class="edit-btn" data-id="${product.id}">✏️</button>
              <button class="delete-btn" data-id="${product.id}">🗑️</button>
            </td>
          `;
  
          tbody.appendChild(row);
        });
      },
  
      getCategoryName(categoryId) {
        const select = document.getElementById('product-category');
        const option = select.querySelector(`option[value="${categoryId}"]`);
        return option ? option.textContent : 'Неизвестно';
      },
  
      formatSpecifications(specs) {
        return specs && Object.entries(specs) ? 
        Object.entries(specs)
          .map(([key, val]) => `<b>${key}:</b> ${val}`)
          .join(', ') 
        : '';
      },
  
      setupSearch() {
        const searchInput = document.getElementById('search-input');
        let timeout;
        
        searchInput.addEventListener('input', (e) => {
          clearTimeout(timeout);
          this.searchQuery = e.target.value;
          
          timeout = setTimeout(() => {
            this.currentPage = 1;
            this.loadProducts();
          }, 500);
        });
      },
  
      renderPagination(totalPages) {
        const container = document.querySelector('.table-container');
        let pagination = container.querySelector('.pagination');
        
        if (!pagination) {
          pagination = document.createElement('div');
          pagination.className = 'pagination';
          container.appendChild(pagination);
        }
  
        pagination.innerHTML = Array.from({ length: totalPages }, (_, i) => `
          <button class="page-btn ${i + 1 === this.currentPage ? 'active' : ''}" 
                  data-page="${i + 1}">
            ${i + 1}
          </button>
        `).join('');
  
        pagination.addEventListener('click', (e) => {
          if (e.target.classList.contains('page-btn')) {
            this.currentPage = parseInt(e.target.dataset.page);
            this.loadProducts();
          }
        });
      },
  
      setupDeleteHandlers() {
        document.addEventListener('click', async (e) => {
          if (!e.target.closest('.delete-btn')) return;
          
          const productId = e.target.dataset.id;
          const productName = e.target.closest('tr').querySelector('td:nth-child(3)').textContent;
  
          if (confirm(`Удалить товар "${productName}"?`)) {
            try {
              await API.delete(`/products/${productId}`);
              this.loadProducts();
              utils.showMessage('Товар успешно удален', 'success');
            } catch (error) {
              console.error('Ошибка удаления товара:', error);
            }
          }
        });
      }
    };

    const Reviews = {
      async init() {
        await this.loadReviews();
        this.setupEventHandlers();
      },

      async loadReviews() {
        try {
          utils.handleLoading(document.getElementById('reviews-section'), true);
          
          const [pending, approved] = await Promise.all([
            API.get('/reviews/pending'),
            API.get('/reviews/approved')
          ]);

          // В методе loadReviews:
          this.renderReviews(pending, '.pending-list', true);  // true - флаг для pending
          this.renderReviews(approved, '.approved-list', false); // false - для approved
          this.updateCounters(pending.length, approved.length);

        } catch (error) {
          console.error('Ошибка загрузки отзывов:', error);
          utils.showMessage('Не удалось загрузить отзывы', 'error');
        } finally {
          utils.handleLoading(document.getElementById('reviews-section'), false);
        }
      },

      renderReviews(reviews, containerSelector, isPending) { // <- Добавляем параметр isPending
        const container = document.querySelector(containerSelector);
        container.innerHTML = '';
      
        if (reviews.length === 0) {
          container.closest('.reviews-list-container')
            .querySelector('.empty-state').style.display = 'flex';
          return;
        }
      
        container.closest('.reviews-list-container')
          .querySelector('.empty-state').style.display = 'none';
      
        reviews.forEach(review => {
          const card = this.createReviewCard(review, isPending); // Передаем флаг
          container.appendChild(card);
        });
      },

      createReviewCard(review, isPending) { // <- Добавляем параметр isPending
        const card = document.createElement('div');
        card.className = 'review-card';
        card.dataset.id = review.id;
        card.innerHTML = `
          <div class="review-header">
            <div class="review-author">${review.author_name}</div>
            <div class="review-date">${this.formatDate(review.created_at)}</div>
          </div>
          <div class="review-rating">${this.createRatingStars(review.rating)}</div>
          <div class="review-comment">${review.comment}</div>
          <div class="review-contacts">
            ${review.email ? `<div>📧 ${review.email}</div>` : ''}
            ${review.phone ? `<div>📱 ${review.phone}</div>` : ''}
          </div>
          <div class="review-actions">
            ${isPending ? '<button class="approve-btn">✅ Одобрить</button>' : ''}
            <button class="delete-btn">🗑️ Удалить</button>
          </div>
        `;
        return card;
      },

      formatDate(dateString) {
        const options = { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        };
        return new Date(dateString).toLocaleDateString('ru-RU', options);
      },

      createRatingStars(rating) {
        return Array.from({ length: 5 }, (_, i) => 
          i < rating ? '★' : '☆'
        ).join('');
      },

      updateCounters(pendingCount, approvedCount) {
        document.querySelector('.pending-column .counter-number').textContent = pendingCount;
        document.querySelector('.approved-column .counter-number').textContent = approvedCount;
      },

      setupEventHandlers() {
        document.getElementById('reviews-section').addEventListener('click', async (e) => {
          const card = e.target.closest('.review-card');
          if (!card) return;

          const reviewId = card.dataset.id;
          const isPending = card.closest('.pending-list');

          // Одобрение отзыва
          if (e.target.closest('.approve-btn')) {
            try {
              await API.put(`/reviews/${reviewId}/approve`);
              card.remove();
              this.updateCounters(
                document.querySelector('.pending-list').children.length,
                document.querySelector('.approved-list').children.length + 1
              );
              utils.showMessage('Отзыв одобрен', 'success');
            } catch (error) {
              console.error('Ошибка одобрения:', error);
              utils.showMessage('Не удалось одобрить отзыв', 'error');
            }
          }

          // Удаление отзыва
          if (e.target.closest('.delete-btn')) {
            if (!confirm('Удалить этот отзыв?')) return;
            
            try {
              const type = isPending ? 'pending' : 'approved';
              await API.delete(`/reviews/${type}/${reviewId}`);
              card.remove();
              this.updateCounters(
                isPending ? 
                  document.querySelector('.pending-list').children.length - 1 :
                  document.querySelector('.pending-list').children.length,
                isPending ? 
                  document.querySelector('.approved-list').children.length :
                  document.querySelector('.approved-list').children.length - 1
              );
              utils.showMessage('Отзыв удален', 'success');
            } catch (error) {
              console.error('Ошибка удаления:', error);
              utils.showMessage('Не удалось удалить отзыв', 'error');
            }
          }
        });
      }
    };

    const Carousel = {
      async init() {
        this.section = document.getElementById('carousel-section');
        this.slidesList = this.section.querySelector('.slides-list');
        this.emptyState = this.section.querySelector('.empty-state');
        this.loader = this.section.querySelector('.loading-overlay');
        this.setupFormHandlers();
        this.setupDeleteHandlers();
    
        await this.loadSlides();
      },
    
      async loadSlides() {
        try {
          utils.handleLoading(this.section, true);
          
          const slides = await API.get('/carousel?for_admin=1');
          this.renderSlides(slides);
          
          this.emptyState.style.display = slides.length ? 'none' : 'flex';
          
        } catch (error) {
          console.error('Ошибка загрузки слайдов:', error);
          utils.showMessage('Не удалось загрузить слайды', 'error');
        } finally {
          utils.handleLoading(this.section, false);
        }
      },
    
      renderSlides(slides) {
        this.slidesList.innerHTML = slides.map(slide => `
          <div class="slide-card" data-id="${slide.id}">
            <div class="slide-preview">
              <img src="${slide.image_path}" 
                   alt="${slide.title || 'Слайд карусели'}" 
                   onerror="this.src='/images/placeholder.png'">
              <div class="slide-meta">
                ${slide.title ? `<h3>${slide.title}</h3>` : ''}
                ${slide.description ? `<p>${slide.description}</p>` : ''}
                <div class="slide-info">
                  <span>${new Date(slide.created_at).toLocaleDateString()}</span>
                  <span>Порядок: ${slide.sort_order}</span>
                  <span>${slide.is_active ? 'Активен' : 'Скрыт'}</span>
                </div>
              </div>
            </div>
            <div class="slide-actions">
              <button class="delete-btn" data-id="${slide.id}">Удалить</button>
            </div>
          </div>
        `).join('');
      },

        // Новый метод для настройки формы
  setupFormHandlers() {
    const form = document.getElementById('add-carousel-form');
    const previewContainer = this.createPreviewContainer();

    form.insertBefore(previewContainer, form.querySelector('.form-grid'));
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleFormSubmit(form, previewContainer);
    });

    form.querySelector('input[type="file"]').addEventListener('change', (e) => {
      this.handleImagePreview(e.target, previewContainer);
    });
  },

  // Создаем контейнер для превью
  createPreviewContainer() {
    const container = document.createElement('div');
    container.className = 'preview-container';
    container.innerHTML = `
      <div class="image-preview" style="display:none;">
        <img class="preview-image">
        <button type="button" class="clear-preview">&times;</button>
      </div>
      <div class="upload-error" style="display:none;"></div>
    `;
    
    container.querySelector('.clear-preview').addEventListener('click', () => {
      this.clearPreview(container);
    });
    
    return container;
  },

  // Обработка превью изображения
  handleImagePreview(input, container) {
    const file = input.files[0];
    const errorEl = container.querySelector('.upload-error');
    const previewEl = container.querySelector('.image-preview');
    
    errorEl.style.display = 'none';
    
    // Валидация файла
    if (!file) return;
    
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      errorEl.textContent = 'Недопустимый формат файла';
      errorEl.style.display = 'block';
      input.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      errorEl.textContent = 'Файл слишком большой (макс. 5MB)';
      errorEl.style.display = 'block';
      input.value = '';
      return;
    }

    // Показ превью
    const reader = new FileReader();
    reader.onload = (e) => {
      previewEl.style.display = 'block';
      previewEl.querySelector('img').src = e.target.result;
    };
    reader.readAsDataURL(file);
  },

  // Очистка превью
  clearPreview(container) {
    const form = document.getElementById('add-carousel-form');
    form.querySelector('input[type="file"]').value = '';
    container.querySelector('.image-preview').style.display = 'none';
    container.querySelector('.preview-image').src = '';
  },

  // Обработка отправки формы
  async handleFormSubmit(form, previewContainer) {
    const formData = new FormData(form);
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.textContent;

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Загрузка...';
      utils.handleLoading(this.section, true);

      // Отправка данных
      await API.post('/carousel', formData);
      
      // Очистка формы
      form.reset();
      this.clearPreview(previewContainer);
      await this.loadSlides();
      
      utils.showMessage('Слайд успешно добавлен', 'success');
    } catch (error) {
      utils.showMessage(`Ошибка: ${error.message}`, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
      utils.handleLoading(this.section, false);
    }
  },

  setupDeleteHandlers() {
    this.slidesList.addEventListener('click', async (e) => {
      const deleteBtn = e.target.closest('.delete-btn');
      if (!deleteBtn) return;

      const slideId = deleteBtn.dataset.id;
      const slideCard = deleteBtn.closest('.slide-card');
      const slideTitle = slideCard.querySelector('h3')?.textContent || 'Без названия';

      if (!confirm(`Удалить слайд "${slideTitle}"?`)) return;

      try {
        utils.handleLoading(this.section, true);
        await API.delete(`/carousel/${slideId}`);
        
        // Удаляем элемент из DOM
        slideCard.remove();
        
        // Проверяем пустой список
        if (!this.slidesList.children.length) {
          this.emptyState.style.display = 'flex';
        }
        
        utils.showMessage('Слайд успешно удален', 'success');
      } catch (error) {
        console.error('Ошибка удаления:', error);
        utils.showMessage('Не удалось удалить слайд', 'error');
      } finally {
        utils.handleLoading(this.section, false);
      }
    });
  },

    };



    const initForms = () => {
      document.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target.closest('form');
        if (!form) return;
    
        // Отбрасываем попытки отправить body в GET
        if (form.method.toUpperCase() === 'GET') {
          // либо просто игнорируем, либо даём браузеру сделать стандартный сабмит:
          // form.submit();
          return;
        }
    
        const container = form.closest('.admin-section') || document.body;
        utils.handleLoading(container, true);
    
        try {
          const formData = new FormData(form);
          const response = await API.request(
            form.method.toUpperCase(),
            form.dataset.action || form.action,
            formData
          );
    
          utils.showMessage('Успешно сохранено', 'success');
          if (form.method.toUpperCase() === 'POST') form.reset();
          
        } finally {
          utils.handleLoading(container, false);
        }
      });
    };
    
    const init = () => {
      // Инициализация модуля категорий
      Categories.init();
      Categories.setupDeleteHandlers();
      Products.init();
      Reviews.init();
      Orders.init();
      Carousel.init();
      initForms();
    };
  
    return {
      init,
      API
    };
  })();
  
  document.addEventListener('DOMContentLoaded', AdminManager.init);