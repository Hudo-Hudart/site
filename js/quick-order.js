// quick-order-modal.js — модальное окно быстрого заказа, интеграция с MySQL API

class QuickOrderModal {
    constructor(items) {
      this.items = items;
      this.init();
    }
  
    init() {
      this.createModal();
      this.modal = document.querySelector('.quick-order-modal');
      this.setupEvents();
      this.initPhoneMask();
    }
  
    // Маска ввода телефона +7XXXXXXXXXX
    initPhoneMask() {
      const phoneInput = this.modal.querySelector('[name="customer_phone"]');
      phoneInput.addEventListener('input', e => {
        let numbers = e.target.value.replace(/\D/g, '');
        if (!numbers.startsWith('7')) {
          numbers = '7' + numbers;
        }
        numbers = numbers.substring(0, 11);
        e.target.value = '+' + numbers;
      });
    }
  
    // Создание структуры модального окна
    createModal() {
      const modalHTML = `
        <div class="quick-order-modal">
          <div class="modal-content">
            <span class="close-modal">&times;</span>
            <h3>Быстрый заказ</h3>
            <form class="quick-order-form">
              <div class="form-group">
                <input type="text" name="customer_name" placeholder="Ваше имя*" required />
              </div>
              <div class="form-group">
                <input type="tel" name="customer_phone" placeholder="Телефон +7...*" pattern="\\+7\\d{10}" required />
              </div>
              <div class="form-group">
                <input type="text" name="street" placeholder="Улица" />
              </div>
              <div class="form-group">
                <input type="text" name="house_number" placeholder="Дом" />
              </div>
              <div class="form-group">
                <textarea name="comment" placeholder="Комментарий"></textarea>
              </div>
              <button type="submit" class="submit-btn">Подтвердить заказ</button>
            </form>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', modalHTML);
      document.body.style.overflow = 'hidden';
    }
  
    // Установка обработчиков событий
    setupEvents() {
      // Закрытие по фону
      this.modal.addEventListener('click', e => {
        if (e.target === this.modal) this.close();
      });
      // Закрытие по крестику
      this.modal.querySelector('.close-modal')
        .addEventListener('click', () => this.close());
      // Отправка формы
      this.modal.querySelector('form').addEventListener('submit', async e => {
        e.preventDefault();
        await this.handleSubmit(new FormData(e.target));
      });
    }
  
    // Обработка сабмита формы
    async handleSubmit(formData) {
      const submitBtn = this.modal.querySelector('.submit-btn');
      this.clearErrors();
      submitBtn.disabled = true;
      submitBtn.textContent = 'Отправка...';
  
      if (!this.validate(formData)) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Подтвердить заказ';
        return;
      }
  
      try {
        await this.submitOrder(formData);
        this.handleSuccess();
      } catch (err) {
        this.handleError(err);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Подтвердить заказ';
      }
    }
  
    // Валидация полей
    validate(formData) {
      const errors = [];
      const name = formData.get('customer_name')?.trim();
      const phone = formData.get('customer_phone')?.replace(/\D/g, '');
      if (!name) errors.push('Укажите имя');
      if (!phone || phone.length !== 11) errors.push('Неверный формат телефона');
      if (errors.length) {
        this.showErrors(errors);
        return false;
      }
      return true;
    }
  
    // Отображение ошибок
    showErrors(errors) {
      let container = this.modal.querySelector('.error-container');
      if (!container) {
        container = document.createElement('div');
        container.className = 'error-container';
        this.modal.querySelector('form').prepend(container);
      }
      container.innerHTML = errors
        .map(err => `<div class="error-item">⚠️ ${err}</div>`)
        .join('');
    }
  
    clearErrors() {
      const container = this.modal.querySelector('.error-container');
      if (container) container.remove();
    }
  
    // Отправка заказа на сервер
    async submitOrder(formData) {
      const street = formData.get('street')?.trim() || '';
      const house_number = formData.get('house_number')?.trim() || '';
      const customer_name = formData.get('customer_name').trim();
      const customer_phone = formData.get('customer_phone').trim();
      const comment = formData.get('comment')?.trim() || '';
  
      const items = this.items.map(i => ({
        product_variant_id: i.id,
        quantity:           i.quantity,
        weight:             i.weight || 0,
        price:              i.price
      }))
      const total_amount = items
        .reduce((sum, it) => sum + it.price * it.quantity, 0);
  
      const payload = { street, house_number, customer_name, customer_phone, comment, total_amount, items };
  
      const res = await fetch('/api/quick-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`Сервер вернул ${res.status}`);
      return res.json();
    }
  
    // При успешном заказе
    handleSuccess() {
      this.close();

    // 2) очищаем localStorage
    localStorage.removeItem('cart');

    // 3) оповещаем все слушатели — CartPage & мини‑корзина в шапке
    document.dispatchEvent(new Event('cart-updated'));

    // 4) …и перезагружаем страницу, чтобы сбросить текущее отображение корзины
    //    (либо, если вам нужна именно страница /cart.html, можно window.location.href = '/cart.html')
    window.location.reload();
  }
  
    handleError(err) {
      console.error('Ошибка оформления быстрого заказа:', err);
      this.showErrors([err.message || 'Ошибка при оформлении заказа']);
    }
  
    // Закрытие модального окна
    close() {
      this.modal.remove();
      document.body.style.overflow = '';
    }
  }
  
  // Экспорт или глобальное присвоение
  window.QuickOrderModal = QuickOrderModal;
  