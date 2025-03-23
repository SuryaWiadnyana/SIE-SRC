// Memuat opsi kategori
async function loadKategoriOptions() {
  try {
    // Mengambil data kategori dari API
    const response = await fetch(`${BASE_URL}/kategori/getall`, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error("Gagal mengambil data kategori");
    }

    const data = await response.json();
    const kategoriFilter = document.getElementById("kategoriFilter");

    // Menambahkan opsi 'Semua Kategori'
    kategoriFilter.innerHTML = '<option value="">Semua Kategori</option>';

    // Menambahkan opsi untuk setiap kategori
    if (data.success && data.data) {
      data.data.forEach((kategori) => {
        const option = document.createElement("option");
        option.value = kategori.id_kategori;
        option.textContent = kategori.nama_kategori;
        kategoriFilter.appendChild(option);
      });
    }
  } catch (error) {
    console.error("Error memuat kategori:", error);
    showError("Gagal memuat data kategori");
  }
}

// Memuat opsi tahun
function loadYearOptions() {
  const yearFilter = document.getElementById("yearFilter");
  const currentYear = new Date().getFullYear();

  // Menambahkan opsi untuk 5 tahun terakhir
  for (let year = currentYear; year >= currentYear - 4; year--) {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    if (year === currentYear) {
      option.selected = true;
    }
    yearFilter.appendChild(option);
  }
}

// Inisialisasi dashboard
async function initializeDashboard() {
  try {
    // Memeriksa autentikasi
    if (!checkAuth()) {
      return;
    }

    // Memuat opsi filter
    loadYearOptions();
    await loadKategoriOptions();

    // Mengambil data dashboard
    await fetchDashboardData();

    // Menambahkan event listener untuk filter
    document.getElementById("yearFilter").addEventListener("change", updateChart);
    document.getElementById("monthFilter").addEventListener("change", updateChart);
    document.getElementById("kategoriFilter").addEventListener("change", updateChart);
    document.getElementById("chartTypeFilter").addEventListener("change", updateChart);

  } catch (error) {
    console.error("Error inisialisasi dashboard:", error);
    showError("Gagal menginisialisasi dashboard");
  }
}

// Konfigurasi URL API
const BASE_URL = "http://localhost:8080"; // URL dasar untuk API

// Mengambil token dari localStorage
function getToken() {
  return localStorage.getItem('token'); // Mengambil token dari penyimpanan lokal
}

// Menampilkan pesan error
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
  
  // Otomatis menghilangkan pesan setelah 5 detik
  setTimeout(() => {
    errorDiv.remove();
  }, 5000);
}

// Menangani respons dari API
async function handleResponse(response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.message ||
        errorData?.error ||
        `Error HTTP! status: ${response.status}`
    );
  }
  const data = await response.json();
  return { success: true, data };
}

// API Autentikasi
async function auth() {
  console.log("Memulai inisialisasi halaman penjualan...");

  try {
    // Menampilkan indikator loading
    $(".loading").show();

    // Memeriksa autentikasi
    const token = localStorage.getItem("token");
    let userData = null;
    try {
      userData = JSON.parse(localStorage.getItem("userData"));
    } catch (error) {
      console.error("Error parsing userData:", error);
      throw new Error("Data pengguna tidak valid");
    }

    if (!token || !userData) {
      throw new Error("Data autentikasi tidak ditemukan");
    }

    // Mengatur nama pengguna jika autentikasi valid
    const displayName =
      userData.role === "owner"
        ? "OwnerSRC"
        : userData.username || userData.name || "User";
    $("#username").text(displayName);
    $("#namaPenjual").val(displayName);

    // Memuat data produk terlebih dahulu
    await loadProdukOptions();

    // Inisialisasi DataTable
    await initializeDataTable();
    await setupEventHandlers();

    console.log("Inisialisasi halaman berhasil");
  } catch (error) {
    console.error("Error Inisialisasi:", error);
    alert("Terjadi kesalahan saat memuat halaman: " + error.message);
    window.location.href = "../login.html";
  } finally {
    // Menyembunyikan indikator loading
    $(".loading").hide();
  }
}

