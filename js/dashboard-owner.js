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

// Show alert message
function showAlert(type, message) {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
  alertDiv.role = 'alert';
  alertDiv.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  
  // Find alert container
  const alertContainer = document.getElementById('alert-container');
  if (!alertContainer) {
    // Create alert container if it doesn't exist
    const container = document.createElement('div');
    container.id = 'alert-container';
    container.style.position = 'fixed';
    container.style.top = '20px';
    container.style.right = '20px';
    container.style.zIndex = '1050';
    document.body.appendChild(container);
    container.appendChild(alertDiv);
  } else {
    alertContainer.appendChild(alertDiv);
  }

  // Auto dismiss after 5 seconds
  setTimeout(() => {
    alertDiv.remove();
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
    // Get current filters
    const filters = getFilters();
    console.log("Current filters:", filters); // Debug log
    
    // Get dashboard data with filters
    const response = await fetch(`${BASE_URL}/dashboard/getdata?tahun=${filters.tahun || ''}`, {
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
                    ${item.product_name} (${item.category})
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
    showError("Gagal memuat data dashboard: " + error.message);
  }
}

// Fungsi untuk memproses data penjualan
function processSalesData(data) {
  // Group data by month and calculate totals
  const monthlyData = {};
  
  data.forEach(sale => {
    const date = new Date(sale.tanggal_penjualan);
    const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {
        units: 0,
        total: 0
      };
    }
    
    monthlyData[monthKey].units += parseInt(sale.jumlah_produk) || 0;
    monthlyData[monthKey].total += parseFloat(sale.total) || 0;
  });

  // Sort months and convert to Chart.js format
  const sortedMonths = Object.keys(monthlyData).sort();
  
  return {
    labels: sortedMonths.map(month => {
      const [year, monthNum] = month.split('-');
      const date = new Date(year, parseInt(monthNum) - 1);
      return date.toLocaleString('id-ID', { month: 'short', year: 'numeric' });
    }),
    units: sortedMonths.map(month => monthlyData[month].units),
    totals: sortedMonths.map(month => monthlyData[month].total)
  };
}

// Register Chart.js plugins
Chart.register(ChartDataLabels);

// Konfigurasi Chart.js
let mainChart = null;

// Fungsi untuk menginisialisasi grafik
async function initializeCharts() {
  try {
    const ctx = document.getElementById('mainChart').getContext('2d');
    
    const config = {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Jumlah Produk',
            data: [],
            backgroundColor: 'rgba(54, 162, 235, 0.5)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1,
            yAxisID: 'y-axis-quantity'
          },
          {
            label: 'Total Penjualan (Rp)',
            data: [],
            backgroundColor: 'rgba(255, 99, 132, 0.5)',
            borderColor: 'rgba(255, 99, 132, 1)',
            borderWidth: 1,
            yAxisID: 'y-axis-sales'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Grafik Penjualan per Bulan',
            font: {
              size: 16,
              weight: 'bold'
            }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.datasetIndex === 1) { // Total Penjualan
                  label += formatRupiah(context.parsed.y);
                } else { // Jumlah Produk
                  label += context.parsed.y;
                }
                return label;
              }
            }
          },
          datalabels: {
            display: true,
            align: 'end',
            anchor: 'end',
            formatter: function(value, context) {
              if (context.datasetIndex === 1) { // Total Penjualan
                return formatRupiah(value);
              } else { // Jumlah Produk
                return value;
              }
            },
            color: function(context) {
              return context.dataset.borderColor;
            },
            font: {
              weight: 'bold'
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            }
          },
          'y-axis-quantity': {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'Jumlah Produk',
              font: {
                weight: 'bold'
              }
            },
            ticks: {
              beginAtZero: true,
              callback: function(value) {
                return value.toLocaleString('id-ID');
              }
            }
          },
          'y-axis-sales': {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
              display: true,
              text: 'Total Penjualan (Rp)',
              font: {
                weight: 'bold'
              }
            },
            ticks: {
              beginAtZero: true,
              callback: function(value) {
                return formatRupiah(value);
              }
            },
            grid: {
              drawOnChartArea: false
            }
          }
        }
      }
    };

    mainChart = new Chart(ctx, config);
    console.log("Chart initialized successfully");
    return mainChart;
  } catch (error) {
    console.error("Error initializing chart:", error);
    showError("Terjadi kesalahan saat menginisialisasi grafik");
    return null;
  }
}

