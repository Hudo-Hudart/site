document.addEventListener("DOMContentLoaded", function() {
    // Читаем параметры из URL (ожидаем, что id передан как ?id=...)
    const urlParams = new URLSearchParams(window.location.search);
    const productId = parseInt(urlParams.get('id'), 10);
    
    // Улучшенная обработка ошибок
    if (isNaN(productId)) {
        showError("Некорректный идентификатор товара");
        return;
    }

    showLoading();

    // Загружаем данные о товарах из JSON-файла
    fetch('/data/products.json')
        .then(response => {
            if (!response.ok) {
                throw new Error("Ошибка сети при загрузке данных");
            }
            return response.json();
        })
        .then(data => {
            // Ищем строку (товар) с нужным ID (приводим к строке для сравнения)
            const product = data.rows.find(row => row[0] === parseInt(productId, 10));
            if (!product) {
                console.error("Товар не найден");
                return;
            }

            // Распаковываем данные товара для удобства (индексы соответствуют схеме JSON)
            const id = product[0];
            const name = product[1];
            // row[2] можно использовать, если требуется номер категории или иное значение
            const price = product[3];
            const rating = product[4];
            const image = product[5];
            const description = product[6];
            const sku = product[7]; // Например, используем для артикулу товара
            const specifications = product[8]; // Объект с характеристиками
            const weights = product[9]; // Массив доступных весов

            // Обновляем главную картинку товара
            const mainImageEl = document.querySelector('.product-gallery .main-image');
            if (mainImageEl) {
                mainImageEl.src = `/images/${image}`;
                mainImageEl.alt = name;
            }

            // Обновляем заголовок с названием товара
            const productTitleEl = document.querySelector('.product-details h1');
            if (productTitleEl) {
                productTitleEl.textContent = name;
            }

            const breadcrumbEl = document.getElementById('current-breadcrumb');
            if (breadcrumbEl) {
                breadcrumbEl.textContent = name;
            }

            // Обновляем блок "product-meta": артикул и рейтинг
            const skuEl = document.querySelector('.product-meta .sku');
            if (skuEl) {
                skuEl.textContent = `Артикул: ${sku}`;
            }
            const ratingEl = document.querySelector('.product-meta .rating');
            if (ratingEl) {
                // Рендерим звёзды — здесь можно доработать по своему вкусу
                const fullStars = Math.floor(rating);
                let stars = "";
                for (let i = 0; i < fullStars; i++) {
                    stars += "★";
                }
                // Если рейтинг с половиной звезды:
                if (rating - fullStars >= 0.5) {
                    stars += "½";  // Можно заменить на иконку половинчатой звезды
                }
                ratingEl.textContent = `${stars} (${rating} отзывов)`;
            }

            // Обновляем блок с ценой
            const priceEl = document.querySelector('.price-block .price');
            if (priceEl) {
                priceEl.textContent = `${price} ₽`;
            }

            // Обновляем select выбора веса товара
            const weightSelectEl = document.querySelector('.price-block .weight-select');
            if (weightSelectEl) {
                weightSelectEl.innerHTML = '';  // Очищаем существующие опции
                weights.forEach(weight => {
                    const option = document.createElement('option');
                    option.value = weight;
                    option.textContent = `${weight} кг`;
                    weightSelectEl.appendChild(option);
                });
            }

            // Обновляем блок характеристик
            const specsGridEl = document.querySelector('.specs-grid');
            if (specsGridEl && specifications) {
                specsGridEl.innerHTML = '';
                for (let key in specifications) {
                    const specItem = document.createElement('div');
                    specItem.classList.add('spec-item');

                    const specName = document.createElement('span');
                    specName.classList.add('spec-name');
                    specName.textContent = `${key}:`;

                    const specValue = document.createElement('span');
                    specValue.classList.add('spec-value');
                    specValue.textContent = specifications[key];

                    specItem.appendChild(specName);
                    specItem.appendChild(specValue);
                    specsGridEl.appendChild(specItem);
                }
            }

            // Обновляем описание товара
            const productDescEl = document.querySelector('.product-description p');
            if (productDescEl) {
                productDescEl.textContent = description;
            }

            const addToCartBtn = document.getElementById('add-to-cart');
            if (addToCartBtn) {
                addToCartBtn.addEventListener('click', () => {
                    const weightSelect = document.getElementById('weight-select');
                    const selectedWeight = weightSelect ? parseFloat(weightSelect.value) : null;
        
                    if (!selectedWeight) {
                        alert('Пожалуйста, выберите вес товара.');
                        return;
                    }
        
                    // Теперь переменные товара доступны в этой области видимости
                    const productData = {
                        id: id,
                        name: name,
                        price: price,
                        image: image, // Убрал /images/ так как оно уже добавляется в классе Cart
                        weight: selectedWeight,
                        sku: sku,
                        specifications: specifications
                    };
        
                    // Добавляем в корзину
                    cart.addItem(productData, 1, selectedWeight);
                    
                    // Уведомление
                    const notification = document.createElement('div');
                    notification.className = 'cart-notification';
                    notification.textContent = 'Товар добавлен в корзину!';
                    document.body.appendChild(notification);
                    
                    setTimeout(() => notification.remove(), 2000);
                });
            }
        })



        


        
        .catch(error => {
            console.error("Ошибка при получении данных о товаре:", error);
        });
        function handleResponse(response) {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        }
        
        function processProductData(data, productId) {
            const product = data.rows.find(row => row[0] === productId);
            
            if (!product) {
                showError("Товар не найден в базе данных");
                return;
            }
        
            // Обновляем DOM только после проверки всех данных
            updateProductPage(product);
        }
        
        function updateProductPage(product) {
            try {
                // Все DOM-операции обернуты в try-catch
                updateMainImage(product[5]);
                updateProductTitle(product[1]);
                updateBreadcrumbs(product[1]);
                // ... остальные методы обновления
            } catch (error) {
                showError("Ошибка при отображении товара");
                console.error('DOM error:', error);
            }
        }
        
        function showError(message) {
            const errorContainer = document.createElement('div');
            errorContainer.className = 'error-message';
            errorContainer.innerHTML = `
                <img src="/images/error-icon.png" alt="Ошибка">
                <h3>${message}</h3>
                <a href="/catalog.html">Вернуться в каталог</a>
            `;
            document.querySelector('main').appendChild(errorContainer);
        }
        
        function showLoading() {
            const loader = document.createElement('div');
            loader.className = 'fullscreen-loader';
            loader.innerHTML = '<div class="spinner"></div>';
            document.body.appendChild(loader);
        }

        
});

