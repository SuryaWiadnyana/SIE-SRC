import { api } from './api.js';

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

// Predefined categories and sub-categories
const PRODUCT_CATEGORIES = {
    'Makanan': ['Makanan Ringan', 'Makanan Instan', 'Bumbu Dapur', 'Bahan Masakan'],
    'Minuman': ['Air Mineral', 'Minuman Bersoda', 'Minuman Kemasan', 'Kopi & Teh'],
    'Kebutuhan Rumah Tangga': ['Pembersih', 'Peralatan Rumah', 'Perlengkapan Mandi', 'Deterjen'],
    'Kesehatan & Kecantikan': ['Obat-obatan', 'Perawatan Wajah', 'Perawatan Tubuh', 'Vitamin'],
    'Perlengkapan Bayi': ['Susu Formula', 'Popok', 'Perlengkapan Mandi Bayi', 'Makanan Bayi']
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

    // Initialize update form
    initializeUpdateForm();
});

// Load all products
async function loadProducts() {
    try {
        console.log('Fetching products...');
        const result = await api.products.getAll();
        console.log('API response:', result);
        if (result.success && result.data && result.data.data) {  
            console.log('Products data:', result.data.data);      
            allProducts = result.data.data;
            
            // Mengumpulkan kategori dan sub-kategori unik
            uniqueCategories.clear();
            uniqueSubCategories.clear();
            allProducts.forEach(product => {
                if (product.kategori) uniqueCategories.add(product.kategori);
                if (product.sub_kategori) uniqueSubCategories.add(product.sub_kategori);
            });
            
            // Update filter buttons
            updateFilterButtons();
            
            // Apply current filters
            applyFilters();
        } else {
            console.log('No products data found');
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
        filteredProducts = filteredProducts.filter(product => 
            product.kategori === activeFilters.category
        );
    }
    
    // Apply sub-category filter
    if (activeFilters.subcategory !== 'all') {
        filteredProducts = filteredProducts.filter(product => 
            product.sub_kategori === activeFilters.subcategory
        );
    }
    
    displayProducts(filteredProducts);
}

// Display products in table
function displayProducts(products = []) {
    console.log('Displaying products:', products);
    if (!productTableElement) {
        console.log('Product table element not found');
        return;
    }
    
    const tbody = productTableElement.querySelector('tbody');
    if (!tbody) {
        console.error('tbody element not found in product table');
        return;
    }
    console.log('Found tbody element:', tbody);
    tbody.innerHTML = '';
    
    if (!Array.isArray(products) || products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">Tidak ada produk ditemukan</td></tr>';
        return;
    }

    products.forEach(product => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${product.id_produk || '-'}</td>
            <td>${product.nama_produk || '-'}</td>
            <td>${product.kategori || '-'}</td>
            <td>${product.sub_kategori || '-'}</td>
            <td>${product.barcode_produk || '-'}</td>
            <td>${formatCurrency(product.harga) || '-'}</td>
            <td>${product.stok_barang || '0'}</td>
            <td>
                <button class="btn btn-info btn-sm edit-product" data-id="${product.id_produk}">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-danger btn-sm delete-product" data-id="${product.id_produk}">
                    <i class="fas fa-trash"></i> Hapus
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Handle search with debounce
let searchTimeout;
function handleSearch(e) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        const searchTerm = e.target.value.trim();
        console.log('Searching for:', searchTerm);
        
        if (!productTableElement) return;
        
        if (searchTerm === '') {
            await loadProducts();
            return;
        }

        try {
            console.log('Loading all products for search');
            const result = await api.products.getAll();
            
            if (result.success && result.data && result.data.data) {
                const allProducts = result.data.data;
                // Filter produk berdasarkan ID, nama, kategori, atau sub kategori
                const filteredProducts = allProducts.filter(product => 
                    (product.id_produk && product.id_produk.toLowerCase().includes(searchTerm.toLowerCase())) ||
                    (product.nama_produk && product.nama_produk.toLowerCase().includes(searchTerm.toLowerCase())) ||
                    (product.kategori && product.kategori.toLowerCase().includes(searchTerm.toLowerCase())) ||
                    (product.sub_kategori && product.sub_kategori.toLowerCase().includes(searchTerm.toLowerCase()))
                );
                console.log('Filtered products:', filteredProducts);
                return displayProducts(filteredProducts);
            } else {
                console.log('No products found');
                displayProducts([]);
            }
        } catch (error) {
            console.error('Error searching products:', error);
            showAlert('Terjadi kesalahan saat mencari produk', 'danger');
            displayProducts([]);
        }
    }, 300);
}

// Handle form submissions
async function handleAddProduct(e) {
    e.preventDefault();
    
    try {
        const formData = new FormData(e.target);
        const productData = {
            // ID akan di-generate otomatis oleh backend
            nama_produk: formData.get('nama_produk'),
            kategori: formData.get('kategori'),
            sub_kategori: formData.get('sub_kategori'),
            barcode_produk: formData.get('barcode_produk'),
            harga: parseInt(formData.get('harga')),
            stok_barang: parseInt(formData.get('stok_barang'))
        };
        
        const result = await api.products.create(productData);
        if (result.success) {
            showAlert('Produk berhasil ditambahkan', 'success');
            await loadProducts();
            $('#addProductModal').modal('hide');
            e.target.reset();
        } else {
            showAlert('Gagal menambahkan produk: ' + result.error, 'danger');
        }
    } catch (error) {
        console.error('Error creating product:', error);
        showAlert('Terjadi kesalahan saat menambahkan produk', 'danger');
    }
}

