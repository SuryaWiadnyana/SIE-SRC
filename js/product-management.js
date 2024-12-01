import { api } from './api.js';

// Get DOM elements
const productTable = document.getElementById('productTable');
const searchInput = document.getElementById('searchProduct');
const addProductForm = document.getElementById('addProductForm');
const updateProductForm = document.getElementById('updateProductForm');

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
});

// Load all products
async function loadProducts() {
    if (!productTable) return;

    try {
        const result = await api.products.getAll();
        if (result.success && result.data) {
            displayProducts(result.data);
        } else {
            displayProducts([]); // Pass empty array if no data
        }
    } catch (error) {
        console.error('Error loading products:', error);
        showAlert('Terjadi kesalahan saat memuat produk', 'danger');
        displayProducts([]); // Pass empty array on error
    }
}

// Display products in table
function displayProducts(products = []) { // Add default empty array
    if (!productTable) return;
    
    const tbody = productTable.querySelector('tbody') || productTable;
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
        
        if (!productTable) return;
        
        if (searchTerm === '') {
            await loadProducts();
            return;
        }

        try {
            const result = await api.products.search(searchTerm);
            if (result.success && result.data && result.data.data) {
                const product = result.data.data;
                if (product) {
                    displayProducts([product]);
                } else {
                    productTable.innerHTML = '<tr><td colspan="8" class="text-center">Tidak ada produk ditemukan</td></tr>';
                }
            } else {
                productTable.innerHTML = '<tr><td colspan="8" class="text-center">Tidak ada produk ditemukan</td></tr>';
            }
        } catch (error) {
            console.error('Error searching products:', error);
            showAlert('Terjadi kesalahan saat mencari produk', 'danger');
        }
    }, 300);
}

// Handle form submissions
async function handleAddProduct(e) {
    e.preventDefault();
    
    const productData = {
        id_produk: addProductForm.id_produk.value,
        nama_produk: addProductForm.nama_produk.value,
        kategori: addProductForm.kategori.value,
        sub_kategori: addProductForm.sub_kategori.value,
        barcode_produk: addProductForm.barcode_produk.value,
        harga: parseInt(addProductForm.harga.value),
        stok_barang: parseInt(addProductForm.stok_barang.value)
    };

    try {
        const result = await api.products.create(productData);
        if (result.success) {
            showAlert('Produk berhasil ditambahkan', 'success');
            $('#addProductModal').modal('hide');
            addProductForm.reset();
            await loadProducts();
        } else {
            showAlert('Gagal menambahkan produk: ' + result.error, 'danger');
        }
    } catch (error) {
        console.error('Error adding product:', error);
        showAlert('Terjadi kesalahan saat menambahkan produk', 'danger');
    }
}

async function handleUpdateProduct(e) {
    e.preventDefault();
    
    const productId = updateProductForm.id_produk.value;
    const productData = {
        nama_produk: updateProductForm.nama_produk.value,
        kategori: updateProductForm.kategori.value,
        sub_kategori: updateProductForm.sub_kategori.value,
        barcode_produk: updateProductForm.barcode_produk.value,
        harga: parseInt(updateProductForm.harga.value),
        stok_barang: parseInt(updateProductForm.stok_barang.value)
    };

    try {
        const result = await api.products.update(productId, productData);
        if (result.success) {
            showAlert('Produk berhasil diupdate', 'success');
            $('#updateProductModal').modal('hide');
            await loadProducts();
        } else {
            showAlert('Gagal mengupdate produk: ' + result.error, 'danger');
        }
    } catch (error) {
        console.error('Error updating product:', error);
        showAlert('Terjadi kesalahan saat mengupdate produk', 'danger');
    }
}

// Handle edit product
async function handleEditClick(e) {
    const button = e.target.closest('.edit-product');
    if (!button) return;

    const productId = button.dataset.id;
    try {
        const result = await api.products.getById(productId);
        if (result.success) {
            const product = result.data.data;
            // Fill update form with product data
            updateProductForm.id_produk.value = product.id_produk;
            updateProductForm.nama_produk.value = product.nama_produk;
            updateProductForm.kategori.value = product.kategori;
            updateProductForm.sub_kategori.value = product.sub_kategori;
            updateProductForm.barcode_produk.value = product.barcode_produk;
            updateProductForm.harga.value = product.harga;
            updateProductForm.stok_barang.value = product.stok_barang;
            $('#updateProductModal').modal('show');
        } else {
            showAlert('Gagal mendapatkan detail produk: ' + result.error, 'danger');
        }
    } catch (error) {
        console.error('Error getting product details:', error);
        showAlert('Terjadi kesalahan saat mengambil detail produk', 'danger');
    }
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
