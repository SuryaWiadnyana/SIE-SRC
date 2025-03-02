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
    const tbody = productTable.querySelector('tbody');
    tbody.innerHTML = '';

    if (!Array.isArray(products) || products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Tidak ada produk ditemukan</td></tr>';
        if (productTableElement) {
            productTableElement.clear().draw();
        }
        return;
    }

    products.forEach(item => {
        // Extract product data from the nested structure
        const product = item.produk || item;
        const relatedProducts = item.produk_terkait || [];
        
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
        
        // Add click event to show related products
        if (window.location.pathname.includes('owner-dashboard.html') && relatedProducts.length > 0) {
            row.style.cursor = 'pointer';
            row.title = 'Klik untuk melihat produk terkait';
            row.addEventListener('click', () => {
                displayRecommendations(relatedProducts);
            });
        }
        
        tbody.appendChild(row);
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
        recommendationsContainer.innerHTML = '<p>Tidak ada produk terkait saat ini.</p>';
        return;
    }

    let html = '<h5>Produk Terkait</h5><div class="table-responsive"><table class="table table-bordered">';
    html += `
        <thead>
            <tr>
                <th>Nama Produk</th>
                <th>Kategori</th>
                <th>Sub Kategori</th>
                <th>Harga</th>
                <th>Stok</th>
            </tr>
        </thead>
        <tbody>
    `;
    
    recommendations.forEach(product => {
        html += `
            <tr>
                <td>${product.nama_produk || '-'}</td>
                <td>${product.kategori || '-'}</td>
                <td>${product.sub_kategori || '-'}</td>
                <td>${formatCurrency(product.harga_produk) || '-'}</td>
                <td>${product.stok_barang || '0'}</td>
            </tr>
        `;
    });
    
    html += '</tbody></table></div>';
    recommendationsContainer.innerHTML = html;
}

// Function to filter products based on search query
function filterProducts(query) {
    if (!query) {
        displayProducts(allProducts);
        return;
    }

    const searchTerm = query.toLowerCase();
    const filteredProducts = allProducts.filter(item => {
        const product = item.produk || item;
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

    // Initialize DataTable
    if ($.fn.DataTable.isDataTable('#productTable')) {
        $('#productTable').DataTable().destroy();
    }
    
    productTableElement = $('#productTable').DataTable({
        responsive: true,
        searching: false,
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

    // Add event listener for search button
    const searchButton = document.getElementById('searchButton');
    if (searchButton) {
        searchButton.addEventListener('click', () => {
            const searchValue = searchInput.value.trim();
            filterProducts(searchValue);
        });
    }

    // Handle Enter key press in search input
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const searchValue = searchInput.value.trim();
                filterProducts(searchValue);
            }
        });
    }

    // Load initial data
    loadProducts();
});
