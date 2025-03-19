// API Base URL
const BASE_URL = "http://localhost:8080";

// Handle API Response
async function handleResponse(response) {
    if (!response.ok) {
        try {
            const errorData = await response.json();
            console.error('API Error Response:', errorData);
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
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

// Subkategori API functions
const subkategori = {
    // Get all subkategori
    getAll: async function() {
        try {
            const response = await fetch(`${BASE_URL}/subkategori/getall`, {
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                }
            });
            
            const result = await handleResponse(response);
            return result.data || [];
        } catch (error) {
            console.error('Error fetching subkategori:', error);
            throw error;
        }
    },

    // Create new subkategori
    create: async function(namaSubKategori, kategoriData) {
        try {
            if (!namaSubKategori || !kategoriData) {
                throw new Error('Nama subkategori dan data kategori harus diisi');
            }

            if (!kategoriData.id_kategori) {
                throw new Error('ID kategori tidak valid');
            }

            const response = await fetch(`${BASE_URL}/subkategori/admin/create-subkategori`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({
                    nama_subkategori: namaSubKategori,
                    kategori: {
                        id_kategori: kategoriData.id_kategori,
                        nama_kategori: kategoriData.nama_kategori
                    }
                })
            });
            
            return await handleResponse(response);
        } catch (error) {
            console.error('Error creating subkategori:', error);
            throw error;
        }
    },

    // Update subkategori
    update: async function(id, namaSubKategori, kategoriData) {
        try {
            if (!id || !namaSubKategori || !kategoriData) {
                throw new Error('ID subkategori, nama subkategori, dan data kategori harus diisi');
            }

            if (!kategoriData.id_kategori) {
                throw new Error('ID kategori tidak valid');
            }

            const response = await fetch(`${BASE_URL}/subkategori/admin/update-subkategori/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({
                    nama_subkategori: namaSubKategori,
                    kategori: {
                        id_kategori: kategoriData.id_kategori,
                        nama_kategori: kategoriData.nama_kategori
                    }
                })
            });
            
            return await handleResponse(response);
        } catch (error) {
            console.error('Error updating subkategori:', error);
            throw error;
        }
    },

    // Delete subkategori
    delete: async function(id) {
        try {
            const response = await fetch(`${BASE_URL}/subkategori/admin/delete-subkategori/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                return {
                    success: false,
                    error: errorData.error || 'Gagal menghapus subkategori'
                };
            }
            
            return {
                success: true
            };
        } catch (error) {
            console.error('Error deleting subkategori:', error);
            return {
                success: false,
                error: error.message || 'Gagal menghapus subkategori'
            };
        }
    }
};

// Kategori API functions for dropdown
const kategori = {
    getAll: async function() {
        try {
            const response = await fetch(`${BASE_URL}/kategori/getall`, {
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                }
            });
            
            const result = await handleResponse(response);
            return result.data || [];
        } catch (error) {
            console.error('Error fetching kategori:', error);
            throw error;
        }
    }
};

