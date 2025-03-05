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
async function auth() {
    console.log('Starting penjualan page initialization...');
    
    try {
        // Show loading indicator
        $('.loading').show();
        
        // Check authentication
        const token = localStorage.getItem('token');
        let userData = null;
        try {
            userData = JSON.parse(localStorage.getItem('userData'));
        } catch (error) {
            console.error('Error parsing userData:', error);
            throw new Error('Invalid user data');
        }

        if (!token || !userData) {
            throw new Error('Missing authentication data');
        }

        // Set username if authentication is valid
        const displayName = userData.role === 'owner' ? 'OwnerSRC' : (userData.username || userData.name || 'User');
        $('#username').text(displayName);
        $('#namaPenjual').val(displayName);

        // Load products first
        await loadProdukOptions();

        // Initialize DataTable
        await initializeDataTable();
        await setupEventHandlers();
        
        console.log('Page initialization completed successfully');
    } catch (error) {
        console.error('Initialization Error:', error);
        alert('Terjadi kesalahan saat memuat halaman: ' + error.message);
        window.location.href = '../login.html';
    } finally {
        // Hide loading indicator
        $('.loading').hide();
    }
}

    // Check authentication
    function checkAuth() {
      const token = localStorage.getItem("token");
      const role = localStorage.getItem("role");

      if (!token || !role || role !== "admin" && role !== "owner") {
        window.location.href = "../login.html";
        return false;
      }
      return true;
    }

// Format currency in Indonesian Rupiah
    function formatRupiah(number) {
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(number);
    }

// Fungsi untuk mengambil data pengguna aktif, total produk, dan total penjualan
    async function fetchDashboardData() {
      if (!checkAuth()) return;

      try {
        // Fetch products
        const productsResponse = await api.products.getAll();
        const productCountElement = document.getElementById('totalProducts');

        if (productsResponse.success && productsResponse.data) {
          const products = Array.isArray(productsResponse.data)
            ? productsResponse.data
            : (Array.isArray(productsResponse.data.data)
              ? productsResponse.data.data
              : []);

          if (productCountElement) {
            productCountElement.textContent = products.length.toString();
          }
        } else {
          if (productCountElement) {
            productCountElement.textContent = "0";
          }
          console.error("Failed to fetch products:", productsResponse.error);
        }

        // Fetch users
        const usersResponse = await api.users.getAll();
        const userCountElement = document.getElementById('activeUsers');

        if (usersResponse.success && usersResponse.data) {
          const users = Array.isArray(usersResponse.data)
            ? usersResponse.data
            : (Array.isArray(usersResponse.data.data)
              ? usersResponse.data.data
              : []);

          if (userCountElement) {
            userCountElement.textContent = users.length.toString();
          }
        } else {
          if (userCountElement) {
            userCountElement.textContent = "0";
          }
          console.error("Failed to fetch users:", usersResponse.error);
        }

        /// Fetch sales
        const salesResponse = await api.sales.getAll();
        console.log('Sales Response:', salesResponse); // Log respon

        const salesElement = document.getElementById('totalSales');

        if (salesResponse.success && salesResponse.data) {
          const sales = Array.isArray(salesResponse.data)
            ? salesResponse.data
            : (Array.isArray(salesResponse.data.data)
              ? salesResponse.data.data
              : []);

          console.log('Sales Data:', sales); // Log data penjualan

          // Calculate total sales
          const totalSales = sales.reduce((total, sale) => {
            console.log('Current Sale:', sale); // Log setiap penjualan
            return total + (sale.total || 0); // Pastikan menggunakan field yang benar
          }, 0);

          if (salesElement) {
            salesElement.textContent = formatRupiah(totalSales);
          }
        } else {
          if (salesElement) {
            salesElement.textContent = formatRupiah(0);
          }
          console.error("Failed to fetch sales:", salesResponse.error);
        }

      } catch (error) {
        console.error('Error fetching dashboard data:', error);

        // Update elements to show 0 if there's an error
        const productCountElement = document.getElementById('totalProducts');
        const userCountElement = document.getElementById('activeUsers');
        const salesElement = document.getElementById('totalSales');

        if (productCountElement) productCountElement.textContent = "0";
        if (userCountElement) userCountElement.textContent = "0";
        if (salesElement) salesElement.textContent = formatRupiah(0);
      }
    }

    // Panggil fungsi saat halaman dimuat
    document.addEventListener('DOMContentLoaded', fetchDashboardData);

