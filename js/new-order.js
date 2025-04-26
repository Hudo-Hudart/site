// new-order.js — логика страницы оформления заказа через MySQL API

document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.checkout-page')) new CheckoutPage();
  });
  
  class CheckoutPage {
    constructor() {
      this.form = document.getElementById('checkout-form');
      if (!this.form) return;
  
      // Загрузка корзины
      try {
        this.cartItems = JSON.parse(localStorage.getItem('cart')) || [];
      } catch (e) {
        console.error('Ошибка загрузки корзины:', e);
        this.cartItems = [];
      }
      // Если корзина пуста, перенаправляем
      if (!this.cartItems.length) {
        window.location.href = '/cart.html';
        return;
      }
  
      this.init();
    }
  
    async init() {
      await this.loadLocations();
      this.populateLocationDatalist();
      this.setupEventListeners();
      this.initLocationAutocomplete();
  
      // Начальный пересчёт доставки, если введено значение
      const input = document.getElementById('location-input');
      if (input && input.value) {
        const loc = this.findLocation(input.value);
        this.updateDeliveryCost(loc);
      }
    }
  
    // Загрузка доступных локаций из API
    async loadLocations() {
      try {
        const res = await fetch('/api/locations');
        if (!res.ok) throw new Error('Сервер вернул ' + res.status);
        this.locations = await res.json(); // [{id, name, delivery_cost, free_from_amount}, ...]
      } catch (err) {
        console.error('Ошибка загрузки локаций:', err);
        this.locations = [];
      }
    }
  
    // Заполнение datalist
    populateLocationDatalist() {
      const datalist = document.getElementById('locations-list');
      if (!datalist || !this.locations) return;
      datalist.innerHTML = this.locations
        .map(loc =>
          `<option value="${loc.name}">${loc.name} — доставка ${loc.delivery_cost}₽${loc.free_from_amount > 0 ? ', бесплатно от ' + loc.free_from_amount + '₽' : ''}</option>`
        ).join('');
    }
  
    // Автокомплит и пересчёт при вводе
    initLocationAutocomplete() {
      const input = document.getElementById('location-input');
      if (!input) return;
      input.addEventListener('input', () => {
        const loc = this.findLocation(input.value);
        this.updateDeliveryCost(loc);
      });
    }
  
    // Поиск локации по названию
    findLocation(name) {
      return this.locations.find(l => l.name === name) || null;
    }
  
    // Обработчики полей формы
    setupEventListeners() {
      // Скидка — показ полей пароля
      const discountCheckbox = document.getElementById('discount-checkbox');
      if (discountCheckbox) {
        discountCheckbox.addEventListener('change', e => this.togglePasswordFields(e.target.checked));
      }
      // Отправка формы
      this.form.addEventListener('submit', async e => {
        e.preventDefault();
        if (!this.validateForm()) return;
        try {
          await this.submitOrder();
          this.handleSuccess();
        } catch (err) {
          this.handleError(err);
        }
      });
    }
  
    // Показ/скрытие полей пароля
    togglePasswordFields(enabled) {
      const section = document.querySelector('.password-fields');
      if (!section) return;
      section.hidden = !enabled;
      section.querySelectorAll('input').forEach(input => input.required = enabled);
    }
  
    // Валидация обязательных полей и паролей
    validateForm() {
      let valid = true;
      this.form.querySelectorAll('[required]').forEach(field => {
        if (!field.value.trim()) {
          field.classList.add('invalid');
          valid = false;
        } else {
          field.classList.remove('invalid');
        }
      });
      const discount = document.getElementById('discount-checkbox')?.checked;
      if (discount) {
        const pw = this.form.querySelector('[name="password"]').value;
        const pw2 = this.form.querySelector('[name="password_confirm"]').value;
        if (pw !== pw2) {
          alert('Пароли не совпадают');
          valid = false;
        }
      }
      return valid;
    }
  
    // Пересчёт стоимости доставки с учётом порога бесплатной доставки
    updateDeliveryCost(loc) {
      const el = document.getElementById('delivery-cost');
      if (!el) return;
      const subtotal = this.cartItems.reduce((sum, it) => sum + it.price * it.quantity, 0);
      let cost = loc ? loc.delivery_cost : 0;
      if (loc && loc.free_from_amount > 0 && subtotal >= loc.free_from_amount) cost = 0;
      el.textContent = cost > 0 ? `Стоимость доставки: ${cost}₽` : 'Бесплатная доставка';
    }
  
    // Вычисление итоговой суммы заказа
    calculateTotal(loc) {
      const subtotal = this.cartItems.reduce((sum, it) => sum + it.price * it.quantity, 0);
      const discountRate = document.getElementById('discount-checkbox')?.checked ? 0.95 : 1;
      let cost = loc ? loc.delivery_cost : 0;
      if (loc && loc.free_from_amount > 0 && subtotal >= loc.free_from_amount) cost = 0;
      return parseFloat((subtotal * discountRate + cost).toFixed(2));
    }
  
    // Подготовка тела запроса API
    prepareOrderData() {
      const data = new FormData(this.form);
      const name = data.get('customer_name')?.trim() || data.get('name')?.trim();
      const phone = data.get('customer_phone')?.trim() || data.get('phone')?.trim();
      const email = data.get('email')?.trim() || '';
      const payment = data.get('payment') || 'cash';
      const locationName = data.get('location');
      const loc = this.findLocation(locationName);
  
      const customer = {
        location_id: loc?.id || null,
        phone,
        name,
        email,
        payment_method: payment
      };
  
      const items = this.cartItems.map(it => ({ id: it.id, quantity: it.quantity, weight: it.weight || 0, price: it.price }));
      const delivery_cost = loc?.delivery_cost || 0;
      const total = this.calculateTotal(loc);
  
      return { customer, items, total, delivery_cost, has_discount: document.getElementById('discount-checkbox')?.checked };
    }
  
    // Отправка заказа на сервер
    async submitOrder() {
      const payload = this.prepareOrderData();
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`Сервер вернул ${res.status}`);
      return res.json();
    }
  
    // Успешное оформление
    handleSuccess() {
      localStorage.removeItem('cart');
      window.location.href = '/order-success.html';
    }
  
    // Обработка ошибок
    handleError(err) {
      console.error('Ошибка оформления:', err);
      alert(`Ошибка оформления: ${err.message}`);
    }
  }
  