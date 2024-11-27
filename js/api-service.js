// API Service for SIE-SRC Dashboard
const API_BASE_URL = 'http://localhost:8080'; // Adjust this to match your backend URL

const ApiService = {
    // User endpoints
    async login(credentials) {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: credentials.username,
                    password: credentials.password
                })
            });
            const data = await response.json();
            if (data.token) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('userRole', data.role);
                localStorage.setItem('username', credentials.username);
            }
            return data;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    },

    async logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        localStorage.removeItem('username');
        window.location.href = 'login.html';
    },

    // Product endpoints
    async getProducts() {
        try {
            const response = await fetch(`${API_BASE_URL}/products`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            return await response.json();
        } catch (error) {
            console.error('Get products error:', error);
            throw error;
        }
    },

    async createProduct(productData) {
        try {
            const response = await fetch(`${API_BASE_URL}/products`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(productData)
            });
            return await response.json();
        } catch (error) {
            console.error('Create product error:', error);
            throw error;
        }
    },

    // Sales endpoints
    async getSales() {
        try {
            const response = await fetch(`${API_BASE_URL}/sales`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            return await response.json();
        } catch (error) {
            console.error('Get sales error:', error);
            throw error;
        }
    },

    async createSale(saleData) {
        try {
            const response = await fetch(`${API_BASE_URL}/sales`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(saleData)
            });
            return await response.json();
        } catch (error) {
            console.error('Create sale error:', error);
            throw error;
        }
    },

    // Algorithm endpoints (Owner only)
    async runAlgorithm(algorithmData) {
        try {
            const response = await fetch(`${API_BASE_URL}/algorithm`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(algorithmData)
            });
            return await response.json();
        } catch (error) {
            console.error('Algorithm error:', error);
            throw error;
        }
    },

    // Analytics endpoints (Owner only)
    async getAnalytics() {
        try {
            const response = await fetch(`${API_BASE_URL}/analytics`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            return await response.json();
        } catch (error) {
            console.error('Get analytics error:', error);
            throw error;
        }
    }
};
