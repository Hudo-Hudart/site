
// Логика для страницы корзины (отображение товаров в виде таблицы)
class CartPage {
    constructor() {
        // 1. Добавляем обработку ошибок при загрузке
        try {
            this.items = JSON.parse(localStorage.getItem('cart')) || [];
        } catch(e) {
            console.error('Ошибка загрузки корзины:', e);
            this.items = [];
        }
        
        // 2. Добавляем проверку структуры товаров
        this.items = this.items.filter(item => 
            item && item.id && item.name && item.price && item.quantity
        );
        
        this.initCart();
    }

    initCart() {
        this.renderCartPage();
        this.initEvents();
        this.saveCartData(); // 3. Синхронизируем при инициализации
    }

    initEvents() {
        // 4. Используем делегирование событий для динамических элементов
        document.addEventListener('click', (e) => {
            const target = e.target;
            
            if (target.closest('.checkout-btn')) {
                this.handleCheckout();
            }

            if (target.closest('.one-click-btn')) {
                this.handleQuickOrder();
            }
            
            if (target.closest('.minus')) {
                const index = target.dataset.index;
                this.updateQuantity(index, -1);
            }
            
            if (target.closest('.plus')) {
                const index = target.dataset.index;
                this.updateQuantity(index, 1);
            }
            
            if (target.closest('.remove-item')) {
                const index = target.dataset.index;
                this.removeItem(index);
            }
        });
    }

    renderCartPage() {
        const cartItemsContainer = document.getElementById('cart-items');
        const cartTotalElement = document.getElementById('cart-total');

        if (!cartItemsContainer || !cartTotalElement) {
            console.error('Элементы корзины не найдены на странице!');
            return;
        }

        cartItemsContainer.innerHTML = '';
        let totalPrice = 0;

        this.items.forEach((item, index) => {
            // 5. Добавляем проверку на валидность товара
            if(!item || typeof item !== 'object') return;
            
            const itemSum = item.price * item.quantity;
            totalPrice += itemSum;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <div class="cart-product">
                        <!-- 6. Добавляем обработку отсутствующих изображений -->
                        <img src="${item.image ? '/images/' + item.image : '/images/placeholder.webp'}" 
                             alt="${item.name}" 
                             width="50"
                             onerror="this.src='/images/placeholder.webp'">
                        <div>
                            <span>${item.name}</span><br>
                            <small>${item.weight || 'N/A'} кг</small>
                        </div>
                    </div>
                </td>
                <!-- 7. Форматируем числа -->
                <td>${item.price?.toFixed(2) || 0} ₽</td>
                <td>
                    <div class="quantity-control">
                        <button class="minus" data-index="${index}">-</button>
                        <span class="qty">${item.quantity}</span>
                        <button class="plus" data-index="${index}">+</button>
                    </div>
                </td>
                <td class="item-sum">${itemSum.toFixed(2)} ₽</td>
                <td>
                    <button class="remove-item" data-index="${index}">×</button>
                </td>
            `;

            cartItemsContainer.appendChild(row);
        });

        // 8. Обновляем общую сумму с форматированием
        cartTotalElement.textContent = totalPrice.toFixed(2);
    }

    updateQuantity(index, delta) {
        // 9. Добавляем проверку индекса
        if(!this.items[index]) return;
        
        const item = this.items[index];
        const newQuantity = item.quantity + delta;
        
        if (newQuantity < 1) {
            if(confirm('Удалить товар из корзины?')) {
                this.removeItem(index);
            }
            return;
        }
        
        item.quantity = newQuantity;
        this.saveCartData();
        this.renderCartPage();
    }

    removeItem(index) {
        // 10. Подтверждение удаления
        if(confirm('Вы уверены, что хотите удалить товар?')) {
            this.items.splice(index, 1);
            this.saveCartData();
            this.renderCartPage();
        }
    }

    saveCartData() {
        try {
            localStorage.setItem('cart', JSON.stringify(this.items));
            // 11. Уведомляем другие компоненты
            document.dispatchEvent(new CustomEvent('cart-updated'));
        } catch(e) {
            console.error('Ошибка сохранения корзины:', e);
        }
    }

    handleCheckout() {
        // 12. Добавляем базовую валидацию
        if(this.items.length === 0) {
            alert('Корзина пуста!');
            return;
        }
        
        console.log('Оформление заказа:', this.items);
        // Дополнительная логика оформления заказа...
        window.location.href = '/new-order.html';
    }

    handleQuickOrder() {
        if (this.items.length === 0) {
            alert('Корзина пуста!');
            return;
        }
        
        this.createQuickOrderModal();
        this.setupQuickOrderHandlers();
        new QuickOrderModal(this.items);
    }
    
    createQuickOrderModal() {
        const modalHTML = `
            <div class="quick-order-modal">
                <div class="modal-content">
                    <span class="close-modal">&times;</span>
                    <h3>Быстрый заказ</h3>
                    <form id="quick-order-form">
                        <input type="text" name="name" placeholder="Ваше имя" required>
                        <input type="tel" name="phone" placeholder="Телефон" pattern="\+7\d{10}" required>
                        <input type="text" name="street" placeholder="Улица">
                        <input type="text" name="house" placeholder="Дом">
                        <textarea name="comment" placeholder="Комментарий"></textarea>
                        <button type="submit">Подтвердить</button>
                    </form>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    
    setupQuickOrderHandlers() {
        const modal = document.querySelector('.quick-order-modal');
        
        modal.querySelector('.close-modal').addEventListener('click', () => {
            modal.remove();
        });
    
        modal.querySelector('form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            
            if (!this.validateQuickOrder(formData)) {
                alert('Заполните обязательные поля: Имя и Телефон');
                return;
            }
    
            const orderData = {
                items: this.items,
                customer: Object.fromEntries(formData.entries()),
                timestamp: new Date().toISOString()
            };
    
            try {
                await fetch('/api/quick-orders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(orderData)
                });
                modal.remove();
                alert('Заказ принят!');
                this.items = [];
                this.saveCartData();
                this.renderCartPage();
            } catch (error) {
                console.error('Ошибка оформления:', error);
                alert('Ошибка при отправке заказа');
            }
        });
    }
    
    validateQuickOrder(formData) {
        const name = formData.get('name')?.trim();
        const phone = formData.get('phone')?.trim();
        return name && phone && phone.match(/\+7\d{10}/);
    }
    

}

// 13. Проверяем наличие корзины на странице перед инициализацией
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.cart-page')) {
        new CartPage();
    }
});