// Fungsi untuk memperbarui grafik
async function updateChart() {
  try {
    // Show loading state
    toggleLoadingState(true);
    
    const year = document.getElementById("yearFilter")?.value || '';
    const month = document.getElementById("monthFilter")?.value || '';
    const kategori = document.getElementById("kategoriFilter")?.value || '';
    const chartType = document.getElementById("chartType")?.value || 'sales';
    const sortOrder = document.getElementById("sortOrder")?.value || 'highest';
    
    console.log("Updating chart with params:", { year, month, kategori, chartType, sortOrder });
    
    // Map chart type to API endpoint
    let endpoint;
    switch (chartType) {
      case 'sales':
        endpoint = 'sales';
        break;
      case 'category-sales':
        endpoint = 'category-sales';
        break;
      case 'stock':
        endpoint = 'stock';
        break;
      default:
        endpoint = 'sales';
    }
    
    // Fetch data from API with retry mechanism
    let retries = 3;
    let response;
    while (retries > 0) {
      try {
        response = await fetch(`${BASE_URL}/dashboard/${endpoint}?year=${year}&month=${month}&kategori=${kategori}`, {
          headers: {
            'Authorization': `Bearer ${getToken()}`,
            'Content-Type': 'application/json'
          }
        });
        if (response.ok) break;
      } catch (error) {
        console.warn(`Retry ${4 - retries} failed:`, error);
      }
      retries--;
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s between retries
    }

    if (!response?.ok) {
      throw new Error(`API request failed: ${response?.status} ${response?.statusText}`);
    }
    
    const responseData = await response.json();
    console.log("Received data:", responseData);
    
    if (!mainChart) {
      console.error("Chart not initialized");
      toggleNoDataMessage(true);
      return;
    }

    // Check for empty or invalid data
    if (!responseData.success || !responseData.data || !Array.isArray(responseData.data) || responseData.data.length === 0) {
      console.log("No data found for current filters");
      toggleNoDataMessage(true);
      if (mainChart) {
        mainChart.data.labels = [];
        mainChart.data.datasets.forEach(dataset => {
          dataset.data = [];
        });
        mainChart.update();
      }
      return;
    }

    // Hide no data message since we have data
    toggleNoDataMessage(false);

    // Update chart configuration based on type
    const config = {
      sales: {
        labels: responseData.data.map(item => {
          const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
          return monthNames[item.bulan - 1];
        }),
        datasets: [
          {
            ...mainChart.data.datasets[0],
            label: 'Jumlah Produk',
            data: responseData.data.map(item => ({
              x: item.bulan,
              y: item.jumlah_produk || 0
            }))
          },
          {
            ...mainChart.data.datasets[1],
            label: 'Total Penjualan (Rp)',
            data: responseData.data.map(item => ({
              x: item.bulan,
              y: item.total || 0
            }))
          }
        ]
      },
      'category-sales': {
        labels: responseData.data.map(item => item.category || 'Tidak Ada Kategori'),
        datasets: [
          {
            ...mainChart.data.datasets[0],
            label: 'Total Penjualan per Kategori',
            data: responseData.data.map(item => ({
              x: item.category || 'Tidak Ada Kategori',
              y: item.value || 0
            }))
          }
        ]
      },
      stock: {
        labels: responseData.data.map(item => `${item.category || 'Tidak Ada Kategori'} - ${item.subcategory || 'Tidak Ada Subkategori'}`),
        datasets: [
          {
            ...mainChart.data.datasets[0],
            label: '', // Removed 'Total Stok' label
            backgroundColor: responseData.data.map(item => {
              const colors = {
                'Makanan': 'rgba(78, 115, 223, 0.8)',
                'Perlengkapan Mandi': 'rgba(54, 185, 204, 0.8)',
                'Perlengkapan Rumah': 'rgba(246, 194, 62, 0.8)',
                'Minuman': 'rgba(231, 74, 59, 0.8)',
                'Lainnya': 'rgba(133, 135, 150, 0.8)'
              };
              return colors[item.category] || colors['Lainnya'];
            }),
            borderColor: responseData.data.map(item => {
              const colors = {
                'Makanan': 'rgba(78, 115, 223, 1)',
                'Perlengkapan Mandi': 'rgba(54, 185, 204, 1)',
                'Perlengkapan Rumah': 'rgba(246, 194, 62, 1)',
                'Minuman': 'rgba(231, 74, 59, 1)',
                'Lainnya': 'rgba(133, 135, 150, 1)'
              };
              return colors[item.category] || colors['Lainnya'];
            }),
            data: responseData.data.map(item => ({
              x: `${item.category || 'Tidak Ada Kategori'} - ${item.subcategory || 'Tidak Ada Subkategori'}`,
              y: item.stock || 0
            }))
          }
        ]
      }
    };

    // Get the chart config for current type and sort it
    let chartConfig = config[chartType] || config.sales;
    chartConfig = sortChartData(chartConfig, sortOrder);

    // Update chart data
    mainChart.data.labels = chartConfig.labels;
    mainChart.data.datasets = chartConfig.datasets;
    
    // Update chart title
    mainChart.options.plugins.title.text = getChartTitle(chartType);
    
    // Update axis configuration based on chart type
    if (chartType === 'category-sales') {
      mainChart.options.scales['y-axis-quantity'].display = false;
      mainChart.options.scales['y-axis-sales'].display = true;
      mainChart.options.scales['y-axis-sales'].title.text = 'Total Penjualan (Rp)';
    } else if (chartType === 'stock') {
      mainChart.options.scales['y-axis-quantity'].display = true;
      mainChart.options.scales['y-axis-sales'].display = false;
      mainChart.options.scales['y-axis-quantity'].title.text = 'Total Stok';
    } else {
      mainChart.options.scales['y-axis-quantity'].display = true;
      mainChart.options.scales['y-axis-sales'].display = true;
      mainChart.options.scales['y-axis-quantity'].title.text = 'Jumlah Produk';
      mainChart.options.scales['y-axis-sales'].title.text = 'Total Penjualan (Rp)';
    }
    
    // Add value labels on top of bars
    mainChart.options.plugins.datalabels = {
      anchor: 'end',
      align: 'top',
      formatter: function(value, context) {
        if (chartType === 'sales' && this.datasetIndex === 1) {
          return formatRupiah(value.y);
        }
        return value.y.toLocaleString('id-ID');
      },
      color: '#666',
      font: {
        weight: 'bold'
      }
    };
    
    console.log("Updating chart with new data");
    mainChart.update();
  } catch (error) {
    console.error("Error updating chart:", error);
    showError("Terjadi kesalahan saat memperbarui grafik");
    toggleNoDataMessage(true);
  } finally {
    toggleLoadingState(false);
  }
}

