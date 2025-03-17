// API Base URL
const BASE_URL = "http://localhost:8080"; // Adjust this to match your backend URL

// Handle API Response
async function handleResponse(response) {
  if (!response.ok) {
    try {
      const errorData = await response.json();
      console.error('API Error Response:', errorData);
      throw new Error(
        errorData?.message ||
        errorData?.error ||
        `HTTP error! status: ${response.status}`
      );
    } catch (parseError) {
      // Jika response tidak bisa di-parse sebagai JSON
      console.error('Error parsing error response:', parseError);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }
  
  try {
    const data = await response.json();
    console.log('API Success Response:', data);
    
    // Jika data sudah dalam format yang benar (memiliki field data)
    if (data && typeof data === 'object') {
      if (data.hasOwnProperty('data')) {
        return data;
      } else {
        // Jika data tidak memiliki field data, bungkus dalam format yang konsisten
        return { success: true, data: data };
      }
    }
    
    // Fallback jika format tidak dikenali
    return { success: true, data: data };
  } catch (parseError) {
    console.error('Error parsing success response:', parseError);
    throw new Error('Gagal memproses respons dari server');
  }
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

// Get DOM elements
const productTable = document.getElementById('productTable');
const searchInput = document.getElementById('searchProduct');
const addProductForm = document.getElementById('addProductForm');
const updateProductForm = document.getElementById('updateProductForm');

let productTableElement;
let allProducts = []; // Menyimpan semua produk untuk filtering
let uniqueCategories = new Set();
let uniqueSubCategories = new Set();
let activeFilters = {
    category: 'all',
    subcategory: 'all'
};

// Products API
const products = {
    getAll: async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          throw new Error("Tidak terautentikasi");
        }
  
        const response = await fetch(`${BASE_URL}/produk/getallproduk`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
  
        // Tangani error non-200 response
        if (!response.ok) {
          const errorText = await response.text();
          console.error("Server response:", {
            status: response.status,
            statusText: response.statusText,
            body: errorText,
          });
          throw new Error(
            `Server error: ${response.status} ${response.statusText}`
          );
        }
  
        const result = await response.json();
        console.log("Raw API Response:", result);
  
        // Pastikan data memiliki struktur yang benar
        if (!result || !result.data) {
          console.warn("Invalid response format:", result);
          return { success: false, error: "Invalid response format", data: [] };
        }
  
        // Kembalikan data mentah dari API
        return {
          success: true,
          data: result.data,
        };
      } catch (error) {
        console.error("Get all products error:", error);
        return {
          success: false,
          error: error.message,
          data: [],
        };
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
        const token = getToken();
        if (!token) {
          throw new Error("Tidak terautentikasi");
        }

        // Pastikan format data sesuai dengan yang diharapkan backend
        // Konversi tanggal ke format yang benar
        if (productData.tanggal_kadaluarsa) {
          // Pastikan tanggal dalam format yang benar (ISO string)
          const date = new Date(productData.tanggal_kadaluarsa);
          if (!isNaN(date.getTime())) {
            productData.tanggal_kadaluarsa = date.toISOString();
          }
        }

        // Pastikan kategori dan subkategori dalam format yang benar
        if (productData.kategori && typeof productData.kategori === 'object') {
          if (!productData.kategori.id_kategori) {
            throw new Error("ID kategori tidak valid");
          }
        }

        if (productData.subkategori && typeof productData.subkategori === 'object') {
          if (!productData.subkategori.id_subkategori) {
            throw new Error("ID subkategori tidak valid");
          }
          
          // Pastikan subkategori memiliki referensi ke kategori yang benar
          if (!productData.subkategori.kategori) {
            productData.subkategori.kategori = productData.kategori;
          }
        }

        // Format data produk sesuai dengan yang diharapkan backend
        const finalProductData = {
          nama_produk: productData.nama_produk,
          kategori: productData.kategori,
          subkategori: productData.subkategori,
          kode_produk: productData.kode_produk,
          harga_produk: parseInt(productData.harga_produk),
          stok_barang: parseInt(productData.stok_barang),
          tanggal_kadaluarsa: productData.tanggal_kadaluarsa
        };

        console.log("Data produk yang akan dikirim:", finalProductData);

        const response = await fetch(`${BASE_URL}/produk/createproduk`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(finalProductData),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Gagal membuat produk");
        }
        
        const data = await response.json();
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

// Fungsi untuk mendapatkan token dari localStorage
function getToken() {
    return localStorage.getItem('token');
}

// Fungsi untuk mengambil kategori dari backend
async function fetchKategori() {
  try {
    const response = await fetch(`${BASE_URL}/kategori/getall`, {
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('Hasil fetchKategori:', result);
    
    // Periksa berbagai kemungkinan format respons
    if (result && result.data && Array.isArray(result.data)) {
      return result;
    } else if (Array.isArray(result)) {
      return { success: true, data: result };
    } else if (result && typeof result === 'object') {
      return { success: true, data: [result] };
    } else {
      console.warn('Format data kategori tidak dikenali:', result);
      return { success: true, data: [] };
    }
  } catch (error) {
    console.error("Error fetching kategori:", error);
    showAlert(`Error: ${error.message}`, 'danger');
    return { success: false, data: [], error: error.message };
  }
}

// Fungsi untuk mengambil subkategori dari backend
async function fetchSubKategori() {
  try {
    const response = await fetch(`${BASE_URL}/subkategori/getall`, {
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('Hasil fetchSubKategori:', result);
    
    // Periksa berbagai kemungkinan format respons
    if (result && result.data && Array.isArray(result.data)) {
      return result;
    } else if (Array.isArray(result)) {
      return { success: true, data: result };
    } else if (result && typeof result === 'object') {
      return { success: true, data: [result] };
    } else {
      console.warn('Format data subkategori tidak dikenali:', result);
      return { success: true, data: [] };
    }
  } catch (error) {
    console.error("Error fetching subkategori:", error);
    showAlert(`Error: ${error.message}`, 'danger');
    return { success: false, data: [], error: error.message };
  }
}

// Fungsi untuk mengambil subkategori berdasarkan ID kategori
async function fetchSubKategoriByKategori(kategoriId) {
  if (!kategoriId) {
    console.warn('ID kategori tidak valid');
    return [];
  }

  try {
    console.log(`Mengambil subkategori untuk kategori ID: ${kategoriId}`);
    const response = await fetch(`${BASE_URL}/subkategori/bykategori/${kategoriId}`, {
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log(`Subkategori untuk kategori ${kategoriId} dari API:`, result);
    
    // Periksa struktur data dan pastikan kita mengembalikan array
    let subkategoriList = [];
    if (result && Array.isArray(result.data)) {
      subkategoriList = result.data;
    } else if (Array.isArray(result)) {
      subkategoriList = result;
    } else if (result && typeof result === 'object') {
      subkategoriList = [result];
    } else {
      console.warn('Format data subkategori tidak sesuai:', result);
      return [];
    }
    
    // Gunakan Map untuk menghilangkan duplikasi
    const uniqueSubkategori = new Map();
    
    // Tambahkan subkategori unik ke Map
    subkategoriList.forEach(subkat => {
      if (subkat && subkat.id_subkategori && subkat.nama_subkategori) {
        uniqueSubkategori.set(subkat.id_subkategori, subkat);
      }
    });
    
    // Konversi Map kembali ke array
    return Array.from(uniqueSubkategori.values());
  } catch (error) {
    console.error(`Error fetching subkategori for kategori ${kategoriId}:`, error);
    showAlert(`Error: ${error.message}`, 'danger');
    return [];
  }
}

// Update dropdown subkategori berdasarkan kategori yang dipilih
async function updateSubCategories(selectedKategoriId, isUpdateForm = false) {
  // Pilih elemen dropdown yang benar berdasarkan parameter isUpdateForm
  const subCategorySelect = isUpdateForm 
    ? document.getElementById('update_sub_kategori') 
    : document.getElementById('sub_kategori');
  
  // Jika elemen tidak ditemukan, keluar dari fungsi
  if (!subCategorySelect) {
    console.error(`Elemen dropdown subkategori tidak ditemukan untuk form ${isUpdateForm ? 'update' : 'add'}`);
    return;
  }
  
  // Reset dropdown
  subCategorySelect.innerHTML = '<option value="">Pilih Sub Kategori</option>';
  
  if (!selectedKategoriId) {
    console.log('Tidak ada kategori yang dipilih, menonaktifkan dropdown subkategori');
    subCategorySelect.disabled = true;
    return;
  }
  
  try {
    console.log(`Memperbarui dropdown subkategori untuk kategori ID: ${selectedKategoriId}`);
    
    // Dapatkan data subkategori
    const subKategoriList = await fetchSubKategoriByKategori(selectedKategoriId);
    
    console.log('Data subkategori yang diterima:', subKategoriList);
    
    // Pastikan subKategoriList adalah array dan memiliki data
    if (Array.isArray(subKategoriList) && subKategoriList.length > 0) {
      // Gunakan Map untuk melacak subkategori berdasarkan ID
      const uniqueSubkategori = new Map();
      
      // Tambahkan subkategori unik ke Map
      subKategoriList.forEach(subKat => {
        if (subKat && subKat.id_subkategori && subKat.nama_subkategori) {
          uniqueSubkategori.set(subKat.id_subkategori, subKat);
        } else {
          console.warn('Data subkategori tidak lengkap:', subKat);
        }
      });
      
      // Tambahkan opsi dari Map (ini menjamin tidak ada duplikasi)
      uniqueSubkategori.forEach(subKat => {
        const option = document.createElement('option');
        option.value = subKat.id_subkategori;
        option.textContent = subKat.nama_subkategori;
        subCategorySelect.appendChild(option);
      });
      
      // Enable dropdown karena ada opsi yang tersedia
      subCategorySelect.disabled = false;
    } else {
      console.log('Tidak ada subkategori yang tersedia untuk kategori ini');
      subCategorySelect.disabled = true;
    }
  } catch (error) {
    console.error('Error updating subcategories:', error);
    subCategorySelect.disabled = true;
  }
}

// Tambahkan event listener untuk dropdown kategori
function setupKategoriChangeListeners() {
    // Untuk form tambah produk
    const kategoriDropdown = document.getElementById('kategori');
    if (kategoriDropdown) {
        kategoriDropdown.addEventListener('change', function() {
            const selectedKategoriId = this.value;
            updateSubCategories(selectedKategoriId, false);
        });
    }
    
    // Untuk form edit produk
    const editKategoriDropdown = document.getElementById('update_kategori');
    if (editKategoriDropdown) {
        editKategoriDropdown.addEventListener('change', function() {
            const selectedKategoriId = this.value;
            updateSubCategories(selectedKategoriId, true);
        });
    }
}

// Initialize event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM Content Loaded');
    
    if (!checkAuth()) {
        console.log('Auth check failed');
        return;
    }
    console.log('Auth check passed');

    // Initialize elements
    const elements = {
        productTable: document.getElementById('productTable'),
        searchInput: document.getElementById('searchProduct'),
        addProductForm: document.getElementById('addProductForm'),
        updateProductForm: document.getElementById('updateProductForm')
    };
    
    console.log('Elements initialized:', {
        hasProductTable: !!elements.productTable,
        hasSearchInput: !!elements.searchInput,
        hasAddForm: !!elements.addProductForm,
        hasUpdateForm: !!elements.updateProductForm
    });

    productTableElement = elements.productTable;

    // Load initial data
    loadProducts();

    // Add form submit handlers
    if (elements.addProductForm) {
        elements.addProductForm.addEventListener('submit', handleAddProduct);
    }

    if (elements.updateProductForm) {
        elements.updateProductForm.addEventListener('submit', handleUpdateProduct);
    }

    // Add search handler
    if (elements.searchInput) {
        elements.searchInput.addEventListener('input', handleSearch);
    }

    // Add table click handlers
    if (elements.productTable) {
        elements.productTable.addEventListener('click', async (e) => {
            if (e.target.closest('.edit-product')) {
                await handleEditClick(e);
            } else if (e.target.closest('.delete-product')) {
                await handleDeleteClick(e);
            }
        });
    }

    // Add category change listener
    const categorySelect = document.getElementById('kategori');
    if (categorySelect) {
        // Populate categories
        categorySelect.innerHTML = '<option value="">Pilih Kategori</option>';
        fetchKategori().then(response => {
          const kategoriList = response && response.data && Array.isArray(response.data) ? response.data : [];
          console.log('Kategori untuk dropdown produk:', kategoriList);
          
          if (kategoriList.length > 0) {
            kategoriList.forEach(kategori => {
              const option = document.createElement('option');
              option.value = kategori.id_kategori;
              option.textContent = kategori.nama_kategori;
              categorySelect.appendChild(option);
            });
          } else {
            console.warn('Tidak ada data kategori untuk dropdown produk');
          }
        }).catch(error => {
          console.error('Error loading kategori for dropdown:', error);
        });
        
        // Add change listener
        categorySelect.addEventListener('change', (e) => {
            updateSubCategories(e.target.value, false);
        });
    }

    const updateCategorySelect = document.getElementById('update_kategori');
    if (updateCategorySelect) {
        // Populate categories
        updateCategorySelect.innerHTML = '<option value="">Pilih Kategori</option>';
        fetchKategori().then(response => {
          const kategoriList = response && response.data && Array.isArray(response.data) ? response.data : [];
          console.log('Kategori untuk dropdown update produk:', kategoriList);
          
          if (kategoriList.length > 0) {
            kategoriList.forEach(kategori => {
              const option = document.createElement('option');
              option.value = kategori.id_kategori;
              option.textContent = kategori.nama_kategori;
              updateCategorySelect.appendChild(option);
            });
          } else {
            console.warn('Tidak ada data kategori untuk dropdown update produk');
          }
        }).catch(error => {
          console.error('Error loading kategori for update dropdown:', error);
        });
        
        // Add change listener
        updateCategorySelect.addEventListener('change', (e) => {
            updateSubCategories(e.target.value, true);
        });
    }

    // Initialize update form
    initializeUpdateForm();

    // Initialize import form
    initializeImportForm();

    // Initialize kategori management
    initializeKategoriManagement();

    // Initialize subkategori management
    initializeSubKategoriManagement();

    // Inisialisasi dropdown dan event listener saat dokumen siap
    await populateKategoriDropdowns();
    
    // Setup event listener untuk perubahan kategori
    setupKategoriChangeListeners();
});

// Load all products
async function loadProducts() {
    try {
        console.log('Fetching products...');
        const result = await products.getAll();
        console.log('API response:', result);
        
        if (result.success && result.data) {  
            console.log('Raw products data:', result.data);      
            // Ambil data produk dari nested object
            allProducts = result.data;
            console.log('Processed products:', allProducts);
            
            // Mengumpulkan kategori dan sub-kategori unik
            uniqueCategories.clear();
            uniqueSubCategories.clear();
            allProducts.forEach(item => {
                const product = item.produk;
                if (product) {
                    if (product.kategori) uniqueCategories.add(product.kategori);
                    if (product.sub_kategori) uniqueSubCategories.add(product.sub_kategori);
                }
            });
            
            // Update filter buttons
            updateFilterButtons();
            
            // Tampilkan semua produk
            displayProducts(allProducts);
        } else {
            console.log('No products data found or error:', result.error);
            showAlert('Gagal memuat data produk: ' + (result.error || 'Data tidak ditemukan'), 'danger');
            displayProducts([]);
        }
    } catch (error) {
        console.error('Error loading products:', error);
        showAlert('Terjadi kesalahan saat memuat produk', 'danger');
        displayProducts([]);
    }
}

// Update filter buttons
function updateFilterButtons() {
    const categoryContainer = document.getElementById('categoryFilters');
    const subCategoryContainer = document.getElementById('subCategoryFilters');
    
    if (!categoryContainer || !subCategoryContainer) return;
    
    // Clear existing buttons
    categoryContainer.innerHTML = '';
    subCategoryContainer.innerHTML = '';
    
    // Add "All" buttons
    addFilterButton(categoryContainer, 'all', 'Semua Kategori', 'category');
    addFilterButton(subCategoryContainer, 'all', 'Semua Sub Kategori', 'subcategory');
    
    // Add category buttons
    [...uniqueCategories].sort().forEach(category => {
        addFilterButton(categoryContainer, category, category, 'category');
    });
    
    // Add sub-category buttons
    [...uniqueSubCategories].sort().forEach(subCategory => {
        addFilterButton(subCategoryContainer, subCategory, subCategory, 'subcategory');
    });
}

// Add filter button
function addFilterButton(container, value, text, type) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `btn btn-outline-primary me-2 mb-2 ${activeFilters[type] === value ? 'active' : ''}`;
    btn.textContent = text;
    btn.onclick = () => filterProducts(type, value);
    container.appendChild(btn);
}

// Filter products
function filterProducts(type, value) {
    activeFilters[type] = value;
    applyFilters();
    
    // Update button states
    const container = document.getElementById(`${type}Filters`);
    if (container) {
        container.querySelectorAll('button').forEach(btn => {
            btn.classList.toggle('active', btn.textContent === value || (value === 'all' && btn.textContent.includes('Semua')));
        });
    }
}

// Apply all active filters
function applyFilters() {
    let filteredProducts = allProducts;
    
    // Apply category filter
    if (activeFilters.category !== 'all') {
        filteredProducts = filteredProducts.filter(item => 
            item.produk.kategori === activeFilters.category
        );
    }
    
    // Apply sub-category filter
    if (activeFilters.subcategory !== 'all') {
        filteredProducts = filteredProducts.filter(item => 
            item.produk.sub_kategori === activeFilters.subcategory
        );
    }
    
    displayProducts(filteredProducts);
}

// Global variables
let currentPage = 1;
const itemsPerPage = 15;
let filteredProducts = [];

// Display products with pagination
function displayProducts(products = []) {
    console.log('Displaying products:', products);
    if (!productTable) {
        console.log('Product table element not found');
        return;
    }
    
    const tbody = productTable.querySelector('tbody');
    if (!tbody) {
        console.error('tbody element not found in product table');
        return;
    }
    
    // Create pagination container if it doesn't exist
    let paginationContainer = document.getElementById('pagination');
    if (!paginationContainer) {
        paginationContainer = document.createElement('div');
        paginationContainer.id = 'pagination';
        paginationContainer.className = 'pagination-container d-flex justify-content-center';
        productTable.parentNode.appendChild(paginationContainer);
    }
    
    // Clear the table body
    tbody.innerHTML = '';
    
    // If no products, show message
    if (!products || products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">Tidak ada produk ditemukan</td></tr>';
        updatePagination(0);
        return;
    }

    // Calculate pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedProducts = products.slice(startIndex, endIndex);

    paginatedProducts.forEach(item => {
        if (!item || !item.produk) {
            console.warn('Invalid product item:', item);
            return;
        }

        const product = item.produk;
        const row = document.createElement('tr');
        
        // Ekstrak nama kategori dan subkategori
        let kategoriDisplay = '-';
        let subKategoriDisplay = '-';
        
        if (product.kategori && typeof product.kategori === 'object') {
            kategoriDisplay = product.kategori.nama_kategori || '-';
        } else if (product.nama_kategori) {
            kategoriDisplay = product.nama_kategori;
        }
        
        if (product.subkategori && typeof product.subkategori === 'object') {
            subKategoriDisplay = product.subkategori.nama_subkategori || '-';
        } else if (product.nama_subkategori) {
            subKategoriDisplay = product.nama_subkategori;
        }
        
        // Format tanggal kadaluarsa jika ada
        let tanggalKadaluarsa = '-';
        if (product.tanggal_kadaluarsa) {
            const date = new Date(product.tanggal_kadaluarsa);
            if (!isNaN(date.getTime())) {
                tanggalKadaluarsa = date.toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                });
            }
        }
        
        row.innerHTML = `
            <td>${product.id_produk || '-'}</td>
            <td>${product.nama_produk || '-'}</td>
            <td>${kategoriDisplay}</td>
            <td>${subKategoriDisplay}</td>
            <td>${product.kode_produk || '-'}</td>
            <td>${formatCurrency(parseFloat(product.harga_produk)) || 'Rp0'}</td>
            <td>${product.stok_barang || '0'}</td>
            <td>${tanggalKadaluarsa}</td>
            <td>
                <div class="btn-group" role="group">
                    <button class="btn btn-info btn-sm edit-product" data-id="${product.id_produk}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-danger btn-sm delete-product" data-id="${product.id_produk}">
                        <i class="fas fa-trash"></i> Hapus
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });

    // Remove any existing page info
    const existingPageInfo = document.querySelector('.page-info');
    if (existingPageInfo) {
        existingPageInfo.remove();
    }

    // Add page info after the table
    const totalPages = Math.ceil(products.length / itemsPerPage);
    const pageInfo = document.createElement('div');
    pageInfo.className = 'page-info text-center mb-2';
    pageInfo.innerHTML = `Halaman ${currentPage} dari ${totalPages} (Total: ${products.length} produk)`;
    productTable.parentNode.insertBefore(pageInfo, paginationContainer);

    // Update pagination
    updatePagination(products.length);
}

// Add pagination controls
function updatePagination(totalItems) {
    const paginationContainer = document.getElementById('pagination');
    if (!paginationContainer) return;

    const totalPages = Math.ceil(totalItems / itemsPerPage);
    let paginationHTML = '<ul class="pagination justify-content-center">';

    // Previous button
    paginationHTML += `
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${currentPage - 1}">&laquo; Previous</a>
        </li>
    `;

    // First page
    paginationHTML += `
        <li class="page-item ${currentPage === 1 ? 'active' : ''}">
            <a class="page-link" href="#" data-page="1">1</a>
        </li>
    `;

    // Add ellipsis and pages around current page
    let startPage = Math.max(2, currentPage - 2);
    let endPage = Math.min(totalPages - 1, currentPage + 2);

    if (startPage > 2) {
        paginationHTML += '<li class="page-item disabled"><span class="page-link">...</span></li>';
    }

    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <li class="page-item ${currentPage === i ? 'active' : ''}">
                <a class="page-link" href="#" data-page="${i}">${i}</a>
            </li>
        `;
    }

    if (endPage < totalPages - 1) {
        paginationHTML += '<li class="page-item disabled"><span class="page-link">...</span></li>';
    }

    // Last page
    if (totalPages > 1) {
        paginationHTML += `
            <li class="page-item ${currentPage === totalPages ? 'active' : ''}">
                <a class="page-link" href="#" data-page="${totalPages}">${totalPages}</a>
            </li>
        `;
    }

    // Next button
    paginationHTML += `
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${currentPage + 1}">Next &raquo;</a>
        </li>
    `;

    paginationHTML += '</ul>';
    paginationContainer.innerHTML = paginationHTML;

    // Add click handlers
    paginationContainer.querySelectorAll('.page-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const newPage = parseInt(e.target.dataset.page);
            if (!isNaN(newPage) && newPage >= 1 && newPage <= totalPages) {
                currentPage = newPage;
                displayProducts(filteredProducts);
                // Scroll to top of table
                productTable.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
}

// Handle search with debounce
let searchTimeout;
function handleSearch(e) {
    const searchQuery = e.target.value.toLowerCase();
    
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        let filteredProducts = allProducts;
        
        if (searchQuery) {
            filteredProducts = filteredProducts.filter(item => {
                const product = item.produk;
                return (
                    product.nama_produk.toLowerCase().includes(searchQuery) ||
                    product.kategori.toLowerCase().includes(searchQuery) ||
                    product.sub_kategori.toLowerCase().includes(searchQuery) ||
                    product.kode_produk.toLowerCase().includes(searchQuery)
                );
            });
        }
        
        displayProducts(filteredProducts);
    }, 300);
}

// Handle form submissions
async function handleAddProduct(event) {
    event.preventDefault();
    
    // Validasi form
    const formData = new FormData(event.target);
    const productData = Object.fromEntries(formData.entries());
    
    // Debug: Log semua field dari form
    console.log("Form data:", productData);
    
    // Validasi data produk
    if (!productData.nama_produk || !productData.kategori || !productData.subkategori || 
        !productData.kode_produk || !productData.harga_produk || !productData.tanggal_kadaluarsa || 
        !productData.stok_barang) {
        showAlert('Semua field harus diisi', 'danger');
        return;
    }
    
    // Konversi nilai numerik
    productData.harga_produk = parseInt(productData.harga_produk);
    productData.stok_barang = parseInt(productData.stok_barang);
    
    // Format tanggal kadaluarsa ke ISO string
    const expDate = new Date(productData.tanggal_kadaluarsa);
    productData.tanggal_kadaluarsa = expDate.toISOString();
    
    try {
        // Cek apakah kategori dan subkategori adalah opsi "Baru"
        let kategoriId = productData.kategori;
        let subkategoriId = productData.subkategori;
        
        // Jika kategori adalah "Baru", buat kategori baru
        if (kategoriId === "new") {
            const newKategoriName = document.getElementById('new_kategori_name').value.trim();
            if (!newKategoriName) {
                showAlert('Nama kategori baru tidak boleh kosong', 'danger');
                return;
            }
            
            try {
                console.log(`Membuat kategori baru: "${newKategoriName}"`);
                const newKategori = await kategori.create(newKategoriName);
                console.log('Kategori baru berhasil dibuat:', newKategori);
                kategoriId = newKategori.data.id_kategori;
            } catch (error) {
                console.error('Gagal membuat kategori baru:', error);
                showAlert(`Gagal membuat kategori baru: ${error.message}`, 'danger');
                return;
            }
        }
        
        // Jika subkategori adalah "Baru", buat subkategori baru
        if (subkategoriId === "new") {
            const newSubkategoriName = document.getElementById('new_subkategori_name').value.trim();
            if (!newSubkategoriName) {
                showAlert('Nama subkategori baru tidak boleh kosong', 'danger');
                return;
            }
            
            try {
                const newSubkategori = await subkategori.create(newSubkategoriName, kategoriId);
                subkategoriId = newSubkategori.data.id_subkategori;
            } catch (error) {
                console.error('Gagal membuat subkategori baru:', error);
                showAlert(`Gagal membuat subkategori baru: ${error.message}`, 'danger');
                return;
            }
        }
        
        // Dapatkan data kategori dan subkategori
        let kategoriObj = {};
        let subkategoriObj = {};
        
        try {
            // Dapatkan data kategori menggunakan fungsi kategori.getById
            const kategoriResponse = await kategori.getById(kategoriId);
            console.log('Kategori response:', kategoriResponse);
            
            if (!kategoriResponse || !kategoriResponse.data) {
                throw new Error('Gagal mendapatkan data kategori');
            }
            
            kategoriObj = {
                id_kategori: kategoriResponse.data.id_kategori,
                nama_kategori: kategoriResponse.data.nama_kategori
            };
            
            // Dapatkan data subkategori menggunakan fungsi subkategori.getById
            const subkategoriResponse = await subkategori.getById(subkategoriId);
            console.log('Subkategori response:', subkategoriResponse);
            
            if (!subkategoriResponse || !subkategoriResponse.data) {
                throw new Error('Gagal mendapatkan data subkategori');
            }
            
            subkategoriObj = {
                id_subkategori: subkategoriResponse.data.id_subkategori,
                nama_subkategori: subkategoriResponse.data.nama_subkategori,
                kategori: kategoriObj
            };
        } catch (error) {
            console.error('Error fetching kategori/subkategori data:', error);
            showAlert(`Error: ${error.message}`, 'danger');
            return;
        }
        
        // Siapkan data produk dengan format yang benar
        const finalProductData = {
            nama_produk: productData.nama_produk,
            kategori: kategoriObj,
            subkategori: subkategoriObj,
            kode_produk: productData.kode_produk,
            harga_produk: productData.harga_produk,
            stok_barang: productData.stok_barang,
            tanggal_kadaluarsa: productData.tanggal_kadaluarsa
        };
        
        console.log('Mengirim data produk:', finalProductData);
        
        // Kirim data ke backend
        const response = await fetch(`${BASE_URL}/produk/createproduk`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${getToken()}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(finalProductData),
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Gagal membuat produk");
        }
        
        const result = await response.json();
        
        // Reset form dan tampilkan notifikasi sukses
        event.target.reset();
        showAlert('Produk berhasil ditambahkan', 'success');
        
        // Perbarui tabel produk
        displayProducts();
        
        // Tutup modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('addProductModal'));
        modal.hide();
    } catch (error) {
        console.error('Error adding product:', error);
        showAlert(`Gagal menambahkan produk: ${error.message}`, 'danger');
    }
}

async function handleUpdateProduct(e) {
    e.preventDefault();
    try {
        const form = e.target;
        const formData = new FormData(form);
        
        // Debug: Log all form values
        console.log('Form values:');
        for (let [key, value] of formData.entries()) {
            console.log(key + ': ' + value);
        }
        
        // Ambil nilai dari form
        const kategoriSelect = document.getElementById('update_kategori');
        const subKategoriSelect = document.getElementById('update_sub_kategori');
        
        // Dapatkan ID dan nama kategori dan subkategori dari opsi yang dipilih
        let kategoriNama = '';
        if (kategoriSelect) {
            const selectedOption = kategoriSelect.options[kategoriSelect.selectedIndex];
            if (selectedOption) {
                kategoriNama = selectedOption.textContent;
            }
        }
        
        let subKategoriNama = '';
        if (subKategoriSelect) {
            const selectedOption = subKategoriSelect.options[subKategoriSelect.selectedIndex];
            if (selectedOption) {
                subKategoriNama = selectedOption.textContent;
            }
        }
        
        const productData = {
            id_produk: document.getElementById('update_id_produk').value,
            nama_produk: document.getElementById('update_nama_produk').value,
            kategori: {
                id_kategori: document.getElementById('update_kategori').value,
                nama_kategori: kategoriNama
            },
            subkategori: {
                id_subkategori: document.getElementById('update_sub_kategori').value,
                nama_subkategori: subKategoriNama
            },
            kode_produk: document.getElementById('update_kode_produk').value,
            harga_produk: parseInt(document.getElementById('update_harga_produk').value) || 0,
            stok_barang: parseInt(document.getElementById('update_stok_barang').value) || 0,
            tanggal_kadaluarsa: document.getElementById('update_tanggal_kadaluarsa').value
        };
        
        // Debug: Log processed data
        console.log('Product data to send:', productData);
        
        // Validate data
        const requiredFields = ['nama_produk', 'kategori.id_kategori', 'kode_produk'];
        const emptyFields = requiredFields.filter(field => !getFieldValue(productData, field));
        
        if (emptyFields.length > 0) {
            const fieldNames = {
                nama_produk: 'Nama Produk',
                'kategori.id_kategori': 'Kategori',
                kode_produk: 'Kode Produk'
            };
            const missingFields = emptyFields.map(field => fieldNames[field]).join(', ');
            showAlert('Field berikut harus diisi: ' + missingFields, 'danger');
            return;
        }
        
        const result = await products.update(productData.id_produk, productData);
        if (result.success) {
            showAlert('Produk berhasil diperbarui', 'success');
            await loadProducts();
            // Menggunakan jQuery untuk menutup modal
            $('#updateProductModal').modal('hide');
            // Reset form setelah sukses
            form.reset();
        } else {
            showAlert('Gagal memperbarui produk: ' + (result.error || 'Unknown error'), 'danger');
        }
    } catch (error) {
        console.error('Error updating product:', error);
        // Jika produk berhasil diupdate tapi ada error saat menutup modal
        // Tetap tampilkan pesan sukses
        if (error.message && error.message.includes('bootstrap.Modal.getInstance')) {
            showAlert('Produk berhasil diperbarui', 'success');
            // Coba tutup modal dengan jQuery
            $('#updateProductModal').modal('hide');
        } else {
            showAlert('Terjadi kesalahan saat memperbarui produk', 'danger');
        }
    }
}

// Fungsi untuk mendapatkan nilai field dari objek
function getFieldValue(obj, field) {
    const fieldParts = field.split('.');
    let value = obj;
    
    for (let part of fieldParts) {
        if (value && typeof value === 'object') {
            value = value[part];
        } else {
            return null;
        }
    }
    
    return value;
}

// Handle edit product click
async function handleEditClick(event) {
    const button = event.target.closest('.edit-product');
    if (!button) return;

    try {
        const productId = button.getAttribute('data-id');
        console.log('Editing product with ID:', productId);

        // Dapatkan data produk dari API
        const product = await products.getById(productId);
        if (!product) {
            throw new Error('Produk tidak ditemukan');
        }

        console.log('Product data from API:', product);

        // Reset form
        const form = document.getElementById('updateProductForm');
        if (form) {
            form.reset();
        }

        // Set form values
        document.getElementById('update_id_produk').value = product.id_produk;
        document.getElementById('update_nama_produk').value = product.nama_produk;
        document.getElementById('update_kode_produk').value = product.kode_produk;
        document.getElementById('update_harga_produk').value = product.harga_produk;
        document.getElementById('update_stok_barang').value = product.stok_barang;
        
        // Set tanggal kadaluarsa jika ada
        if (product.tanggal_kadaluarsa) {
            // Format tanggal untuk input type="date" (YYYY-MM-DD)
            const date = new Date(product.tanggal_kadaluarsa);
            if (!isNaN(date.getTime())) {
                const formattedDate = date.toISOString().split('T')[0];
                document.getElementById('update_tanggal_kadaluarsa').value = formattedDate;
            }
        }

        // Handle kategori dan subkategori
        await populateKategoriAndSubkategori(product);

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('updateProductModal'));
        modal.show();

    } catch (error) {
        console.error('Error preparing edit form:', error);
        showAlert('Terjadi kesalahan saat menyiapkan form edit', 'danger');
    }
}

// Fungsi untuk mengisi dropdown kategori dan subkategori pada form edit
async function populateKategoriAndSubkategori(product) {
    try {
        // Ambil semua kategori
        const kategoriList = await fetchKategori();
        const kategoriSelect = document.getElementById('update_kategori');
        
        if (!kategoriSelect) return;
        
        // Reset dan isi dropdown kategori
        kategoriSelect.innerHTML = '<option value="">Pilih Kategori</option>';
        
        // Cari ID kategori berdasarkan nama kategori
        let selectedKategoriId = null;
        
        kategoriList.forEach(kat => {
            const option = document.createElement('option');
            option.value = kat.id_kategori;
            option.textContent = kat.nama_kategori;
            
            // Pilih kategori yang sesuai
            if (kat.nama_kategori === product.nama_kategori) {
                option.selected = true;
                selectedKategoriId = kat.id_kategori;
            }
            
            kategoriSelect.appendChild(option);
        });
        
        // Update subkategori berdasarkan kategori yang dipilih
        if (selectedKategoriId) {
            await updateSubCategories(selectedKategoriId, true);
            
            // Pilih subkategori yang sesuai
            setTimeout(async () => {
                const subKategoriSelect = document.getElementById('update_sub_kategori');
                if (!subKategoriSelect) return;
                
                // Ambil semua subkategori
                const subKategoriList = await fetchSubKategoriByKategori(selectedKategoriId);
                
                // Cari subkategori yang sesuai berdasarkan nama
                for (let i = 0; i < subKategoriSelect.options.length; i++) {
                    const subKategori = subKategoriList.find(sk => 
                        sk.id_subkategori === subKategoriSelect.options[i].value && 
                        sk.nama_subkategori === product.nama_subkategori
                    );
                    
                    if (subKategori) {
                        subKategoriSelect.selectedIndex = i;
                        break;
                    }
                }
            }, 300);
        }
    } catch (error) {
        console.error('Error populating kategori and subkategori:', error);
        showAlert(`Error: ${error.message}`, 'danger');
    }
}

// Initialize update form
function initializeUpdateForm() {
    // Fungsi ini sudah tidak diperlukan karena event listener untuk update_kategori
    // sudah ditambahkan pada saat DOM loaded
    console.log('Update form initialized');
}

// Handle delete product
async function handleDeleteClick(event) {
    const button = event.target.closest('.delete-product');
    if (!button) return;
    
    const id = button.getAttribute('data-id');
    if (!id) {
        alert('ID produk tidak ditemukan');
        return;
    }
    
    if (confirm('Apakah Anda yakin ingin menghapus produk ini?')) {
        try {
            const result = await products.delete(id);
            console.log('Delete result:', result);
            
            if (result.success) {
                showAlert('Produk berhasil dihapus', 'success');
                await loadProducts();
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Error deleting product:', error);
            showAlert('Gagal menghapus produk: ' + error.message, 'danger');
        }
    }
}

// Handle import data
async function handleImportData(e) {
    e.preventDefault();
    const fileInput = document.getElementById('fileInput');
    
    if (!fileInput.files.length) {
        showAlert('Pilih file terlebih dahulu', 'warning');
        return;
    }

    const file = fileInput.files[0];
    
    // Validasi format file
    const allowedTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'];
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.csv')) {
        showAlert('Format file tidak didukung. Gunakan file Excel (.xlsx) atau CSV', 'warning');
        return;
    }

    // Validasi ukuran file (maksimal 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
        showAlert('Ukuran file terlalu besar. Maksimal 5MB', 'warning');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    // Tampilkan loading state
    const importButton = document.getElementById('importDataBtn');
    const originalText = importButton.textContent;
    importButton.disabled = true;
    importButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Mengimpor...';

    try {
        const result = await products.importData(formData);
        if (result.success) {
            let message = `Berhasil mengimpor ${result.count || 0} produk`;
            if (result.skipped && result.skipped.length > 0) {
                message += `, ${result.skipped.length} produk dilewati`;
            }
            showAlert(message, 'success');
            await loadProducts();
            $('#importDataModal').modal('hide');
            document.getElementById('importDataForm').reset();
        } else {
            showAlert(result.error || 'Gagal mengimpor data', 'danger');
        }
    } catch (error) {
        console.error('Error importing data:', error);
        let errorMessage = 'Terjadi kesalahan saat mengimpor data';
        
        if (error.message.includes('duplicate')) {
            errorMessage = 'Beberapa produk memiliki kode yang sudah ada dalam sistem';
        } else if (error.message.includes('validation')) {
            errorMessage = 'Data dalam file tidak valid. Pastikan semua kolom terisi dengan benar';
        }
        
        showAlert(errorMessage, 'danger');
    } finally {
        // Kembalikan tombol ke kondisi awal
        importButton.disabled = false;
        importButton.innerHTML = originalText;
    }
}

// Initialize import form
function initializeImportForm() {
    const importBtn = document.getElementById('importDataBtn');
    if (importBtn) {
        importBtn.addEventListener('click', handleImportData);
    }
}

// Helper functions
function showAlert(message, type) {
    const alertPlaceholder = document.getElementById('alertPlaceholder');
    if (alertPlaceholder) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <div class="alert alert-${type} alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
        `;
        alertPlaceholder.appendChild(wrapper);

        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            const alert = wrapper.querySelector('.alert');
            if (alert) {
                $(alert).alert('close');
            }
        }, 5000);
    }
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

// Check authentication and redirect if not logged in
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '../login.html';
        return false;
    }
    return true;
}

// Objek untuk manajemen kategori
const kategori = {
    // Mendapatkan semua kategori
    getAll: async function() {
        try {
            const kategoriData = await fetchKategori();
            console.log('Kategori data in getAll:', kategoriData);
            
            // Periksa apakah data ada dalam format {data: [...]}
            if (kategoriData && kategoriData.data && Array.isArray(kategoriData.data)) {
                return kategoriData.data;
            } else if (Array.isArray(kategoriData)) {
                return kategoriData;
            } else {
                console.error("Format data kategori tidak valid:", kategoriData);
                return [];
            }
        } catch (error) {
            console.error('Error fetching kategori:', error);
            showAlert(`Error: ${error.message}`, 'danger');
            return [];
        }
    },
    
    // Membuat kategori baru
    create: async function(namaKategori) {
        try {
            // Validasi nama kategori
            if (!namaKategori || namaKategori.trim() === '') {
                throw new Error('Nama kategori tidak boleh kosong');
            }
            
            console.log(`Mencoba membuat kategori baru: "${namaKategori}"`);
            
            const response = await fetch(`${BASE_URL}/kategori/admin/create-kategori`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({ nama_kategori: namaKategori })
            });
            
            const result = await handleResponse(response);
            console.log('Kategori berhasil dibuat:', result);
            return result;
        } catch (error) {
            console.error('Error creating kategori:', error);
            throw error;
        }
    },
    
    // Mendapatkan kategori berdasarkan ID
    getById: async function(id) {
        try {
            const response = await fetch(`${BASE_URL}/kategori/getbyid/${id}`, {
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                }
            });
            
            const result = await handleResponse(response);
            console.log('Kategori getById result:', result);
            return result;
        } catch (error) {
            console.error('Error fetching kategori by ID:', error);
            throw error;
        }
    },
    
    // Menghapus kategori berdasarkan ID
    delete: async function(id) {
        try {
            // Periksa apakah ID valid
            if (!id) {
                console.error('ID kategori tidak valid');
                throw new Error('ID kategori tidak valid');
            }
            
            // Tampilkan peringatan bahwa fitur ini belum diimplementasi di backend
            console.warn('Fitur hapus kategori belum diimplementasi di backend');
            alert('Maaf, fitur hapus kategori belum tersedia saat ini. Silakan hubungi administrator.');
            
            // Kembalikan false untuk menunjukkan bahwa penghapusan tidak berhasil
            return false;
            
            /* 
            // Kode asli yang akan digunakan ketika endpoint tersedia
            const response = await fetch(`${BASE_URL}/kategori/admin/delete-kategori/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                }
            });
            
            const result = await handleResponse(response);
            return result.data;
            */
        } catch (error) {
            console.error('Error deleting kategori:', error);
            // Jangan throw error, tangani dengan mengembalikan false
            return false;
        }
    },
    
    // Memperbarui kategori berdasarkan ID
    update: async function(id, namaKategori) {
        try {
            // Validasi nama kategori
            if (!namaKategori || namaKategori.trim() === '') {
                throw new Error('Nama kategori tidak boleh kosong');
            }
            
            console.log(`Mencoba memperbarui kategori dengan ID ${id} menjadi "${namaKategori}"`);
            
            const response = await fetch(`${BASE_URL}/kategori/admin/update-kategori/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({ nama_kategori: namaKategori })
            });
            
            const result = await handleResponse(response);
            console.log('Kategori berhasil diperbarui:', result);
            return result.data;
        } catch (error) {
            console.error('Error updating kategori:', error);
            throw error;
        }
    }
};

// Objek untuk manajemen subkategori
const subkategori = {
    // Mendapatkan semua subkategori
    getAll: async function() {
        try {
            const subkategoriData = await fetchSubKategori();
            console.log('Subkategori data in getAll:', subkategoriData);
            
            // Periksa apakah data ada dalam format {data: [...]}
            if (subkategoriData && subkategoriData.data && Array.isArray(subkategoriData.data)) {
                return subkategoriData.data;
            } else if (Array.isArray(subkategoriData)) {
                return subkategoriData;
            } else {
                console.error("Format data subkategori tidak valid:", subkategoriData);
                return [];
            }
        } catch (error) {
            console.error('Error fetching subkategori:', error);
            showAlert(`Error: ${error.message}`, 'danger');
            return [];
        }
    },
    
    // Mendapatkan subkategori berdasarkan ID
    getById: async function(id) {
        try {
            const response = await fetch(`${BASE_URL}/subkategori/getbyid/${id}`, {
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                }
            });
            
            const result = await handleResponse(response);
            console.log('Subkategori getById result:', result);
            return result;
        } catch (error) {
            console.error('Error fetching subkategori by ID:', error);
            throw error;
        }
    },
    
    // Mendapatkan subkategori berdasarkan ID kategori
    getByKategoriId: async function(kategoriId) {
        try {
            // Gunakan fetchSubKategoriByKategori yang sudah menghilangkan duplikasi
            const subkategoriData = await fetchSubKategoriByKategori(kategoriId);
            console.log(`Subkategori for kategori ${kategoriId}:`, subkategoriData);
            return subkategoriData;
        } catch (error) {
            console.error(`Error fetching subkategori for kategori ${kategoriId}:`, error);
            showAlert(`Error: ${error.message}`, 'danger');
            return [];
        }
    },
    
    // Membuat subkategori baru
    create: async function(namaSubKategori, kategoriId) {
        try {
            // Validasi input
            if (!namaSubKategori || namaSubKategori.trim() === '') {
                throw new Error('Nama subkategori tidak boleh kosong');
            }
            
            if (!kategoriId) {
                throw new Error('ID kategori tidak boleh kosong');
            }
            
            console.log(`Mencoba membuat subkategori baru: "${namaSubKategori}" untuk kategori ID: ${kategoriId}`);
            
            // Dapatkan data kategori
            let kategoriObj = {};
            try {
                const kategoriResponse = await fetch(`${BASE_URL}/kategori/getbyid/${kategoriId}`, {
                    headers: {
                        'Authorization': `Bearer ${getToken()}`
                    }
                });
                
                if (!kategoriResponse.ok) {
                    throw new Error('Gagal mendapatkan data kategori');
                }
                
                const kategoriData = await kategoriResponse.json();
                kategoriObj = {
                    id_kategori: kategoriData.id_kategori,
                    nama_kategori: kategoriData.nama_kategori
                };
            } catch (error) {
                console.warn('Tidak bisa mendapatkan data kategori lengkap:', error);
                kategoriObj = {
                    id_kategori: kategoriId,
                    nama_kategori: ''  // Kosong jika tidak bisa mendapatkan nama
                };
            }
            
            const response = await fetch(`${BASE_URL}/subkategori/admin/create-subkategori`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({
                    nama_subkategori: namaSubKategori,
                    kategori: kategoriObj
                })
            });
            
            const result = await handleResponse(response);
            console.log('Subkategori berhasil dibuat:', result);
            return result;
        } catch (error) {
            console.error('Error creating subkategori:', error);
            throw error;
        }
    },
    
    // Membuat subkategori baru
    update: async function(id, kategoriId, namaSubKategori) {
        try {
            // Dapatkan data kategori
            let kategoriObj = {};
            try {
                const kategoriResponse = await fetch(`${BASE_URL}/kategori/getbyid/${kategoriId}`, {
                    headers: {
                        'Authorization': `Bearer ${getToken()}`
                    }
                });
                
                if (!kategoriResponse.ok) {
                    throw new Error('Gagal mendapatkan data kategori');
                }
                
                const kategoriData = await kategoriResponse.json();
                kategoriObj = {
                    id_kategori: kategoriData.id_kategori,
                    nama_kategori: kategoriData.nama_kategori
                };
            } catch (error) {
                console.warn('Tidak bisa mendapatkan data kategori lengkap:', error);
                kategoriObj = {
                    id_kategori: kategoriId,
                    nama_kategori: ''  // Kosong jika tidak bisa mendapatkan nama
                };
            }
            
            const response = await fetch(`${BASE_URL}/subkategori/admin/update-subkategori/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({
                    nama_subkategori: namaSubKategori,
                    kategori: kategoriObj
                })
            });
            
            const result = await handleResponse(response);
            console.log('Subkategori berhasil diperbarui:', result);
            return result;
        } catch (error) {
            console.error('Error updating subkategori:', error);
            throw error;
        }
    },
    
    // Menghapus subkategori
    delete: async function(id) {
        try {
            // Periksa apakah ID valid
            if (!id) {
                console.error('ID subkategori tidak valid');
                throw new Error('ID subkategori tidak valid');
            }
            
            // Tampilkan peringatan bahwa fitur ini belum diimplementasi di backend
            console.warn('Fitur hapus subkategori belum diimplementasi di backend');
            alert('Maaf, fitur hapus subkategori belum tersedia saat ini. Silakan hubungi administrator.');
            
            // Kembalikan false untuk menunjukkan bahwa penghapusan tidak berhasil
            return false;
            
            /* 
            // Kode asli yang akan digunakan ketika endpoint tersedia
            const response = await fetch(`${BASE_URL}/subkategori/admin/delete-subkategori/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                }
            });
            
            const result = await handleResponse(response);
            return result.data;
            */
        } catch (error) {
            console.error('Error deleting subkategori:', error);
            // Jangan throw error, tangani dengan mengembalikan false
            return false;
        }
    }
};

