document.addEventListener('DOMContentLoaded', () => {
  const redirectToLogin = () => {
    localStorage.removeItem('currentUser');
    window.location.href = '/login.html';
  };

  // Расширенная проверка авторизации
  const checkAuth = () => {
    try {
      const user = JSON.parse(localStorage.getItem('currentUser'));
      if (!user || user.role !== 'admin') redirectToLogin();
    } catch (e) {
      redirectToLogin();
    }
  };

  // Проверка при загрузке
  checkAuth();
  
  // Проверка каждые 15 секунд
  setInterval(checkAuth, 15000);

  // Обработчик выхода
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    localStorage.removeItem('currentUser');
    redirectToLogin();
  });

  // Управление вкладками 
  const activateTab = (tab) => {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`${tab.dataset.tab}-section`)?.classList.add('active');
  };

  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => activateTab(tab));
  });

  activateTab(document.querySelector('.admin-tab.active') || document.querySelector('.admin-tab'));
});