// Базовый класс для избранного, сравнения и корзины
class Collection {
    constructor(key) {
        this.key = key;
        this.items = JSON.parse(localStorage.getItem(this.key)) || [];
        this.initEvents();
        this.updateDisplay();
    }

    initEvents() {
        document.addEventListener('click', (e) => {
            if (e.target.closest(`.${this.key} .clear-all`)) this.clearAll();
            if (e.target.closest(`.${this.key} .remove-item`)) {
                const id = parseInt(e.target.dataset.id);
                this.removeItem(id);
            }
        });
    }

    addItem(product, quantity, weight) { 
        const existingItem = this.items.find(item => 
            item.id === product.id && item.weight === weight
        );

        if (existingItem) existingItem.quantity += quantity;
        else this.items.push({...product, quantity, weight, addedAt: new Date().toISOString()});
        
        this.saveCollection();
    }

    removeItem(id) {
        this.items = this.items.filter(item => item.id !== id);
        this.saveCollection();
    }

    clearAll() {
        this.items = [];
        this.saveCollection();
    }

    saveCollection() {
        localStorage.setItem(this.key, JSON.stringify(this.items));
        this.updateDisplay();
    }

    updateDisplay() {
        const container = document.querySelector(`.${this.key} .items-list`);
        const counter = document.querySelector(`.${this.key} .counter`);
        const emptyMsg = document.querySelector(`.${this.key} .empty-message`);
        if (!container || !counter || !emptyMsg) return;

        const totalItems = this.items.reduce((sum, item) => sum + item.quantity, 0);
        const totalPrice = this.items.reduce((sum, item) => sum + item.quantity * item.price, 0);

        container.innerHTML = this.items.length === 0 ? 
            this.getEmptyTemplate() : 
            this.getFilledTemplate(totalItems, totalPrice);

        counter.textContent = totalItems > 0 ? totalItems : '';
        counter.style.display = totalItems > 0 ? 'flex' : 'none';
        emptyMsg.style.display = this.items.length === 0 ? 'block' : 'none';
    }

    getEmptyTemplate() {
        return '';
    }

    getFilledTemplate(totalItems, totalPrice) {
        return `
            <div class="cart-summary">
                <p>В вашей корзине <strong>${totalItems}</strong> товар(ов) на сумму <strong>${totalPrice} руб</strong></p>
            </div>
            ${this.items.map(item => this.getItemTemplate(item)).join('')}
            <div class="cart-actions">
                <a href="/cart.html" class="open-cart">Открыть корзину</a>
                <a href="/new-order.html" class="open-cart">Оформить заказ</a>
            </div>
        `;
    }

    getItemTemplate(item) {
        const itemTotal = item.price * item.quantity;
        return `
            <div class="cart-item">
                <img src="/images/${item.image}" alt="${item.name}" width="50" 
                     onerror="this.src='/images/placeholder.png'" />
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name} (${item.weight} кг)</div>
                    <div class="cart-item-quantity">
                        ${item.quantity} × ${item.price} ₽ = <strong>${itemTotal} ₽</strong>
                    </div>
                </div>
                <button class="remove-item" data-id="${item.id}">🗑</button>
            </div>`;
    }
}

// FIXED: Упрощенный класс Cart с обновлением счетчика
class Cart extends Collection {
    constructor() { super('cart'); }
    
    updateDisplay() {
        super.updateDisplay();
        document.querySelectorAll('.cart .counter').forEach(counter => {
            const total = this.items.reduce((sum, item) => sum + item.quantity, 0);
            counter.textContent = total > 0 ? total : '';
        });
    }
}

