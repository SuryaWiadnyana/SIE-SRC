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

// Debounce function to limit API calls
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Load product recommendations with debounce
const debouncedLoadRecommendations = debounce(async (productId) => {
    try {
        const recommendations = await api.algoritma.getRekomendasiProduk([], productId, 0.3);
        displayRecommendations(recommendations);
    } catch (error) {
        console.error('Error loading recommendations:', error);
        // Don't show error to user, just silently fail
    }
}, 1000); // Wait 1 second before making another request

// Display products function
function displayProducts(products = []) {
    console.log('Displaying products:', products);
    const tbody = productTable.querySelector('tbody');
    tbody.innerHTML = '';

    if (!Array.isArray(products) || products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Tidak ada produk ditemukan</td></tr>';
        if (productTableElement) {
            productTableElement.clear().draw();
        }
        return;
    }

    products.forEach(product => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${product.id_produk || '-'}</td>
            <td>${product.nama_produk || '-'}</td>
            <td>${product.kategori || '-'}</td>
            <td>${product.sub_kategori || '-'}</td>
            <td>${product.kode_produk || '-'}</td>
            <td>${formatCurrency(product.harga_produk) || '-'}</td>
            <td>${product.stok_barang || '0'}</td>  
        `;
        tbody.appendChild(row);

        // Load recommendations with debounce
        if (window.location.pathname.includes('owner-dashboard.html')) {
            debouncedLoadRecommendations(product.id_produk);
        }
    });

    // Reinitialize DataTable if it exists
    if (productTableElement) {
        productTableElement.clear().rows.add($(tbody).find('tr')).draw();
    }
}

// Display recommendations
function displayRecommendations(recommendations) {
    const recommendationsContainer = document.getElementById('recommendationsContainer');
    if (!recommendationsContainer) return;

    if (!recommendations || recommendations.length === 0) {
        recommendationsContainer.innerHTML = '<p>Tidak ada rekomendasi produk saat ini.</p>';
        return;
    }

    let html = '<h5>Rekomendasi Produk</h5><ul class="list-group">';
    recommendations.forEach(rec => {
        html += `
            <li class="list-group-item">
                <div class="d-flex justify-content-between align-items-center">
                    <span>${rec.nama_produk}</span>
                    <span class="badge bg-primary rounded-pill">${(rec.support * 100).toFixed(1)}%</span>
                </div>
            </li>
        `;
    });
    html += '</ul>';
    recommendationsContainer.innerHTML = html;
}

// Load recommendations for a specific product
async function loadProductRecommendations(productId) {
    try {
        const minSupport = 0.3; // Minimum support threshold
        const transactions = await getTransactionData(); // Get transaction data
        
        const result = await api.algoritma.getRekomendasiProduk(transactions, productId, minSupport);
        
        if (result.success && result.data && result.data.length > 0) {
            const recommendationList = document.getElementById(`recommendations-${productId}`);
            
            // Get product details for recommendations
            const productDetails = await Promise.all(
                result.data.flatMap(rec => 
                    rec.Items.map(async productId => {
                        try {
                            const productResult = await api.products.getById(productId);
                            if (productResult.success) {
                                return {
                                    id: productId,
                                    name: productResult.data.nama_produk,
                                    support: rec.Support
                                };
                            }
                        } catch (error) {
                            console.error('Error fetching product details:', error);
                        }
                        return null;
                    })
                )
            );

            // Filter out null values and format recommendations
            const validRecommendations = productDetails.filter(rec => rec !== null);
            
            if (validRecommendations.length > 0) {
                recommendationList.innerHTML = validRecommendations.map(rec => `
                    <li>
                        ${rec.name} 
                        <span class="text-muted">(${(rec.support * 100).toFixed(1)}%)</span>
                    </li>
                `).join('');
            } else {
                recommendationList.innerHTML = '<li>Tidak ada rekomendasi ditemukan</li>';
            }
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

// Function to filter products based on search query
function filterProducts(query) {
    if (!query) {
        displayProducts(allProducts);
        return;
    }

    const searchTerm = query.toLowerCase();
    const filteredProducts = allProducts.filter(product => {
        return (
            (product.nama_produk && product.nama_produk.toLowerCase().includes(searchTerm)) ||
            (product.kategori && product.kategori.toLowerCase().includes(searchTerm)) ||
            (product.sub_kategori && product.sub_kategori.toLowerCase().includes(searchTerm)) ||
            (product.kode_produk && product.kode_produk.toLowerCase().includes(searchTerm))
        );
    });
    
    displayProducts(filteredProducts);
}

// Initialize event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded');
    
    if (!checkAuth()) return;

    // Set username from localStorage
    try {
        const userData = JSON.parse(localStorage.getItem('userData'));
        if (userData) {
            const usernameElement = document.getElementById('username');
            if (usernameElement) {
                const displayName = userData.role === 'owner' ? 'OwnerSRC' : (userData.username || userData.name || 'User');
                usernameElement.textContent = displayName;
            }
        }
    } catch (error) {
        console.error('Error setting username:', error);
    }

    // Initialize DataTable after the table is populated with data
    async function initializeDataTable() {
        if ($.fn.DataTable.isDataTable('#productTable')) {
            $('#productTable').DataTable().destroy();
        }
        
        productTableElement = $('#productTable').DataTable({
            responsive: true,
            searching: false, // Disable default DataTables search since we're implementing our own
            processing: true,
            language: {
                emptyTable: "Tidak ada produk ditemukan",
                info: "Menampilkan _START_ sampai _END_ dari _TOTAL_ produk",
                infoEmpty: "Menampilkan 0 sampai 0 dari 0 produk",
                infoFiltered: "(difilter dari _MAX_ total produk)",
                lengthMenu: "Tampilkan _MENU_ produk",
                loadingRecords: "Memuat...",
                processing: "Memproses...",
                zeroRecords: "Tidak ada produk yang cocok ditemukan",
                paginate: {
                    first: "Pertama",
                    last: "Terakhir",
                    next: "Selanjutnya",
                    previous: "Sebelumnya"
                }
            }
        });

        // Display all products initially
        displayProducts(allProducts);
    }

    // Function to handle search
    function handleSearch() {
        const searchValue = searchInput.value.trim();
        if (searchValue === '') {
            // Jika kotak pencarian kosong, tampilkan semua produk
            displayProducts(allProducts);
        } else {
            // Lakukan pencarian hanya saat tombol diklik
            const searchTerm = searchValue.toLowerCase();
            const filteredProducts = allProducts.filter(product => {
                return (
                    (product.nama_produk && product.nama_produk.toLowerCase().includes(searchTerm)) ||
                    (product.kategori && product.kategori.toLowerCase().includes(searchTerm)) ||
                    (product.sub_kategori && product.sub_kategori.toLowerCase().includes(searchTerm)) ||
                    (product.kode_produk && product.kode_produk.toLowerCase().includes(searchTerm))
                );
            });
            displayProducts(filteredProducts);
        }
    }

    // Add event listener for search button
    const searchButton = document.getElementById('searchButton');
    if (searchButton) {
        searchButton.addEventListener('click', handleSearch);
    }

    // Handle Enter key press in search input
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleSearch();
            }
        });
    }

    // Load initial data
    loadProducts().then(() => {
        initializeDataTable();
    });
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

// Menambahkan fungsi untuk menampilkan rekomendasi produk saat detail produk dibuka
async function showProductDetails(productId) {
    try {
        const result = await api.products.getById(productId);
        if (result.success && result.data) {
            const product = result.data.produk;
            const relatedProducts = result.data.produk_terkait;

            // Tampilkan detail produk di modal atau form
            document.getElementById('productId').value = product.id_produk || '';
            document.getElementById('productName').value = product.nama_produk || '';
            document.getElementById('productCategory').value = product.kategori || '';
            document.getElementById('productSubCategory').value = product.sub_kategori || '';
            document.getElementById('productCode').value = product.kode_produk || '';
            document.getElementById('productPrice').value = product.harga_produk || '';
            document.getElementById('productStock').value = product.stok_barang || '';

            // Tampilkan rekomendasi produk jika ada
            const recommendationCard = document.getElementById('recommendationCard');
            const recommendationTableBody = document.getElementById('recommendationTableBody');
            
            if (relatedProducts && relatedProducts.length > 0) {
                recommendationTableBody.innerHTML = '';
                relatedProducts.forEach(product => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${product.id_produk || '-'}</td>
                        <td>${product.nama_produk || '-'}</td>
                        <td>${product.kategori || '-'}</td>
                        <td>${product.sub_kategori || '-'}</td>
                        <td>${product.kode_produk || '-'}</td>
                        <td>${formatCurrency(product.harga_produk) || '-'}</td>
                        <td>${product.stok_barang || '0'}</td>
                    `;
                    recommendationTableBody.appendChild(row);
                });
                recommendationCard.style.display = 'block';
            } else {
                recommendationCard.style.display = 'none';
            }

            // Tampilkan modal
            $('#editModal').modal('show');
        } else {
            showAlert('Gagal memuat detail produk', 'error');
        }
    } catch (error) {
        console.error('Error showing product details:', error);
        showAlert('Terjadi kesalahan saat memuat detail produk', 'error');
    }
}
