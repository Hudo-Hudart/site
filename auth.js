// auth.js — сервис авторизации через API MySQL-бэкенда

class AuthService {
    constructor() {
      this.currentUserKey = 'currentUser';
    }
  
    // Вход
    async login(email, password) {
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Ошибка авторизации');
        }
        const user = await res.json(); // { id, email, role }
        localStorage.setItem(this.currentUserKey, JSON.stringify(user));
        return user;
      } catch (e) {
        throw new Error(e.message || 'Ошибка сети при авторизации');
      }
    }
  
    // Регистрация и автоматический вход
    async register(email, password) {
      try {
        const res = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Ошибка регистрации');
        }
        const { id } = await res.json();
        const user = { id, email, role: 'user' };
        localStorage.setItem(this.currentUserKey, JSON.stringify(user));
        return user;
      } catch (e) {
        throw new Error(e.message || 'Ошибка сети при регистрации');
      }
    }
  
    // Получить текущего пользователя
    getCurrentUser() {
      const raw = localStorage.getItem(this.currentUserKey);
      return raw ? JSON.parse(raw) : null;
    }
  
    // Выход
    logout() {
      localStorage.removeItem(this.currentUserKey);
    }
  }
  
  // Экземпляр сервиса
  const authService = new AuthService();
  
  // Для использования в скриптах
  window.authService = authService;
  