// Configuration
const API_URL = 'http://127.0.0.1:8080';
const FRONTEND_URL = 'http://127.0.0.1:5501/SIE-SRC_Dashboard';

// Handle login functionality
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');
    
    // Only check auth if we're not in a redirect loop
    const lastRedirectTime = sessionStorage.getItem('lastRedirectTime');
    const currentTime = new Date().getTime();
    
    if (!lastRedirectTime || currentTime - parseInt(lastRedirectTime) > 2000) {
        checkAuthAndRedirect();
    } else {
        // Clear any stale auth data if we detect a redirect loop
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('userData');
        sessionStorage.removeItem('lastRedirectTime');
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Get form data
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;
            
            // Basic validation
            if (!username || !password) {
                showError('Please fill in all fields');
                return;
            }
            
            try {
                // Show loading state
                const submitBtn = this.querySelector('button[type="submit"]');
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
                
                const response = await fetch(`${API_URL}/user/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();
                
                if (response.ok && data.token) {
                    // Store user data
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('role', data.role || 'admin');
                    localStorage.setItem('userData', JSON.stringify({
                        username: username,
                        role: data.role || 'admin'
                    }));
                    
                    // Set redirect time to prevent loops
                    sessionStorage.setItem('lastRedirectTime', new Date().getTime().toString());
                    
                    // Small delay before redirect to ensure storage is complete
                    setTimeout(() => {
                        redirectBasedOnRole(data.role || 'admin');
                    }, 100);
                } else {
                    showError(data.message || 'Invalid username or password');
                }
            } catch (error) {
                console.error('Login error:', error);
                showError('Connection error. Please try again later.');
            } finally {
                // Restore button state
                const submitBtn = loginForm.querySelector('button[type="submit"]');
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Login';
            }
        });
    }
});

// Helper function to check authentication and redirect if necessary
function checkAuthAndRedirect() {
    try {
        const token = localStorage.getItem('token');
        const role = localStorage.getItem('role');
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        
        // Get current path
        const currentPath = window.location.pathname;
        
        // If on login page and already logged in, redirect to dashboard
        if (currentPath.endsWith('login.html') && token && role) {
            console.log('Already logged in, redirecting to dashboard...');
            sessionStorage.setItem('lastRedirectTime', new Date().getTime().toString());
            redirectBasedOnRole(role);
            return;
        }
        
        // If on dashboard page and not logged in, redirect to login
        if (currentPath.includes('Dashboard') && (!token || !role)) {
            console.log('Not logged in, redirecting to login...');
            sessionStorage.setItem('lastRedirectTime', new Date().getTime().toString());
            window.location.href = `${FRONTEND_URL}/login.html`;
        }
    } catch (error) {
        console.error('Auth check error:', error);
        // Clear potentially corrupted data
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('userData');
        sessionStorage.removeItem('lastRedirectTime');
    }
}

// Helper function to show error message
function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        
        // Hide error after 3 seconds
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 3000);
    }
}

// Helper function to redirect based on role
function redirectBasedOnRole(role) {
    try {
        console.log('Redirecting based on role:', role);
        const targetPath = role === 'owner' 
            ? `${FRONTEND_URL}/Owner Dashboard/index.html`
            : `${FRONTEND_URL}/Admin Dashboard/index.html`;
            
        console.log('Redirecting to:', targetPath);
        window.location.href = targetPath;
    } catch (error) {
        console.error('Redirect error:', error);
        window.location.href = `${FRONTEND_URL}/login.html`;
    }
}