// Function to toggle loading state
function toggleLoadingState(show) {
  const chartArea = document.querySelector('.chart-area');
  if (!chartArea) return;
  
  let loadingOverlay = chartArea.querySelector('.loading-overlay');
  if (show) {
    if (!loadingOverlay) {
      loadingOverlay = document.createElement('div');
      loadingOverlay.className = 'loading-overlay';
      loadingOverlay.innerHTML = `
        <div class="spinner-border text-primary" role="status">
          <span class="sr-only">Loading...</span>
        </div>
      `;
      chartArea.style.position = 'relative';
      chartArea.appendChild(loadingOverlay);
    }
    loadingOverlay.style.display = 'flex';
  } else if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
  }
}

// Function to toggle no data message
function toggleNoDataMessage(show) {
  const noDataMessage = document.getElementById('noDataMessage');
  const chartArea = document.querySelector('.chart-area');
  
  if (noDataMessage && chartArea) {
    if (show) {
      noDataMessage.classList.remove('d-none');
      chartArea.style.display = 'none';
    } else {
      noDataMessage.classList.add('d-none');
      chartArea.style.display = 'block';
    }
  }
}

// Sort data based on filter
function sortChartData(chartConfig, sortOrder) {
  if (!sortOrder) return chartConfig;
  
  chartConfig.datasets.forEach(dataset => {
    const sortedData = [...dataset.data];
    const indices = sortedData.map((_, idx) => idx)
      .sort((a, b) => {
        const valueA = sortedData[a].y;
        const valueB = sortedData[b].y;
        return sortOrder === 'highest' ? valueB - valueA : valueA - valueB;
      });
    
    // Reorder data
    dataset.data = indices.map(i => sortedData[i]);
    
    // Reorder labels if this is the first dataset
    if (dataset === chartConfig.datasets[0]) {
      chartConfig.labels = indices.map(i => chartConfig.labels[i]);
    }
  });
  
  return chartConfig;
}

