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
        const response = await fetch(`${BASE_URL}/produk/by-id/${id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${getToken()}`
          }
        });
        
        // Parse the response
        const responseData = await response.json();
        console.log('GetById raw response:', responseData);
        
        // Check if the response has the expected structure
        if (responseData && responseData.data && responseData.data.produk) {
          console.log('Product data found:', responseData.data.produk);
          return { success: true, data: responseData.data.produk };
        }
        
        console.error('Unexpected response structure:', responseData);
        return { 
          success: false, 
          error: responseData.error || 'Format data tidak valid' 
        };
      } catch (error) {
        console.error('Error fetching product by ID:', error);
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
          subkategori: productData.subkategori,  // Backend mengharapkan field 'subkategori'
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

        console.log('Mengirim request update ke API:', productData);

        const response = await fetch(`${BASE_URL}/produk/update/${id}`, {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(productData)
        });

        const responseData = await response.json();
        console.log('Response dari API:', responseData);

        if (!response.ok) {
          throw new Error(responseData.message || 'Gagal memperbarui produk');
        }

        return { success: true, data: responseData };
      } catch (error) {
        console.error("Error updating product:", error);
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
    let kategoriList = [];
    if (result && result.data && Array.isArray(result.data)) {
      kategoriList = result.data;
    } else if (Array.isArray(result)) {
      kategoriList = result;
    } else if (result && typeof result === 'object') {
      kategoriList = [result];
    } else {
      console.warn('Format data kategori tidak dikenali:', result);
      return { success: false, data: [], error: 'Format data tidak valid' };
    }
    
    // Gunakan Map untuk menghilangkan duplikasi
    const uniqueKategori = new Map();
    
    // Tambahkan kategori unik ke Map
    kategoriList.forEach(kat => {
      if (kat && kat.id_kategori && kat.nama_kategori) {
        uniqueKategori.set(kat.id_kategori, kat);
      }
    });
    
    // Konversi Map kembali ke array
    const uniqueKategoriArray = Array.from(uniqueKategori.values());
    
    return { success: true, data: uniqueKategoriArray };
  } catch (error) {
    console.error("Error fetching kategori:", error);
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
    let subkategoriList = [];
    if (result && result.data && Array.isArray(result.data)) {
      subkategoriList = result.data;
    } else if (Array.isArray(result)) {
      subkategoriList = result;
    } else if (result && typeof result === 'object') {
      subkategoriList = [result];
    } else {
      console.warn('Format data subkategori tidak dikenali:', result);
      return { success: true, data: [] };
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
    const uniqueSubkategoriArray = Array.from(uniqueSubkategori.values());
    
    return { success: true, data: uniqueSubkategoriArray };
  } catch (error) {
    console.error("Error fetching subkategori:", error);
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
    // console.log(`Memperbarui dropdown subkategori untuk kategori ID: ${selectedKategoriId}`);
    
    // Dapatkan data subkategori
    const subKategoriList = await fetchSubKategoriByKategori(selectedKategoriId);
    
    console.log('Data subkategori yang diterima:', subKategoriList);
    
    // Gunakan Set untuk melacak ID subkategori yang sudah ditambahkan
    const addedSubkategoriIds = new Set();
    
    // Pastikan subKategoriList adalah array dan memiliki data
    if (Array.isArray(subKategoriList) && subKategoriList.length > 0) {
      // Aktifkan dropdown
      subCategorySelect.disabled = false;
      
      // Tambahkan opsi untuk setiap subkategori (tanpa duplikasi)
      subKategoriList.forEach(subKategori => {
        if (subKategori && subKategori.id_subkategori && subKategori.nama_subkategori) {
          // Periksa apakah ID ini sudah ditambahkan sebelumnya
          if (!addedSubkategoriIds.has(subKategori.id_subkategori)) {
            const option = document.createElement('option');
            option.value = subKategori.id_subkategori;
            option.textContent = subKategori.nama_subkategori;
            subCategorySelect.appendChild(option);
            
            // Tandai ID ini sebagai sudah ditambahkan
            addedSubkategoriIds.add(subKategori.id_subkategori);
          }
        }
      });
    }
    
    
    // Jika tidak ada subkategori sama sekali, pastikan dropdown tetap aktif
    if (subCategorySelect.options.length <= 1 && !isUpdateForm) {
      subCategorySelect.disabled = false;
    }
  } catch (error) {
    console.error('Error updating subcategories:', error);
    return;
  }
}

