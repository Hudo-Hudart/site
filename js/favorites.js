// js/favorites.js
document.addEventListener('DOMContentLoaded', () => {
    const favoritesList = document.getElementById('favorites-list');
    if (!favoritesList) return;
  
    // Получаем экземпляр избранного из main.js
    const fav = window.favorites;
    
    function renderFavorites() {
        if (!fav.items.length) {
          favoritesList.innerHTML = `
            <div class="empty-favorites">
              <img src="/images/heart.png" alt="Избранное" class="empty-icon">
              <span>В вашем избранном пока пусто</span>
            </div>`;
          return;
        }
      
        favoritesList.innerHTML = fav.items.map(item => `
          <div class="product-item">
            <a href="/product.html?id=${item.id}" class="product-item-link">
              <img src="/images/${item.image}"
                   onerror="this.src='/images/placeholder.png'"
                   alt="${item.name}">
              <h3 class="product-item-title">${item.name}</h3>
              <p class="product-price">${item.price ? item.price + ' руб' : ''}</p>
            </a>
            <div class="product-actions">
              <button class="add-to-cart" data-id="${item.id}">
                <svg><!-- иконка корзины --></svg>
                Выбрать
              </button>
              <button class="remove-favorite" data-id="${item.id}">
                <svg width="12" height="12" viewBox="0 0 14 14">
                  <path d="M1 13L13 1M1 1L13 13"
                        stroke="currentColor" stroke-width="2"/>
                </svg>
              </button>
            </div>
          </div>
        `).join('');
      }
      
  
    // Обработчик удаления
    favoritesList.addEventListener('click', e => {
      const btn = e.target.closest('.remove-favorite');
      if (!btn) return;
      
      const id = parseInt(btn.dataset.id);
      fav.toggleFavorite({ id });
      renderFavorites();
    });
  
    // Первоначальный рендер
    renderFavorites();
  });