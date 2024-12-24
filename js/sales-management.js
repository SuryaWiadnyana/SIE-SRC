import { api } from './api.js';

// DOM Elements
const salesTable = document.querySelector('#salesTable tbody');
const addSalesForm = document.querySelector('#addSalesForm');
const updateSalesForm = document.querySelector('#updateSalesForm');
const searchInput = document.querySelector('#searchSales');

// Load all sales
async function loadSales() {
    const result = await api.sales.getAll();
    if (result.success) {
        displaySales(result.data);
    } else {
        showAlert('Error loading sales: ' + result.error, 'danger');
    }
}

// Display sales in table
function displaySales(sales) {
    if (!salesTable) return;
    
    salesTable.innerHTML = '';
    sales.forEach(sale => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${sale.id_penjualan}</td>
            <td>${sale.id_produk}</td>
            <td>${sale.nama_produk}</td>
            <td>${sale.jumlah_terjual}</td>
            <td>${sale.total_penjualan}</td>
            <td>${new Date(sale.tanggal_penjualan).toLocaleDateString()}</td>
            <td>
                <button class="btn btn-sm btn-primary edit-btn" data-id="${sale.id_penjualan}">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-sm btn-danger delete-btn" data-id="${sale.id_penjualan}">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </td>
        `;
        salesTable.appendChild(row);
    });



    // Add event listeners to buttons
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => openUpdateModal(btn.dataset.id));
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteSale(btn.dataset.id));
    });
}

// Add new sale
async function addSale(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const saleData = {
        id_produk: formData.get('id_produk'),
        nama_produk: formData.get('nama_produk'),
        jumlah_terjual: parseInt(formData.get('jumlah_terjual')),
        total_penjualan: parseFloat(formData.get('total_penjualan')),
        tanggal_penjualan: formData.get('tanggal_penjualan'),
    };

    const result = await api.sales.create(saleData);
    if (result.success) {
        showAlert('Sale added successfully!', 'success');
        loadSales();
        $('#addSalesModal').modal('hide');
        event.target.reset();
    } else {
        showAlert('Error adding sale: ' + result.error, 'danger');
    }
}

// Update sale
async function updateSale(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const saleId = formData.get('id_penjualan');
    const saleData = {
        id_produk: formData.get('id_produk'),
        nama_produk: formData.get('nama_produk'),
        jumlah_terjual: parseInt(formData.get('jumlah_terjual')),
        total_penjualan: parseFloat(formData.get('total_penjualan')),
        tanggal_penjualan: formData.get('tanggal_penjualan'),
    };

    const result = await api.sales.update(saleId, saleData);
    if (result.success) {
        showAlert('Sale updated successfully!', 'success');
        loadSales();
        $('#updateSalesModal').modal('hide');
    } else {
        showAlert('Error updating sale: ' + result.error, 'danger');
    }
}

// Delete sale
async function deleteSale(saleId) {
    if (confirm('Are you sure you want to delete this sale?')) {
        const result = await api.sales.delete(saleId);
        if (result.success) {
            showAlert('Sale deleted successfully!', 'success');
            loadSales();
        } else {
            showAlert('Error deleting sale: ' + result.error, 'danger');
        }
    }
}

// Open update modal with sale data
async function openUpdateModal(saleId) {
    const result = await api.sales.getById(saleId);
    if (result.success) {
        const sale = result.data;
        document.querySelector('#updateSalesForm #id_penjualan').value = sale.id_penjualan;
        document.querySelector('#updateSalesForm #id_produk').value = sale.id_produk;
        document.querySelector('#updateSalesForm #nama_produk').value = sale.nama_produk;
        document.querySelector('#updateSalesForm #jumlah_terjual').value = sale.jumlah_terjual;
        document.querySelector('#updateSalesForm #total_penjualan').value = sale.total_penjualan;
        document.querySelector('#updateSalesForm #tanggal_penjualan').value = sale.tanggal_penjualan.split('T')[0];
        $('#updateSalesModal').modal('show');
    } else {
        showAlert('Error loading sale details: ' + result.error, 'danger');
    }
}

// Search sales
function searchSales(event) {
    const searchTerm = event.target.value.toLowerCase();
    const rows = salesTable.getElementsByTagName('tr');
    
    Array.from(rows).forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

// Show alert message
function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="close" data-dismiss="alert" aria-label="Close">
            <span aria-hidden="true">&times;</span>
        </button>
    `;
    document.querySelector('.container-fluid').insertBefore(alertDiv, document.querySelector('.container-fluid').firstChild);
    
    // Auto dismiss after 3 seconds
    setTimeout(() => {
        alertDiv.remove();
    }, 3000);
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    loadSales();
    
    if (addSalesForm) {
        addSalesForm.addEventListener('submit', addSale);
    }
    
    if (updateSalesForm) {
        updateSalesForm.addEventListener('submit', updateSale);
    }
    
    if (searchInput) {
        searchInput.addEventListener('input', searchSales);
    }
});