// Inisialisasi manajemen kategori
function initializeKategoriManagement() {
    // Load kategori saat modal dibuka
    $('#manageKategoriModal').on('show.bs.modal', loadKategoriTable);
    
    // Form tambah kategori
    const addKategoriForm = document.getElementById('addKategoriForm');
    if (addKategoriForm) {
        addKategoriForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const namaKategori = document.getElementById('newKategoriName').value.trim();
            if (!namaKategori) {
                showAlert('Nama kategori tidak boleh kosong', 'danger');
                return;
            }
            
            try {
                await kategori.create(namaKategori);
                document.getElementById('newKategoriName').value = '';
                showAlert('Kategori berhasil ditambahkan', 'success');
                loadKategoriTable();
            } catch (error) {
                console.error('Error creating kategori:', error);
                showAlert(`Error: ${error.message}`, 'danger');
            }
        });
    }
    
    // Edit kategori
    document.addEventListener('click', async function(e) {
        if (e.target.classList.contains('edit-kategori') || e.target.closest('.edit-kategori')) {
            const button = e.target.closest('.edit-kategori') || e.target;
            const id = button.getAttribute('data-id');
            const nama = button.getAttribute('data-nama');
            
            document.getElementById('editKategoriId').value = id;
            document.getElementById('editKategoriName').value = nama;
            
            const modal = new bootstrap.Modal(document.getElementById('editKategoriModal'));
            modal.show();
        }
    });
    
    // Simpan perubahan kategori
    const saveKategoriChanges = document.getElementById('saveKategoriChanges');
    if (saveKategoriChanges) {
        saveKategoriChanges.addEventListener('click', async function() {
            const id = document.getElementById('editKategoriId').value;
            const nama = document.getElementById('editKategoriName').value.trim();
            
            if (!nama) {
                showAlert('Nama kategori tidak boleh kosong', 'danger');
                return;
            }
            
            try {
                await kategori.update(id, nama);
                showAlert('Kategori berhasil diperbarui', 'success');
                
                // Tutup modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('editKategoriModal'));
                modal.hide();
                
                // Refresh tabel
                loadKategoriTable();
            } catch (error) {
                console.error('Error updating kategori:', error);
                showAlert(`Error: ${error.message}`, 'danger');
            }
        });
    }
    
    // Hapus kategori
    document.addEventListener('click', async function(e) {
        if (e.target.classList.contains('delete-kategori') || e.target.closest('.delete-kategori')) {
            const button = e.target.closest('.delete-kategori') || e.target;
            const id = button.getAttribute('data-id');
            const nama = button.getAttribute('data-nama');
            
            if (confirm(`Apakah Anda yakin ingin menghapus kategori "${nama}"? Semua subkategori yang terkait juga akan dihapus.`)) {
                try {
                    await kategori.delete(id);
                    showAlert('Kategori berhasil dihapus', 'success');
                    loadKategoriTable();
                } catch (error) {
                    console.error('Error deleting kategori:', error);
                    showAlert(`Error: ${error.message}`, 'danger');
                }
            }
        }
    });
}

