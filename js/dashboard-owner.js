// API Base URL
const BASE_URL = "http://localhost:8080"; // Adjust this to match your backend URL

// Get token from localStorage
function getToken() {
  return localStorage.getItem('token');
}

// Show error message
function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'alert alert-danger alert-dismissible fade show';
  errorDiv.role = 'alert';
  errorDiv.innerHTML = `
    ${message}
    <button type="button" class="close" data-dismiss="alert" aria-label="Close">
      <span aria-hidden="true">&times;</span>
    </button>
  `;
  document.querySelector('.container-fluid').insertBefore(errorDiv, document.querySelector('.container-fluid').firstChild);
  
  // Auto dismiss after 5 seconds
  setTimeout(() => {
    errorDiv.remove();
  }, 5000);
}

// Handle API Response
async function handleResponse(response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.message ||
        errorData?.error ||
        `HTTP error! status: ${response.status}`
    );
  }
  const data = await response.json();
  return { success: true, data };
}

// Authentication API
async function auth() {
  console.log("Starting penjualan page initialization...");

  try {
    // Show loading indicator
    $(".loading").show();

    // Check authentication
    const token = localStorage.getItem("token");
    let userData = null;
    try {
      userData = JSON.parse(localStorage.getItem("userData"));
    } catch (error) {
      console.error("Error parsing userData:", error);
      throw new Error("Invalid user data");
    }

    if (!token || !userData) {
      throw new Error("Missing authentication data");
    }

    // Set username if authentication is valid
    const displayName =
      userData.role === "owner"
        ? "OwnerSRC"
        : userData.username || userData.name || "User";
    $("#username").text(displayName);
    $("#namaPenjual").val(displayName);

    // Load products first
    await loadProdukOptions();

    // Initialize DataTable
    await initializeDataTable();
    await setupEventHandlers();

    console.log("Page initialization completed successfully");
  } catch (error) {
    console.error("Initialization Error:", error);
    alert("Terjadi kesalahan saat memuat halaman: " + error.message);
    window.location.href = "../login.html";
  } finally {
    // Hide loading indicator
    $(".loading").hide();
  }
}

// Check authentication
function checkAuth() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token || !role || (role !== "admin" && role !== "owner")) {
    window.location.href = "../login.html";
    return false;
  }
  return true;
}

// Format number to Indonesian Rupiah
function formatRupiah(number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(number);
}

