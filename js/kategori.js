// API Base URL
const BASE_URL = "http://localhost:8080";

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
            console.error('Error parsing error response:', parseError);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    }

    try {
        const data = await response.json();
        console.log('API Success Response:', data);
        return data;
    } catch (parseError) {
        console.error('Error parsing success response:', parseError);
        throw new Error('Gagal memproses respons dari server');
    }
}

// Get token from localStorage
function getToken() {
    return localStorage.getItem('token');
}

// Check authentication
function checkAuth() {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');

    if (!token || !role || (role !== "admin" && role !== "owner")) {
        window.location.href = "../login.html";
        return false;
    }
    return true;
}

// Kategori API functions
const kategori = {
    // Get all kategori
    getAll: async function() {
        try {
            const response = await fetch(`${BASE_URL}/kategori/getall`, {
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                }
            });
            
            const result = await handleResponse(response);
            console.log('Kategori data in getAll:', result);
            
            if (result && result.data && Array.isArray(result.data)) {
                return { success: true, data: result.data };
            } else if (Array.isArray(result)) {
                return { success: true, data: result };
            } else if (result && typeof result === 'object') {
                return { success: true, data: [result] };
            } else {
                console.error("Format data kategori tidak valid:", result);
                return { success: false, data: [], error: 'Format data tidak valid' };
            }
        } catch (error) {
            console.error('Error fetching kategori:', error);
            return { success: false, data: [], error: error.message };
        }
    },

    // Get kategori by ID
    getById: async function(id) {
        try {
            const response = await fetch(`${BASE_URL}/kategori/getbyid/${id}`, {
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                }
            });
            
            const result = await handleResponse(response);
            return result;
        } catch (error) {
            console.error('Error fetching kategori by ID:', error);
            throw error;
        }
    },

    // Create new kategori
    create: async function(namaKategori) {
        try {
            if (!namaKategori || namaKategori.trim() === '') {
                throw new Error('Nama kategori tidak boleh kosong');
            }
            
            const response = await fetch(`${BASE_URL}/kategori/admin/create-kategori`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({ nama_kategori: namaKategori })
            });
            
            return await handleResponse(response);
        } catch (error) {
            console.error('Error creating kategori:', error);
            throw error;
        }
    },

    // Update kategori
    update: async function(id, namaKategori) {
        try {
            if (!namaKategori || namaKategori.trim() === '') {
                throw new Error('Nama kategori tidak boleh kosong');
            }
            
            const response = await fetch(`${BASE_URL}/kategori/admin/update-kategori/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({ nama_kategori: namaKategori })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Gagal memperbarui kategori');
            }

            return await response.json();
        } catch (error) {
            console.error('Error updating kategori:', error);
            throw error;
        }
    },

    // Delete kategori
    delete: async function(id) {
        try {
            const response = await fetch(`${BASE_URL}/kategori/admin/delete-kategori/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                return {
                    success: false,
                    error: errorData.error || 'Gagal menghapus kategori'
                };
            }
            
            return {
                success: true
            };
        } catch (error) {
            console.error('Error deleting kategori:', error);
            return {
                success: false,
                error: error.message || 'Gagal menghapus kategori'
            };
        }
    }
};

// Global variables for pagination
let currentPage = 1;
const itemsPerPage = 10;
let filteredData = [];

// Search and filter function
function searchKategori(data, searchTerm) {
    if (!searchTerm) return data;
    searchTerm = searchTerm.toLowerCase();
    return data.filter(item => 
        item.id_kategori.toLowerCase().includes(searchTerm) ||
        item.nama_kategori.toLowerCase().includes(searchTerm)
    );
}

// Update pagination info
function updatePaginationInfo(totalItems) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(start + itemsPerPage - 1, totalItems);
    
    document.getElementById('pagination-info').innerHTML = `
        Showing ${totalItems ? start : 0} to ${end} of ${totalItems} entries
    `;

    // Update pagination buttons
    const paginationContainer = document.getElementById('pagination-buttons');
    let buttons = '';
    
    // Previous button
    buttons += `<button onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>Previous</button>`;
    
    // Page buttons
    for (let i = 1; i <= totalPages; i++) {
        buttons += `<button onclick="changePage(${i})" class="${i === currentPage ? 'active' : ''}">${i}</button>`;
    }
    
    // Next button
    buttons += `<button onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>`;
    
    paginationContainer.innerHTML = buttons;
}

// Change page function
function changePage(newPage) {
    currentPage = newPage;
    loadKategoriTable();
}

