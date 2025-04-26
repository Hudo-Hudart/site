document.addEventListener("DOMContentLoaded", function() {
    // Получаем ID товара из URL (?id=...)
    const urlParams = new URLSearchParams(window.location.search);
    const productId = parseInt(urlParams.get('id'), 10);

    if (isNaN(productId)) {
        showError("Некорректный идентификатор товара");
        return;
    }

    showLoading();

    // Запрашиваем данные товара по API (MySQL)
    fetch(`/api/products/${productId}`)
        .then(handleResponse)
        .then(product => {
            if (!product) {
                showError("Товар не найден");
                return;
            }

            // Распаковываем данные из объекта
            const {
                id,
                name,
                description,
                sku,
                rating,
                image,
                specifications = {},
                variants = []
            } = product;

            // Обновляем главное изображение
            const mainImageEl = document.querySelector('.product-gallery .main-image');
            if (mainImageEl) {
                mainImageEl.src = `/images/${image}`;
                mainImageEl.alt = name;
            }

            // Заголовок
            const productTitleEl = document.querySelector('.product-details h1');
            if (productTitleEl) productTitleEl.textContent = name;

            // Хлебные крошки
            const breadcrumbEl = document.getElementById('current-breadcrumb');
            if (breadcrumbEl) breadcrumbEl.textContent = name;

            // Артикул и рейтинг
            const skuEl = document.querySelector('.product-meta .sku');
            if (skuEl) skuEl.textContent = `Артикул: ${sku}`;

            const ratingEl = document.querySelector('.product-meta .rating');
            if (ratingEl) {
                const fullStars = Math.floor(rating);
                let stars = '';
                for (let i = 0; i < fullStars; i++) stars += '★';
                if (rating - fullStars >= 0.5) stars += '½';
                ratingEl.textContent = `${stars} (${rating})`;
            }

            // Селект веса и цена
            const weightSelectEl = document.querySelector('.price-block .weight-select');
            const priceEl = document.querySelector('.price-block .price');
            if (weightSelectEl && priceEl) {
                weightSelectEl.innerHTML = '';
                variants.forEach(variant => {
                    const opt = document.createElement('option');
                    opt.value = variant.weight;
                    opt.textContent = `${variant.weight} кг`;
                    opt.dataset.price = variant.price;
                    weightSelectEl.appendChild(opt);
                });

                // Устанавливаем цену по умолчанию на первом варианте
                const firstOpt = weightSelectEl.options[0];
                priceEl.textContent = `${firstOpt.dataset.price} ₽`;

                // При изменении веса меняем цену
                weightSelectEl.addEventListener('change', () => {
                    const price = weightSelectEl.selectedOptions[0].dataset.price;
                    priceEl.textContent = `${price} ₽`;
                });
            }

            // Характеристики
            const specsGridEl = document.querySelector('.specs-grid');
            if (specsGridEl) {
                specsGridEl.innerHTML = '';
                Object.entries(specifications).forEach(([key, val]) => {
                    const item = document.createElement('div');
                    item.classList.add('spec-item');

                    const nameEl = document.createElement('span');
                    nameEl.classList.add('spec-name');
                    nameEl.textContent = `${key}:`;

                    const valEl = document.createElement('span');
                    valEl.classList.add('spec-value');
                    valEl.textContent = val;

                    item.append(nameEl, valEl);
                    specsGridEl.appendChild(item);
                });
            }

            // Описание
            const productDescEl = document.querySelector('.product-description p');
            if (productDescEl) productDescEl.textContent = description;

            // Кнопка "Добавить в корзину"
            const addToCartBtn = document.getElementById('add-to-cart');
            if (addToCartBtn) {
                addToCartBtn.addEventListener('click', () => {
                    const selectedOpt = weightSelectEl.selectedOptions[0];
                    if (!selectedOpt) {
                        alert('Пожалуйста, выберите вес товара.');
                        return;
                    }
                    const productData = {
                        id,
                        name,
                        price: parseFloat(selectedOpt.dataset.price),
                        image,
                        weight: parseFloat(selectedOpt.value),
                        sku,
                        specifications
                    };
                    cart.addItem(productData, 1, productData.weight);
                    const notif = document.createElement('div');
                    notif.className = 'cart-notification';
                    notif.textContent = 'Товар добавлен в корзину!';
                    document.body.appendChild(notif);
                    setTimeout(() => notif.remove(), 2000);
                });
            }
        })
        .catch(error => {
            console.error('Ошибка при получении данных о товаре:', error);
            showError('Не удалось загрузить данные товара.');
        });

    // Универсальные функции
    function handleResponse(response) {
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
    }

    function showError(message) {
        const err = document.createElement('div');
        err.className = 'error-message';
        err.innerHTML = `
            <img src="/images/error-icon.png" alt="Ошибка">
            <h3>${message}</h3>
            <a href="/catalog.html">Вернуться в каталог</a>
        `;
        document.querySelector('main').appendChild(err);
    }

    function showLoading() {
        const loader = document.createElement('div');
        loader.className = 'fullscreen-loader';
        loader.innerHTML = '<div class="spinner"></div>';
        document.body.appendChild(loader);
    }
});
