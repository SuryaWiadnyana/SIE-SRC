import { api } from './api.js';

// Get DOM elements
const productTable = document.getElementById('productTable');
const searchInput = document.getElementById('searchProduct');
const recommendationsTable = document.getElementById('recommendationsTable');

let productTableElement;
let allProducts = []; // Menyimpan semua produk untuk filtering

// Check authentication and redirect if not logged in
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '../login.html';
        return false;
    }
    return true;
}

// Show alert function
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

// Format currency function
function formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

// Display products function
function displayProducts(products = []) {
    console.log('Displaying products:', products);
    const tbody = productTable.querySelector('tbody');
    tbody.innerHTML = '';

    if (!Array.isArray(products) || products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Tidak ada produk ditemukan</td></tr>';
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

        // Add "Sering Dibeli Dengan:" section
        const recommendationRow = document.createElement('tr');
        recommendationRow.classList.add('recommendation-row');
        recommendationRow.innerHTML = `
            <td colspan="7">
                <div class="recommendation-section">
                    <h6>Sering Dibeli Dengan:</h6>
                    <ul class="recommendation-list" id="recommendations-${product.id_produk}">
                        <li>Memuat rekomendasi...</li>
                    </ul>
                </div>
            </td>
        `;
        tbody.appendChild(recommendationRow);

        // Load recommendations for this product
        loadProductRecommendations(product.id_produk);
    });
}

// Load recommendations for a specific product
async function loadProductRecommendations(productId) {
    try {
        const minSupport = 0.3; // Minimum support threshold
        const transactions = await getTransactionData(); // Get transaction data
        
        const result = await api.algoritma.getRekomendasiProduk(transactions, productId, minSupport);
        
        if (result.success && result.data && result.data.length > 0) {
            const recommendationList = document.getElementById(`recommendations-${productId}`);
            recommendationList.innerHTML = result.data.map(rec => `
                <li>${rec.Items.join(', ')} (${(rec.Support * 100).toFixed(1)}%)</li>
            `).join('');
        } else {
            const recommendationList = document.getElementById(`recommendations-${productId}`);
            recommendationList.innerHTML = '<li>Tidak ada rekomendasi ditemukan</li>';
        }
    } catch (error) {
        console.error('Error loading recommendations:', error);
        const recommendationList = document.getElementById(`recommendations-${productId}`);
        recommendationList.innerHTML = '<li>Gagal memuat rekomendasi</li>';
    }
}

// Get transaction data from API
async function getTransactionData() {
    try {
        console.log('Fetching transaction data...');
        const result = await api.sales.getAll();
        console.log('Transaction data response:', result);
        
        if (!result.success) {
            console.error('Failed to fetch transaction data:', result.error);
            return [];
        }
        
        // Handle different response structures
        let salesData = [];
        if (Array.isArray(result.data)) {
            salesData = result.data;
        } else if (result.data && Array.isArray(result.data.data)) {
            salesData = result.data.data;
        } else {
            console.warn('Invalid transaction data structure:', result.data);
            return [];
        }
        
        console.log('Raw transaction data:', salesData);
        
        // Transform sales data into transaction format
        const transactions = salesData.map(sale => {
            if (!sale.produk || !Array.isArray(sale.produk)) {
                console.warn('Sale without products:', sale);
                return [];
            }
            
            // Extract product IDs and remove duplicates
            const productIds = [...new Set(sale.produk.map(item => item.id_produk))];
            
            // Filter out null/undefined IDs
            return productIds.filter(id => id);
        }).filter(transaction => transaction.length > 0); // Remove empty transactions
        
        console.log('Processed transactions:', transactions);
        return transactions;
    } catch (error) {
        console.error('Error fetching transaction data:', error);
        return [];
    }
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
            await loadRecommendations(); // Load recommendations after products
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

// Load recommendations
async function loadRecommendations() {
    const minSupport = 0.5; // Set your minimum support threshold
    const selectedProduct = ''; // Get the selected product from the UI or context
    const transactions = []; // Replace with actual transaction data

    try {
        const recommendations = await api.algoritma.getRekomendasiProduk(transactions, selectedProduct, minSupport);
        console.log('Recommendations:', recommendations);
        displayRecommendations(recommendations);
    } catch (error) {
        console.error('Error loading recommendations:', error);
        showAlert('Terjadi kesalahan saat memuat rekomendasi', 'danger');
    }
}

// Display recommendations in table
function displayRecommendations(recommendations = []) {
    console.log('Displaying recommendations:', recommendations);
    const tbody = recommendationsTable.querySelector('tbody');
    tbody.innerHTML = '';

    if (!Array.isArray(recommendations) || recommendations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center">Tidak ada rekomendasi ditemukan</td></tr>';
        return;
    }

    recommendations.forEach(rec => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${rec.id_produk || '-'}</td>
            <td>${rec.nama_produk || '-'}</td>
            <td>${rec.support || '-'}</td>
        `;
        tbody.appendChild(row);
    });

    // Show recommendations section
    document.getElementById('recommendationsSection').style.display = 'block';
}

// Remaining code...
