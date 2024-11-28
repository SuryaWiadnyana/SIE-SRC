// API Service for SIE-SRC Dashboard
const API_BASE_URL = 'http://localhost:8080'; // Adjust this to match your backend URL

const ApiService = {
    // User endpoints
    async login(credentials) {
        try {
            const response = await fetch(`${API_BASE_URL}/user/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: credentials.username,
                    password: credentials.password
                })
            });

            if (!response.ok) {
                const text = await response.text();
                try {
                    // Try to parse as JSON first
                    const data = JSON.parse(text);
                    throw new Error(data.message || 'Login failed');
                } catch (e) {
                    // If parsing fails, use the text as is
                    throw new Error(text || 'Login failed');
                }
            }

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

    async registerUser(userData) {
        try {
            console.log('Attempting to register user:', userData);
            const response = await fetch(`${API_BASE_URL}/user/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: userData.username,
                    password: userData.password,
                    role: userData.role
                })
            });

            const text = await response.text();
            let data;
            try {
                data = text ? JSON.parse(text) : {};
            } catch (e) {
                data = {};
            }

            if (response.ok) {
                return {
                    success: true,
                    message: 'Registration successful',
                    user: {
                        username: userData.username,
                        role: userData.role
                    },
                    ...data
                };
            }

            throw new Error(data.message || text || 'Registration failed');
        } catch (error) {
            console.error('Registration error:', error);
            throw error;
        }
    },

    // Product endpoints
    async getProducts() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/products`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            return await response.json();
        } catch (error) {
            console.error('Error fetching products:', error);
            throw error;
        }
    },

    async createProduct(productData) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/products`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(productData)
            });
            return await response.json();
        } catch (error) {
            console.error('Error creating product:', error);
            throw error;
        }
    },

    // Sales endpoints
    async getSales() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/sales`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            return await response.json();
        } catch (error) {
            console.error('Error fetching sales:', error);
            throw error;
        }
    },

    async createSale(saleData) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/sales`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(saleData)
            });
            return await response.json();
        } catch (error) {
            console.error('Error creating sale:', error);
            throw error;
        }
    },

    // Algorithm endpoints (Owner only)
    async runAlgorithm(algorithmData) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/algorithm/run`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(algorithmData)
            });
            return await response.json();
        } catch (error) {
            console.error('Error running algorithm:', error);
            throw error;
        }
    },

    // Analytics endpoints (Owner only)
    async getAnalytics() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/analytics`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            return await response.json();
        } catch (error) {
            console.error('Error fetching analytics:', error);
            throw error;
        }
    }
};
