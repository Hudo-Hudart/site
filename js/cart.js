/* cart.js — логика страницы корзины, отказ от JSON-файлов, использование MySQL через API */

class CartPage {
    constructor() {
      this.cartIconCount = document.getElementById('cart-count');
      this.itemsContainer = document.getElementById('cart-items');
      this.totalElement = document.getElementById('cart-total');
      this.checkoutBtn = document.querySelector('.checkout-btn');
      this.oneClickBtn = document.querySelector('.one-click-btn');
  
      // Загрузка корзины из локального хранилища
      try {
        this.items = JSON.parse(localStorage.getItem('cart')) || [];
        this.items = this.items.map(item => ({
          id: item.variant_id || item.id, // Важно: должен быть ID варианта товара
          price: Number(item.price),
          quantity: Number(item.quantity),
          weight: Number(item.weight) || 0,
          name: item.name,
          image: item.image
        })).filter(i => i.id && !isNaN(i.price) && !isNaN(i.quantity));
      } catch (err) {
        console.error('Ошибка загрузки корзины из localStorage:', err);
        this.items = [];
      }
  
      // Убираем некорректные элементы
      this.items = this.items.filter(i => i && i.id && i.price != null && i.quantity != null);
  
      this.initEventListeners();
      this.init();
      
    }

    initEventListeners() {
        document.addEventListener('cart-updated', () => {
          try {
            this.items = JSON.parse(localStorage.getItem('cart')) || [];
            this.items = this.items.filter(i => i && i.id && i.price != null && i.quantity != null);
            this.renderCartPreview();
            this.renderCartPage();
          } catch (err) {
            console.error('Ошибка при обновлении корзины:', err);
          }
        });
      }
  
    init() {
      this.renderCartPreview();
      if (this.itemsContainer) {
        this.renderCartPage();
        this.initEvents();
      }
      
    }
  
    // Показываем количество товаров в иконке корзины
    renderCartPreview() {
      if (!this.cartIconCount) return;
      const totalQty = this.items.reduce((sum, i) => sum + (i.quantity || 0), 0);
      this.cartIconCount.textContent = totalQty;
    }
  
