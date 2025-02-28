// Initialize page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing laporan page...');
    
    // Check authentication
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '../login.html';
        return;
    }

    // Set username from localStorage
    try {
        const userData = JSON.parse(localStorage.getItem('userData'));
        if (userData) {
            const usernameElement = document.getElementById('username');
            if (usernameElement) {
                const displayName = userData.role === 'owner' ? 'OwnerSRC' : (userData.username || userData.name || 'User');
                usernameElement.textContent = displayName;
            }
        }
    } catch (error) {
        console.error('Error setting username:', error);
    }
});