class Favorites extends Collection {
    constructor() {
      super('favorites');
  
      // Элементы дропдауна
      this.dropdown      = document.querySelector('.icon-dropdown.favorites');
    if (!this.dropdown) return;  // если дропдауна нет — нафиг
    this.content       = this.dropdown.querySelector('.dropdown-content');
    this.counterGlobal = this.dropdown.querySelector('.counter');
    this.headerTitle   = this.content.querySelector('.dropdown-header h4');
    this.itemsList     = this.content.querySelector('.items-list');
    this.emptyMsg      = this.content.querySelector('.empty-message');
    this.footer        = this.content.querySelector('.dropdown-footer');

    this.content.addEventListener('click', e => {
      const rem = e.target.closest('.remove-item');
      if (rem) { this.toggleFavorite({ id: +rem.dataset.id }); return; }
      if (e.target.closest('.clear-all')) { this.clearAll(); }
    });

    this.updateDisplay();
  }
  
    toggleFavorite(product) {
      if (!product?.id) return;
      const idx = this.items.findIndex(i => i.id === product.id);
      if (idx !== -1) this.items.splice(idx, 1);
      else this.items.push(product);
      this.saveCollection();
    }
  
    // Перерисовка дропдауна
    updateDisplay() {
        if (!this.content) return;

        const count = this.items.length;
    
        // Шапка
        this.headerTitle.textContent = `Избранное${count>0? ` (${count})` : ''}`;
    
        // Счётчик на иконе
        this.counterGlobal.textContent = count||'';
        this.counterGlobal.style.display = count ? 'inline-flex' : 'none';
    
        // Список, пустой блок, футер
        this.itemsList.innerHTML = count ? this.getFilledTemplate() : '';
        this.emptyMsg.classList.toggle('hidden', count>0);
        if (this.footer) {
          this.footer.classList.toggle('hidden', count===0);
        }
    }
  
    getEmptyTemplate() {
      return `
        <div class="empty-favorites">
          <img src="/images/heart.png" alt="Избранное" class="empty-icon">
          <span>В вашем избранном пока пусто</span>
        </div>`;
    }
  
    getFilledTemplate() {
        return this.items.map(item => this.getItemTemplate(item)).join('');
      }
      
      getItemTemplate(item) {
        return `
          <div class="favorite-item">
            <img src="/images/${item.image}"
                 class="favorite-item-img"
                 onerror="this.src='/images/placeholder.png'"
                 alt="${item.name}">
            <span class="favorite-item-title">${item.name}</span>
            <button class="remove-item" data-id="${item.id}">
              <svg width="12" height="12" viewBox="0 0 14 14">
                <path d="M1 13L13 1M1 1L13 13"
                      stroke="currentColor" stroke-width="2"/>
              </svg>
            </button>
          </div>`;
      }
  }

  


// FIXED: Инициализация только ОДИН РАЗ
const favorites = new Favorites();
window.favorites = favorites;
const compare = new Collection('compare');
const cart = new Cart();

document.addEventListener('click', (e) => {
    if (e.target.closest('.add-to-favorites')) {
        const button = e.target.closest('.add-to-favorites');
        // Предполагаем, что данные товара сохранены в data-атрибутах
        const product = {
            id: parseInt(button.dataset.id),
            name: button.dataset.name,
            price: parseFloat(button.dataset.price),
            image: button.dataset.image,
            // можно добавить другие свойства, если нужно
        };

        favorites.toggleFavorite(product);

        // Дополнительно можно изменить состояние кнопки (например, добавить/убрать класс "active")
        button.classList.toggle('active');
    }
});

