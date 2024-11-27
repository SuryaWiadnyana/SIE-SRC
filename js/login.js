// Login functionality
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');
    
    if (token && userRole) {
        redirectBasedOnRole(userRole);
        return;
    }

    const loginForm = document.querySelector('form.user');
    
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = document.getElementById('inputUsername').value;
        const password = document.getElementById('inputPassword').value;
        
        if (!username || !password) {
            showError('Please enter both username and password');
            return;
        }
        
        try {
            const response = await ApiService.login({ username, password });
            
            if (response.token) {
                redirectBasedOnRole(response.role);
            } else {
                showError(response.message || 'Invalid credentials');
            }
        } catch (error) {
            console.error('Login error:', error);
            showError('Login failed. Please try again.');
        }
    });
});

function redirectBasedOnRole(role) {
    switch (role.toLowerCase()) {
        case 'admin':
            window.location.href = 'admin-dashboard.html';
            break;
        case 'owner':
            window.location.href = 'owner-dashboard.html';
            break;
        default:
            showError('Invalid user role');
            localStorage.clear(); // Clear any stored data for security
    }
}

function showError(message) {
    // Remove any existing error messages
    const existingError = document.querySelector('.alert-danger');
    if (existingError) {
        existingError.remove();
    }
    
    // Create and show new error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger';
    errorDiv.textContent = message;
    
    const cardBody = document.querySelector('.card-body');
    cardBody.insertBefore(errorDiv, cardBody.firstChild);
}