// Fungsi untuk menginisialisasi dashboard
async function initializeDashboard() {
  try {
    // Muat opsi filter
    loadYearOptions();
    await loadKategoriOptions();

    // Tambahkan event listener untuk filter
    document.getElementById("chartType")?.addEventListener("change", updateChart);
    document.getElementById("yearFilter")?.addEventListener("change", updateChart);
    document.getElementById("monthFilter")?.addEventListener("change", updateChart);
    document.getElementById("kategoriFilter")?.addEventListener("change", updateChart);

    // Inisialisasi grafik
    await initializeCharts();

    // Update grafik pertama kali
    await updateChart();
  } catch (error) {
    console.error("Error initializing dashboard:", error);
  }
}

// Inisialisasi saat dokumen dimuat
document.addEventListener("DOMContentLoaded", async () => {
  if (window.location.pathname.includes("index-owner.html")) {
    try {
      await initializeDashboard();
      await fetchDashboardData();
      await updateBestSellingProductsTable();

      // Set up auto-refresh interval
      setInterval(async () => {
        console.log("Auto-refreshing dashboard data...");
        await fetchDashboardData();
        await updateBestSellingProductsTable();
        await updateChart();
      }, 3600 * 1000); // Refresh every hour
    } catch (error) {
      console.error("Error in dashboard initialization:", error);
    }
  }
});

// Helper function to get current filter values
function getFilters() {
  return {
    kategori: document.getElementById("kategoriFilter")?.value || '',
    tahun: document.getElementById("yearFilter")?.value || '',
    bulan: document.getElementById("monthFilter")?.value || ''
  };
}