// Load kategori table with search and pagination
async function loadKategoriTable() {
    try {
        const searchTerm = document.getElementById('searchInput').value;
        const result = await kategori.getAll();
        
        // Get table body reference
        const tableBody = document.getElementById('kategoriTableBody');
        tableBody.innerHTML = '';

        if (result.success && Array.isArray(result.data) && result.data.length > 0) {
            // Filter data based on search term
            filteredData = searchKategori(result.data, searchTerm);
            
            // Calculate pagination
            const totalItems = filteredData.length;
            const startIndex = (currentPage - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            const paginatedData = filteredData.slice(startIndex, endIndex);
            
            // Generate table rows
            paginatedData.forEach(item => {
                if (item && item.id_kategori && item.nama_kategori) {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${item.id_kategori}</td>
                        <td>${item.nama_kategori}</td>
                        <td>
                            <button class="btn btn-sm btn-primary edit-kategori" 
                                data-id="${item.id_kategori}" 
                                data-nama="${item.nama_kategori}">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button class="btn btn-sm btn-danger delete-kategori" 
                                data-id="${item.id_kategori}" 
                                data-nama="${item.nama_kategori}">
                                <i class="fas fa-trash"></i> Hapus
                            </button>
                        </td>
                    `;
                    tableBody.appendChild(row);
                }
            });
            
            // Update pagination info
            updatePaginationInfo(totalItems);
        } else {
            // Show message when no data
            const row = document.createElement('tr');
            row.innerHTML = `
                <td colspan="3" class="text-center">
                    <strong>Tidak Ada Data Kategori</strong>
                </td>
            `;
            tableBody.appendChild(row);
            
            // Reset pagination
            updatePaginationInfo(0);
        }
    } catch (error) {
        console.error('Error in loadKategoriTable:', error);
        showAlert('Gagal memuat data kategori: ' + error.message, 'error');
        
        // Show error in table
        const tableBody = document.getElementById('kategoriTableBody');
        tableBody.innerHTML = `
            <tr>
                <td colspan="3" class="text-center text-danger">
                    Terjadi kesalahan saat memuat data
                </td>
            </tr>
        `;
    }
}

// Show alert message
function showAlert(message, type) {
    const alertPlaceholder = document.getElementById('alertPlaceholder');
    if (!alertPlaceholder) {
        console.error('Alert placeholder not found');
        return;
    }

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

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Initializing kategori page...');
    if (!checkAuth()) return;

    try {
        // Add search input event listener
        const searchInput = document.getElementById('searchInput');
        let searchTimeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                currentPage = 1; // Reset to first page on search
                loadKategoriTable();
            }, 300);
        });

        // Initial load
        await loadKategoriTable();
        
        // Add form submit handlers
        const addForm = document.getElementById('addKategoriForm');
        if (addForm) {
            addForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const namaKategori = document.getElementById('newKategoriName').value.trim();
                
                try {
                    if (!namaKategori) {
                        showAlert('Nama kategori harus diisi', 'danger');
                        return;
                    }
                    
                    await kategori.create(namaKategori);
                    showAlert('Kategori berhasil ditambahkan', 'success');
                    $('#addKategoriModal').modal('hide');
                    addForm.reset();
                    await loadKategoriTable();
                } catch (error) {
                    showAlert('Gagal menambahkan kategori: Kategori dengan nama "' + namaKategori + '" sudah ada', 'danger');
                }
            });
        }
        
        const editForm = document.getElementById('editKategoriForm');
        if (editForm) {
            editForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    const id = document.getElementById('editKategoriId').value;
                    const namaKategori = document.getElementById('editKategoriName').value.trim();
                    
                    if (!namaKategori) {
                        showAlert('Nama kategori harus diisi', 'danger');
                        return;
                    }
                    
                    await kategori.update(id, namaKategori);
                    showAlert('Kategori berhasil diperbarui', 'success');
                    $('#editKategoriModal').modal('hide');
                    await loadKategoriTable();
                } catch (error) {
                    showAlert('Gagal memperbarui kategori: ' + error.message, 'danger');
                }
            });
        }
        
        // Add click handlers for edit and delete buttons
        document.addEventListener('click', async (e) => {
            // Edit button handler
            if (e.target.closest('.edit-kategori')) {
                const button = e.target.closest('.edit-kategori');
                document.getElementById('editKategoriId').value = button.dataset.id;
                document.getElementById('editKategoriName').value = button.dataset.nama;
                $('#editKategoriModal').modal('show');
            }
            
            // Delete button handler
            if (e.target.closest('.delete-kategori')) {
                const button = e.target.closest('.delete-kategori');
                const id = button.dataset.id;
                const namaKategori = button.dataset.nama;

                showDeleteConfirmation(
                    "Konfirmasi Hapus Kategori",
                    `Apakah Anda yakin ingin menghapus kategori "${namaKategori}"?`,
                    async function() {
                        try {
                            const result = await kategori.delete(id);
                            if (result.success) {
                                showAlert('Kategori berhasil dihapus', 'success');
                                await loadKategoriTable();
                            } else {
                                const errorMsg = result.error === 'kategori dengan ID ' + id + ' tidak ditemukan'
                                    ? 'Kategori sudah tidak ada di database'
                                    : result.error || 'Gagal menghapus kategori';
                                showAlert(errorMsg, 'danger');
                                await loadKategoriTable(); // Refresh table to show current state
                            }
                        } catch (error) {
                            console.error('Error:', error);
                            showAlert('Terjadi kesalahan saat menghapus kategori', 'danger');
                            await loadKategoriTable(); // Refresh table to show current state
                        }
                    }
                );
            }
        });
        
    } catch (error) {
        console.error('Error during initialization:', error);
        showAlert('Failed to initialize page: ' + error.message, 'error');
    }
});

// // Export functions and objects
// export {
//     kategori,
//     getToken,
//     checkAuth,
//     showAlert,
//     loadKategoriTable,
//     handleResponse
// };
