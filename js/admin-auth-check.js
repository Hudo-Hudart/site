// admin-auth-check.js — проверка прав администратора и переключение вкладок

document.addEventListener('DOMContentLoaded', () => {
  // Проверка авторизации через AuthService
  const user = window.authService?.getCurrentUser() || null;
  if (!user || user.role !== 'admin') {
    alert('Доступ запрещён!');
    window.location.href = '/login.html';
    return;
  }

  // Периодическая проверка актуальности сессии (каждые 30 сек)
  setInterval(() => {
    const u = window.authService.getCurrentUser();
    if (!u || u.role !== 'admin') {
      alert('Сессия истекла или права изменились');
      window.location.href = '/login.html';
    }
  }, 30000);

  // Вкладки администратора
  const tabs = document.querySelectorAll('.admin-tab');
  const sections = document.querySelectorAll('.admin-section');

  function activateTab(tab) {
    tabs.forEach(t => t.classList.remove('active'));
    sections.forEach(s => s.classList.remove('active'));
    tab.classList.add('active');
    const section = document.getElementById(`${tab.dataset.tab}-section`);
    if (section) section.classList.add('active');
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => activateTab(tab));
  });

  // Инициализация — активируем первую вкладку
  const initial = document.querySelector('.admin-tab.active') || tabs[0];
  if (initial) activateTab(initial);
});
