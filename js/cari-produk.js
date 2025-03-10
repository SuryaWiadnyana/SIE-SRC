// import { api } from './api.js';

const BASE_URL = "http://localhost:8080";

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

// Get DOM elements
const productTable = document.getElementById('productTable');
// const searchInput = document.getElementById('searchProduct');
// const addProductForm = document.getElementById('addProductForm');
// const updateProductForm = document.getElementById('updateProductForm');

let productTableElement;
let allProducts = []; // Menyimpan semua produk untuk filtering
let uniqueCategories = new Set();
let uniqueSubCategories = new Set();
let activeFilters = {
    category: 'all',
    subcategory: 'all'
};

// Global variables
let currentPage = 1;
const itemsPerPage = 15;
let filteredProducts = [];
  
// Products API
const products = {
  async getAll() {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Tidak terautentikasi");
      }

      const response = await fetch(`${BASE_URL}/produk/getallproduk`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

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
      console.error("Error fetching products:", error);
      return { success: false, error: error.message };
    }
  }
};

async function fetchProductsData() {
  if (!checkAuth()) return;

  try {
    // Fetch products
    const productsResponse = await products.getAll();
    const productCountElement = document.getElementById("totalProducts");

    if (productsResponse.success && productsResponse.data) {
      const productsData = Array.isArray(productsResponse.data)
        ? productsResponse.data
        : Array.isArray(productsResponse.data.data)
        ? productsResponse.data.data
        : [];

      if (productCountElement) {
        productCountElement.textContent = productsData.length.toString();
      }
    } else {
      if (productCountElement) {
        productCountElement.textContent = "0";
      }
      console.error("Failed to fetch products:", productsResponse.error);
    }
  } catch (error) {
    console.error("Error fetching products:", error);
    showAlert('Gagal memuat data produk: ' + (error.message || 'Terjadi kesalahan'), 'danger');
  }
}

// Predefined categories and sub-categories
const PRODUCT_CATEGORIES = {
    'Makanan': [
        'Makanan Ringan', 
        'Makanan Berat', 
        'Makanan Instan', 
        'Bumbu Dapur', 
        'Bahan Masakan',
        'Mie & Pasta',
        'Biskuit & Kue',
        'Coklat & Permen',
        'Sereal & Sarapan'
    ],
    'Minuman': [
        'Air Mineral', 
        'Minuman Bersoda', 
        'Minuman Kemasan', 
        'Kopi & Teh',
        'Susu & Krimer',
        'Sirup & Sari Buah',
        'Minuman Energi',
        'Minuman Kesehatan'
    ],
    'Kebutuhan Rumah Tangga': [
        'Pembersih', 
        'Peralatan Rumah', 
        'Perlengkapan Mandi', 
        'Deterjen',
        'Pengharum Ruangan',
        'Tisu & Kertas',
        'Plastik & Pembungkus',
        'Peralatan Dapur',
        'Perlengkapan Mencuci'
    ],
    'Kesehatan & Kecantikan': [
        'Obat-obatan', 
        'Perawatan Wajah', 
        'Perawatan Tubuh', 
        'Vitamin',
        'Perawatan Rambut',
        'Perawatan Gigi',
        'Kosmetik',
        'Parfum & Deodoran',
        'Pembalut & Kapas',
        'Masker & Hand Sanitizer'
    ],
    'Perlengkapan Bayi': [
        'Susu Formula', 
        'Popok', 
        'Perlengkapan Mandi Bayi', 
        'Makanan Bayi',
        'Perawatan Bayi',
        'Perlengkapan Makan Bayi',
        'Mainan Bayi',
        'Pakaian Bayi'
    ],
    'Makanan Segar': [
        'Buah-buahan',
        'Sayuran',
        'Daging',
        'Ikan & Seafood',
        'Telur',
        'Tahu & Tempe',
        'Roti & Kue Segar'
    ],
    'Alat Tulis & Kantor': [
        'Kertas',
        'Alat Tulis',
        'Buku & Notes',
        'Perlengkapan Sekolah',
        'Perlengkapan Kantor',
        'Amplop & Packaging'
    ],
    'Elektronik & Gadget': [
        'Baterai',
        'Charger & Kabel',
        'Lampu',
        'Peralatan Elektronik',
        'Aksesoris Gadget'
    ]
};

