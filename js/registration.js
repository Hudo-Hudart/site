document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const confirm = document.getElementById('regConfirm').value;

    try {
        if (password !== confirm) {
            throw new Error('Пароли не совпадают');
        }
        
        await authService.register(email, password);
        window.location.href = '/login.html';
    } catch (error) {
        document.getElementById('regError').textContent = error.message;
    }
});