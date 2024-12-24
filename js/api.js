// API Base URL
const BASE_URL = 'http://localhost:8080'; // Adjust this to match your backend URL

// Handle API Response
async function handleResponse(response) {
    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || errorData?.error || `HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return { success: true, data };
}

// Authentication API
const auth = {
    login: async (credentials) => {
        try {
            const response = await fetch(`${BASE_URL}/user/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(credentials),
            });
            const data = await handleResponse(response);
            if (data.success && data.data.token) {
                localStorage.setItem('token', data.data.token);
                localStorage.setItem('role', data.data.role);
                localStorage.setItem('userData', JSON.stringify({
                    username: credentials.username,
                    role: data.data.role
                }));
                console.log('Token:', data.token);  // Debug
                console.log('Role:', data.role);    // Debug
                console.log('LocalStorage:', localStorage); // Debug
                // Check if role is admin or owner
                if (['admin', 'owner'].includes(data.data.role)) {
                    return { success: true, data: data.data };
                }
                return { success: false, error: 'Unauthorized role' };
            }
            return { success: false, error: 'Invalid response from server' };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: error.message };
        }
    },
    
    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('userData');
        window.location.href = '/SIE-SRC-frontend/login.html';
    },

    checkAuth: () => {
        const token = localStorage.getItem('token');
        const role = localStorage.getItem('role');
        if (!token || !role) {
            window.location.href = '/SIE-SRC-frontend/login.html';
            return false;
        }
        return true;
    }
};

// Users API
const users = {
    getAll: async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Tidak terautentikasi');
            }

            const response = await fetch(`${BASE_URL}/user/getall`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            const data = await handleResponse(response);
            return { success: true, data: data.data };
        } catch (error) {
            console.error('Get users error:', error);
            return { success: false, error: error.message };
        }
    },

    getByUsername: async (username) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Tidak terautentikasi');
            }

            const response = await fetch(`${BASE_URL}/user/by-username/${username}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            const data = await handleResponse(response);
            return { success: true, data: data.data };
        } catch (error) {
            console.error('Get user error:', error);
            return { success: false, error: error.message };
        }
    },

    getAllUsers: async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Tidak terautentikasi');
            }

            const response = await fetch(`${BASE_URL}/user/getall`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            return handleResponse(response);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    create: async (userData) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Tidak terautentikasi');
            }

            const response = await fetch(`${BASE_URL}/user/admin/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(userData)
            });
            return handleResponse(response);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    updateUser: async (username, userData) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Tidak terautentikasi');
            }

            const response = await fetch(`${BASE_URL}/user/admin/update/${username}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(userData)
            });
            return handleResponse(response);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    delete: async (id) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Tidak terautentikasi');
            }

            const response = await fetch(`${BASE_URL}/user/admin/delete-user/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            return handleResponse(response);
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
};