// FIXED: Улучшенная обработка авторизации
// FIXED: Улучшенная обработка авторизации
// FIXED: Улучшенная обработка авторизации
document.addEventListener('DOMContentLoaded', () => {
    const authElements = {
        authButtons: document.querySelector('.auth-buttons'),
        userInfo: document.getElementById('userInfo'),
        logoutBtn: document.getElementById('logoutBtn'),
        adminPanelBtn: document.getElementById('adminPanelBtn'),
        currentUserEmail: document.getElementById('currentUserEmail'),
        loginBtn: document.querySelector('.login-btn'),
        registerBtn: document.querySelector('.register-btn')
    };

    // 2. Функция обновления интерфейса
    const updateAuthUI = (user) => {
        if (authElements.authButtons) authElements.authButtons.style.display = user ? 'none' : 'block';
        if (authElements.userInfo) authElements.userInfo.style.display = user ? 'block' : 'none';
        if (user && authElements.currentUserEmail) authElements.currentUserEmail.textContent = user.email;
        if (authElements.adminPanelBtn) authElements.adminPanelBtn.style.display = user?.role === 'admin' ? 'block' : 'none';
    };

    // 3. Обработчик выхода
    authElements.logoutBtn?.addEventListener('click', () => {
        localStorage.removeItem('currentUser');
        window.location.href = '/index.html';
    });

    try {
        const user = JSON.parse(localStorage.getItem('currentUser'));
        updateAuthUI(user);
    } catch (error) {
        localStorage.removeItem('currentUser');
        updateAuthUI(null);
    }

    // 4. Инициализация при загрузке
    const initAuth = () => {
        try {
            const user = JSON.parse(localStorage.getItem('currentUser'));
            updateAuthUI(user);
        } catch (error) {
            console.error('Ошибка чтения данных:', error);
            localStorage.removeItem('currentUser');
            updateAuthUI(null);
        }
    };
    initAuth();

    // 5. Обработчики кнопок с защитой от null
    const safeAddListener = (element, event, handler) => element?.addEventListener(event, handler);
    safeAddListener(authElements.loginBtn, 'click', () => window.location.href = '/login.html');
    safeAddListener(authElements.registerBtn, 'click', () => window.location.href = '/register.html');
    safeAddListener(authElements.adminPanelBtn, 'click', (e) => {
        e.preventDefault();
        window.location.href = '/admin.html';
    });
});

// FIXED: Улучшенная карусель с проверкой элементов
class Carousel {
    constructor() {
        this.carousel = document.querySelector('.carousel');
        if (!this.carousel) return;

        this.slides = document.querySelectorAll('.slide');
        this.dotsContainer = document.querySelector('.carousel-dots');
        this.currentIndex = 0;
        this.interval = null;
        
        this.initDots();
        this.startAutoPlay();
        this.addEventListeners();
        this.goToSlide(0);
    }

    initDots() {
        this.dotsContainer.innerHTML = '';
        
        this.slides.forEach((_, index) => {
            const dot = document.createElement('span');
            dot.className = `dot ${index === 0 ? 'active' : ''}`; // Исправлены кавычки и пробел
            dot.addEventListener('click', () => this.goToSlide(index));
            this.dotsContainer.appendChild(dot);
        });
        this.dots = document.querySelectorAll('.dot');
    }

    goToSlide(index) {
        this.currentIndex = index;
        const translateValue = -100 * this.currentIndex;
        this.carousel.style.transform = `translateX(${translateValue}%)`; // Исправлены кавычки
        
        this.dots.forEach(dot => dot.classList.remove('active'));
        this.dots[this.currentIndex].classList.add('active');
    }

    nextSlide() {
        this.currentIndex = (this.currentIndex + 1) % this.slides.length;
        this.goToSlide(this.currentIndex);
    }

    startAutoPlay() {
        if (this.interval) clearInterval(this.interval);
        this.interval = setInterval(() => this.nextSlide(), 5000);
    }

    addEventListeners() {
        
        this.carousel?.addEventListener('mouseenter', () => clearInterval(this.interval));
        this.carousel?.addEventListener('mouseleave', () => this.startAutoPlay());
    }
}

// Инициализация только при наличии элементов
if (document.querySelector('.carousel')) {
    new Carousel();
}

// Динамическое меню каталога =============================================
// Динамическое меню каталога =============================================
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.catalog-dropdown')) {
        initDynamicCatalog();
    }
});