// Memeriksa status autentikasi
function checkAuth() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token || !role || (role !== "admin" && role !== "owner")) {
    window.location.href = "../login.html";
    return false;
  }
  return true;
}

// Format angka ke format Rupiah Indonesia
function formatRupiah(number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(number);
}

// Mengambil data dashboard
async function fetchDashboardData() {
  try {
    // Mengambil data dashboard
    const response = await fetch(`${BASE_URL}/dashboard/getdata`, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error("Gagal mengambil data dashboard");
    }

    const dashboardResponse = await response.json();
    console.log("Respons Dashboard:", dashboardResponse);

    if (dashboardResponse.success && dashboardResponse.data) {
      const data = dashboardResponse.data;

      // Memperbarui total penjualan
      const salesElement = document.getElementById("totalSales");
      if (salesElement && data.total_sales !== undefined) {
        salesElement.textContent = formatRupiah(data.total_sales);
      }

      // Memperbarui total produk
      const productCountElement = document.getElementById("totalProducts");
      if (productCountElement && data.total_products !== undefined) {
        productCountElement.textContent = data.total_products.toString();
      }

      // Memperbarui total produk terjual
      const soldProductsElement = document.getElementById("totalProductsSales");
      if (soldProductsElement && data.total_sold !== undefined) {
        soldProductsElement.textContent = data.total_sold.toString();
      }

      // Mengambil data stok produk terendah
      const stockResponse = await fetch(`${BASE_URL}/dashboard/stock`, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      if (stockResponse.ok) {
        const stockData = await stockResponse.json();
        if (stockData.success && stockData.data && stockData.data.length > 0) {
          // Memperbarui tampilan stok
          const stockElement = document.getElementById("stok_barang");
          const stockDetailElement = document.getElementById("stok_detail");
          
          if (stockElement && stockDetailElement) {
            const lowestStock = Math.min(...stockData.data.map(item => item.stock));

            // Membuat item carousel untuk produk dengan stok rendah
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

            // Inisialisasi carousel dengan auto-slide dan transisi halus
            $('#lowStockCarousel').carousel({
              interval: 3000,
              ride: 'carousel',
              wrap: true,
              pause: 'hover'
            });

            // Memperbarui angka stok
            stockElement.textContent = stockData.data[0].stock.toString();

            // Memperbarui angka stok saat carousel bergeser
            $('#lowStockCarousel').on('slide.bs.carousel', function (e) {
              const nextStock = stockData.data[e.to].stock;
              stockElement.textContent = nextStock.toString();
            });
          }
        }
      }

      // Memperbarui grafik penjualan
      await updateChart();
      
      // Memperbarui tabel produk terlaris
      await updateBestSellingProductsTable();
    }
  } catch (error) {
    console.error("Error mengambil data dashboard:", error);
    showError("Gagal memuat data dashboard");
  }
}

// Fungsi untuk memperbarui grafik
async function updateChart() {
  try {
    const chartType = document.getElementById("chartType").value;
    const filters = {
      year: document.getElementById("yearFilter").value,
      month: document.getElementById("monthFilter").value,
      kategori: document.getElementById("kategoriFilter").value,
    };

    let response;
    let chartTitle = "";
    let chartData = null;

    switch (chartType) {
      case "sales":
        response = await fetch(
          `${BASE_URL}/dashboard/sales?year=${filters.year}&month=${filters.month}&kategori=${filters.kategori}`,
          {
            headers: {
              Authorization: `Bearer ${getToken()}`,
            },
          }
        );
        chartTitle = "Grafik Penjualan";
        break;

      case "category":
        response = await fetch(
          `${BASE_URL}/dashboard/category-sales?year=${filters.year}&month=${filters.month}`,
          {
            headers: {
              Authorization: `Bearer ${getToken()}`,
            },
          }
        );
        chartTitle = "Grafik Penjualan per Kategori";
        break;

      case "stock":
        response = await fetch(
          `${BASE_URL}/dashboard/stock?kategori=${filters.kategori}`,
          {
            headers: {
              Authorization: `Bearer ${getToken()}`,
            },
          }
        );
        chartTitle = "Stok Produk per Kategori";
        break;
    }

    if (!response.ok) {
      throw new Error("Gagal mengambil data grafik");
    }

    const jsonResponse = await response.json();
    console.log("Chart Response:", jsonResponse); // Debug

    if (!jsonResponse.success || !jsonResponse.data) {
      throw new Error(jsonResponse.error || "Data tidak valid");
    }

    // Update chart title
    document.getElementById("chartTitle").textContent = chartTitle;

    // Update chart data based on type
    switch (chartType) {
      case "sales":
        if (Array.isArray(jsonResponse.data)) {
          mainChart.config.type = "line";
          mainChart.options.scales.y.ticks.callback = function(value) {
            return formatRupiah(value);
          };
          mainChart.options.plugins.tooltip.callbacks.label = function(context) {
            let label = "Total Penjualan: ";
            return label + formatRupiah(context.parsed.y);
          };

          chartData = {
            labels: jsonResponse.data.map((item) => {
              const date = new Date(item.date);
              return date.toLocaleDateString('id-ID', { 
                day: 'numeric',
                month: 'short'
              });
            }),
            datasets: [
              {
                label: "Total Penjualan",
                data: jsonResponse.data.map((item) => item.value),
                borderColor: "#e74a3b",
                backgroundColor: "rgba(231, 74, 59, 0.1)",
                fill: true,
              },
            ],
          };
        }
        break;

      case "category":
        if (Array.isArray(jsonResponse.data)) {
          mainChart.config.type = "pie";
          mainChart.options.plugins.tooltip.callbacks.label = function(context) {
            let label = context.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed !== null) {
              label += formatRupiah(context.parsed);
            }
            return label;
          };

          chartData = {
            labels: jsonResponse.data.map((item) => item.category),
            datasets: [
              {
                data: jsonResponse.data.map((item) => item.value),
                backgroundColor: [
                  "#e74a3b",
                  "#1cc88a",
                  "#4e73df",
                  "#f6c23e",
                  "#36b9cc",
                  "#858796",
                  "#5a5c69",
                  "#e83e8c",
                  "#fd7e14",
                  "#6f42c1",
                ],
              },
            ],
          };
        }
        break;

      case "stock":
        if (Array.isArray(jsonResponse.data)) {
          mainChart.config.type = "bar";
          mainChart.options.scales.y.ticks.callback = function(value) {
            return value.toLocaleString('id-ID') + ' unit';
          };
          mainChart.options.plugins.tooltip.callbacks.label = function(context) {
            let label = context.dataset.label + ': ';
            return label + context.parsed.y.toLocaleString('id-ID') + ' unit';
          };

          chartData = {
            labels: jsonResponse.data.map((item) => item.product_name),
            datasets: [
              {
                label: "Sisa Stok",
                data: jsonResponse.data.map((item) => item.stock),
                backgroundColor: jsonResponse.data.map((item) => {
                  // Warna merah untuk stok di bawah 10
                  return item.stock < 10 ? '#e74a3b' : '#1cc88a';
                }),
                borderColor: jsonResponse.data.map((item) => {
                  return item.stock < 10 ? '#e74a3b' : '#1cc88a';
                }),
                borderWidth: 1,
              },
            ],
          };

          // Update chart options for better display
          mainChart.options.plugins.title = {
            display: true,
            text: '5 Produk dengan Stok Terendah',
            font: {
              size: 16
            }
          };
          mainChart.options.scales.y.beginAtZero = true;
          mainChart.options.indexAxis = 'y'; // Horizontal bar chart
        }
        break;
    }

    // Update chart if data is valid
    if (chartData) {
      mainChart.data = chartData;
      mainChart.update();
    } else {
      throw new Error("Data grafik tidak valid");
    }
  } catch (error) {
    console.error("Error updating chart:", error);
    showError("Gagal memperbarui grafik: " + error.message);
  }
}