// Inisialisasi manajemen subkategori
function initializeSubKategoriManagement() {
    // Load subkategori dan kategori saat modal dibuka
    $('#manageSubKategoriModal').on('show.bs.modal', async function() {
        await loadSubKategoriTable();
        await populateKategoriDropdowns();
    });
    
    // Form tambah subkategori
    const addSubKategoriForm = document.getElementById('addSubKategoriForm');
    if (addSubKategoriForm) {
        addSubKategoriForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const idKategori = document.getElementById('parentKategori').value;
            const namaSubKategori = document.getElementById('newSubKategoriName').value.trim();
            
            if (!idKategori) {
                showAlert('Pilih kategori terlebih dahulu', 'danger');
                return;
            }
            
            if (!namaSubKategori) {
                showAlert('Nama subkategori tidak boleh kosong', 'danger');
                return;
            }
            
            try {
                await subkategori.create(namaSubKategori, idKategori);
                document.getElementById('newSubKategoriName').value = '';
                showAlert('Subkategori berhasil ditambahkan', 'success');
                loadSubKategoriTable();
            } catch (error) {
                console.error('Error creating subkategori:', error);
                showAlert(`Error: ${error.message}`, 'danger');
            }
        });
    }
    
    // Edit subkategori
    document.addEventListener('click', async function(e) {
        if (e.target.classList.contains('edit-subkategori') || e.target.closest('.edit-subkategori')) {
            const button = e.target.closest('.edit-subkategori') || e.target;
            const id = button.getAttribute('data-id');
            const idKategori = button.getAttribute('data-kategori-id');
            const nama = button.getAttribute('data-nama');
            
            // Populate kategori dropdown terlebih dahulu
            await populateKategoriDropdowns('editSubKategoriParent');
            
            document.getElementById('editSubKategoriId').value = id;
            document.getElementById('editSubKategoriName').value = nama;
            
            // Set selected kategori
            const kategoriSelect = document.getElementById('editSubKategoriParent');
            for (let i = 0; i < kategoriSelect.options.length; i++) {
                if (kategoriSelect.options[i].value === idKategori) {
                    kategoriSelect.selectedIndex = i;
                    break;
                }
            }
            
            const modal = new bootstrap.Modal(document.getElementById('editSubKategoriModal'));
            modal.show();
        }
    });
    
    // Simpan perubahan subkategori
    const saveSubKategoriChanges = document.getElementById('saveSubKategoriChanges');
    if (saveSubKategoriChanges) {
        saveSubKategoriChanges.addEventListener('click', async function() {
            const id = document.getElementById('editSubKategoriId').value;
            const idKategori = document.getElementById('editSubKategoriParent').value;
            const nama = document.getElementById('editSubKategoriName').value.trim();
            
            if (!idKategori) {
                showAlert('Pilih kategori terlebih dahulu', 'danger');
                return;
            }
            
            if (!nama) {
                showAlert('Nama subkategori tidak boleh kosong', 'danger');
                return;
            }
            
            try {
                await subkategori.update(id, idKategori, nama);
                showAlert('Subkategori berhasil diperbarui', 'success');
                
                // Tutup modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('editSubKategoriModal'));
                modal.hide();
                
                // Refresh tabel
                loadSubKategoriTable();
            } catch (error) {
                console.error('Error updating subkategori:', error);
                showAlert(`Error: ${error.message}`, 'danger');
            }
        });
    }
    
    // Hapus subkategori
    document.addEventListener('click', async function(e) {
        if (e.target.classList.contains('delete-subkategori') || e.target.closest('.delete-subkategori')) {
            const button = e.target.closest('.delete-subkategori') || e.target;
            const id = button.getAttribute('data-id');
            const nama = button.getAttribute('data-nama');
            
            if (confirm(`Apakah Anda yakin ingin menghapus subkategori "${nama}"?`)) {
                try {
                    const result = await subkategori.delete(id);
                    
                    // Jika penghapusan berhasil, perbarui UI
                    if (result !== false) {
                        showAlert('Subkategori berhasil dihapus', 'success');
                        loadSubKategoriTable();
                    }
                    // Jika false, berarti sudah ditangani oleh fungsi delete dengan menampilkan alert
                } catch (error) {
                    console.error('Error deleting subkategori:', error);
                    showAlert(`Error: ${error.message}`, 'danger');
                }
            }
        }
    });
}