async function handleUpdateProduct(e) {
    e.preventDefault();
    
    try {
        const formData = new FormData(e.target);
        const productData = {
            id_produk: formData.get('id_produk'),
            nama_produk: formData.get('nama_produk'),
            kategori: formData.get('kategori'),
            sub_kategori: formData.get('sub_kategori'),
            barcode_produk: formData.get('barcode_produk'),
            harga: parseInt(formData.get('harga')),
            stok_barang: parseInt(formData.get('stok_barang'))
        };
        
        console.log('Updating product with data:', productData); // Debug log
        
        const result = await api.products.update(productData);
        if (result.success) {
            showAlert('Produk berhasil diperbarui', 'success');
            await loadProducts();
            $('#updateProductModal').modal('hide');
        } else {
            showAlert('Gagal memperbarui produk: ' + result.error, 'danger');
        }
    } catch (error) {
        console.error('Error updating product:', error);
        showAlert('Terjadi kesalahan saat memperbarui produk', 'danger');
    }
}

// Handle edit product click
async function handleEditClick(event) {
    const button = event.target.closest('.edit-product');
    if (!button) return;

    const productId = button.getAttribute('data-id');
    console.log('Editing product with ID:', productId);

    try {
        const result = await api.products.getById(productId);
        console.log('API Response:', result);

        if (result.success && result.data) {
            const product = result.data;
            console.log('Product data to fill form:', product);
            
            // Pastikan semua field yang diperlukan ada
            const processedProduct = {
                id_produk: product.id_produk,
                nama_produk: product.nama_produk,
                kategori: product.kategori,
                sub_kategori: product.sub_kategori,
                barcode_produk: product.barcode_produk,
                harga: parseInt(product.harga),
                stok_barang: parseInt(product.stok_barang)
            };
            
            console.log('Processed product data:', processedProduct);

            // Reset form sebelum mengisi data baru
            const form = document.getElementById('updateProductForm');
            if (form) {
                form.reset();
            }

            // Fill form with data
            fillUpdateForm(processedProduct);

            // Show the modal
            const modal = new bootstrap.Modal(document.getElementById('updateProductModal'));
            modal.show();
        } else {
            showAlert('Gagal mendapatkan detail produk: ' + (result.error || 'Data tidak ditemukan'), 'danger');
        }
    } catch (error) {
        console.error('Error getting product details:', error);
        showAlert('Terjadi kesalahan saat mengambil detail produk', 'danger');
    }
}

// Fill update form with product data
function fillUpdateForm(product) {
    console.log('Filling form with data:', product);

    // Format currency
    const formatCurrency = (number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'decimal',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(number);
    };

    // Set form values
    const fields = {
        'id_produk': { value: product.id_produk },
        'nama_produk': { value: product.nama_produk },
        'barcode_produk': { value: product.barcode_produk },
        'harga': { value: product.harga, formatter: formatCurrency },
        'stok_barang': { value: product.stok_barang }
    };

    // Update each field
    Object.entries(fields).forEach(([fieldName, config]) => {
        const input = document.getElementById(`update_${fieldName}`);
        if (input) {
            const value = config.value ?? '';
            input.value = value;
            
            if (config.formatter) {
                input.placeholder = `Saat ini: ${config.formatter(value)}`;
            } else {
                input.placeholder = `Saat ini: ${value}`;
            }
        }
    });

    // Handle kategori
    const kategoriSelect = document.getElementById('update_kategori');
    if (kategoriSelect) {
        // Reset and populate kategori options
        kategoriSelect.innerHTML = '<option value="">Pilih Kategori</option>';
        Object.keys(PRODUCT_CATEGORIES).forEach(kategori => {
            const option = document.createElement('option');
            option.value = kategori;
            option.textContent = kategori;
            if (kategori === product.kategori) {
                option.selected = true;
            }
            kategoriSelect.appendChild(option);
        });

        // Trigger change to populate sub-kategori
        kategoriSelect.dispatchEvent(new Event('change'));

        // After a short delay, set sub-kategori
        setTimeout(() => {
            const subKategoriSelect = document.getElementById('update_sub_kategori');
            if (subKategoriSelect && product.sub_kategori) {
                // Find and select the matching sub-kategori option
                const options = Array.from(subKategoriSelect.options);
                const targetOption = options.find(opt => opt.value === product.sub_kategori);
                if (targetOption) {
                    targetOption.selected = true;
                }
            }
        }, 100);
    }

    // Add change tracking
    const form = document.getElementById('updateProductForm');
    if (form) {
        const originalData = { ...product };
        
        form.addEventListener('input', function(e) {
            const input = e.target;
            const fieldName = input.id.replace('update_', '');
            const originalValue = originalData[fieldName];
            
            if (String(originalValue) !== String(input.value)) {
                input.classList.add('border-warning');
            } else {
                input.classList.remove('border-warning');
            }
        });
    }
}

// Initialize update form
function initializeUpdateForm() {
    const updateKategoriSelect = document.getElementById('update_kategori');
    
    // Populate categories
    updateKategoriSelect.innerHTML = '<option value="">Pilih Kategori</option>';
    Object.keys(PRODUCT_CATEGORIES).forEach(kategori => {
        const option = document.createElement('option');
        option.value = kategori;
        option.textContent = kategori;
        updateKategoriSelect.appendChild(option);
    });
    
    // Add change listener
    updateKategoriSelect.addEventListener('change', (e) => {
        const subCategorySelect = document.getElementById('update_sub_kategori');
        const subCategories = PRODUCT_CATEGORIES[e.target.value] || [];
        
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
    });
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
            const result = await api.products.delete(id);
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
