document.addEventListener('DOMContentLoaded', () => {
    // Переключение между вкладками
    const tabs = document.querySelectorAll('.admin-tab');
    const sections = document.querySelectorAll('.admin-section');

    // Проверка авторизации администратора
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));

    if (!currentUser || currentUser.role !== 'admin') {
    alert('Доступ запрещен!');
    window.location.href = '/index.html';
    }

    setInterval(() => {
        const user = JSON.parse(localStorage.getItem('currentUser'));
        if (!user || user.role !== 'admin') {
          window.location.href = '/index.html';
        }
      }, 30000); // Проверка каждые 30 секунд

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Удаляем активный класс у всех элементов
            tabs.forEach(t => t.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));

            // Добавляем активный класс выбранной вкладке и секции
            tab.classList.add('active');
            const targetSection = document.getElementById(`${tab.dataset.tab}-section`);
            if(targetSection) targetSection.classList.add('active');
        });
    });

    // Базовая инициализация - показать первую вкладку
    document.querySelector('.admin-tab.active').click();
});