// Load tabel kategori
async function loadKategoriTable() {
    const tableBody = document.getElementById('kategoriTableBody');
    if (!tableBody) return;
    
    try {
        const kategoriList = await kategori.getAll();
        
        // Clear table
        tableBody.innerHTML = '';
        
        // Populate table
        kategoriList.forEach(kat => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${kat.id_kategori}</td>
                <td>${kat.nama_kategori}</td>
                <td>
                    <button class="btn btn-sm btn-primary edit-kategori" 
                        data-id="${kat.id_kategori}" 
                        data-nama="${kat.nama_kategori}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger delete-kategori" 
                        data-id="${kat.id_kategori}" 
                        data-nama="${kat.nama_kategori}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading kategori table:', error);
        showAlert(`Error: ${error.message}`, 'danger');
    }
}

// Load tabel subkategori
async function loadSubKategoriTable() {
    const tableBody = document.getElementById('subKategoriTableBody');
    if (!tableBody) return;
    
    try {
        const subKategoriList = await subkategori.getAll();
        
        // Clear table
        tableBody.innerHTML = '';
        
        // Populate table
        subKategoriList.forEach(subKat => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${subKat.id_subkategori}</td>
                <td>${subKat.kategori ? subKat.kategori.nama_kategori : '-'}</td>
                <td>${subKat.nama_subkategori}</td>
                <td>
                    <button class="btn btn-sm btn-primary edit-subkategori" 
                        data-id="${subKat.id_subkategori}" 
                        data-kategori-id="${subKat.kategori ? subKat.kategori.id_kategori : ''}" 
                        data-nama="${subKat.nama_subkategori}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger delete-subkategori" 
                        data-id="${subKat.id_subkategori}" 
                        data-nama="${subKat.nama_subkategori}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading subkategori table:', error);
        showAlert(`Error: ${error.message}`, 'danger');
    }
}

// Populate dropdown kategori
async function populateKategoriDropdowns(targetId = 'parentKategori') {
    const kategoriSelect = document.getElementById(targetId);
    if (!kategoriSelect) return;
    
    try {
        const kategoriList = await kategori.getAll();
        console.log('Kategori untuk dropdown:', kategoriList);
        
        // Simpan opsi default
        const defaultOption = kategoriSelect.options[0];
        
        // Clear current options
        kategoriSelect.innerHTML = '';
        
        // Add default option
        kategoriSelect.appendChild(defaultOption);
        
        // Add kategori options
        if (Array.isArray(kategoriList) && kategoriList.length > 0) {
            kategoriList.forEach(kat => {
                const option = document.createElement('option');
                option.value = kat.id_kategori;
                option.textContent = kat.nama_kategori;
                kategoriSelect.appendChild(option);
            });
        } else {
            console.warn('Tidak ada data kategori untuk dropdown');
        }
    } catch (error) {
        console.error('Error populating kategori dropdowns:', error);
        showAlert(`Error: ${error.message}`, 'danger');
    }
}

// Fungsi untuk mendapatkan produk berdasarkan ID
products.getById = async function(id) {
    try {
        const response = await fetch(`${BASE_URL}/produk/getbyid/${id}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });
        
        const result = await handleResponse(response);
        return result.data;
    } catch (error) {
        console.error('Error fetching product by ID:', error);
        throw error;
    }
};