document.addEventListener('DOMContentLoaded', function() {
    const form = document.querySelector('form.user');
    const usernameInput = document.getElementById('inputUsername');
    const fullNameInput = document.getElementById('inputFullName');
    const passwordInput = document.getElementById('inputPassword');
    const confirmPasswordInput = document.getElementById('inputConfirmPassword');
    const roleInput = document.getElementById('inputRole');

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        // Reset any previous error states
        clearErrors();

        // Validate form
        if (!validateForm()) {
            return;
        }

        try {
            const response = await registerUser({
                username: usernameInput.value,
                fullName: fullNameInput.value,
                password: passwordInput.value,
                role: roleInput.value
            });

            if (response.success) {
                // Store user data and token
                localStorage.setItem('userToken', response.token);
                localStorage.setItem('userData', JSON.stringify(response.user));

                // Redirect based on role
                if (response.user.role === 'admin') {
                    window.location.href = 'index.html';
                } else if (response.user.role === 'owner') {
                    window.location.href = '../Owner Dashboard/index.html';
                }
            } else {
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

        // Full Name validation
        if (!fullNameInput.value.trim()) {
            showFieldError(fullNameInput, 'Full Name is required');
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
        if (passwordInput.value !== confirmPasswordInput.value) {
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
        const errorDiv = document.createElement('div');
        errorDiv.className = 'alert alert-danger';
        errorDiv.textContent = message;
        form.insertBefore(errorDiv, form.firstChild);
    }

    function clearErrors() {
        // Remove all error messages
        const errorMessages = form.querySelectorAll('.alert-danger, .invalid-feedback');
        errorMessages.forEach(error => error.remove());

        // Remove invalid classes from inputs
        const invalidInputs = form.querySelectorAll('.is-invalid');
        invalidInputs.forEach(input => input.classList.remove('is-invalid'));
    }

    // Add input event listeners for real-time validation
    const inputs = [usernameInput, fullNameInput, passwordInput, confirmPasswordInput, roleInput];
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