// Users API
const users = {
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
                    role: data.data.role,
                    name: data.data.name || credentials.username
                }));
                
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
        window.location.href = '../login.html';
    },

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

            console.log('Sending request with token:', token); // Debug log

            const response = await fetch(`${BASE_URL}/user/admin/update/${username}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(userData)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(errorData?.message || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return { success: true, data: data.data };
        } catch (error) {
            console.error('Update user error:', error);
            return { success: false, error: error.message };
        }
    },

    delete: async (id_user) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Tidak terautentikasi');
            }

            const response = await fetch(`${BASE_URL}/user/admin/delete-user/${id_user}`, {
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

            // Tangani error non-200 response
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Server response:', {
                    status: response.status,
                    statusText: response.statusText,
                    body: errorText
                });
                throw new Error(`Server error: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            console.log('Raw API Response:', result);

            // Pastikan data memiliki struktur yang benar
            if (!result || !result.data) {
                console.warn('Invalid response format:', result);
                return { success: false, error: 'Invalid response format', data: [] };
            }

            // Kembalikan data mentah dari API
            return { 
                success: true, 
                data: result.data 
            };
        } catch (error) {
            console.error('Get all products error:', error);
            return { 
                success: false, 
                error: error.message,
                data: [] 
            };
        }
    },

    getById: async (id) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Tidak terautentikasi');
            }

            const response = await fetch(`${BASE_URL}/produk/by-id/${id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.clear();
                    window.location.href = '../login.html';
                    return;
                }
                throw new Error('Gagal mengambil data produk');
            }

            const result = await response.json();
            return { success: true, data: result.data };
        } catch (error) {
            console.error('Get product error:', error);
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
                const match = error.message.match(/\{ id_produk: "(.+?)" \}/);
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

// Dashboard API
const dashboard = {
    // Fetch all dashboard data
    async getDashboardData() {
        try {
            const [productsData, salesData] = await Promise.all([
                products.getAll(),
                sales.getAll()
            ]);

            console.log('Products Data:', productsData);
            console.log('Sales Data:', salesData);

            if (!productsData.success || !salesData.success) {
                throw new Error('Failed to fetch data');
            }

            // Calculate dashboard metrics
            const productsList = Array.isArray(productsData.data) ? productsData.data : 
                               Array.isArray(productsData.data?.data) ? productsData.data.data : [];
            const salesList = Array.isArray(salesData.data) ? salesData.data : 
                            Array.isArray(salesData.data?.data) ? salesData.data.data : [];

            console.log('Processed Products List:', productsList);
            console.log('Processed Sales List:', salesList);

            // Calculate total sales
            const totalSales = salesList.reduce((total, sale) => total + (Number(sale.total) || 0), 0);

            // Calculate total products and remaining stock
            const totalProducts = productsList.length;
            const remainingStock = productsList.reduce((total, product) => total + (Number(product.stok) || 0), 0);

            // Calculate total products sold
            const totalProductsSold = salesList.reduce((total, sale) => {
                const detailPenjualan = Array.isArray(sale.detail_penjualan) ? sale.detail_penjualan : [];
                return total + detailPenjualan.reduce((subtotal, detail) => subtotal + (Number(detail.jumlah) || 0), 0);
            }, 0);

            return {
                success: true,
                data: {
                    totalSales,
                    totalProducts,
                    remainingStock,
                    totalProductsSold
                }
            };
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            return { success: false, error: error.message };
        }
    },

    // Get monthly and weekly sales data for chart
    async getMonthlySales() {
        try {
            const salesData = await sales.getAll();
            console.log('Monthly Sales Data:', salesData);

            if (!salesData.success) {
                throw new Error('Failed to fetch sales data');
            }

            const salesList = Array.isArray(salesData.data) ? salesData.data : 
                            Array.isArray(salesData.data?.data) ? salesData.data.data : [];

            console.log('Processed Monthly Sales List:', salesList);
            const monthlyData = new Map();
            const weeklyData = new Map();

            // Group sales by month and week
            salesList.forEach(sale => {
                if (!sale.tanggal_penjualan) return;
                
                const date = new Date(sale.tanggal_penjualan);
                const total = Number(sale.total) || 0;

                // Monthly data
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                const currentMonthTotal = monthlyData.get(monthKey) || 0;
                monthlyData.set(monthKey, currentMonthTotal + total);

                // Weekly data
                const weekKey = getWeekKey(date);
                const currentWeekTotal = weeklyData.get(weekKey) || 0;
                weeklyData.set(weekKey, currentWeekTotal + total);
            });

            // Convert to array and sort by date
            const monthlyChartData = Array.from(monthlyData.entries())
                .sort()
                .map(([month, total]) => ({
                    month: month,
                    total: total
                }));

            const weeklyChartData = Array.from(weeklyData.entries())
                .sort()
                .map(([week, total]) => ({
                    week: week,
                    total: total
                }));

            return { 
                success: true, 
                data: {
                    monthly: monthlyChartData,
                    weekly: weeklyChartData
                }
            };
        } catch (error) {
            console.error('Error fetching sales data:', error);
            return { success: false, error: error.message };
        }
    },

    // Get top selling products
    async getTopProducts() {
        try {
            const [productsData, salesData] = await Promise.all([
                products.getAll(),
                sales.getAll()
            ]);

            console.log('Top Products - Products Data:', productsData);
            console.log('Top Products - Sales Data:', salesData);

            if (!productsData.success || !salesData.success) {
                throw new Error('Failed to fetch data');
            }

            const productsList = Array.isArray(productsData.data) ? productsData.data : 
                               Array.isArray(productsData.data?.data) ? productsData.data.data : [];
            const salesList = Array.isArray(salesData.data) ? salesData.data : 
                            Array.isArray(salesData.data?.data) ? salesData.data.data : [];

            console.log('Processed Products List:', productsList);
            console.log('Processed Sales List:', salesList);

            // Create map of product sales
            const productSales = new Map();

            // Calculate total sales for each product
            salesList.forEach(sale => {
                const detailPenjualan = Array.isArray(sale.detail_penjualan) ? sale.detail_penjualan : [];
                detailPenjualan.forEach(detail => {
                    if (!detail.id_produk) return;
                    
                    const productId = detail.id_produk;
                    const currentStats = productSales.get(productId) || { total_terjual: 0, total_penjualan: 0 };
                    productSales.set(productId, {
                        total_terjual: currentStats.total_terjual + (Number(detail.jumlah) || 0),
                        total_penjualan: currentStats.total_penjualan + (Number(detail.subtotal) || 0)
                    });
                });
            });

            // Combine with product data and sort by total sold
            const topProducts = productsList
                .map(product => {
                    const stats = productSales.get(product.id_produk) || { total_terjual: 0, total_penjualan: 0 };
                    return {
                        nama_produk: product.nama_produk,
                        total_terjual: stats.total_terjual,
                        total_penjualan: stats.total_penjualan
                    };
                })
                .sort((a, b) => b.total_terjual - a.total_terjual)
                .slice(0, 10); // Get top 10 products

            return { success: true, data: topProducts };
        } catch (error) {
            console.error('Error fetching top products:', error);
            return { success: false, error: error.message };
        }
    }
};

// Get week number key for grouping
function getWeekKey(date) {
    const startDate = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date - startDate) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((days + startDate.getDay() + 1) / 7);
    return `${date.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}

// Update dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('index-owner.html')) {
        updateDashboardData();
        // Update dashboard every 5 minutes
        setInterval(updateDashboardData, 300000);
    }
});