// Load subkategori table
async function loadSubKategoriTable() {
    try {
        const subkategoriList = await subkategori.getAll();
        const tableBody = document.getElementById('subkategoriTableBody');
        
        if (!tableBody) {
            console.error('Table body element not found');
            return;
        }
        
        tableBody.innerHTML = '';
        
        subkategoriList.forEach(subkat => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${subkat.id_subkategori}</td>
                <td>${subkat.kategori ? subkat.kategori.nama_kategori : '-'}</td>
                <td>${subkat.nama_subkategori}</td>
                <td>
                    <button class="btn btn-sm btn-primary edit-subkategori" 
                        data-id="${subkat.id_subkategori}"
                        data-kategori-id="${subkat.kategori ? subkat.kategori.id_kategori : ''}"
                        data-nama="${subkat.nama_subkategori}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-danger delete-subkategori" 
                        data-id="${subkat.id_subkategori}"
                        data-nama="${subkat.nama_subkategori}">
                        <i class="fas fa-trash"></i> Hapus
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading subkategori table:', error);
        showAlert('Gagal memuat data subkategori: ' + error.message, 'danger');
    }
}

// Populate kategori dropdowns
async function populateKategoriDropdowns() {
    try {
        const kategoriList = await kategori.getAll();
        const dropdowns = ['kategoriDropdown', 'editKategoriDropdown'];
        
        dropdowns.forEach(dropdownId => {
            const dropdown = document.getElementById(dropdownId);
            if (dropdown) {
                dropdown.innerHTML = '<option value="">Pilih Kategori</option>';
                kategoriList.forEach(kat => {
                    const option = document.createElement('option');
                    option.value = kat.id_kategori;
                    option.textContent = kat.nama_kategori;
                    dropdown.appendChild(option);
                });
            }
        });
    } catch (error) {
        console.error('Error populating kategori dropdowns:', error);
        showAlert('Gagal memuat data kategori: ' + error.message, 'danger');
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
    console.log('Initializing subkategori page...');
    
    if (!checkAuth()) {
        console.log('Auth check failed');
        return;
    }
    
    try {
        // Load initial data
        await loadSubKategoriTable();
        await populateKategoriDropdowns();
        
        // Add form submit handlers
        const addForm = document.getElementById('addSubKategoriForm');
        if (addForm) {
            addForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    const kategoriId = document.getElementById('kategoriDropdown').value;
                    const namaSubKategori = document.getElementById('namaSubKategori').value.trim();
                    
                    if (!kategoriId) {
                        showAlert('Pilih kategori terlebih dahulu', 'danger');
                        return;
                    }
                    
                    if (!namaSubKategori) {
                        showAlert('Nama subkategori harus diisi', 'danger');
                        return;
                    }
                    
                    // Get kategori data first
                    const kategoriResponse = await fetch(`${BASE_URL}/kategori/getbyid/${kategoriId}`, {
                        headers: {
                            'Authorization': `Bearer ${getToken()}`
                        }
                    });
                    
                    if (!kategoriResponse.ok) {
                        throw new Error('Gagal mendapatkan data kategori');
                    }
                    
                    const kategoriData = await kategoriResponse.json();
                    if (!kategoriData || !kategoriData.data || !kategoriData.data.id_kategori) {
                        throw new Error('Data kategori tidak valid');
                    }
                    
                    // Create subkategori with complete kategori data
                    await subkategori.create(namaSubKategori, kategoriData.data);
                    showAlert('Subkategori berhasil ditambahkan', 'success');
                    const modal = bootstrap.Modal.getInstance(document.getElementById('addSubKategoriModal'));
                    modal.hide();
                    addForm.reset();
                    await loadSubKategoriTable();
                } catch (error) {
                    showAlert('Gagal menambahkan subkategori: ' + error.message, 'danger');
                }
            });
        }
        
        const editForm = document.getElementById('editSubKategoriForm');
        if (editForm) {
            editForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    const id = document.getElementById('editSubKategoriId').value;
                    const kategoriId = document.getElementById('editKategoriDropdown').value;
                    const namaSubKategori = document.getElementById('editNamaSubKategori').value;
                    
                    if (!id) {
                        showAlert('ID subkategori tidak valid', 'danger');
                        return;
                    }
                    
                    if (!kategoriId) {
                        showAlert('Pilih kategori terlebih dahulu', 'danger');
                        return;
                    }
                    
                    if (!namaSubKategori) {
                        showAlert('Nama subkategori harus diisi', 'danger');
                        return;
                    }
                    
                    // Get kategori data first
                    const kategoriResponse = await fetch(`${BASE_URL}/kategori/getbyid/${kategoriId}`, {
                        headers: {
                            'Authorization': `Bearer ${getToken()}`
                        }
                    });
                    
                    if (!kategoriResponse.ok) {
                        throw new Error('Gagal mendapatkan data kategori');
                    }
                    
                    const kategoriData = await kategoriResponse.json();
                    if (!kategoriData || !kategoriData.data || !kategoriData.data.id_kategori) {
                        throw new Error('Data kategori tidak valid');
                    }
                    
                    // Update subkategori with complete kategori data
                    await subkategori.update(id, namaSubKategori, kategoriData.data);
                    showAlert('Subkategori berhasil diperbarui', 'success');
                    const modal = bootstrap.Modal.getInstance(document.getElementById('editSubKategoriModal'));
                    modal.hide();
                    await loadSubKategoriTable();
                } catch (error) {
                    showAlert('Gagal memperbarui subkategori: ' + error.message, 'danger');
                }
            });
        }
        
        // Add click handlers for edit and delete buttons
        document.addEventListener('click', async (e) => {
            // Edit button handler
            if (e.target.closest('.edit-subkategori')) {
                const button = e.target.closest('.edit-subkategori');
                const modal = new bootstrap.Modal(document.getElementById('editSubKategoriModal'));
                document.getElementById('editSubKategoriId').value = button.dataset.id;
                document.getElementById('editNamaSubKategori').value = button.dataset.nama;
                document.getElementById('editKategoriDropdown').value = button.dataset.kategoriId;
                modal.show();
            }

            // Delete button handler
            if (e.target.closest('.delete-subkategori')) {
                const button = e.target.closest('.delete-subkategori');
                const id = button.dataset.id;
                const namaSubKategori = button.dataset.nama;

                showDeleteConfirmation(
                    "Konfirmasi Hapus Subkategori",
                    `Apakah Anda yakin ingin menghapus subkategori "${namaSubKategori}"?`,
                    async function() {
                        try {
                            const result = await subkategori.delete(id);
                            if (result.success) {
                                showAlert('Subkategori berhasil dihapus', 'success');
                                await loadSubKategoriTable();
                            } else {
                                const errorMsg = result.error === 'subkategori dengan ID ' + id + ' tidak ditemukan' 
                                    ? 'Subkategori sudah tidak ada di database' 
                                    : result.error || 'Gagal menghapus subkategori';
                                showAlert(errorMsg, 'danger');
                                await loadSubKategoriTable(); // Refresh table to show current state
                            }
                        } catch (error) {
                            console.error('Error:', error);
                            showAlert('Terjadi kesalahan saat menghapus subkategori', 'danger');
                            await loadSubKategoriTable(); // Refresh table to show current state
                        }
                    }
                );
            }
        });
        
    } catch (error) {
        console.error('Error initializing page:', error);
        showAlert('Terjadi kesalahan saat memuat halaman: ' + error.message, 'danger');
    }
});