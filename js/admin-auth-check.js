document.addEventListener('DOMContentLoaded', () => {
  // Проверка авторизации через localStorage
  const user = JSON.parse(localStorage.getItem('currentUser')) || null;
  
  if (!user || user.role !== 'admin') {
    alert('Доступ запрещён!');
    window.location.href = '/login.html';
  }

  setInterval(() => {
    const currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
    if (!currentUser || currentUser.role !== 'admin') {
      window.location.href = '/login.html';
    }
  }, 30000);

  // Управление вкладками 
  const tabs = document.querySelectorAll('.admin-tab');
  const sections = document.querySelectorAll('.admin-section');

  const activateTab = (tab) => {
    tabs.forEach(t => t.classList.remove('active'));
    sections.forEach(s => s.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`${tab.dataset.tab}-section`)?.classList.add('active');
  };

  tabs.forEach(tab => tab.addEventListener('click', () => activateTab(tab)));

  // Инициализация первой вкладки
  activateTab(document.querySelector('.admin-tab.active') || tabs[0]);
});