// Fungsi untuk mengambil data dashboard
async function fetchDashboardData() {
  try {
    // Get dashboard data
    const response = await fetch(`${BASE_URL}/dashboard/getdata`, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error("Gagal mengambil data dashboard");
    }

    const dashboardResponse = await response.json();
    console.log("Dashboard Response:", dashboardResponse); // Debug

    if (dashboardResponse.success && dashboardResponse.data) {
      const data = dashboardResponse.data;

      // Update total penjualan
      const salesElement = document.getElementById("totalSales");
      if (salesElement && data.total_sales !== undefined) {
        salesElement.textContent = formatRupiah(data.total_sales);
      }

      // Update total produk
      const productCountElement = document.getElementById("totalProducts");
      if (productCountElement && data.total_products !== undefined) {
        productCountElement.textContent = data.total_products.toString();
      }

      // Update total produk terjual
      const soldProductsElement = document.getElementById("totalProductsSales");
      if (soldProductsElement && data.total_sold !== undefined) {
        soldProductsElement.textContent = data.total_sold.toString();
      }

      // Get stock data for lowest stock products
      const stockResponse = await fetch(`${BASE_URL}/dashboard/stock`, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      if (stockResponse.ok) {
        const stockData = await stockResponse.json();
        if (stockData.success && stockData.data && stockData.data.length > 0) {
          // Update sisa stok with the lowest stock value
          const stockElement = document.getElementById("stok_barang");
          const stockDetailElement = document.getElementById("stok_detail");
          
          if (stockElement && stockDetailElement) {
            const lowestStock = Math.min(...stockData.data.map(item => item.stock));

            // Create carousel items for low stock products
            let carouselHtml = `
              <div id="lowStockCarousel" class="carousel slide" data-ride="carousel">
                <div class="carousel-inner">
            `;

            stockData.data.forEach((item, index) => {
              const stockClass = item.stock < 10 ? 'text-danger' : 'text-success';
              carouselHtml += `
                <div class="carousel-item ${index === 0 ? 'active' : ''}" data-interval="3000">
                  <div class="text-xs font-weight-bold ${stockClass} mb-1">
                    ${item.product_name}
                  </div>
                  <div class="h5 mb-0 font-weight-bold text-gray-800">
                    Stok: ${item.stock}
                  </div>
                </div>
              `;
            });

            carouselHtml += `
                </div>
              </div>
            `;

            stockDetailElement.innerHTML = carouselHtml;

            // Initialize carousel with auto-slide and smooth transition
            $('#lowStockCarousel').carousel({
              interval: 3000,
              ride: 'carousel',
              wrap: true,
              pause: 'hover'
            });

            // Update the first stock number
            stockElement.textContent = stockData.data[0].stock.toString();

            // Update stock number when carousel slides
            $('#lowStockCarousel').on('slide.bs.carousel', function (e) {
              const nextStock = stockData.data[e.to].stock;
              stockElement.textContent = nextStock.toString();
            });
          }
        }
      }
    } else {
      throw new Error(dashboardResponse.error || "Data tidak valid");
    }
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
  }
}

// Fungsi untuk memperbarui grafik
async function updateChart() {
  try {
    const selectedYear = document.getElementById('yearFilter').value;
    const selectedCategory = document.getElementById('categoryFilter').value;

    // Get sales data from API
    const response = await fetch(`${BASE_URL}/dashboard/sales?year=${selectedYear}&category=${selectedCategory}`, {
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch sales data');
    }

    const salesData = await response.json();
    
    if (!salesData.success || !salesData.data) {
      throw new Error('Invalid sales data format');
    }

    // Process the data
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const quantities = new Array(12).fill(0);
    const sales = new Array(12).fill(0);

    // Populate data arrays
    salesData.data.forEach(item => {
      const monthIndex = new Date(item.tanggal).getMonth();
      quantities[monthIndex] += parseInt(item.jumlah_produk);
      sales[monthIndex] += parseFloat(item.total);
    });

    // Update chart data
    mainChart.data.labels = months;
    mainChart.data.datasets[0].data = quantities;
    mainChart.data.datasets[1].data = sales;

    mainChart.update();
  } catch (error) {
    console.error('Error updating chart:', error);
    showError('Gagal memperbarui grafik: ' + error.message);
  }
}

// Fungsi untuk memuat opsi kategori
async function loadKategoriOptions() {
  try {
    const response = await fetch(`${BASE_URL}/kategori/getall`, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error("Gagal mengambil data kategori");
    }

    const data = await response.json();
    console.log("Kategori Response:", data); // Debug

    const kategoriFilter = document.getElementById("kategoriFilter");
    kategoriFilter.innerHTML = '<option value="">Semua Kategori</option>'; // Reset options

    if (data.success && Array.isArray(data.data)) {
      data.data.forEach((kategori) => {
        const option = document.createElement("option");
        option.value = kategori.id_kategori;
        option.textContent = kategori.nama_kategori;
        kategoriFilter.appendChild(option);
      });
    } else {
      throw new Error("Data kategori tidak valid");
    }
  } catch (error) {
    console.error("Error loading kategori options:", error);
    showError("Gagal memuat data kategori: " + error.message);
  }
}

// Fungsi untuk memuat opsi tahun
function loadYearOptions() {
  const yearFilter = document.getElementById("yearFilter");
  yearFilter.innerHTML = ''; // Reset options

  // Get current year
  const currentYear = new Date().getFullYear();
  
  // Add last 5 years as options
  for (let year = currentYear; year >= currentYear - 4; year--) {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    yearFilter.appendChild(option);
  }
}

// Fungsi untuk menginisialisasi dashboard
async function initializeDashboard() {
  try {
    // Inisialisasi grafik
    await initializeCharts();

    // Muat opsi filter
    loadYearOptions();
    await loadKategoriOptions();

    // Tambahkan event listener untuk filter
    document
      .getElementById("chartType")
      .addEventListener("change", updateChart);
    document
      .getElementById("yearFilter")
      .addEventListener("change", updateChart);
    document
      .getElementById("monthFilter")
      .addEventListener("change", updateChart);
    document
      .getElementById("kategoriFilter")
      .addEventListener("change", updateChart);

    // Update grafik pertama kali
    await updateChart();
  } catch (error) {
    console.error("Error initializing dashboard:", error);
  }
}

// Fungsi untuk memperbarui tabel produk terlaris
async function updateBestSellingProductsTable() {
  try {
    if (!checkAuth()) return;

    const response = await fetch(`${BASE_URL}/dashboard/sales?limit=10`, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error("Gagal mengambil data produk terlaris");
    }

    const jsonResponse = await response.json();
    console.log("Best Selling Products Response:", jsonResponse); // Debug

    if (!jsonResponse.success || !jsonResponse.data) {
      throw new Error(jsonResponse.error || "Data tidak valid");
    }

    const tableBody = document.getElementById("produkTerlarisBody");
    if (!tableBody) {
      throw new Error("Tabel produk terlaris tidak ditemukan");
    }

    tableBody.innerHTML = "";

    if (Array.isArray(jsonResponse.data) && jsonResponse.data.length > 0) {
      jsonResponse.data.forEach((product, index) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${index + 1}</td>
          <td>${product.nama_produk || "Nama Tidak Tersedia"}</td>
          <td>${product.jumlah_terjual || 0}</td>
        `;
        tableBody.appendChild(row);
      });
    } else {
      tableBody.innerHTML = `
        <tr>
          <td colspan="3" class="text-center">Tidak ada data produk terlaris</td>
        </tr>
      `;
    }
  } catch (error) {
    console.error("Error updating best selling products table:", error);
    const tableBody = document.getElementById("produkTerlarisBody");
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="3" class="text-center text-danger">
            Gagal memuat data: ${error.message}
          </td>
        </tr>
      `;
    }
  }
}

// Inisialisasi saat dokumen dimuat
document.addEventListener("DOMContentLoaded", () => {
  if (window.location.pathname.includes("index-owner.html")) {
    initializeDashboard();
    fetchDashboardData();
    updateBestSellingProductsTable();

    // Set up auto-refresh interval
    setInterval(async () => {
      console.log("Auto-refreshing dashboard data...");
      await fetchDashboardData();
      await updateBestSellingProductsTable();
      await updateChart();
    }, 3600 * 1000); // Refresh every hour
  }
});

// Users API
const users = {
  login: async (credentials) => {
    try {
      const response = await fetch(`${BASE_URL}/user/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      });
      const data = await handleResponse(response);
      if (data.success && data.data.token) {
        localStorage.setItem("token", data.data.token);
        localStorage.setItem("role", data.data.role);
        localStorage.setItem(
          "userData",
          JSON.stringify({
            username: credentials.username,
            role: data.data.role,
            name: data.data.name || credentials.username,
          })
        );

        // Check if role is admin or owner
        if (["admin", "owner"].includes(data.data.role)) {
          return { success: true, data: data.data };
        }
        return { success: false, error: "Unauthorized role" };
      }
      return { success: false, error: "Invalid response from server" };
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, error: error.message };
    }
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("userData");
    window.location.href = "../login.html";
  },

  getAll: async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Tidak terautentikasi");
      }

      const response = await fetch(`${BASE_URL}/user/getall`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await handleResponse(response);
      return { success: true, data: data.data };
    } catch (error) {
      console.error("Get users error:", error);
      return { success: false, error: error.message };
    }
  },

  getByUsername: async (username) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Tidak terautentikasi");
      }

      const response = await fetch(`${BASE_URL}/user/by-username/${username}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await handleResponse(response);
      return { success: true, data: data.data };
    } catch (error) {
      console.error("Get user error:", error);
      return { success: false, error: error.message };
    }
  },

  getAllUsers: async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Tidak terautentikasi");
      }

      const response = await fetch(`${BASE_URL}/user/getall`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return handleResponse(response);
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  create: async (userData) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Tidak terautentikasi");
      }

      const response = await fetch(`${BASE_URL}/user/admin/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(userData),
      });
      return handleResponse(response);
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  updateUser: async (username, userData) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Tidak terautentikasi");
      }

      console.log("Sending request with token:", token); // Debug log

      const response = await fetch(
        `${BASE_URL}/user/admin/update/${username}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(userData),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.message || `HTTP error! status: ${response.status}`
        );
      }

      const data = await response.json();
      return { success: true, data: data.data };
    } catch (error) {
      console.error("Update user error:", error);
      return { success: false, error: error.message };
    }
  },

  delete: async (id_user) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Tidak terautentikasi");
      }

      const response = await fetch(
        `${BASE_URL}/user/admin/delete-user/${id_user}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      return handleResponse(response);
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
};

// Products API
const products = {
  getAll: async function () {
    try {
      const response = await fetch(`${BASE_URL}/produk/getallproduk`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const result = await handleResponse(response);
      return result.data;
    } catch (error) {
      console.error("Error fetching products:", error);
      throw error;
    }
  },

  // Fungsi untuk mendapatkan produk yang mendekati kadaluarsa
  getNearExpiry: async function (daysThreshold = 30) {
    try {
      const response = await fetch(`${BASE_URL}/produk/getnearexpiry/${daysThreshold}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const result = await handleResponse(response);
      return result.data;
    } catch (error) {
      console.error(`Error fetching products near expiry (${daysThreshold} days):`, error);
      throw error;
    }
  },

  getById: async (id) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Tidak terautentikasi");
      }

      const response = await fetch(`${BASE_URL}/produk/by-id/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.clear();
          window.location.href = "../login.html";
          return;
        }
        throw new Error("Gagal mengambil data produk");
      }

      const result = await response.json();
      return { success: true, data: result.data };
    } catch (error) {
      console.error("Get product error:", error);
      return { success: false, error: error.message };
    }
  },

  getByName: async (name) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Tidak terautentikasi");
      }

      const response = await fetch(
        `${BASE_URL}/produk/by-name/${encodeURIComponent(name)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      const data = await handleResponse(response);
      return { success: true, data };
    } catch (error) {
      console.error("Get product by name error:", error);
      return { success: false, error: error.message };
    }
  },

  create: async (productData) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Tidak terautentikasi");
      }

      const response = await fetch(`${BASE_URL}/produk/createproduk`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(productData),
      });
      const data = await handleResponse(response);
      return { success: true, data };
    } catch (error) {
      let errorMessage = "Gagal membuat produk: ";
      if (error.message.includes("duplicate key error")) {
        const match = error.message.match(/\{ id_produk: "(.+?)" \}/);
        const id = match ? match[1] : "unknown";
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
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Tidak terautentikasi");
      }

      // Remove id_produk from body since it's in the URL
      const { id_produk, ...dataToSend } = productData;

      console.log("Sending update request:", {
        url: `${BASE_URL}/produk/update/${id}`,
        data: dataToSend,
      });

      const response = await fetch(`${BASE_URL}/produk/update/${id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dataToSend),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Gagal untuk memperbarui data");
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error("Update product error:", error);
      return { success: false, error: error.message };
    }
  },

  delete: async (id) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Tidak terautentikasi");
      }

      const response = await fetch(`${BASE_URL}/produk/delete/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      await handleResponse(response);
      return { success: true };
    } catch (error) {
      console.error("Delete product error:", error);
      return { success: false, error: error.message };
    }
  },

  search: async (query) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Tidak terautentikasi");
      }

      const response = await fetch(
        `${BASE_URL}/produk/by-name/${encodeURIComponent(query)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      const data = await handleResponse(response);
      return { success: true, data };
    } catch (error) {
      console.error("Search products error:", error);
      return { success: false, error: error.message };
    }
  },

  importData: async (formData) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Tidak terautentikasi");
      }

      const response = await fetch(`${BASE_URL}/produk/importdata`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || data.message || "Gagal mengimpor data";
        throw new Error(errorMsg);
      }

      if (data.skipped && data.skipped.length > 0) {
        return {
          success: true,
          message: `Berhasil mengimpor ${data.count || 0} produk. ${
            data.skipped.length
          } produk dilewati.`,
          count: data.count || 0,
          skipped: data.skipped,
          warnings: data.warnings || [],
        };
      }

      return {
        success: true,
        message: data.message || `Berhasil mengimpor ${data.count || 0} produk`,
        count: data.count || 0,
      };
    } catch (error) {
      console.error("Import data error:", error);
      return {
        success: false,
        message: error.message,
        error: error.message,
      };
    }
  },

  getLowestStock: async function () {
    try {
      const response = await fetch(`${BASE_URL}/produk/getloweststock`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch lowest stock products");
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error("Error fetching lowest stock products:", error);
      return [];
    }
  },
};

// Sales API
const sales = {
  getAll: async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Tidak terautentikasi");
      }

      const response = await fetch(`${BASE_URL}/penjualan/getall`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await handleResponse(response);
      return { success: true, data: data.data };
    } catch (error) {
      console.error("Get sales error:", error);
      return { success: false, error: error.message };
    }
  },
  create: async (salesData) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Tidak terautentikasi");
      }

      const response = await fetch(`${BASE_URL}/penjualan/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(salesData),
      });
      const data = await handleResponse(response);
      return { success: true, data };
    } catch (error) {
      console.error("Create sales error:", error);
      return { success: false, error: error.message };
    }
  },
  update: async (id, salesData) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Tidak terautentikasi");
      }

      const response = await fetch(`${BASE_URL}/penjualan/update/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(salesData),
      });
      const data = await handleResponse(response);
      return { success: true, data };
    } catch (error) {
      console.error("Update sales error:", error);
      return { success: false, error: error.message };
    }
  },
  delete: async (id) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Tidak terautentikasi");
      }

      const response = await fetch(`${BASE_URL}/penjualan/delete/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await handleResponse(response);
      return { success: true, data };
    } catch (error) {
      console.error("Delete sales error:", error);
      return { success: false, error: error.message };
    }
  },
};

