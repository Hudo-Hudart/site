// favorites.js — логика страницы избранного
document.addEventListener('DOMContentLoaded', () => {
  const favoritesList = document.getElementById('favorites-list');
  const favorites = window.favorites; // Экземпляр из main.js

  // Рендер избранного
  // В файле favorites.js обновите renderFavorites()
function renderFavorites() {
  if (!favoritesList) return;

  // Полная перезапись содержимого
  favoritesList.innerHTML = favorites.items.length 
      ? getFavoritesTemplate() 
      : getEmptyTemplate();

  setupRemoveHandlers();
}

  // Шаблон для наполненного избранного
  // В файле favorites.js обновите getFavoritesTemplate()
function getFavoritesTemplate() {
  return `
      <div class="favorites-container">
          <div class="favorites-header">
              <h2>Избранное (${favorites.items.length})</h2>
              <button class="clear-all">Очистить всё</button>
          </div>
          <div class="favorites-items">
              ${favorites.items.map(item => `
                  <div class="favorite-item" data-id="${item.id}">
                      <img style="height: 200px" src="${item.image}" 
                           alt="${item.name}"
                           onerror="this.src='/images/placeholder.png'">
                      <div class="favorite-info">
                          <h3>${item.name}</h3>
                          ${item.price ? `<div class="price">${item.price.toFixed(2)} ₽</div>` : ''}
                          ${item.weight ? `<div class="weight">${item.weight}</div>` : ''}
                      </div>
                        <button class="remove-item" data-id="${item.id}">
                          <svg width="14" height="14" viewBox="0 0 14 14">
                              <path d="M1 13L13 1M1 1L13 13" 
                                    stroke="currentColor" 
                                    stroke-width="2"/>
                          </svg>
                      </button>
                  </div>
              `).join('')}
          </div>
          <div class="favorites-actions">
              <a href="/catalog.html" class="continue-shopping">← Продолжить покупки</a>
          </div>
      </div>`;
}

  // Шаблон пустого избранного
  function getEmptyTemplate() {
      return `
          <div class="empty-favorites">
              <img src="/images/heart.png" alt="Избранное пусто">
              <h3>В избранном пока ничего нет</h3>
              <p>Добавляйте товары с помощью ❤ в каталоге</p>
              <a href="/catalog.html" class="btn">Перейти в каталог</a>
          </div>`;
  }

  // Обработчики удаления
  function setupRemoveHandlers() {
      document.querySelectorAll('.remove-item').forEach(btn => {
          btn.addEventListener('click', () => {
              const itemId = parseInt(btn.closest('.favorite-item').dataset.id);
              favorites.removeItem(itemId);
          });
      });

      document.querySelector('.clear-all')?.addEventListener('click', () => {
          if (confirm('Очистить всё избранное?')) {
              favorites.clearAll();
          }
      });
  }

  // Инициализация
  document.addEventListener('favorites-updated', renderFavorites);
  renderFavorites();
});