// Объявляем функции ДО их использования
function createCategoryColumn(category) {
    const column = document.createElement('div');
    column.className = 'category-col';
    column.innerHTML = `
        <div class="category-header compact">
            <img src="/images/categories/${category.id}.webp" 
                 alt="${category.name}" 
                 class="category-icon-small"
                 onerror="this.src='/images/categories/placeholder.webp'">
            <h3>${category.name}</h3>
        </div>
        <div class="subcategories-compact-grid">
            ${category.subcategories.map(sub => `
                <a href="/category/${sub.id}" 
                   data-subcategory-id="${sub.id}"
                   class="${sub.subcategories ? 'has-children' : ''}">
                    ${sub.name}
                </a>
            `).join('')}
        </div>
    `;
    return column;
}

function createCombinedColumn(categories) {
    const column = document.createElement('div');
    column.className = 'category-col combined';
    column.innerHTML = categories.map(category => `
        <div class="category-block" data-category-id="${category.id}">
            <div class="category-header compact">
                <img src="/images/categories/${category.id}.webp" 
                     alt="${category.name}" 
                     class="category-icon-small"
                     onerror="this.src='/images/categories/placeholder.webp'">
                <h3>${category.name}</h3>
            </div>
            <div class="subcategories-compact-grid">
                ${category.subcategories.map(sub => `
                    <a href="/category/${sub.id}" 
                       data-subcategory-id="${sub.id}">
                        ${sub.name}
                    </a>
                `).join('')}
            </div>
        </div>
    `).join('');
    return column;
}

async function initDynamicCatalog() {
    if (!document.querySelector('.catalog-dropdown')) return;
    let catalogMenu;
    
    try {
        const response = await fetch('/data/categories.json');
        if (!response.ok) throw new Error('Ошибка загрузки категорий');
        const data = await response.json();
        
        catalogMenu = document.querySelector('.catalog-menu');
        if (!catalogMenu) throw new Error('Элемент меню не найден');
        
        catalogMenu.innerHTML = '';
        
        // Разделение категорий
        const {mainCategories, combinedCategories} = data.categories.reduce((acc, category) => {
            const hasMultipleSubs = category.subcategories?.length > 1;
            hasMultipleSubs ? acc.mainCategories.push(category) : acc.combinedCategories.push(category);
            return acc;
        }, {mainCategories: [], combinedCategories: []});

        // Добавление категорий
        mainCategories.forEach(category => {
            catalogMenu.appendChild(createCategoryColumn(category));
        });

        if (combinedCategories.length > 0) {
            const combinedColumn = createCombinedColumn(combinedCategories);
            catalogMenu.appendChild(combinedColumn);
        }

    } catch (error) {
        console.error('Ошибка каталога:', error);
        if (catalogMenu) {
            catalogMenu.innerHTML = '<div class="error">Ошибка загрузки меню</div>';
        }
    }
}

// Обработчики меню
document.querySelector('.catalog-btn')?.addEventListener('mouseenter', () => {
    document.querySelector('.catalog-menu').classList.add('active');
});

document.querySelector('.catalog-dropdown')?.addEventListener('mouseleave', (e) => {
    if (!e.relatedTarget?.closest('.catalog-dropdown')) {
        document.querySelector('.catalog-menu').classList.remove('active');
    }
});
// ========================================================================
// ========================================================================

/*Прокрутка*/
document.addEventListener("DOMContentLoaded", function () {
    const nav = document.querySelector('.main-nav');
    if (nav) {
        const navOffsetTop = nav.offsetTop;
        window.addEventListener('scroll', function () {
            nav.classList.toggle('sticky', window.scrollY > navOffsetTop);
        });
    }
});


// Отзывы =============================================

class TestimonialCarousel {
    constructor() {
        this.container = document.querySelector('.testimonial-carousel');
        if (!this.container) return;
        
        this.elements = {
            track: this.container.querySelector('.carousel-track'),
            prevBtn: this.container.querySelector('.carousel-btn.prev'),
            nextBtn: this.container.querySelector('.carousel-btn.next'),
            indicators: this.container.querySelector('.carousel-indicators')
        };
        
        this.currentIndex = 0;
        this.autoPlayInterval = null;
        this.reviews = [];
        
        this.init();
    }