// Update modal form when category is selected
function updateSubCategories(selectedCategory) {
    const subCategorySelect = document.getElementById('sub_kategori');
    const subCategories = PRODUCT_CATEGORIES[selectedCategory] || [];
    
    // Clear current options
    subCategorySelect.innerHTML = '<option value="">Pilih Sub Kategori</option>';
    
    // Add new options
    subCategories.forEach(subCat => {
        const option = document.createElement('option');
        option.value = subCat;
        option.textContent = subCat;
        subCategorySelect.appendChild(option);
    });
    
    // Enable/disable based on whether there are sub-categories
    subCategorySelect.disabled = subCategories.length === 0;
}

// Initialize event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
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
        Object.keys(PRODUCT_CATEGORIES).forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categorySelect.appendChild(option);
        });
        
        // Add change listener
        categorySelect.addEventListener('change', (e) => {
            updateSubCategories(e.target.value);
        });
    }
});

// Load all products
async function loadProducts() {
    if (!checkAuth()) return;

    try {
        const result = await products.getAll();
        console.log('API response:', result);
        
        if (result.success && result.data) {  
            console.log('Raw products data:', result.data);
            
            // Pastikan allProducts adalah array
            if (Array.isArray(result.data)) {
                allProducts = result.data;
            } else if (result.data.data && Array.isArray(result.data.data)) {
                allProducts = result.data.data;
            } else {
                console.error('Unexpected data format:', result.data);
                allProducts = [];
            }
            
            console.log('Processed products:', allProducts);
            
            // Mengumpulkan kategori dan sub-kategori unik
            uniqueCategories.clear();
            uniqueSubCategories.clear();
            
            // Pastikan allProducts adalah array sebelum menggunakan forEach
            if (Array.isArray(allProducts)) {
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
                console.error('allProducts is not an array after processing:', allProducts);
                displayProducts([]);
            }
        } else {
            console.log('No products data found or error:', result.error);
            showAlert('Gagal memuat data produk: ' + (result.error || 'Data tidak ditemukan'), 'danger');
            displayProducts([]);
        }
    } catch (error) {
        console.error('Error loading products:', error);
        showAlert('Gagal memuat data produk: ' + error.message, 'danger');
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
    currentPage = 1; // Reset to first page when filtering
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
    // Pastikan allProducts adalah array
    if (!Array.isArray(allProducts)) {
        console.error('allProducts is not an array in applyFilters:', allProducts);
        displayProducts([]);
        return;
    }
    
    let filteredProducts = [...allProducts];
    
    // Apply category filter
    if (activeFilters.category !== 'all') {
        filteredProducts = filteredProducts.filter(item => {
            if (!item || !item.produk) return false;
            return item.produk.kategori === activeFilters.category;
        });
    }
    
    // Apply sub-category filter
    if (activeFilters.subcategory !== 'all') {
        filteredProducts = filteredProducts.filter(item => {
            if (!item || !item.produk) return false;
            return item.produk.sub_kategori === activeFilters.subcategory;
        });
    }
    
    displayProducts(filteredProducts);
}

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
        paginationContainer.className = 'mt-3';
        productTable.parentNode.insertBefore(paginationContainer, productTable.nextSibling);
    }
    
    tbody.innerHTML = '';
    filteredProducts = products; // Update filtered products
    
    if (!Array.isArray(products) || products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Tidak ada produk ditemukan</td></tr>';
        updatePagination(0);
        
        // Sembunyikan kartu rekomendasi jika tidak ada produk
        const recommendationCard = document.getElementById('recommendationCard');
        if (recommendationCard) {
            recommendationCard.style.display = 'none';
        }
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
        
        // Buat baris utama untuk produk
        const row = document.createElement('tr');
        
        // Tambahkan kelas untuk menandai produk yang memiliki rekomendasi
        if (item.produk_terkait && item.produk_terkait.length > 0) {
            row.classList.add('has-recommendations');
            row.style.cursor = 'pointer';
        }
        
        row.innerHTML = `
            <td>${product.id_produk || '-'}</td>
            <td>
                <div class="font-weight-bold">${product.nama_produk || '-'}</div>
                ${item.produk_terkait && item.produk_terkait.length > 0 ? 
                    `<div class="text-primary mt-2 font-weight-bold" style="font-size: 14px;">
                        <i class="fas fa-link mr-1"></i>Sering dibeli dengan: 
                        ${item.produk_terkait.map(related => 
                            `<span class="badge badge-info" style="font-size: 13px; padding: 5px 8px; margin: 2px;">${related.nama_produk}</span>`
                        ).join(' ')}
                    </div>` : ''}
            </td>
            <td>${product.kategori || '-'}</td>
            <td>${product.sub_kategori || '-'}</td>
            <td>${product.kode_produk || '-'}</td>
            <td>${formatCurrency(parseFloat(product.harga_produk)) || 'Rp0'}</td>
            <td>${product.stok_barang || '0'}</td>
        `;
        
        // Tambahkan event listener untuk menampilkan produk terkait
        if (item.produk_terkait && item.produk_terkait.length > 0) {
            row.addEventListener('click', () => {
                displayRelatedProducts(item);
                
                // Hapus kelas aktif dari semua baris
                const allRows = tbody.querySelectorAll('tr');
                allRows.forEach(r => r.classList.remove('table-primary'));
                
                // Tambahkan kelas aktif ke baris yang diklik
                row.classList.add('table-primary');
            });
        }
        
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

// Display related products
function displayRelatedProducts(item) {
    console.log('Displaying related products for:', item);
    
    const recommendationCard = document.getElementById('recommendationCard');
    const recommendationTableBody = document.getElementById('recommendationTableBody');
    
    if (!recommendationCard || !recommendationTableBody) {
        console.error('Recommendation card or table body not found');
        return;
    }
    
    // Tampilkan kartu rekomendasi
    recommendationCard.style.display = 'block';
    
    // Kosongkan tabel
    recommendationTableBody.innerHTML = '';
    
    // Judul kartu
    const cardTitle = recommendationCard.querySelector('.card-header h6');
    if (cardTitle) {
        cardTitle.textContent = `Produk yang Sering Dibeli dengan ${item.produk.nama_produk}`;
    }
    
    // Periksa apakah produk memiliki produk terkait
    if (!item.produk_terkait || !Array.isArray(item.produk_terkait) || item.produk_terkait.length === 0) {
        recommendationTableBody.innerHTML = '<tr><td colspan="7" class="text-center">Tidak ada produk terkait</td></tr>';
        return;
    }
    
    // Tampilkan produk terkait
    item.produk_terkait.forEach(relatedProduct => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${relatedProduct.id_produk || '-'}</td>
            <td>${relatedProduct.nama_produk || '-'}</td>
            <td>${relatedProduct.kategori || '-'}</td>
            <td>${relatedProduct.sub_kategori || '-'}</td>
            <td>${relatedProduct.kode_produk || '-'}</td>
            <td>${formatCurrency(parseFloat(relatedProduct.harga_produk)) || 'Rp0'}</td>
            <td>${relatedProduct.stok_barang || '0'}</td>
        `;
        recommendationTableBody.appendChild(row);
    });
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
    const searchQuery = e.target.value.toLowerCase().trim();
    
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        // Pastikan allProducts adalah array
        if (!Array.isArray(allProducts)) {
            console.error('allProducts is not an array in handleSearch:', allProducts);
            displayProducts([]);
            return;
        }
        
        let filteredProducts = [...allProducts];
        
        if (searchQuery) {
            filteredProducts = filteredProducts.filter(item => {
                if (!item || !item.produk) return false;
                
                const product = item.produk;
                return (
                    product.nama_produk.toLowerCase().includes(searchQuery) ||
                    product.kategori.toLowerCase().includes(searchQuery) ||
                    product.sub_kategori.toLowerCase().includes(searchQuery) ||
                    product.kode_produk.toLowerCase().includes(searchQuery) ||
                    product.id_produk.toLowerCase().includes(searchQuery)
                );
            });
        }
        
        // Reset active filters when searching
        activeFilters.category = 'all';
        activeFilters.subcategory = 'all';
        
        // Update UI to show all categories are selected
        const categoryButtons = document.querySelectorAll('#categoryFilters button');
        const subCategoryButtons = document.querySelectorAll('#subCategoryFilters button');
        
        categoryButtons.forEach(btn => {
            btn.classList.toggle('active', btn.textContent.includes('Semua Kategori'));
        });
        
        subCategoryButtons.forEach(btn => {
            btn.classList.toggle('active', btn.textContent.includes('Semua Sub Kategori'));
        });
        
        // Display filtered products
        currentPage = 1; // Reset to first page
        displayProducts(filteredProducts);
    }, 300); // Debounce for 300ms
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
// function checkAuth() {
//     const token = localStorage.getItem('token');
//     if (!token) {
//         window.location.href = '../login.html';
//         return false;
//     }
//     return true;
// }
