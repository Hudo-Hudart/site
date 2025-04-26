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
        this.dropdown      = document.querySelector('.icon-dropdown.favorites');
        if (!this.dropdown) return;
        this.content       = this.dropdown.querySelector('.dropdown-content');
        this.counterGlobal = this.dropdown.querySelector('.counter');
        this.headerTitle   = this.content.querySelector('.dropdown-header h4');
        this.itemsList     = this.content.querySelector('.items-list');
        this.emptyMsg      = this.content.querySelector('.empty-message');
        this.footer        = this.content.querySelector('.dropdown-footer');

        this.content.addEventListener('click', e => {
            if (e.target.closest('.remove-item')) { this.toggleFavorite({ id: +e.target.dataset.id }); return; }
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

    updateDisplay() {
        if (!this.content) return;
        const count = this.items.length;
        this.headerTitle.textContent = `Избранное${count>0? ` (${count})` : ''}`;
        this.counterGlobal.textContent = count||'';
        this.counterGlobal.style.display = count ? 'inline-flex' : 'none';
        this.itemsList.innerHTML = count ? this.getFilledTemplate() : '';
        this.emptyMsg.classList.toggle('hidden', count>0);
        if (this.footer) this.footer.classList.toggle('hidden', count===0);
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
            <img src="/images/${item.image}" alt="${item.name}" class="favorite-item-img"
                 onerror="this.src='/images/placeholder.png'">
            <span class="favorite-item-title">${item.name}</span>
            <button class="remove-item" data-id="${item.id}">
              <svg width="12" height="12" viewBox="0 0 14 14">
                <path d="M1 13L13 1M1 1L13 13" stroke="currentColor" stroke-width="2"/>
              </svg>
            </button>
          </div>`;
    }
}

const favorites = new Favorites();
window.favorites = favorites;
const compare = new Collection('compare');
const cart = new Cart();

// Динамическое меню каталога
async function initDynamicCatalog() {
    const catalogDropdown = document.querySelector('.catalog-dropdown');
    if (!catalogDropdown) return;
    const catalogMenu = document.querySelector('.catalog-menu');
    if (!catalogMenu) return;

    try {
        const response = await fetch('/api/categories');
        if (!response.ok) throw new Error('Ошибка загрузки категорий');
        const categories = await response.json();

        // Построение иерархии
        const top = categories.filter(c => c.parent_id === null);
        const nested = top.map(cat => ({
            ...cat,
            subcategories: categories.filter(sub => sub.parent_id === cat.id)
        }));

        // Разделение
        const { mainCategories, combinedCategories } = nested.reduce((acc, category) => {
            (category.subcategories.length > 1 ? acc.mainCategories : acc.combinedCategories)
                .push(category);
            return acc;
        }, { mainCategories: [], combinedCategories: [] });

        catalogMenu.innerHTML = '';
        mainCategories.forEach(category => catalogMenu.appendChild(createCategoryColumn(category)));
        if (combinedCategories.length) {
            catalogMenu.appendChild(createCombinedColumn(combinedCategories));
        }
    } catch (error) {
        console.error('Ошибка каталога:', error);
        const catalogMenu = document.querySelector('.catalog-menu');
        if (catalogMenu) catalogMenu.innerHTML = '<div class="error">Ошибка загрузки меню</div>';
    }
}

function createCategoryColumn(category) {
    const column = document.createElement('div');
    column.className = 'category-col';
    column.innerHTML = `
        <div class="category-header compact">
            <img src="/images/categories/${category.id}.webp" alt="${category.name}" 
                 class="category-icon-small" onerror="this.src='/images/categories/placeholder.webp'">
            <h3>${category.name}</h3>
        </div>
        <div class="subcategories-compact-grid">
            ${category.subcategories.map(sub => `
                <a href="/category/${sub.id}" data-subcategory-id="${sub.id}">${sub.name}</a>
            `).join('')}
        </div>
    `;
    return column;
}

function createCombinedColumn(categories) {
    const column = document.createElement('div');
    column.className = 'category-col combined';
    column.innerHTML = categories.map(category => `
        <div class="category-block">
            <div class="category-header compact">
                <img src="/images/categories/${category.id}.webp" alt="${category.name}" 
                     class="category-icon-small" onerror="this.src='/images/categories/placeholder.webp'">
                <h3>${category.name}</h3>
            </div>
            <div class="subcategories-compact-grid">
                ${category.subcategories.map(sub => `
                    <a href="/category/${sub.id}" data-subcategory-id="${sub.id}">${sub.name}</a>
                `).join('')}
            </div>
        </div>`).join('');
    return column;
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelector('.catalog-btn')?.addEventListener('mouseenter', () =>
        document.querySelector('.catalog-menu').classList.add('active')
    );
    document.querySelector('.catalog-dropdown')?.addEventListener('mouseleave', e => {
        if (!e.relatedTarget?.closest('.catalog-dropdown'))
            document.querySelector('.catalog-menu').classList.remove('active');
    });
    if (document.querySelector('.catalog-dropdown')) initDynamicCatalog();
});

// Карусель отзывов и загрузка из MySQL
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
            const response = await fetch('/api/reviews/approved');
            if (!response.ok) throw new Error('Ошибка загрузки отзывов');
            const rows = await response.json();
            this.reviews = rows.map(r => ({
                id: r.id,
                author: r.author_name,
                content: r.comment,
                created_at: r.created_at,
                avatar: r.avatar_url || null
            }));
        } catch (error) {
            console.error('Ошибка загрузки отзывов:', error);
            this.reviews = [];
        }
    }

    render() {
        this.elements.track.innerHTML = this.reviews.map(review => this.createSlide(review)).join('');
        this.createIndicators();
        this.updateActiveState();
    }

    createSlide(review) {
        return `\
            <div class="carousel-slide">\
            <img src="${review.avatar || `/images/reviews/review_${review.id}.jpg`}" alt="Фото ${review.author}" class="testimonial-avatar" width="100" height="100" onerror="this.src='/images/reviews/placeholder.png'">\
                <ul class="testimonial-list">\
                    ${review.content.split('\n').map(line => line.trim()).filter(line => line).map(line => `<li>${line}</li>`).join('')}\
                </ul>\
                <time>${new Date(review.created_at).toLocaleDateString()}</time>\
            </div>`;
    }

    createIndicators() {
        this.elements.indicators.innerHTML = this.reviews.map((_, i) => `\
                <span class="indicator ${i === 0 ? 'active' : ''}" data-slide-to="${i}"></span>`).join('');
    }

    goToSlide(index) {
        if (index < 0) index = this.reviews.length - 1;
        if (index >= this.reviews.length) index = 0;
        this.currentIndex = index;
        this.elements.track.style.transform = `translateX(-${this.currentIndex * 100}%)`;
        this.updateActiveState();
    }

    updateActiveState() {
        this.container.querySelectorAll('.indicator').forEach((indicator, i) => {
            indicator.classList.toggle('active', i === this.currentIndex);
        });
    }

    setupEventListeners() {
        this.elements.prevBtn.addEventListener('click', () => this.goToSlide(this.currentIndex - 1));
        this.elements.nextBtn.addEventListener('click', () => this.goToSlide(this.currentIndex + 1));
        this.elements.indicators.addEventListener('click', e => {
            const ind = e.target.closest('.indicator');
            if (!ind) return;
            this.goToSlide(+ind.dataset.slideTo);
        });
    }

    startAutoPlay() {
        this.autoPlayInterval = setInterval(() => this.goToSlide(this.currentIndex + 1), 7000);
        this.container.addEventListener('mouseenter', () => clearInterval(this.autoPlayInterval));
        this.container.addEventListener('mouseleave', () => this.startAutoPlay());
    }
}

// Модальное окно отзывов
class ReviewForm {
    constructor() {
        this.modal = document.getElementById('add-review-form');
        this.form = this.modal?.querySelector('#reviewForm');
        if (!this.modal || !this.form) return;
        this.ratingInput = this.form.querySelector('input[name="rating"]');
        this.ratingGroup = this.form.querySelector('.rating-group');
        this.init();
    }

    init() {
        this.form.addEventListener('submit', e => this.submitForm(e));
        this.form.querySelectorAll('.star').forEach(star => star.addEventListener('click', () => this.setRating(star)));
        this.modal.querySelector('.modal-close')?.addEventListener('click', () => this.closeModal());
        document.querySelectorAll('.add-review a').forEach(link => link.addEventListener('click', e => {
            e.preventDefault(); this.openModal();
        }));
        document.addEventListener('keydown', e => { if (e.key === 'Escape') this.closeModal(); });
    }

    setRating(star) {
        const val = +star.dataset.value;
        this.ratingInput.value = val;
        this.form.querySelectorAll('.star').forEach(s => s.classList[val >= +s.dataset.value ? 'add' : 'remove']('active'));
        this.ratingGroup.classList.remove('error');
    }

    validateForm() {
        let valid = true;
        this.form.querySelectorAll('[required]').forEach(field => {
            const grp = field.closest('.form-group');
            if (!field.value.trim()) { grp.classList.add('error'); grp.querySelector('.error-message').textContent = 'Обязательное поле'; valid = false; }
            else grp.classList.remove('error');
        });
        if (!this.ratingInput.value) { this.ratingGroup.classList.add('error'); valid = false; }
        return valid;
    }

    async submitForm(e) {
        e.preventDefault(); if (!this.validateForm()) return;
        const productId = this.form.dataset.productId || null;
        const payload = {
            author_name: this.form.name.value.trim(),
            email: this.form.email.value.trim(),
            phone: this.form.phone.value.trim() || null,
            rating: +this.ratingInput.value,
            comment: this.form.content.value.trim(),
            product_id: +productId
        };
        try {
            const res = await fetch('/api/reviews', {
                method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error(res.statusText);
            const result = await res.json();
            if (result.id) {
                this.closeModal(); alert('✅ Отзыв успешно отправлен!'); this.form.reset();
                this.form.querySelectorAll('.star').forEach(s => s.classList.remove('active'));
            } else throw new Error('Ошибка сервера');
        } catch (err) {
            console.error(err); alert(`❌ Ошибка отправки: ${err.message}`);
        }
    }

    openModal() {
        this.modal.classList.add('show'); document.body.classList.add('modal-open');
        this.modal.style.display = 'block'; document.body.style.overflow = 'hidden';
    }

    closeModal() {
        this.modal.classList.remove('show'); document.body.classList.remove('modal-open');
        this.modal.style.display = 'none'; document.body.style.overflow = '';
        this.form.reset(); this.form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
    }
}

// Инициализация всех компонентов
window.addEventListener('DOMContentLoaded', () => {
    // Карусель отзывов
    new TestimonialCarousel();
    // Модальное окно отзывов
    if (document.getElementById('add-review-form') && document.getElementById('reviewForm')) new ReviewForm();

    // Обработчик добавления в избранное
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.add-to-favorites');
        if (!btn) return;
        const product = {
            id: +btn.dataset.id,
            name: btn.dataset.name,
            price: +btn.dataset.price,
            image: btn.dataset.image
        };
        favorites.toggleFavorite(product);
        btn.classList.toggle('active');
    });

    // Обработка авторизации
    const authElements = {
        authButtons: document.querySelector('.auth-buttons'),
        userInfo: document.getElementById('userInfo'),
        logoutBtn: document.getElementById('logoutBtn'),
        adminPanelBtn: document.getElementById('adminPanelBtn'),
        currentUserEmail: document.getElementById('currentUserEmail'),
        loginBtn: document.querySelector('.login-btn'),
        registerBtn: document.querySelector('.register-btn')
    };
    const updateAuthUI = (user) => {
        if (authElements.authButtons) authElements.authButtons.style.display = user ? 'none' : 'block';
        if (authElements.userInfo) authElements.userInfo.style.display = user ? 'block' : 'none';
        if (user && authElements.currentUserEmail) authElements.currentUserEmail.textContent = user.email;
        if (authElements.adminPanelBtn) authElements.adminPanelBtn.style.display = user?.role === 'admin' ? 'block' : 'none';
    };
    authElements.logoutBtn?.addEventListener('click', () => {
        localStorage.removeItem('currentUser');
        updateAuthUI(null);
        window.location.href = '/index.html';
    });
    try {
        const user = JSON.parse(localStorage.getItem('currentUser'));
        updateAuthUI(user);
    } catch {
        localStorage.removeItem('currentUser');
        updateAuthUI(null);
    }
    authElements.loginBtn?.addEventListener('click', () => window.location.href = '/login.html');
    authElements.registerBtn?.addEventListener('click', () => window.location.href = '/register.html');
    authElements.adminPanelBtn?.addEventListener('click', (e) => { e.preventDefault(); window.location.href = '/admin.html'; });

    // Баннерная карусель
    if (document.querySelector('.carousel')) new Carousel();

    // Прилипание навигации
    const nav = document.querySelector('.main-nav');
    if (nav) {
        const topOffset = nav.offsetTop;
        window.addEventListener('scroll', () => {
            nav.classList.toggle('sticky', window.scrollY > topOffset);
        });
    }
});
