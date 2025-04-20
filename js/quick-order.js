// js/quick-order-modal.js
 class QuickOrderModal {
    constructor(items) {
        this.items = items;
        this.init();
    }

    init() {
        this.createModal();
        this.setupEvents();
        this.initPhoneMask(); // Добавляем маску телефона
    }

    initPhoneMask() {
        const phoneInput = this.modal.querySelector('[name="phone"]');
        phoneInput.addEventListener('input', (e) => {
            const numbers = e.target.value.replace(/\D/g, '');
            let formatted = '+7';
            if (numbers.length > 1) {
                formatted += numbers.substring(1, Math.min(numbers.length, 11));
            }
            e.target.value = formatted;
        });
    }

    createModal() {
        const modalHTML = `
            <div class="quick-order-modal" style="display: flex;">
                <div class="modal-content">
                    <span class="close-modal">&times;</span>
                    <h3>Быстрый заказ</h3>
                    <form class="quick-order-form">
                        <div class="form-group">
                            <input type="text" 
                                   name="name" 
                                   placeholder="Ваше имя*" 
                                   required>
                        </div>
                        <div class="form-group">
                            <input type="tel" 
                                   name="phone" 
                                   placeholder="Телефон*" 
                                   pattern="\+7\d{10}" 
                                   required>
                        </div>
                        <div class="form-group">
                            <input type="text" 
                                   name="street" 
                                   placeholder="Улица">
                        </div>
                        <div class="form-group">
                            <input type="text" 
                                   name="house" 
                                   placeholder="Дом">
                        </div>
                        <div class="form-group">
                            <textarea name="comment" 
                                      placeholder="Комментарий"></textarea>
                        </div>
                        <button type="submit" class="submit-btn">
                            Подтвердить заказ
                        </button>
                    </form>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    setupEvents() {
        this.modal = document.querySelector('.quick-order-modal');
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });

        
        
        this.modal.querySelector('.close-modal').addEventListener('click', () => this.close());
        
        this.modal.querySelector('form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleSubmit(new FormData(e.target));
        });
    }

    async handleSubmit(formData) {
        const errorContainer = this.modal.querySelector('.error-container');
        if (errorContainer) errorContainer.innerHTML = ''; // Очистка предыдущих ошибок
        const submitBtn = this.modal.querySelector('.submit-btn');
        try {
            submitBtn.disabled = true; // Блокируем кнопку
            submitBtn.textContent = 'Отправка...';
            
            if (!this.validate(formData)) return;
            
            await this.submitOrder(formData);
            this.handleSuccess();
        } catch (error) {
            this.handleError(error);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Подтвердить заказ';
        }
    }

    validate(formData) {
        const errors = [];
        const name = formData.get('name')?.trim();
        const phone = formData.get('phone')?.replace(/\D/g, '');
        
        if (!name) errors.push('Укажите имя');
        if (!phone || phone.length !== 11) errors.push('Неверный формат телефона');
        
        if (errors.length) {
            this.showErrors(errors);
            return false;
        }
        return true;
    }

    showErrors(errors) {
        const errorContainer = this.modal.querySelector('.error-container') || 
            this.createErrorContainer();
        
        errorContainer.innerHTML = errors
            .map(error => `<div class="error-item">⚠️ ${error}</div>`)
            .join('');
    }

    createErrorContainer() {
        const container = document.createElement('div');
        container.className = 'error-container';
        this.modal.querySelector('form').prepend(container);
        return container;
    }

    async submitOrder(formData) {
        try {
            const orderData = {
                id: Date.now(),
                status: "new",
                timestamp: new Date().toISOString(),
                customer: Object.fromEntries(formData.entries()),
                items: this.items,
                total: this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
            };
    
            const response = await fetch(CONFIG.QUICK_ORDERS_DATA_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData)
            });
    
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Ошибка сервера: ${errorText}`);
            }
    
            return await response.json();
        } catch (error) {
            console.error('Ошибка сохранения заказа:', error);
            throw error;
        }
    }

    handleSuccess() {
        this.close();
      
        document.dispatchEvent(new CustomEvent('cart:clear', {
            detail: { showNotification: true }
        }));
    }

    handleError(error) {
        console.error('Ошибка:', error);
        alert('Ошибка при оформлении заказа');
    }

    close() {
        this.modal.remove();
        document.body.style.overflow = '';
    }
}