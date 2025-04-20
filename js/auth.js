class AuthService {
        constructor() {
            this.users = [];
            this.loadUsers().catch(console.error);
        }
    
        async loadUsers() {
            try {
                const response = await fetch('./data/users.json');
                if (!response.ok) throw new Error('Ошибка загрузки: ' + response.status);
                const data = await response.json();
                this.users = data.rows.map(row => ({
                    id: row[0],
                    email: String(row[1]), // Приводим к строке
                    password_hash: String(row[2]),
                    role: row[3]
                }));
                console.log('Загружены пользователи:', this.users);
            } catch (error) {
                console.error('Ошибка загрузки пользователей:', error);
                this.users = [];
            }
        }
    
        login(email, password) {
            if (!Array.isArray(this.users)) {
                throw new Error('Данные не загружены');
            }
            
            const user = this.users.find(u => 
                u.email === email && 
                u.password_hash === password
            );
            
            if (!user) throw new Error('Неверные данные');
            localStorage.setItem('currentUser', JSON.stringify({
                email: 'admin@example.com',
                role: 'admin',
                token: 'JWT_TOKEN_FROM_SERVER' // Получать при авторизации
              }));
              
            return user;
        }
    
        getCurrentUser() {
            const user = localStorage.getItem('currentUser');
            return user ? JSON.parse(user) : null;
        }

    logout() {
        localStorage.removeItem('currentUser');
    }


    //Регистрация

    async register(email, password) {
        if (this.users.some(u => u.email === email)) {
            throw new Error('Пользователь с таким email уже существует');
        }

        const newUser = {
            id: Date.now(),
            email: email,
            password_hash: password, // В реальном проекте хешируйте пароль!
            role: 'user'
        };

        this.users.push(newUser);
        await this.saveUsers();
        return newUser;
    }

    async saveUsers() {
        try {
            // Эмуляция сохранения на "сервере"
            localStorage.setItem('users', JSON.stringify(this.users));
        } catch (error) {
            console.error('Ошибка сохранения:', error);
        }
    }

}

const authService = new AuthService(); // Единственный экземпляр