// Tambahkan event listener untuk dropdown kategori
function setupKategoriChangeListeners() {
    // Untuk form tambah produk
    const kategoriDropdown = document.getElementById('kategori');
    if (kategoriDropdown) {
        // Hapus event listener lama untuk menghindari duplikasi
        const newKategoriDropdown = kategoriDropdown.cloneNode(true);
        kategoriDropdown.parentNode.replaceChild(newKategoriDropdown, kategoriDropdown);
        
        // Pasang event listener baru
        newKategoriDropdown.addEventListener('change', function() {
            const selectedKategoriId = this.value;
            console.log(`Kategori dipilih (form tambah): ${selectedKategoriId}`);
            updateSubCategories(selectedKategoriId, false);
        });
    }
    
    // Untuk form edit produk
    const editKategoriDropdown = document.getElementById('update_kategori');
    if (editKategoriDropdown) {
        // Hapus event listener lama untuk menghindari duplikasi
        const newEditKategoriDropdown = editKategoriDropdown.cloneNode(true);
        editKategoriDropdown.parentNode.replaceChild(newEditKategoriDropdown, editKategoriDropdown);
        
        // Pasang event listener baru
        newEditKategoriDropdown.addEventListener('change', function() {
            const selectedKategoriId = this.value;
            console.log(`Kategori dipilih (form edit): ${selectedKategoriId}`);
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
        // Hapus event listener input untuk mencegah pencarian otomatis
        // elements.searchInput.addEventListener('input', handleSearch);
        
        // Tambahkan event listener untuk tombol search
        const searchButton = document.getElementById('searchButton');
        if (searchButton) {
            searchButton.addEventListener('click', handleSearch);
        }
        
        // Tambahkan event listener untuk tombol Enter pada input search
        elements.searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch();
            }
        });
    }

    // Add table click handlers
    if (elements.productTable) {
        elements.productTable.addEventListener('click', async (e) => {
            if (e.target.closest('.edit-product')) {
                await handleEditClick(e.target.closest('.edit-product').getAttribute('data-id'));
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
          
          // Pasang event listener setelah dropdown kategori diisi
          setupKategoriChangeListeners();
        }).catch(error => {
          console.error('Error loading kategori for dropdown:', error);
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
          
          // Pasang event listener setelah dropdown kategori diisi
          setupKategoriChangeListeners();
        }).catch(error => {
          console.error('Error loading kategori for update dropdown:', error);
        });
    }

    // Initialize update form
    // initializeUpdateForm();

    // Initialize import form
    initializeImportForm();

    // Initialize kategori management
    initializeKategoriManagement();

    // Initialize subkategori management
    initializeSubKategoriManagement();

    // Inisialisasi dropdown dan event listener saat dokumen siap
    await populateKategoriDropdowns();
    
    // Setup event listener untuk perubahan kategori
    // setupKategoriChangeListeners();
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
function handleSearch() {
    const searchQuery = document.getElementById('searchProduct').value.trim();
    
    let filteredProducts = allProducts;
    
    if (searchQuery) {
        filteredProducts = filteredProducts.filter(item => {
            const product = item.produk;
            
            // Ekstrak nama kategori dan subkategori
            let kategoriNama = '-';
            let subKategoriNama = '-';
            
            if (product.kategori && typeof product.kategori === 'object') {
                kategoriNama = product.kategori.nama_kategori || '';
            } else if (product.nama_kategori) {
                kategoriNama = product.nama_kategori;
            }
            
            if (product.subkategori && typeof product.subkategori === 'object') {
                subKategoriNama = product.subkategori.nama_subkategori || '';
            } else if (product.nama_subkategori) {
                subKategoriNama = product.nama_subkategori;
            }
            
            const searchLower = searchQuery.toLowerCase();
            return (
                (product.nama_produk || '').toLowerCase().includes(searchLower) ||
                kategoriNama.toLowerCase().includes(searchLower) ||
                subKategoriNama.toLowerCase().includes(searchLower) ||
                (product.kode_produk || '').toLowerCase().includes(searchLower)
            );
        });
    }
    
    displayProducts(filteredProducts);
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
    if (!productData.nama_produk || !productData.kode_produk || 
        !productData.harga_produk || !productData.stok_barang ||
        !productData.kategori || !productData.sub_kategori) {
        showAlert('Nama produk, kode produk, harga, stok, kategori, dan sub kategori harus diisi', 'danger');
        return;
    }

    // Validasi kategori dan subkategori
    const kategoriSelect = document.getElementById('kategori');
    const subKategoriSelect = document.getElementById('sub_kategori');
    
    if (!kategoriSelect.value || !subKategoriSelect.value) {
        showAlert('Kategori dan sub kategori harus dipilih', 'danger');
        return;
    }

    // Format data produk dengan kategori dan subkategori
    const formattedData = {
        nama_produk: productData.nama_produk,
        kode_produk: productData.kode_produk,
        harga_produk: parseFloat(productData.harga_produk),
        stok_barang: parseInt(productData.stok_barang),
        kategori: {
            id_kategori: kategoriSelect.value,
            nama_kategori: kategoriSelect.options[kategoriSelect.selectedIndex].text
        },
        subkategori: {
            id_subkategori: subKategoriSelect.value,
            nama_subkategori: subKategoriSelect.options[subKategoriSelect.selectedIndex].text,
            kategori: {
                id_kategori: kategoriSelect.value,
                nama_kategori: kategoriSelect.options[kategoriSelect.selectedIndex].text
            }
        }
    };

    // Validasi harga dan stok (tidak boleh negatif)
    if (formattedData.harga_produk < 0) {
        showAlert('Harga produk tidak boleh negatif', 'danger');
        return;
    }
    
    if (formattedData.stok_barang < 0) {
        showAlert('Stok barang tidak boleh negatif', 'danger');
        return;
    }
    
    // Format tanggal kadaluarsa ke ISO string jika ada
    if (productData.tanggal_kadaluarsa) {
        const expDate = new Date(productData.tanggal_kadaluarsa);
        if (!isNaN(expDate.getTime())) {
            formattedData.tanggal_kadaluarsa = expDate.toISOString();
        }
    }
    
    try {
        console.log('Mengirim data produk:', formattedData);
        
        // Kirim data ke backend
        const response = await fetch(`${BASE_URL}/produk/createproduk`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${getToken()}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(formattedData),
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Gagal membuat produk");
        }
        
        const result = await response.json();
        console.log('Produk berhasil ditambahkan:', result);
        
        // Reset form dan tampilkan notifikasi sukses
        event.target.reset();
        showAlert('Produk berhasil ditambahkan', 'success');
        
        // Perbarui tabel produk
        await loadProducts();
        
        // Tutup modal
        const modal = document.getElementById('addProductModal');
        if (modal) {
            modal.classList.remove('show');
            modal.style.display = 'none';
            document.body.classList.remove('modal-open');
            const backdrop = document.querySelector('.modal-backdrop');
            if (backdrop) {
                backdrop.remove();
            }
        }
    } catch (error) {
        console.error('Error adding product:', error);
        showAlert(`Gagal menambahkan produk: ${error.message}`, 'danger');
    }
}

async function handleUpdateProduct(e) {
    e.preventDefault();
    
    try {
        // Ambil nilai dari form
        const idProduk = document.getElementById('update_id_produk').value;
        const namaProduk = document.getElementById('update_nama_produk').value;
        const kategoriSelect = document.getElementById('update_kategori');
        const subKategoriSelect = document.getElementById('update_sub_kategori');
        const kodeProduk = document.getElementById('update_kode_produk').value;
        const hargaProduk = document.getElementById('update_harga_produk').value;
        const stokBarang = document.getElementById('update_stok_barang').value;
        const tanggalKadaluarsaInput = document.getElementById('update_tanggal_kadaluarsa').value;

        // Validasi input dasar
        if (!namaProduk || !kategoriSelect.value || !subKategoriSelect.value || !kodeProduk || !hargaProduk || !stokBarang) {
            showAlert('Semua field harus diisi kecuali tanggal kadaluarsa', 'danger');
            return;
        }
        
        // Validasi harga dan stok
        if (parseFloat(hargaProduk) < 0) {
            showAlert('Harga produk tidak boleh negatif', 'danger');
            return;
        }
        
        if (parseInt(stokBarang) < 0) {
            showAlert('Stok barang tidak boleh negatif', 'danger');
            return;
        }
        
        // Format tanggal kadaluarsa ke ISO string
        let formattedTanggalKadaluarsa = null;
        if (tanggalKadaluarsaInput) {
            const expDate = new Date(tanggalKadaluarsaInput);
            formattedTanggalKadaluarsa = expDate.toISOString();
        }
        
        // Siapkan data produk dengan format yang benar
        const productData = {
            id_produk: idProduk,
            nama_produk: namaProduk,
            kategori: {
                id_kategori: kategoriSelect.value,
                nama_kategori: kategoriSelect.options[kategoriSelect.selectedIndex].text
            },
            subkategori: {
                id_subkategori: subKategoriSelect.value,
                nama_subkategori: subKategoriSelect.options[subKategoriSelect.selectedIndex].text
            },
            kode_produk: kodeProduk,
            harga_produk: parseFloat(hargaProduk),
            stok_barang: parseInt(stokBarang)
        };

        // Tambahkan tanggal kadaluarsa jika ada
        if (formattedTanggalKadaluarsa) {
            productData.tanggal_kadaluarsa = formattedTanggalKadaluarsa;
        }

        console.log('Data produk yang akan diupdate:', productData);

        // Kirim request update
        const result = await products.update(idProduk, productData);
        
        if (result.success) {
            showAlert('Produk berhasil diperbarui', 'success');
            loadSubKategoriTable();
            $('#updateProductModal').modal('hide');
            loadProducts(); // Refresh tabel
        } else {
            throw new Error(result.error || 'Gagal memperbarui produk');
        }
    } catch (error) {
        console.error('Error updating product:', error);
        showAlert(`Error: ${error.message}`, 'danger');
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
async function handleEditClick(id) {
    try {
        console.log('Editing product with ID:', id);
        
        if (!id) {
            throw new Error('ID produk tidak valid');
        }
        
        // Ambil data produk
        const result = await products.getById(id);
        
        if (result.success && result.data) {
            const product = result.data;
            console.log('Retrieved product for editing:', product);
            
            // Populate form
            await populateUpdateForm(product);
            
            // Show modal
            $('#updateProductModal').modal('show');
        } else {
            const errorMsg = result.error || 'Gagal mengambil data produk';
            console.error('Error fetching product:', errorMsg);
            showAlert(`Error: ${errorMsg}`, 'danger');
        }
    } catch (error) {
        console.error('Error when trying to edit product:', error);
        showAlert(`Error: ${error.message}`, 'danger');
    }
}

// Populate update form with product data
async function populateUpdateForm(product) {
    console.log('Data produk yang akan ditampilkan:', product);
    
    try {
        // Reset form
        document.getElementById('updateProductForm').reset();
        
        // Set nilai-nilai dasar
        document.getElementById('update_id_produk').value = product.id_produk;
        document.getElementById('update_nama_produk').value = product.nama_produk;
        document.getElementById('update_kode_produk').value = product.kode_produk;
        document.getElementById('update_harga_produk').value = product.harga_produk;
        document.getElementById('update_stok_barang').value = product.stok_barang;
        
        // Format tanggal kadaluarsa
        if (product.tanggal_kadaluarsa) {
            const date = new Date(product.tanggal_kadaluarsa);
            if (!isNaN(date.getTime())) {
                const formattedDate = date.toISOString().split('T')[0];
                document.getElementById('update_tanggal_kadaluarsa').value = formattedDate;
            }
        }
        
        // Ambil referensi ke dropdown
        const kategoriSelect = document.getElementById('update_kategori');
        const subKategoriSelect = document.getElementById('update_sub_kategori');
        
        // Reset dropdown
        kategoriSelect.innerHTML = '<option value="">Pilih Kategori</option>';
        subKategoriSelect.innerHTML = '<option value="">Pilih Sub Kategori</option>';
        
        // Ambil daftar kategori
        const kategoriResponse = await fetchKategori();
        if (!kategoriResponse.success) {
            throw new Error('Gagal mengambil data kategori');
        }
        
        // Isi dropdown kategori
        const kategoriList = kategoriResponse.data;
        for (const kat of kategoriList) {
            const option = document.createElement('option');
            option.value = kat.id_kategori;
            option.textContent = kat.nama_kategori;
            if (product.kategori && kat.id_kategori === product.kategori.id_kategori) {
                option.selected = true;
            }
            kategoriSelect.appendChild(option);
        }
        
        // Jika ada kategori yang dipilih, ambil dan isi subkategori
        if (product.kategori && product.kategori.id_kategori) {
            const subkategoriList = await fetchSubKategoriByKategori(product.kategori.id_kategori);
            
            for (const subkat of subkategoriList) {
                const option = document.createElement('option');
                option.value = subkat.id_subkategori;
                option.textContent = subkat.nama_subkategori;
                if (product.subkategori && subkat.id_subkategori === product.subkategori.id_subkategori) {
                    option.selected = true;
                }
                subKategoriSelect.appendChild(option);
            }
        }
        
        // Hapus event listener lama jika ada
        const oldKategoriSelect = kategoriSelect.cloneNode(true);
        kategoriSelect.parentNode.replaceChild(oldKategoriSelect, kategoriSelect);
        
        // Tambah event listener baru untuk perubahan kategori
        oldKategoriSelect.addEventListener('change', async function() {
            const selectedKategoriId = this.value;
            const subKategoriSelect = document.getElementById('update_sub_kategori');
            
            // Reset subkategori dropdown
            subKategoriSelect.innerHTML = '<option value="">Pilih Sub Kategori</option>';
            
            if (selectedKategoriId) {
                try {
                    const subkategoriList = await fetchSubKategoriByKategori(selectedKategoriId);
                    
                    // Isi dropdown subkategori
                    for (const subkat of subkategoriList) {
                        const option = document.createElement('option');
                        option.value = subkat.id_subkategori;
                        option.textContent = subkat.nama_subkategori;
                        subKategoriSelect.appendChild(option);
                    }
                } catch (error) {
                    console.error('Error fetching subkategori:', error);
                    showAlert('Gagal mengambil data subkategori', 'danger');
                }
            }
        });
        
    } catch (error) {
        console.error('Error populating update form:', error);
        showAlert(`Error: ${error.message}`, 'danger');
    }
}

// Edit product button click
async function editProduct(id) {
    try {
        console.log(`Editing product with ID: ${id}`);
        
        // Ambil data produk
        const result = await products.getById(id);
        
        if (result.success) {
            const product = result.data;
            console.log('Retrieved product for editing:', product);
            
            // Populate form
            await populateUpdateForm(product);
            
            // Show modal
            $('#updateProductModal').modal('show');
        } else {
            showAlert(`Error: ${result.error}`, 'danger');
        }
    } catch (error) {
        console.error('Error when trying to edit product:', error);
        showAlert(`Error: ${error.message}`, 'danger');
    }
}

// Initialize update form
function initializeUpdateForm() {
    // Fungsi ini sudah tidak diperlukan karena event listener untuk update_kategori
    // sudah ditambahkan pada saat DOM loaded dan populateUpdateForm
    console.log('Update form initialized');
}

// Handle delete product
async function handleDeleteClick(event) {
    const button = event.target.closest('.delete-product');
    if (!button) return;

    const id = button.dataset.id;
    const namaProduk = button.closest('tr').querySelector('td:nth-child(2)').textContent;

    showDeleteConfirmation(
        "Konfirmasi Hapus",
        `Apakah Anda yakin ingin menghapus produk "${namaProduk}"?`,
        async function() {
            try {
                const result = await products.delete(id);
                console.log('Delete result:', result);
                
                if (result.success) {
                    showAlert('Produk berhasil dihapus', 'success');
                    await loadProducts();
                } else {
                    throw new Error(result.error || 'Gagal menghapus produk');
                }
            } catch (error) {
                console.error('Error deleting product:', error);
                showAlert(`Error: ${error.message}`, 'danger');
            }
        }
    );
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
            // Tutup modal tanpa menggunakan jQuery
            const modal = document.getElementById('importDataModal');
            modal.classList.remove('show');
            modal.style.display = 'none';
            const backdrop = document.querySelector('.modal-backdrop');
            if (backdrop) {
                backdrop.remove();
            }
            document.getElementById('importDataForm').reset();
        } else {
            showAlert(result.error || 'Gagal mengimpor data', 'danger');
        }
    } catch (error) {
        console.error('Error importing data:', error);
        let errorMessage = 'Terjadi kesalahan saat mengimpor data';
        
        if (error.message.includes('duplicate')) {
            const match = error.message.match(/\{ id_produk: "(.+?)" \}/);
            const id = match ? match[1] : "unknown";
            errorMessage += `ID ${id} sudah digunakan`;
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
                return { success: true, data: kategoriData };
            } else if (kategoriData && typeof kategoriData === 'object') {
                return { success: true, data: [kategoriData] };
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
            
            const response = await fetch(`${BASE_URL}/kategori/admin/delete-kategori/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                }
            });
            
            const result = await handleResponse(response);
            return result.data;
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
                body: JSON.stringify({ 
                    nama_kategori: namaKategori 
                })
            });
            
            if (!response.ok) {
                throw new Error(responseData.message || 'Gagal memperbarui kategori');
            }

            const result = await response.json();
            console.log('Kategori berhasil diperbarui:', result);
            return result;
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
                return { success: true, data: subkategoriData };
            } else if (subkategoriData && typeof subkategoriData === 'object') {
                return { success: true, data: [subkategoriData] };
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
    
    // Memperbarui subkategori
    update: async function(id, kategoriId, namaSubKategori) {
        try {
            // Validasi input
            if (!id || !kategoriId || !namaSubKategori || namaSubKategori.trim() === '') {
                throw new Error('ID subkategori, ID kategori, dan nama subkategori harus diisi');
            }
            
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
                if (!kategoriData || !kategoriData.id_kategori) {
                    throw new Error('Data kategori tidak valid');
                }
                
                kategoriObj = {
                    id_kategori: kategoriData.id_kategori,
                    nama_kategori: kategoriData.nama_kategori
                };
            } catch (error) {
                console.error('Error mendapatkan data kategori:', error);
                throw new Error('Gagal mendapatkan data kategori: ' + error.message);
            }
            
            const dataToSend = {
                id_subkategori: id,
                nama_subkategori: namaSubKategori,
                kategori: kategoriObj
            };
            
            console.log('Data subkategori yang akan diupdate:', dataToSend);
            
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
            
            if (!response.ok) {
                throw new Error(responseData.message || 'Gagal memperbarui subkategori');
            }

            const result = await response.json();
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
            
            const response = await fetch(`${BASE_URL}/subkategori/admin/delete-subkategori/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                }
            });
            
            const result = await handleResponse(response);
            return result.data;
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
                showAlert('Nama kategori baru tidak boleh kosong', 'danger');
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
            
            const modal = document.getElementById('editKategoriModal');
            modal.classList.add('show');
            modal.style.display = 'block';
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
                loadKategoriTable();
                
                // Tutup modal
                const modal = document.getElementById('editKategoriModal');
                modal.classList.remove('show');
                modal.style.display = 'none';
                const backdrop = document.querySelector('.modal-backdrop');
                if (backdrop) {
                    backdrop.remove();
                }
            } catch (error) {
                console.error('Error updating kategori:', error);
                showAlert(`Error: ${error.message}`, 'danger');
            }
        });
    }
    
    // Hapus kategori
    $('#kategoriTable').on('click', function(e) {
        // Tombol delete kategori
        if (e.target.classList.contains('delete-kategori') || e.target.closest('.delete-kategori')) {
            const button = e.target.closest('.delete-kategori') || e.target;
            const id = button.dataset.id;
            const namaKategori = button.dataset.nama;

            showDeleteConfirmation(
                "Konfirmasi Hapus Kategori",
                `Apakah Anda yakin ingin menghapus kategori "${namaKategori}"?`,
                function() {
                    kategori.delete(id).then(result => {
                        if (result.success) {
                            showAlert('Kategori berhasil dihapus', 'success');
                            loadKategoriTable();
                        } else {
                            showAlert(result.error || 'Gagal menghapus kategori', 'danger');
                        }
                    }).catch(error => {
                        console.error('Error:', error);
                        showAlert(error.message || 'Gagal menghapus kategori', 'danger');
                    });
                }
            );
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
                showAlert('Nama subkategori baru tidak boleh kosong', 'danger');
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
            
            const modal = document.getElementById('editSubKategoriModal');
            modal.classList.add('show');
            modal.style.display = 'block';
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
                const modal = document.getElementById('editSubKategoriModal');
                modal.classList.remove('show');
                modal.style.display = 'none';
                const backdrop = document.querySelector('.modal-backdrop');
                if (backdrop) {
                    backdrop.remove();
                }
                
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

// Inisialisasi halaman berdasarkan URL saat ini
document.addEventListener('DOMContentLoaded', async () => {
    // Dapatkan URL halaman saat ini
    const currentPath = window.location.pathname;
    
    // Periksa halaman mana yang sedang diakses
    if (currentPath.includes('kategori.html')) {
        console.log('Initializing kategori page...');
        initializeKategoriPage();
    } else if (currentPath.includes('subkategori.html')) {
        console.log('Initializing subkategori page...');
        initializeSubKategoriPage();
    } else if (currentPath.includes('produk.html')) {
        console.log('Initializing produk page...');
        // Kode inisialisasi produk yang sudah ada
    }
});

// Fungsi untuk menginisialisasi halaman kategori
function initializeKategoriPage() {
    // Pastikan elemen yang dibutuhkan ada di halaman
    const kategoriTable = document.getElementById('kategoriTable');
    const addKategoriForm = document.getElementById('addKategoriForm');
    const editKategoriForm = document.getElementById('editKategoriForm');
    
    if (!kategoriTable || !addKategoriForm || !editKategoriForm) {
        console.error('Elemen yang dibutuhkan tidak ditemukan di halaman kategori');
        return;
    }
    
    // Tambahkan tbody jika belum ada
    if (!document.getElementById('kategoriTableBody')) {
        const tbody = document.createElement('tbody');
        tbody.id = 'kategoriTableBody';
        kategoriTable.appendChild(tbody);
    }
    
    // Load data kategori saat halaman dimuat
    loadKategoriTable();
    
    // Event listener untuk form tambah kategori
    addKategoriForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const namaKategori = document.getElementById('newKategoriName').value.trim();
        if (!namaKategori) {
            showAlert('Nama kategori baru tidak boleh kosong', 'danger');
            return;
        }
        
        try {
            await kategori.create(namaKategori);
            document.getElementById('newKategoriName').value = '';
            showAlert('Kategori berhasil ditambahkan', 'success');
            loadKategoriTable();
            
            // Tutup modal setelah berhasil
            $('#addKategoriModal').modal('hide');
        } catch (error) {
            console.error('Error creating kategori:', error);
            showAlert(`Error: ${error.message}`, 'danger');
        }
    });
    
    // Event listener untuk form edit kategori
    editKategoriForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const id = document.getElementById('editKategoriId').value;
        const namaKategori = document.getElementById('editKategoriName').value.trim();
        
        if (!namaKategori) {
            showAlert('Nama kategori tidak boleh kosong', 'danger');
            return;
        }
        
        try {
            await kategori.update(id, namaKategori);
            showAlert('Kategori berhasil diperbarui', 'success');
            loadKategoriTable();
            
            // Tutup modal setelah berhasil
            $('#editKategoriModal').modal('hide');
        } catch (error) {
            console.error('Error updating kategori:', error);
            showAlert(`Error: ${error.message}`, 'danger');
        }
    });
    
    // Event delegation untuk tombol edit dan delete
    document.addEventListener('click', function(e) {
        // Tombol edit kategori
        if (e.target.classList.contains('edit-kategori') || e.target.closest('.edit-kategori')) {
            const button = e.target.closest('.edit-kategori') || e.target;
            const id = button.getAttribute('data-id');
            const nama = button.getAttribute('data-nama');
            
            document.getElementById('editKategoriId').value = id;
            document.getElementById('editKategoriName').value = nama;
            
            // Tampilkan modal edit
            $('#editKategoriModal').modal('show');
        }
        
        // Tombol delete kategori
        if (e.target.classList.contains('delete-kategori') || e.target.closest('.delete-kategori')) {
            const button = e.target.closest('.delete-kategori') || e.target;
            const id = button.getAttribute('data-id');
            const nama = button.getAttribute('data-nama');
            
            if (confirm(`Apakah Anda yakin ingin menghapus kategori "${nama}"?`)) {
                kategori.delete(id).then(result => {
                    if (result !== false) {
                        showAlert('Kategori berhasil dihapus', 'success');
                        loadKategoriTable();
                    }
                }).catch(error => {
                    console.error('Error deleting kategori:', error);
                    showAlert(`Error: ${error.message}`, 'danger');
                });
            }
        }
    });
}