// Dashboard API
const dashboard = {
  // Fetch all dashboard data
  getDashboardData: async (filters = {}) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Authentication required");

      const queryParams = new URLSearchParams({
        year: filters.year || new Date().getFullYear(),
        month: filters.month || "",
        kategori: filters.kategori || "",
        subkategori: filters.subkategori || "",
      }).toString();

      const response = await fetch(`${BASE_URL}/dashboard?${queryParams}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return await handleResponse(response);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      throw error;
    }
  },

  // Get sales data dengan filter
  getSalesData: async (filters = {}) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Authentication required");

      const queryParams = new URLSearchParams({
        year: filters.year || new Date().getFullYear(),
        month: filters.month || "",
        kategori: filters.kategori || "",
        subkategori: filters.subkategori || "",
        type: filters.type || "quantity", // 'quantity' or 'value'
      }).toString();

      const response = await fetch(`${BASE_URL}/dashboard/sales?${queryParams}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return await handleResponse(response);
    } catch (error) {
      console.error("Error fetching sales data:", error);
      throw error;
    }
  },

  // Get category sales data
  getCategorySales: async (filters = {}) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Authentication required");

      const queryParams = new URLSearchParams({
        year: filters.year || new Date().getFullYear(),
        month: filters.month || "",
        type: filters.type || "quantity", // 'quantity' or 'value'
      }).toString();

      const response = await fetch(`${BASE_URL}/dashboard/category-sales?${queryParams}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return await handleResponse(response);
    } catch (error) {
      console.error("Error fetching category sales data:", error);
      throw error;
    }
  },

  // Get stock data dengan filter kategori
  getStockByCategory: async (filters = {}) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Authentication required");

      const queryParams = new URLSearchParams({
        kategori: filters.kategori || "",
        subkategori: filters.subkategori || "",
      }).toString();

      const response = await fetch(`${BASE_URL}/dashboard/stock?${queryParams}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return await handleResponse(response);
    } catch (error) {
      console.error("Error fetching stock data:", error);
      throw error;
    }
  },
};

