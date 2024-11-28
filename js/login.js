// Login functionality
document.addEventListener('DOMContentLoaded', function() {
    console.log('Login page loaded');
    
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    
    if (token && userData.role) {
        redirectBasedOnRole(userData.role);
        return;
    }

    const loginForm = document.querySelector('form.user');
    if (!loginForm) {
        console.error('Login form not found');
        return;
    }
    
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = document.getElementById('inputUsername').value;
        const password = document.getElementById('inputPassword').value;
        
        if (!username || !password) {
            showError('Please enter both username and password');
            return;
        }
        
        try {
            // Clear any existing auth data
            localStorage.clear();
            
            // Kirim request ke API untuk login
            const response = await fetch('http://localhost:8080/user/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: username,
                    password: password
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Login failed');
            }

            const data = await response.json();
            
            // Simpan token dan data user
            localStorage.setItem('token', data.token);
            localStorage.setItem('userData', JSON.stringify({
                username: data.username,
                role: data.role
            }));
            
            console.log('Login berhasil:', {
                username: data.username,
                role: data.role
            });
            
            // Redirect berdasarkan role
            redirectBasedOnRole(data.role);
            
        } catch (error) {
            console.error('Login error:', error);
            showError(error.message || 'Username atau password tidak valid');
            localStorage.clear();
        }
    });
});

function redirectBasedOnRole(role) {
    if (!role) {
        showError('Role tidak valid');
        localStorage.clear();
        return;
    }

    const normalizedRole = role.toLowerCase().trim();
    let targetPath;
    
    switch (normalizedRole) {
        case 'admin':
            targetPath = 'Admin Dashboard/index.html';
            break;
        case 'owner':
            targetPath = 'Owner Dashboard/index.html';
            break;
        default:
            console.error('Role tidak valid:', role);
            showError('Role user tidak valid');
            localStorage.clear();
            return;
    }
    
    try {
        window.location.href = targetPath;
    } catch (error) {
        console.error('Redirect error:', error);
        showError('Gagal melakukan redirect. Silakan coba lagi.');
    }
}

function showError(message) {
    // Remove any existing error messages first
    const existingErrors = document.querySelectorAll('.alert-danger');
    existingErrors.forEach(error => error.remove());

    // Create and show new error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger';
    errorDiv.textContent = message;
    
    const form = document.querySelector('form.user');
    if (form) {
        form.insertBefore(errorDiv, form.firstChild);
        
        // Automatically remove the error after 5 seconds
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }
}
