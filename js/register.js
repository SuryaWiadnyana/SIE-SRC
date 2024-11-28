document.addEventListener('DOMContentLoaded', function() {
    const form = document.querySelector('form.user');
    const usernameInput = document.getElementById('inputUsername');
    const passwordInput = document.getElementById('inputPassword');
    const confirmPasswordInput = document.getElementById('inputConfirmPassword');
    const roleInput = document.getElementById('inputRole');

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        console.log('Form submission started');

        // Reset any previous error states
        clearErrors();

        // Validate form
        if (!validateForm()) {
            console.log('Form validation failed');
            return;
        }
        console.log('Form validation passed');

        try {
            const userData = {
                username: usernameInput.value,
                password: passwordInput.value,
                role: roleInput.value
            };
            console.log('Sending registration data:', userData);
            
            const response = await ApiService.registerUser(userData);
            console.log('Registration response received:', response);

            if (response.success) {
                console.log('Registration successful, storing data...');
                // Store user data and token
                localStorage.setItem('userToken', response.token);
                localStorage.setItem('userData', JSON.stringify(response.user));

                // Redirect based on role
                if (response.user.role === 'admin') {
                    window.location.href = 'Admin Dashboard/index.html';
                } else if (response.user.role === 'owner') {
                    window.location.href = 'Owner Dashboard/index.html';
                }
            } else {
                console.log('Registration failed:', response.message);
                showError('Registration failed: ' + response.message);
            }
        } catch (error) {
            console.error('Registration error:', error);
            showError('An error occurred during registration. Please try again.');
        }
    });

    function validateForm() {
        let isValid = true;

        // Username validation
        if (!usernameInput.value.trim()) {
            showFieldError(usernameInput, 'Username is required');
            isValid = false;
        } else if (usernameInput.value.length < 3) {
            showFieldError(usernameInput, 'Username must be at least 3 characters');
            isValid = false;
        }

        // Password validation
        if (!passwordInput.value) {
            showFieldError(passwordInput, 'Password is required');
            isValid = false;
        } else if (passwordInput.value.length < 6) {
            showFieldError(passwordInput, 'Password must be at least 6 characters');
            isValid = false;
        }

        // Confirm Password validation
        if (!confirmPasswordInput.value) {
            showFieldError(confirmPasswordInput, 'Please confirm your password');
            isValid = false;
        } else if (confirmPasswordInput.value !== passwordInput.value) {
            showFieldError(confirmPasswordInput, 'Passwords do not match');
            isValid = false;
        }

        // Role validation
        if (!roleInput.value) {
            showFieldError(roleInput, 'Please select a role');
            isValid = false;
        }

        return isValid;
    }

    function showFieldError(field, message) {
        field.classList.add('is-invalid');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'invalid-feedback';
        errorDiv.textContent = message;
        field.parentNode.appendChild(errorDiv);
    }

    function showError(message) {
        const errorAlert = document.createElement('div');
        errorAlert.className = 'alert alert-danger mt-3';
        errorAlert.textContent = message;
        form.insertAdjacentElement('beforebegin', errorAlert);
    }

    function clearErrors() {
        // Remove all error messages
        const errorMessages = document.querySelectorAll('.invalid-feedback, .alert-danger');
        errorMessages.forEach(error => error.remove());

        // Remove invalid class from all inputs
        const invalidInputs = document.querySelectorAll('.is-invalid');
        invalidInputs.forEach(input => input.classList.remove('is-invalid'));
    }

    // Add input event listeners for real-time validation
    const inputs = [usernameInput, passwordInput, confirmPasswordInput, roleInput];
    inputs.forEach(input => {
        input.addEventListener('input', function() {
            this.classList.remove('is-invalid');
            const feedback = this.parentNode.querySelector('.invalid-feedback');
            if (feedback) {
                feedback.remove();
            }
        });
    });
});