    async init() {
        await this.loadReviews();
        this.render();
        this.setupEventListeners();
        this.startAutoPlay();
    }

    async loadReviews() {
        try {
            const response = await fetch('/data/approved-reviews.json');
            this.reviews = await response.json();
        } catch (error) {
            console.error('Ошибка загрузки отзывов:', error);
            this.reviews = [];
        }
    }

    render() {
        this.elements.track.innerHTML = this.reviews
            .map(review => this.createSlide(review))
            .join('');

        this.createIndicators();
        this.updateActiveState();
    }

    createSlide(review) {
        return `
            <div class="carousel-slide">
            <img src="${review.avatar || `/images/reviews/review_${review.id}.jpg`}" 
                 alt="Фото ${review.author}" 
                 class="testimonial-avatar"
                 width="100"
                 height="100"
                 onerror="this.src='/images/reviews/placeholder.png'; this.alt='Фото недоступно'">
                <ul class="testimonial-list">
                    ${review.content.split('\n')
                        .map(line => line.trim())
                        .filter(line => line)
                        .map(line => `<li>${line}</li>`)
                        .join('')}
                </ul>
                <time>${new Date(review.created_at).toLocaleDateString()}</time>
            </div>`;
    }

    createIndicators() {
        this.elements.indicators.innerHTML = this.reviews
            .map((_, i) => `
                <span class="indicator ${i === 0 ? 'active' : ''}" 
                      data-slide-to="${i}"></span>`)
            .join('');
    }

    goToSlide(index) {
        if (index < 0) index = this.reviews.length - 1;
        if (index >= this.reviews.length) index = 0;
        
        this.currentIndex = index;
        this.elements.track.style.transform = 
            `translateX(-${this.currentIndex * 100}%)`;
        
        this.updateActiveState();
    }

    updateActiveState() {
        this.container.querySelectorAll('.indicator').forEach((indicator, i) => {
            indicator.classList.toggle('active', i === this.currentIndex);
        });
    }

    setupEventListeners() {
        this.elements.prevBtn.addEventListener('click', () => 
            this.goToSlide(this.currentIndex - 1));
        
        this.elements.nextBtn.addEventListener('click', () => 
            this.goToSlide(this.currentIndex + 1));
        
        this.elements.indicators.addEventListener('click', e => {
            const indicator = e.target.closest('.indicator');
            if (!indicator) return;
            this.goToSlide(parseInt(indicator.dataset.slideTo));
        });
    }

    startAutoPlay() {
        this.autoPlayInterval = setInterval(() => 
            this.goToSlide(this.currentIndex + 1), 7000);
        
        this.container.addEventListener('mouseenter', () => 
            clearInterval(this.autoPlayInterval));
        
        this.container.addEventListener('mouseleave', () => 
            this.startAutoPlay());
    }
}

// Модальное окно отзывов
class ReviewForm {
    constructor() {
        this.modal = document.getElementById('add-review-form');
    this.form = this.modal.querySelector('#reviewForm'); // Изменено
    
    if (!this.modal || !this.form) {
      console.warn('Элементы формы отзыва не найдены');
      return;
    }

        this.ratingInput = this.form.querySelector('input[name="rating"]');
        if (!this.ratingInput) {
            console.error('Не найдено поле для рейтинга');
            return;
        }

        this.ratingGroup = this.form.querySelector('.rating-group');
        /*document.addEventListener('DOMContentLoaded', () => {
            new TestimonialCarousel();
            
            const reviewModal = document.getElementById('add-review-form');
            const reviewForm = reviewModal?.querySelector('#reviewForm');
            
            if (reviewModal && reviewForm) {
              new ReviewForm();
            } else {
              console.log('Review form elements not found');
            }
          });*/
        this.init();
    }

    
    
    