// Fungsi untuk memuat opsi kategori
async function loadKategoriOptions() {
  try {
    // Mengambil data kategori dari API
    const response = await fetch(`${BASE_URL}/kategori/getall`, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error("Gagal mengambil data kategori");
    }

    const data = await response.json();
    const kategoriFilter = document.getElementById("kategoriFilter");

    // Menambahkan opsi 'Semua Kategori'
    kategoriFilter.innerHTML = '<option value="">Semua Kategori</option>';

    // Menambahkan opsi untuk setiap kategori
    if (data.success && data.data) {
      data.data.forEach((kategori) => {
        const option = document.createElement("option");
        option.value = kategori.id_kategori;
        option.textContent = kategori.nama_kategori;
        kategoriFilter.appendChild(option);
      });
    }
  } catch (error) {
    console.error("Error memuat kategori:", error);
    showError("Gagal memuat data kategori");
  }
}

// Fungsi untuk memuat opsi tahun
function loadYearOptions() {
  const yearFilter = document.getElementById("yearFilter");
  const currentYear = new Date().getFullYear();

  // Menambahkan opsi untuk 5 tahun terakhir
  for (let year = currentYear; year >= currentYear - 4; year--) {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    if (year === currentYear) {
      option.selected = true;
    }
    yearFilter.appendChild(option);
  }
}