// Konfigurasi Chart.js
let mainChart = null;

// Fungsi untuk menginisialisasi grafik
async function initializeCharts() {
  const ctx = document.getElementById('salesChart').getContext('2d');
  
  // Destroy existing chart if it exists
  if (mainChart) {
    mainChart.destroy();
  }

  mainChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Jumlah Terjual',
          data: [],
          backgroundColor: 'rgba(78, 115, 223, 0.8)',
          borderColor: 'rgba(78, 115, 223, 1)',
          borderWidth: 1,
          yAxisID: 'y-axis-quantity'
        },
        {
          label: 'Total Penjualan (Rp)',
          data: [],
          type: 'line',
          borderColor: 'rgba(231, 74, 59, 1)',
          borderWidth: 2,
          fill: false,
          tension: 0.4,
          yAxisID: 'y-axis-sales'
        }
      ]
    },
    options: {
      responsive: true,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      scales: {
        x: {
          grid: {
            display: true,
            drawBorder: true,
            drawOnChartArea: true,
            drawTicks: true,
          },
          ticks: {
            maxRotation: 0,
            minRotation: 0
          }
        },
        'y-axis-quantity': {
          type: 'linear',
          position: 'left',
          grid: {
            drawOnChartArea: true
          },
          ticks: {
            beginAtZero: true,
            callback: function(value) {
              if (Math.floor(value) === value) {
                return value;
              }
            }
          }
        },
        'y-axis-sales': {
          type: 'linear',
          position: 'right',
          grid: {
            drawOnChartArea: false
          },
          ticks: {
            beginAtZero: true,
            callback: function(value) {
              return 'Rp ' + value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
            }
          }
        }
      },
      plugins: {
        title: {
          display: true,
          text: 'Grafik Penjualan per Bulan',
          font: {
            size: 16
          }
        },
        legend: {
          display: true,
          position: 'bottom'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if (context.dataset.yAxisID === 'y-axis-sales') {
                label += 'Rp ' + context.parsed.y.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
              } else {
                label += context.parsed.y;
              }
              return label;
            }
          }
        }
      },
    }
  });

  // Initial update
  await updateChart();
}

// Inisialisasi saat dokumen dimuat
document.addEventListener("DOMContentLoaded", () => {
  if (window.location.pathname.includes("index-owner.html")) {
    initializeDashboard();
    fetchDashboardData();
    updateBestSellingProductsTable();

    // Set up auto-refresh interval
    setInterval(async () => {
      console.log("Auto-refreshing dashboard data...");
      await fetchDashboardData();
      await updateBestSellingProductsTable();
      await updateChart();
    }, 3600 * 1000); // Refresh every hour
  }
});