    init() {

        const links = document.querySelectorAll('.add-review a');
        if (links.length > 0) {
            links.forEach(link => {
                link.addEventListener('click', e => {
                    e.preventDefault();
                    this.openModal();
                });
            });
        }

        // Остальные обработчики
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') this.closeModal();
        });

        const closeBtn = this.modal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal());
        }

     

        const stars = this.form.querySelectorAll('.star');
        if (stars.length > 0) {
            stars.forEach(star => {
                star.addEventListener('click', () => this.setRating(star));
            });
        }

        this.form.addEventListener('submit', e => this.submitForm(e));

        // Выбор рейтинга
        this.form.querySelectorAll('.star').forEach(star => {
            star.addEventListener('click', () => this.setRating(star));
        });
    }

    setRating(selectedStar) {
        const value = parseInt(selectedStar.dataset.value);
        this.ratingInput.value = value;
        
        // Убираем все активные классы
        this.form.querySelectorAll('.star').forEach(star => {
          star.classList.remove('active');
        });
        
        // Добавляем активные классы выбранным звездам
        this.form.querySelectorAll('.star').forEach(star => {
          if(parseInt(star.dataset.value) <= value) {
            star.classList.add('active');
          }
        });
        
        this.ratingGroup.classList.remove('error');
      }

    validateForm() {
        let isValid = true;
        
        // Проверка текстовых полей
        this.form.querySelectorAll('[required]').forEach(field => {
            const group = field.closest('.form-group');
            if (!field.value.trim()) {
                group.classList.add('error');
                group.querySelector('.error-message').textContent = 'Обязательное поле';
                isValid = false;
            } else {
                group.classList.remove('error');
            }
        });

        // Специальная проверка рейтинга
        if (!this.ratingInput.value) {
            this.ratingGroup.classList.add('error');
            this.ratingGroup.querySelector('.error-message').textContent = 'Поставьте оценку';
            isValid = false;
        } else {
            this.ratingGroup.classList.remove('error');
        }

        return isValid;
    }

    async submitForm(e) {
        e.preventDefault();
        if (!this.validateForm()) return;
      
        const formData = {
          author: this.form.name.value.trim(),
          email: this.form.email.value.trim(),
          phone: this.form.phone.value.trim() || null,
          rating: parseInt(this.ratingInput.value),
          content: this.form.content.value.trim()
        };
      
        try {
          const response = await fetch('http://localhost:3000/api/save-review', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
          });
      
          // Проверка ответа сервера
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
      
          const result = await response.json();
          if (result.success) {
            this.closeModal();
            alert('✅ Отзыв успешно отправлен!');
            this.form.reset();
            this.form.querySelectorAll('.star').forEach(s => s.classList.remove('active'));
          } else {
            throw new Error(result.error || 'Неизвестная ошибка');
          }
      
        } catch (error) {
          console.error('Ошибка:', error);
          alert(`❌ Ошибка отправки: ${error.message}`);
        }
      }

    openModal() {
        console.log('Opening modal'); // Отладочное сообщение
        this.modal.classList.add('show');
        document.body.classList.add('modal-open');
        this.modal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Блокируем скролл
    }


    closeModal() {
        console.log('Closing modal'); // Отладочное сообщение
        this.modal.classList.remove('show');
        document.body.classList.remove('modal-open');
        this.modal.style.display = 'none';
        document.body.style.overflow = ''; // Восстанавливаем скролл
        this.form.reset();
        this.form.querySelectorAll('.error').forEach(el => 
            el.classList.remove('error'));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Инициализация карусели отзывов
    new TestimonialCarousel();

    // Инициализация формы только при наличии элементов
    if (document.getElementById('add-review-form') && 
        document.getElementById('reviewForm')) {
        new ReviewForm();
    }
});

// Инициализация после загрузки страницы
document.addEventListener('DOMContentLoaded', () => {
    new TestimonialCarousel();
});