    // Отрисовка полной таблицы корзины
    renderCartPage() {
      if (!this.itemsContainer || !this.totalElement) return;
      this.itemsContainer.innerHTML = '';
      let totalSum = 0;
  
      this.items.forEach((item, idx) => {
        const price = parseFloat(item.price) || 0;
        const qty = parseInt(item.quantity, 10) || 0;
        const sum = price * qty;
        totalSum += sum;
  
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>
            <div class="cart-product">
              <img src="${item.image || '/images/placeholder.webp'}" alt="${item.name}" width="50" onerror="this.src='/images/placeholder.webp'">
              <div>
                <strong>${item.name}</strong><br>
                <small>Вес: ${item.weight || 'N/A'} г</small>
              </div>
            </div>
          </td>
          <td>${price.toFixed(2)} ₽</td>
          <td>
            <button class="quantity-btn minus" data-index="${idx}">-</button>
            <span class="quantity-value">${qty}</span>
            <button class="quantity-btn plus" data-index="${idx}">+</button>
          </td>
          <td class="item-sum">${sum.toFixed(2)} ₽</td>
                  <td><button class="remove-btn" data-id="${item.id}" data-weight="${item.weight}">×</button></td>
        `;
        this.itemsContainer.appendChild(tr);
      });
  
      this.totalElement.textContent = totalSum.toFixed(2);
    }
  
    initEvents() {
      document.addEventListener('click', e => {
        const minus = e.target.closest('.minus');
        const plus = e.target.closest('.plus');
        const remove = e.target.closest('.remove-btn');
  
        if (minus) this.changeQuantity(minus.dataset.index, -1);
        if (plus) this.changeQuantity(plus.dataset.index, 1);
        if (remove) {
          const id = parseInt(remove.dataset.id);
          const weight = remove.dataset.weight;
          this.removeItemByIdAndWeight(id, weight);
      }
        if (e.target.closest('.checkout-btn')) this.handleCheckout();
        if (e.target.closest('.one-click-btn')) this.handleQuickOrder();
      });
    }

    removeItemByIdAndWeight(id, weight) {
      this.items = this.items.filter(item => !(item.id === id && item.weight === weight));
      this.saveCart();
      this.renderCartPage();
      this.renderCartPreview();
  }
  
    changeQuantity(idxStr, delta) {
      const idx = parseInt(idxStr, 10);
      const item = this.items[idx];
      if (!item) return;
  
      const newQty = item.quantity + delta;
      if (newQty < 1) {
        if (confirm('Удалить товар из корзины?')) {
          this.removeItem(idx);
        }
        return;
      }
      item.quantity = newQty;
      this.saveCart();
      this.renderCartPage();
      this.renderCartPreview();
    }
  
    removeItem(idxStr) {
      const idx = parseInt(idxStr, 10);
      if (confirm('Вы уверены, что хотите удалить этот товар?')) {
        this.items.splice(idx, 1);
        this.saveCart();
        this.renderCartPage();
        this.renderCartPreview();
      }
    }
  
    saveCart() {
      try {
        localStorage.setItem('cart', JSON.stringify(this.items));
        document.dispatchEvent(new CustomEvent('cart-updated', { detail: this.items }));
      } catch (err) {
        console.error('Ошибка сохранения корзины в localStorage:', err);
      }
    }
  
    handleCheckout() {
      if (!this.items.length) {
        alert('Корзина пуста!');
        return;
      }
      // Переход на страницу оформления заказов, где new-order.js отправит POST /api/orders
      window.location.href = '/new-order.html';
    }
  
    handleQuickOrder() {
      if (!this.items.length) {
        alert('Корзина пуста!');
        return;
      }
      this.openQuickOrderModal();
    }
  
    openQuickOrderModal() {
      const modalHtml = `
        <div class="quick-order-modal">
          <div class="modal-window">
            <span class="close">×</span>
            <h2>Быстрый заказ</h2>
            <form id="quick-order-form">
              <input type="text" name="customer_name" placeholder="Ваше имя" required>
              <input type="tel" name="customer_phone" placeholder="Телефон +7..." pattern="\\+7\\d{10}" required>
              <input type="text" name="street" placeholder="Улица">
              <input type="text" name="house_number" placeholder="Дом">
              <textarea name="comment" placeholder="Комментарий"></textarea>
              <button type="submit">Отправить заказ</button>
            </form>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      this.bindQuickOrderEvents();
    }
  
    bindQuickOrderEvents() {
      const modal = document.querySelector('.quick-order-modal');
      const closeBtn = modal.querySelector('.close');
      const form = modal.querySelector('#quick-order-form');
  
      closeBtn.addEventListener('click', () => modal.remove());
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const data = new FormData(form);
        const customer_name = data.get('customer_name').trim();
        const customer_phone = data.get('customer_phone').trim();
        if (!customer_name || !/^\+7\d{10}$/.test(customer_phone)) {
          alert('Введите имя и корректный телефон');
          return;
        }
        const payload = {
          street: data.get('street').trim() || '',
          house_number: data.get('house_number').trim() || '',
          customer_name,
          customer_phone,
          comment: data.get('comment').trim() || '',
          total_amount: this.items.reduce((sum, i) => sum + i.price * i.quantity, 0),
          items: this.items.map(i => ({ id: i.id, quantity: i.quantity, weight: i.weight || 0, price: i.price }))
        };
  
        try {
          const res = await fetch('/api/quick-orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (!res.ok) throw new Error();
          modal.remove();
          alert('Заказ принят!');
          this.items = [];
          this.saveCart();
          this.renderCartPage();
          this.renderCartPreview();
        } catch (err) {
          console.error('Ошибка при быстром заказе:', err);
          alert('Не удалось оформить быстрый заказ');
        }
      });
    }
  }
  
  // Инициализация страницы
  
  document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.cart-page')) {
      new CartPage();
    }
  });
  