// Update sales chart
function updateSalesChart(data) {
    const ctx = document.getElementById('salesChart');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (window.salesChart instanceof Chart) {
        window.salesChart.destroy();
    }

    const months = data.monthly.map(item => item.month);
    const monthlySales = data.monthly.map(item => item.total);
    const weeks = data.weekly.map(item => item.week);
    const weeklySales = data.weekly.map(item => item.total);

    window.salesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [
                {
                    label: 'Penjualan Bulanan',
                    data: monthlySales,
                    borderColor: '#e74a3b',
                    backgroundColor: 'rgba(231, 74, 59, 0.1)',
                    borderWidth: 2,
                    fill: true
                },
                {
                    label: 'Penjualan Mingguan',
                    data: weeklySales,
                    labels: weeks,
                    borderColor: '#4e73df',
                    backgroundColor: 'rgba(78, 115, 223, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    hidden: true // Default hidden, can be toggled
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatRupiah(value);
                        },
                        stepSize: 50000 // Set step size to 50000
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    onClick: function(e, legendItem, legend) {
                        const index = legendItem.datasetIndex;
                        const ci = legend.chart;
                        const meta = ci.getDatasetMeta(index);

                        // Toggle visibility
                        meta.hidden = meta.hidden === null ? !ci.data.datasets[index].hidden : null;

                        // Update labels if switching between weekly/monthly
                        if (index === 1) { // Weekly dataset
                            ci.data.labels = meta.hidden ? months : weeks;
                        } else { // Monthly dataset
                            ci.data.labels = months;
                        }

                        ci.update();
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatRupiah(context.parsed.y)}`;
                        }
                    }
                }
            }
        }
    });
}

// Update top products table
function updateTopProductsTable(products) {
    const tableBody = document.querySelector('#topProductsTable tbody');
    if (!tableBody) return;

    tableBody.innerHTML = '';
    products.forEach((product, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${product.nama_produk}</td>
            <td>${product.total_terjual}</td>
            <td>${formatRupiah(product.total_penjualan)}</td>
        `;
        tableBody.appendChild(row);
    });
}