// Fungsi untuk menginisialisasi halaman subkategori
function initializeSubKategoriPage() {
    // Pastikan elemen yang dibutuhkan ada di halaman
    const subKategoriTable = document.getElementById('subKategoriTable');
    const addSubKategoriForm = document.getElementById('addSubKategoriForm');
    const editSubKategoriForm = document.getElementById('editSubKategoriForm');
    const kategoriDropdown = document.getElementById('kategoriDropdown');
    const editKategoriDropdown = document.getElementById('editKategoriDropdown');
    
    if (!subKategoriTable || !addSubKategoriForm || !editSubKategoriForm) {
        console.error('Elemen yang dibutuhkan tidak ditemukan di halaman subkategori');
        return;
    }
    
    // Tambahkan tbody jika belum ada
    if (!document.getElementById('subKategoriTableBody')) {
        const tbody = document.createElement('tbody');
        tbody.id = 'subKategoriTableBody';
        subKategoriTable.appendChild(tbody);
    }
    
    // Load data subkategori saat halaman dimuat
    loadSubKategoriTable();
    
    // Isi dropdown kategori
    if (kategoriDropdown) {
        kategori.getAll().then(kategoriList => {
          kategoriDropdown.innerHTML = '<option value="">Pilih Kategori</option>';
          kategoriList.forEach(kat => {
            const option = document.createElement('option');
            option.value = kat.id_kategori;
            option.textContent = kat.nama_kategori;
            kategoriDropdown.appendChild(option);
          });

        }).catch(error => {
          console.error('Error loading kategori dropdown:', error);
          showAlert(`Error: ${error.message}`, 'danger');
        });
    }
    
    // Event listener untuk form tambah subkategori
    addSubKategoriForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const kategoriId = kategoriDropdown ? kategoriDropdown.value : '';
        const namaSubKategori = document.getElementById('newSubKategoriName').value.trim();
        
        if (!kategoriId) {
            showAlert('Silakan pilih kategori terlebih dahulu', 'danger');
            return;
        }
        
        if (!namaSubKategori) {
            showAlert('Nama subkategori tidak boleh kosong', 'danger');
            return;
        }
        
        try {
            await subkategori.create(kategoriId, namaSubKategori);
            document.getElementById('newSubKategoriName').value = '';
            if (kategoriDropdown) kategoriDropdown.value = '';
            showAlert('Subkategori berhasil ditambahkan', 'success');
            loadSubKategoriTable();
            
            // Tutup modal setelah berhasil
            $('#addSubKategoriModal').modal('hide');
        } catch (error) {
            console.error('Error creating subkategori:', error);
            showAlert(`Error: ${error.message}`, 'danger');
        }
    });
    
    // Event listener untuk form edit subkategori
    editSubKategoriForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const id = document.getElementById('editSubKategoriId').value;
        const idKategori = editKategoriDropdown ? editKategoriDropdown.value : '';
        const namaSubKategori = document.getElementById('editSubKategoriName').value.trim();
        
        if (!idKategori) {
            showAlert('Silakan pilih kategori terlebih dahulu', 'danger');
            return;
        }
        
        if (!namaSubKategori) {
            showAlert('Nama subkategori tidak boleh kosong', 'danger');
            return;
        }
        
        try {
            await subkategori.update(id, idKategori, namaSubKategori);
            showAlert('Subkategori berhasil diperbarui', 'success');
            
            // Tutup modal setelah berhasil
            $('#editSubKategoriModal').modal('hide');
        } catch (error) {
            console.error('Error updating subkategori:', error);
            showAlert(`Error: ${error.message}`, 'danger');
        }
    });
    
    // Isi dropdown kategori untuk form edit
    if (editKategoriDropdown) {
        // Event listener untuk modal edit subkategori
        $('#editSubKategoriModal').on('show.bs.modal', function() {
            kategori.getAll().then(kategoriList => {
                editKategoriDropdown.innerHTML = '<option value="">Pilih Kategori</option>';
                kategoriList.forEach(kat => {
                    const option = document.createElement('option');
                    option.value = kat.id_kategori;
                    option.textContent = kat.nama_kategori;
                    editKategoriDropdown.appendChild(option);
                });
                
                // Set nilai kategori yang dipilih
                const selectedKategoriId = document.getElementById('editSubKategoriKategoriId').value;
                if (selectedKategoriId) {
                    editKategoriDropdown.value = selectedKategoriId;
                }
            }).catch(error => {
                console.error('Error loading kategori dropdown for edit:', error);
                showAlert(`Error: ${error.message}`, 'danger');
            });
        });
    }
    
    // Event delegation untuk tombol edit dan delete
    document.addEventListener('click', function(e) {
        // Tombol edit subkategori
        if (e.target.classList.contains('edit-subkategori') || e.target.closest('.edit-subkategori')) {
            const button = e.target.closest('.edit-subkategori') || e.target;
            const id = button.getAttribute('data-id');
            const idKategori = button.getAttribute('data-kategori-id');
            const nama = button.getAttribute('data-nama');
            
            document.getElementById('editSubKategoriId').value = id;
            document.getElementById('editSubKategoriKategoriId').value = idKategori;
            document.getElementById('editSubKategoriName').value = nama;
            
            // Tampilkan modal edit
            $('#editSubKategoriModal').modal('show');
        }
        
        // Tombol delete subkategori
        if (e.target.classList.contains('delete-subkategori') || e.target.closest('.delete-subkategori')) {
            const button = e.target.closest('.delete-subkategori') || e.target;
            const id = button.getAttribute('data-id');
            const nama = button.getAttribute('data-nama');
            
            if (confirm(`Apakah Anda yakin ingin menghapus subkategori "${nama}"?`)) {
                subkategori.delete(id).then(result => {
                    if (result !== false) {
                        showAlert('Subkategori berhasil dihapus', 'success');
                        loadSubKategoriTable();
                    }
                }).catch(error => {
                    console.error('Error deleting subkategori:', error);
                    showAlert(`Error: ${error.message}`, 'danger');
                });
            }
        }
    });
}

$(document).on('click', '.btn-delete', function() {
    const id = $(this).data('id');
    const namaProduk = $(this).data('nama');
    
    showDeleteConfirmation(
        "Konfirmasi Hapus",
        `Apakah Anda yakin ingin menghapus produk "${namaProduk}"?`,
        async function() {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`${BASE_URL}/produk/${id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                const result = await handleResponse(response);
                showNotification('success', 'Produk berhasil dihapus');
                await loadProdukData(); // Refresh table
            } catch (error) {
                console.error('Error:', error);
                showNotification('error', error.message || 'Gagal menghapus produk');
            }
        }
    );
});
