// Configuration
const API_URL = 'http://127.0.0.1:8080';
const FRONTEND_URL = 'http://127.0.0.1:5502/SIE-SRC-frontend';

// Handle login functionality
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');
    
    // Hide error message
    if (errorMessage) {
        errorMessage.style.display = 'none';
    }

    // Only clear auth data if we're actually on the login page
    if (window.location.pathname.includes('login.html')) {
        localStorage.clear();
    }

    // Add autocomplete attribute to password input
    const passwordInput = document.getElementById('password');
    if (passwordInput) {
        passwordInput.setAttribute('autocomplete', 'current-password');
    }

    // Toggle password visibility
    const togglePasswordBtn = document.getElementById('togglePassword');
    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener('click', function() {
            const passwordInput = document.getElementById('password');
            const icon = this.querySelector('i');
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                passwordInput.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;
            
            if (!username || !password) {
                showError('Mohon isi semua field');
                return;
            }
            
            const submitBtn = this.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
            
            try {
                const response = await fetch(API_URL + '/user/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();
                console.log('Response Data:', data);

                if (!response.ok || !data.success) {
                    throw new Error(data.message || 'Login gagal');
                }

                // Get user data and token from response
                const token = data.data.token;
                const userData = data.data.user;
                const userRole = userData.role ? userData.role.toLowerCase() : 'admin';
                
                // Save to localStorage
                localStorage.setItem('token', token);
                localStorage.setItem('role', userRole);
                localStorage.setItem('userData', JSON.stringify({
                    username: username,
                    role: userRole
                }));

                // Get dashboard URL
                const dashboardUrl = userRole === 'admin' 
                    ? '/Admin-Dashboard/index-admin.html'
                    : '/Owner-Dashboard/index-owner.html';

                // Show success message
                submitBtn.innerHTML = '<i class="fas fa-check"></i> Login Berhasil';
                
                // Redirect after a short delay
                const fullUrl = FRONTEND_URL + dashboardUrl;
                console.log('Redirecting to:', fullUrl);
                
                // Force reload to clear any cached state
                window.location.href = fullUrl;
                
            } catch (error) {
                console.error('Login error:', error);
                showError(error.message || 'Terjadi kesalahan saat login');
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Login';
            }
        });
    }
});

function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 3000);
    }
}