// Load kategori options
async function loadKategori() {
  try {
    const response = await fetch(`${BASE_URL}/kategori/getall`, {
      headers: {
        Authorization: `Bearer ${getToken()}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch categories');
    }

    const data = await response.json();
    const kategoriFilter = document.getElementById("kategoriFilter");
    
    if (kategoriFilter && Array.isArray(data.data)) {
      // Clear existing options except the first one
      while (kategoriFilter.options.length > 1) {
        kategoriFilter.remove(1);
      }

      // Add new options
      data.data.forEach(kategori => {
        const option = document.createElement("option");
        option.value = kategori.id_kategori;
        option.textContent = kategori.nama_kategori;
        kategoriFilter.appendChild(option);
      });
    }
  } catch (error) {
    console.error("Error loading categories:", error);
    showAlert("danger", "Gagal memuat kategori");
  }
}

// Load year options
function loadYearOptions() {
  const yearFilter = document.getElementById("yearFilter");
  if (yearFilter) {
    const currentYear = new Date().getFullYear();
    const startYear = 2020; // Adjust this based on your needs

    // Clear existing options except the first one
    while (yearFilter.options.length > 1) {
      yearFilter.remove(1);
    }

    // Add year options
    for (let year = currentYear; year >= startYear; year--) {
      const option = document.createElement("option");
      option.value = year;
      option.textContent = year;
      yearFilter.appendChild(option);
    }
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
    console.log("Kategori Response:", data);

    const kategoriFilter = document.getElementById("kategoriFilter");
    kategoriFilter.innerHTML = '<option value="">Semua Kategori</option>';

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

// Fungsi untuk memperbarui tabel produk terlaris
async function updateBestSellingProductsTable() {
  try {
    if (!checkAuth()) return;

    // Get selected year and sort option
    const selectedYear = parseInt(document.getElementById('yearFilter')?.value) || new Date().getFullYear();
    const sortOption = document.getElementById('bestSellingSort')?.value || 'quantity_desc';

    console.log("Fetching best selling products for year:", selectedYear);

    const response = await fetch(`${BASE_URL}/dashboard/sales/best-selling`, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json'
      },
      method: 'POST',
      body: JSON.stringify({ tahun: selectedYear })
    });

    if (!response.ok) {
      throw new Error("Gagal mengambil data produk terlaris");
    }

    const jsonResponse = await response.json();
    console.log("Best Selling Products Response:", jsonResponse);

    const tableBody = document.querySelector("#bestSellingProductsTable tbody");
    if (!tableBody) return;

    if (!jsonResponse.success || !jsonResponse.data || !Array.isArray(jsonResponse.data)) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="4" class="text-center">Tidak ada data produk terlaris</td>
        </tr>
      `;
      return;
    }

    // Sort products based on selected option
    const products = jsonResponse.data.sort((a, b) => {
      switch (sortOption) {
        case 'quantity_desc':
          return b.jumlah_terjual - a.jumlah_terjual;
        case 'quantity_asc':
          return a.jumlah_terjual - b.jumlah_terjual;
        case 'revenue_desc':
          return b.total_penjualan - a.total_penjualan;
        case 'revenue_asc':
          return a.total_penjualan - b.total_penjualan;
        default:
          return b.jumlah_terjual - a.jumlah_terjual;
      }
    }).slice(0, 10); // Get top 10 products

    tableBody.innerHTML = products.map((product, index) => `
      <tr>
        <td class="text-center">${index + 1}</td>
        <td>${product.nama_produk}</td>
        <td class="text-center">${product.jumlah_terjual}</td>
        <td class="text-right">${formatRupiah(product.total_penjualan)}</td>
      </tr>
    `).join('');

  } catch (error) {
    console.error("Error updating best selling products table:", error);
    const tableBody = document.querySelector("#bestSellingProductsTable tbody");
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="4" class="text-center text-danger">
            Gagal memuat data produk terlaris
          </td>
        </tr>
      `;
    }
  }
}

// Add event listener for year filter to update best selling products
document.getElementById('yearFilter')?.addEventListener('change', () => {
  updateBestSellingProductsTable();
  updateChart(); // Also update the chart when year changes
});

// Add event listener for sort option to update best selling products
document.getElementById('bestSellingSort')?.addEventListener('change', updateBestSellingProductsTable);

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
          errorData?.message ||
            `HTTP error! status: ${response.status}`
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

  // Fungsi untuk mendapatkan produk yang mendekati kedaluwarsa
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

// Function to update the stock warning card
async function updateStockWarning() {
  const stockWarningCard = document.querySelector('#stockWarningCard .card-body');
  if (!stockWarningCard) return;

  try {
    const response = await fetch(`${BASE_URL}/produk/getloweststock`, {
      headers: {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data || !data.data || !Array.isArray(data.data)) {
      throw new Error('Invalid data format received');
    }

    // Filter and sort products by stock level
    const validProducts = data.data
      .filter(product => 
        product && 
        product.nama_produk && 
        typeof product.stok_barang === 'number'
      )
      .sort((a, b) => a.stok_barang - b.stok_barang)
      .slice(0, 5);

    if (validProducts.length === 0) {
      stockWarningCard.innerHTML = `
        <div class="row no-gutters align-items-center">
          <div class="col mr-2">
            <div class="text-xs font-weight-bold text-warning text-uppercase mb-1">STOK MENIPIS</div>
            <div class="h6 mb-0 text-gray-800">Tidak ada produk dengan stok menipis</div>
          </div>
          <div class="col-auto">
            <i class="fas fa-exclamation-triangle fa-2x text-gray-300"></i>
          </div>
        </div>
      `;
      return;
    }

    let currentIndex = 0;
    
    function updateWarningDisplay() {
      const product = validProducts[currentIndex];
      stockWarningCard.innerHTML = `
        <div class="row no-gutters align-items-center">
          <div class="col mr-2">
            <div class="text-xs font-weight-bold text-warning text-uppercase mb-1">STOK MENIPIS</div>
            <div class="h6 mb-0 text-gray-800">${product.nama_produk}</div>
            <div class="text-xs text-gray-600">Stok: ${product.stok_barang}</div>
          </div>
          <div class="col-auto">
            <i class="fas fa-exclamation-triangle fa-2x text-gray-300"></i>
          </div>
        </div>
      `;
      
      currentIndex = (currentIndex + 1) % validProducts.length;
    }

    // Initial display
    updateWarningDisplay();

    // Clear any existing interval
    if (window.stockWarningInterval) {
      clearInterval(window.stockWarningInterval);
    }

    // Set up auto-sliding every 2 seconds
    window.stockWarningInterval = setInterval(updateWarningDisplay, 2000);

  } catch (error) {
    console.error('Error updating stock warning:', error);
    stockWarningCard.innerHTML = `
      <div class="row no-gutters align-items-center">
        <div class="col mr-2">
          <div class="text-xs font-weight-bold text-warning text-uppercase mb-1">STOK MENIPIS</div>
          <div class="h6 mb-0 text-gray-800 text-danger">Gagal memuat data stok menipis</div>
        </div>
        <div class="col-auto">
          <i class="fas fa-exclamation-triangle fa-2x text-gray-300"></i>
        </div>
      </div>
    `;
  }
}

// Call updateStockWarning when page loads
document.addEventListener('DOMContentLoaded', function() {
  updateStockWarning();
});

// Function to update chart title
function updateChartTitle() {
  const chartType = document.getElementById('chartType')?.value || 'sales';
  const chartTitleElement = document.getElementById('chartTitle');
  
  let title = '';
  switch (chartType) {
    case 'sales':
      title = 'Grafik Penjualan per Bulan';
      break;
    case 'category-sales':
      title = 'Grafik Penjualan per Kategori';
      break;
    case 'stock':
      title = 'Grafik Stok per Kategori';
      break;
    default:
      title = 'Grafik Penjualan';
  }
  
  if (chartTitleElement) {
    chartTitleElement.textContent = title;
  }
}

// Add event listeners for filters
document.getElementById('sortOrder')?.addEventListener('change', updateChart);
document.getElementById('chartType')?.addEventListener('change', function() {
  updateChartTitle();
  updateChart();
});

// Function to get chart title based on type
function getChartTitle(chartType) {
  switch (chartType) {
    case 'sales':
      return 'Grafik Penjualan per Bulan';
    case 'category-sales':
      return 'Grafik Penjualan per Kategori';
    case 'stock':
      return 'Grafik Stok per Kategori';
    default:
      return 'Grafik Penjualan';
  }
}

// Format number to rupiah
function formatRupiah(number) {
  return new Intl.NumberFormat('id-ID').format(number);
}

// Function to load year options
async function loadYearOptions() {
  try {
    const response = await fetch(`${BASE_URL}/dashboard/years`, {
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch years');
    }
    
    const data = await response.json();
    const yearSelect = document.getElementById('yearFilter');
    
    if (yearSelect) {
      yearSelect.innerHTML = '<option value="">Semua Tahun</option>';
      data.data.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Error loading year options:', error);
    showError('Gagal memuat daftar tahun');
  }
}

// Function to load kategori options
async function loadKategoriOptions() {
  try {
    const response = await fetch(`${BASE_URL}/dashboard/categories`, {
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch categories');
    }
    
    const data = await response.json();
    const kategoriSelect = document.getElementById('kategoriFilter');
    
    if (kategoriSelect) {
      kategoriSelect.innerHTML = '<option value="">Semua Kategori</option>';
      data.data.forEach(kategori => {
        const option = document.createElement('option');
        option.value = kategori.id_kategori;
        option.textContent = kategori.nama_kategori;
        kategoriSelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Error loading category options:', error);
    showError('Gagal memuat daftar kategori');
  }
}

// Function to load product options
async function loadProdukOptions() {
  try {
    const response = await fetch(`${BASE_URL}/produk/getallproduk`, {
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch products');
    }
    
    const data = await response.json();
    const produkSelect = document.getElementById('produkFilter');
    
    if (produkSelect) {
      produkSelect.innerHTML = '<option value="">Semua Produk</option>';
      data.data.forEach(produk => {
        const option = document.createElement('option');
        option.value = produk.id_produk;
        option.textContent = produk.nama_produk;
        produkSelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Error loading product options:', error);
    showError('Gagal memuat daftar produk');
  }
}

// Add event listener for year filter to update all dashboard data
document.getElementById('yearFilter')?.addEventListener('change', () => {
  fetchDashboardData(); // Update dashboard data when year changes
  updateBestSellingProductsTable();
  updateChart();
});