// Products API
const products = {
    getAll: async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Tidak terautentikasi');
            }

            const response = await fetch(`${BASE_URL}/produk/getallproduk`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            const data = await handleResponse(response);
            return { success: true, data: data.data };
        } catch (error) {
            console.error('Get all products error:', error);
            return { success: false, error: error.message };
        }
    },

    getById: async (id) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Tidak terautentikasi');
            }

            const response = await fetch(`${BASE_URL}/produk/by-id/${id}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await handleResponse(response);
            console.log('Product data from API:', data); // Debug log
            return { success: true, data: data };
        } catch (error) {
            console.error('Get product by ID error:', error);
            return { success: false, error: error.message };
        }
    },

    getByName: async (name) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Tidak terautentikasi');
            }

            const response = await fetch(`${BASE_URL}/produk/by-name/${encodeURIComponent(name)}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            const data = await handleResponse(response);
            return { success: true, data };
        } catch (error) {
            console.error('Get product by name error:', error);
            return { success: false, error: error.message };
        }
    },

    create: async (productData) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Tidak terautentikasi');
            }

            const response = await fetch(`${BASE_URL}/produk/createproduk`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(productData)
            });
            const data = await handleResponse(response);
            return { success: true, data };
        } catch (error) {
            let errorMessage = 'Gagal membuat produk: ';
            if (error.message.includes('duplicate key error')) {
                const match = error.message.match(/\{ _id: "(.+?)" \}/);
                const id = match ? match[1] : 'unknown';
                errorMessage += `ID ${id} sudah digunakan`;
            } else {
                errorMessage += error.message;
            }
            console.error(errorMessage);
            return { success: false, error: errorMessage };
        }
    },

    update: async (id, productData) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Tidak terautentikasi');
            }

            // Remove id_produk from body since it's in the URL
            const { id_produk, ...dataToSend } = productData;
            
            console.log('Sending update request:', {
                url: `${BASE_URL}/produk/update/${id}`,
                data: dataToSend
            });

            const response = await fetch(`${BASE_URL}/produk/update/${id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dataToSend)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Gagal untuk memperbarui data');
            }

            const data = await response.json();
            return { success: true, data };
        } catch (error) {
            console.error('Update product error:', error);
            return { success: false, error: error.message };
        }
    },

    delete: async (id) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Tidak terautentikasi');
            }

            const response = await fetch(`${BASE_URL}/produk/delete/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            await handleResponse(response);
            return { success: true };
        } catch (error) {
            console.error('Delete product error:', error);
            return { success: false, error: error.message };
        }
    },

    search: async (query) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Tidak terautentikasi');
            }

            const response = await fetch(`${BASE_URL}/produk/by-name/${encodeURIComponent(query)}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            const data = await handleResponse(response);
            return { success: true, data };
        } catch (error) {
            console.error('Search products error:', error);
            return { success: false, error: error.message };
        }
    },

    importData: async (formData) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Tidak terautentikasi');
            }

            const response = await fetch(`${BASE_URL}/produk/importdata`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                const errorMsg = data.error || data.message || 'Gagal mengimpor data';
                throw new Error(errorMsg);
            }

            if (data.skipped && data.skipped.length > 0) {
                return {
                    success: true,
                    message: `Berhasil mengimpor ${data.count || 0} produk. ${data.skipped.length} produk dilewati.`,
                    count: data.count || 0,
                    skipped: data.skipped,
                    warnings: data.warnings || []
                };
            }

            return {
                success: true,
                message: data.message || `Berhasil mengimpor ${data.count || 0} produk`,
                count: data.count || 0
            };
        } catch (error) {
            console.error('Import data error:', error);
            return {
                success: false,
                message: error.message,
                error: error.message
            };
        }
    }
};

// Sales API
const sales = {
    getAll: async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Tidak terautentikasi');
            }

            const response = await fetch(`${BASE_URL}/penjualan/getall`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            const data = await handleResponse(response);
            return { success: true, data: data.data };
        } catch (error) {
            console.error('Get sales error:', error);
            return { success: false, error: error.message };
        }
    },
    create: async (salesData) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Tidak terautentikasi');
            }

            const response = await fetch(`${BASE_URL}/penjualan/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(salesData),
            });
            const data = await handleResponse(response);
            return { success: true, data };
        } catch (error) {
            console.error('Create sales error:', error);
            return { success: false, error: error.message };
        }
    },
    update: async (id, salesData) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Tidak terautentikasi');
            }

            const response = await fetch(`${BASE_URL}/penjualan/update/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(salesData),
            });
            const data = await handleResponse(response);
            return { success: true, data };
        } catch (error) {
            console.error('Update sales error:', error);
            return { success: false, error: error.message };
        }
    },
    delete: async (id) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Tidak terautentikasi');
            }

            const response = await fetch(`${BASE_URL}/penjualan/delete/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            const data = await handleResponse(response);
            return { success: true, data };
        } catch (error) {
            console.error('Delete sales error:', error);
            return { success: false, error: error.message };
        }
    },
};

// Export the API modules
export const api = {
    auth,
    products,
    sales,
    users,
};

