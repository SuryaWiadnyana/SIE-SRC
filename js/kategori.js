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
    delete: async function(id, nama) {
        try {
            if (!id) {
                throw new Error('ID kategori tidak valid');
            }
            
            const response = await fetch(`${BASE_URL}/kategori/admin/delete-kategori/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                if (response.status === 404) {
                    throw new Error(`Kategori "${nama}" tidak ditemukan atau sudah dihapus`);
                }
                throw new Error(errorData.error || 'Gagal menghapus kategori');
            }

            return true;
        } catch (error) {
            console.error('Error deleting kategori:', error);
            throw error;
        }
    }
};

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

// Load kategori table
async function loadKategoriTable() {
    const tableBody = document.getElementById('kategoriTableBody');
    if (!tableBody) {
        console.error('Kategori table body not found');
        return;
    }
    
    try {
        const result = await kategori.getAll();
        if (!result.success) {
            throw new Error(result.error || 'Failed to load kategori');
        }

        const kategoriList = result.data;
        tableBody.innerHTML = '';
        
        kategoriList.forEach(kat => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${kat.id_kategori}</td>
                <td>${kat.nama_kategori}</td>
                <td>
                    <button class="btn btn-sm btn-primary edit-kategori" 
                        data-id="${kat.id_kategori}" 
                        data-nama="${kat.nama_kategori}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-danger delete-kategori" 
                        data-id="${kat.id_kategori}" 
                        data-nama="${kat.nama_kategori}">
                        <i class="fas fa-trash"></i> Hapus
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

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Initializing kategori page...');
    
    if (!checkAuth()) {
        console.log('Auth check failed');
        return;
    }
    
    try {
        // Load initial data
        await loadKategoriTable();
        
        // Add form submit handlers
        const addForm = document.getElementById('addKategoriForm');
        if (addForm) {
            addForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    const namaKategori = document.getElementById('newKategoriName').value.trim();
                    
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
                    showAlert('Gagal menambahkan kategori: ' + error.message, 'danger');
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
                const nama = button.dataset.nama;
                
                if (confirm(`Apakah Anda yakin ingin menghapus kategori "${nama}"?`)) {
                    try {
                        await kategori.delete(id, nama);
                        showAlert('Kategori berhasil dihapus', 'success');
                        await loadKategoriTable();
                    } catch (error) {
                        if (error.message.includes('tidak ditemukan')) {
                            showAlert(error.message, 'warning');
                        } else {
                            showAlert('Gagal menghapus kategori: ' + error.message, 'danger');
                        }
                    }
                }
            }
        });
        
    } catch (error) {
        console.error('Error initializing page:', error);
        showAlert('Terjadi kesalahan saat memuat halaman: ' + error.message, 'danger');
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
