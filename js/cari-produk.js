import { api } from './api.js';

// Get DOM elements
const productTable = document.getElementById('productTable');
const searchInput = document.getElementById('searchProduct');

let productTableElement;
let allProducts = []; // Menyimpan semua produk untuk filtering

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
    };
    
    console.log('Elements initialized:', {
        hasProductTable: !!elements.productTable,
        hasSearchInput: !!elements.searchInput,
    });

    productTableElement = elements.productTable;

    // Load initial data
    loadProducts();
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
            
            displayProducts(allProducts);
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
                // Filter produk berdasarkan ID, nama, kategori, sub kategori, atau kode produk
                const filteredProducts = allProducts.filter(product => 
                    (product.id_produk && product.id_produk.toLowerCase().includes(searchTerm.toLowerCase())) ||
                    (product.nama_produk && product.nama_produk.toLowerCase().includes(searchTerm.toLowerCase())) ||
                    (product.kategori && product.kategori.toLowerCase().includes(searchTerm.toLowerCase())) ||
                    (product.sub_kategori && product.sub_kategori.toLowerCase().includes(searchTerm.toLowerCase())) ||
                    (product.barcode_produk && product.barcode_produk.toLowerCase().includes(searchTerm.toLowerCase()))
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