// Fungsi untuk menginisialisasi dashboard
async function initializeDashboard() {
  try {
    // Memeriksa autentikasi
    if (!checkAuth()) {
      return;
    }

    // Memuat opsi filter
    loadYearOptions();
    await loadKategoriOptions();

    // Mengambil data dashboard
    await fetchDashboardData();

    // Menambahkan event listener untuk filter
    document.getElementById("yearFilter").addEventListener("change", updateChart);
    document.getElementById("monthFilter").addEventListener("change", updateChart);
    document.getElementById("kategoriFilter").addEventListener("change", updateChart);
    document.getElementById("chartTypeFilter").addEventListener("change", updateChart);

  } catch (error) {
    console.error("Error inisialisasi dashboard:", error);
    showError("Gagal menginisialisasi dashboard");
  }
}

// Fungsi untuk memperbarui tabel produk terlaris
async function updateBestSellingProductsTable() {
  try {
    // Mengambil filter yang dipilih
    const selectedYear = document.getElementById("yearFilter").value;
    const selectedMonth = document.getElementById("monthFilter").value;
    const selectedKategori = document.getElementById("kategoriFilter").value;

    // Mengambil data produk terlaris
    const response = await fetch(
      `${BASE_URL}/dashboard/sales?year=${selectedYear}&month=${selectedMonth}&kategori=${selectedKategori}&limit=5`,
      {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Gagal mengambil data produk terlaris");
    }

    const data = await response.json();

    // Memperbarui tabel
    const tableBody = document.getElementById("bestSellingTableBody");
    tableBody.innerHTML = "";

    if (data.success && data.data) {
      data.data.forEach((product, index) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${index + 1}</td>
          <td>${product.nama_produk}</td>
          <td>${product.jumlah_terjual}</td>
        `;
        tableBody.appendChild(row);
      });
    }
  } catch (error) {
    console.error("Error memperbarui tabel:", error);
    showError("Gagal memuat data produk terlaris");
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

  // Get sales data with filters
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

  // Get stock data by category
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
function initializeCharts() {
  const ctx = document.getElementById("mainChart").getContext("2d");
  mainChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Data",
          data: [],
          borderColor: "#e74a3b",
          backgroundColor: "rgba(231, 74, 59, 0.1)",
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: "#e74a3b",
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: "rgba(0, 0, 0, 0.1)",
          },
          ticks: {
            callback: function(value) {
              return formatRupiah(value);
            }
          }
        },
        x: {
          grid: {
            color: "rgba(0, 0, 0, 0.1)",
          },
        },
      },
      plugins: {
        legend: {
          display: true,
          position: "top",
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if (context.parsed.y !== null) {
                label += formatRupiah(context.parsed.y);
              }
              return label;
            }
          }
        }
      },
    },
  });
}