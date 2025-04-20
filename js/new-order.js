class CheckoutPage {
    constructor() {
        if (!document.querySelector('.checkout-page')) return;
    
        this.form = document.getElementById('checkout-form');
        this.cartItems = JSON.parse(localStorage.getItem('cart')) || [];
    
    // Новая проверка пустой корзины
    if (this.cartItems.length === 0) {
        window.location.href = '/cart.html';
        return;
    }

    this.init();
    }

    async init() {
        await this.loadLocations();
        this.setupEventListeners();
        this.initLocationAutocomplete();
    }

    // Загрузка данных о городах и районах
    async loadLocations() {
        try {
            const response = await fetch('/data/locations.json');
            this.locations = await response.json();
            this.populateLocationDatalist();
        } catch (error) {
            console.error('Ошибка загрузки локаций:', error);
        }
    }

    // Динамическое заполнение datalist
    populateLocationDatalist() {
        const datalist = document.getElementById('locations-list');
        datalist.innerHTML = this.locations
          .map(city => 
            city.districts
              .map(district => 
                `<option value="${city.city}, ${district.name}">${district.name} (доставка ${district.delivery_cost}₽)</option>`
              )
              .join('')
          )
          .join('');
      }

    // Инициализация автокомплита
    initLocationAutocomplete() {
        const input = document.getElementById('location-input');
        input.addEventListener('input', () => {
            const [city, district] = input.value.split(', ');
            const location = this.findLocation(city, district);
            this.updateDeliveryCost(location?.delivery_cost || 0);
        });
    }

    // Поиск локации в данных
    findLocation(cityName, districtName) {
        return this.locations
          .find(c => c.city === cityName)
          ?.districts
          .find(d => d.name === districtName);
      }
      

    // Обновление стоимости доставки
    updateDeliveryCost(cost) {
        const costElement = document.getElementById('delivery-cost');
        costElement.textContent = cost > 0 ? 
            `Стоимость доставки: ${cost}₽` : 
            'Бесплатная доставка';
    }

    // Обработчики событий
    setupEventListeners() {
        // Переключение полей пароля
        document.getElementById('discount-checkbox')
            .addEventListener('change', (e) => {
                const passwordFields = document.querySelector('.password-fields');
                passwordFields.hidden = !e.target.checked;
                passwordFields.querySelectorAll('input')
                    .forEach(input => input.toggleAttribute('required', e.target.checked));
            });

        // Отправка формы
        this.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!this.validateForm()) return;

            try {
                await this.submitOrder();
                this.handleSuccess();
            } catch (error) {
                this.handleError(error);
            }
        });
    }

    // Валидация формы
    validateForm() {
        let isValid = true;
    const discountChecked = document.getElementById('discount-checkbox').checked;

    this.form.querySelectorAll('[required]').forEach(field => {
        if (!field.value.trim()) {
            field.classList.add('invalid');
            isValid = false;
        } else {
            field.classList.remove('invalid');
        }
    });
    if (discountChecked) {
        const password = this.form.querySelector('[name="password"]').value;
        const confirm = this.form.querySelector('[name="password_confirm"]').value;
        
        if (password !== confirm) {
            alert('Пароли не совпадают!');
            isValid = false;
        }
    }

    return isValid;
}

    // Подготовка данных заказа
    prepareOrderData(formData) {
        const location = this.findLocation(...formData.get('location').split(', '));
    const discount = document.getElementById('discount-checkbox').checked;
    
    return {
        customer: {
            ...Object.fromEntries(formData.entries()),
            delivery_cost: location?.delivery_cost || 0,
            has_discount: discount
        },
        items: this.cartItems.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity
        })),
        total: this.calculateTotal(location?.delivery_cost),
        timestamp: new Date().toISOString()
    };
}

    // Расчет итоговой суммы
    calculateTotal(deliveryCost = 0) {
        const subtotal = this.cartItems.reduce((sum, item) => 
            sum + (item.price * item.quantity), 0);
        
        const discount = document.getElementById('discount-checkbox').checked ? 0.95 : 1;
        return (subtotal * discount + deliveryCost).toFixed(2);
    }

    // Отправка на сервер
    async submitOrder() {
        const formData = new FormData(this.form);
        const orderData = this.prepareOrderData(formData);

        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });

        if (!response.ok) throw new Error('Ошибка сервера');
        return response.json();
    }

    // Успешное оформление
    handleSuccess() {
        localStorage.removeItem('cart');
        window.location.href = '/order-success.html';
    }

    // Обработка ошибок
    handleError(error) {
        console.error('Ошибка:', error);
        alert(`Ошибка оформления: ${error.message}`);
    }
}

// Инициализация только на странице оформления
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.checkout-page')) {
        new CheckoutPage();
    }
});