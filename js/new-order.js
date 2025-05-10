// new-order.js — логика страницы оформления заказа через MySQL API

document.addEventListener('DOMContentLoaded', () => {
  // Запускаем CheckoutPage, только если на странице есть контейнер оформления
  if (document.querySelector('.checkout-form')) {
    new CheckoutPage();
  }
});

class CheckoutPage {
  constructor() {
    this.form = document.getElementById('checkout-form');
    if (!this.form) return;

    // Загрузка корзины из localStorage
    try {
      this.items = (JSON.parse(localStorage.getItem('cart')) || [])
        .map(item => ({
          ...item,
          price:    Number(item.price),
          quantity: Number(item.quantity),
          weight:   Number(item.weight) || 0
        }))
        .filter(i => i.id && !isNaN(i.price) && !isNaN(i.quantity));
    } catch (err) {
      console.error('Ошибка загрузки корзины:', err);
      this.items = [];
    }

    // Если корзина пуста — возвращаем на страницу корзины
    if (!this.items.length) {
      window.location.href = '/cart.html';
      return;
    }

    // Основная инициализация
    this.init();
  }

  async init() {
    // 1) Загрузить список локаций
    await this.loadLocations();

    // 2) Заполнить <datalist> вариантами
    this.populateLocationDatalist();

    // 3) Настроить автокомплит и закрытие списка
    this.initLocationAutocomplete();

    // 4) Подвесить остальные обработчики (скидка, отправка формы)
    this.setupEventListeners();

    // 5) Если поле уже заполнено (например, после reload), пересчитать доставку
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
      const data = await res.json();
      console.log('Загруженные локации:', data);

      this.locations = data.map(loc => ({
        id:               loc.id,
        name:             loc.name,
        delivery_cost:    Number(loc.delivery_cost),
        free_from_amount: Number(loc.free_from_amount)
      }));
    } catch (err) {
      console.error('Ошибка загрузки локаций:', err);
      this.locations = [];
    }
  }

  // Заполнение datalist
  // Заполнение пользовательского dropdown списка
  populateLocationDatalist() {
  const list = document.getElementById('locations-list');
  if (!list || !this.locations) return;
  
  this.locations.forEach(loc => {
    const li = document.createElement('li');
    li.textContent = `${loc.name} — доставка ${loc.delivery_cost}₽` + 
      (loc.free_from_amount > 0 ? `, бесплатно от ${loc.free_from_amount}₽` : '');
    li.dataset.value = loc.name;
    list.appendChild(li);
  });
}

  // Автокомплит и автоматическое закрытие списка после выбора
  initLocationAutocomplete() {
    const input = document.getElementById('location-input');
    const list = document.getElementById('locations-list');
    if (!input || !list) return;
  
    // Показать список при фокусе
    input.addEventListener('focus', () => {
      list.classList.add('open');
    });
  
    // Обработчик ввода текста
    input.addEventListener('input', () => {
      const search = input.value.toLowerCase();
      const items = list.querySelectorAll('li');
      
      items.forEach(item => {
        const match = item.dataset.value.toLowerCase().includes(search);
        item.style.display = match ? 'block' : 'none';
      });
      
      list.classList.add('open');
    });
  
    // Обработчик выбора элемента
    list.addEventListener('click', (e) => {
      if (e.target.tagName === 'LI') {
        input.value = e.target.dataset.value;
        list.classList.remove('open');
        const loc = this.findLocation(input.value);
        this.updateDeliveryCost(loc);
      }
    });
  
    // Закрыть список при клике вне поля
    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !list.contains(e.target)) {
        list.classList.remove('open');
      }
    });
  }

  // Находит объект локации по имени (value) или по id (если передан id)
  findLocation(identifier) {
    if (!this.locations) return null;
    // если идентификатор — число или строка-число, ищем по id
    if (!isNaN(identifier)) {
      const id = Number(identifier);
      return this.locations.find(l => l.id === id) || null;
    }
    // иначе — ищем по имени
    return this.locations.find(l => l.name === identifier) || null;
  }

  // Настройка обработки чекбокса скидки и отправки формы
  setupEventListeners() {
    // Показ/скрытие полей пароля при выборе скидки
    const discountCheckbox = document.getElementById('discount-checkbox');
    if (discountCheckbox) {
      discountCheckbox.addEventListener('change', e =>
        this.togglePasswordFields(e.target.checked)
      );
    }

    // Сабмит формы
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
  togglePasswordFields(show) {
    const section = document.querySelector('.password-fields');
    if (!section) return;
    section.hidden = !show;
    section.querySelectorAll('input').forEach(input => {
      input.required = show;
    });
  }

  // Простая валидация обязательных полей и паролей
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

    if (document.getElementById('discount-checkbox')?.checked) {
      const pw  = this.form.querySelector('[name="password"]').value;
      const pw2 = this.form.querySelector('[name="password_confirm"]').value;
      if (pw !== pw2) {
        alert('Пароли не совпадают');
        valid = false;
      }
    }

    return valid;
  }

  // Пересчёт стоимости доставки
  updateDeliveryCost(loc) {
    const el = document.getElementById('delivery-cost');
    if (!el) return;
    const subtotal = this.items.reduce((sum, it) =>
      sum + (it.price * it.quantity), 0
    );
    let cost = loc ? loc.delivery_cost : 0;
    if (loc && loc.free_from_amount > 0 && subtotal >= loc.free_from_amount) {
      cost = 0;
    }
    el.textContent = cost > 0
      ? `Стоимость доставки: ${cost}₽`
      : 'Бесплатная доставка';
  }

  // Подсчёт итоговой суммы (товары + доставка – скидка)
  calculateTotal(loc) {
    const subtotal = this.items.reduce((sum, it) =>
      sum + (Number(it.price) * Number(it.quantity)), 0
    );
    const discountRate = document.getElementById('discount-checkbox')?.checked
      ? 0.95
      : 1;

    let cost = loc ? Number(loc.delivery_cost) : 0;
    const freeFrom = loc ? Number(loc.free_from_amount) : 0;
    if (freeFrom > 0 && subtotal >= freeFrom) {
      cost = 0;
    }

    const total = (subtotal * discountRate) + cost;
    return Number(total.toFixed(2));
  }

  // Сборка payload для API
  prepareOrderData() {
    const formData = new FormData(this.form);
    const locName  = formData.get('location');
    const loc      = this.findLocation(locName);

    const customer = {
      location_id:       loc?.id || null,
      customer_fullname: `${formData.get('first_name')?.trim() || ''} ${formData.get('last_name')?.trim() || ''}`.trim(),
      customer_phone:    formData.get('phone')?.trim() || '',
      customer_email:    formData.get('email')?.trim() || '',
      payment_method:    formData.get('payment') || 'cash'
    };

    const items = this.items.map(it => ({
      // используем variantId, который вы теперь явно сохраняете
      product_variant_id: it.variantId || it.id,
      quantity:           it.quantity,
      weight:             it.weight,
      price:              it.price
    }));
    

    return {
      customer,
      items,
      delivery_cost: loc?.delivery_cost || 0,
      has_discount:  Boolean(document.getElementById('discount-checkbox')?.checked),
      total_amount:  this.calculateTotal(loc)
    };
  }

  // Отправка POST /api/orders
  async submitOrder() {
    const payload = this.prepareOrderData();
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `HTTP error ${res.status}`);
      }
      
      return await res.json();
      
    } catch (err) {
      console.error('Ошибка отправки заказа:', err);
      throw new Error(err.message || 'Ошибка связи с сервером');
    }
  }

  // После успешного заказа
  handleSuccess() {
    localStorage.removeItem('cart');
    window.location.href = '/index.html';
  }

  // Обработка ошибок
  handleError(err) {
    console.error('Ошибка оформления:', err);
    alert(`Не удалось оформить заказ: ${err.message}`);
  }
}