// Update dashboard data
async function updateDashboardData() {
    if (!checkAuth()) return;

    try {
        // Fetch dashboard summary
        const dashboardData = await dashboard.getDashboardData();
        if (dashboardData.success) {
            // Update total sales
            const totalSalesElement = document.getElementById('totalSales');
            if (totalSalesElement) {
                totalSalesElement.textContent = formatRupiah(dashboardData.data.totalSales || 0);
            }

            // Update total products
            const totalProductsElement = document.getElementById('totalProducts');
            if (totalProductsElement) {
                totalProductsElement.textContent = dashboardData.data.totalProducts || 0;
            }

            // Update products sold
            const totalProductsSalesElement = document.getElementById('totalProductsSales');
            if (totalProductsSalesElement) {
                totalProductsSalesElement.textContent = dashboardData.data.totalProductsSold || 0;
            }

            // Update remaining stock
            const remainingStockElement = document.getElementById('stok_barang');
            if (remainingStockElement) {
                remainingStockElement.textContent = dashboardData.data.remainingStock || 0;
            }
        }

        // Fetch and update monthly sales chart
        const monthlySalesData = await dashboard.getMonthlySales();
        if (monthlySalesData.success) {
            updateSalesChart(monthlySalesData.data);
        }

        // Fetch and update top products
        const topProductsData = await dashboard.getTopProducts();
        if (topProductsData.success) {
            updateTopProductsTable(topProductsData.data);
        }

    } catch (error) {
        console.error('Error updating dashboard:', error);
    }
}

// Export the API modules
export const api = {
    auth,
    checkAuth,
    users,
    products,
    sales,
    dashboard,
    formatRupiah
};
