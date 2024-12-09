// Import API service
import { api } from './api.js';

// DOM Elements
const userTable = document.querySelector('#userTable tbody');
const addUserForm = document.querySelector('#addUserForm');
const editUserForm = document.querySelector('#editUserForm');
const searchInput = document.querySelector('#searchUser');
const deleteUserModal = document.querySelector('#deleteUserModal');
let userToDelete = null;

// Load all users
async function loadUsers() {
    try {
        const result = await api.users.getAll();
        if (result.success) {
            displayUsers(result.data.data || []);
        } else {
            showAlert(result.error || 'Gagal memuat data pengguna', 'danger');
        }
    } catch (error) {
        console.error('Error loading users:', error);
        showAlert('Error memuat data pengguna', 'danger');
    }
}

// Display users in table
function displayUsers(users) {
    if (!userTable) return;

    userTable.innerHTML = '';
    if (!users || users.length === 0) {
        userTable.innerHTML = '<tr><td colspan="3" class="text-center">Tidak ada pengguna ditemukan</td></tr>';
        return;
    }

    users.forEach(user => {
        // Pastikan user.id ada
        const userId = user.id || user._id;
        if (!userId) {
            console.error('User tidak memiliki ID:', user);
            return;
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.username}</td>
            <td>${user.role}</td>
            <td class="text-center">
                <button class="btn btn-warning btn-sm edit-user me-2" 
                    data-username="${user.username}" 
                    data-role="${user.role}">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-danger btn-sm delete-user" 
                    data-username="${user.username}"
                    data-id="${userId}">
                    <i class="fas fa-trash"></i> Hapus
                </button>
            </td>
        `;
        userTable.appendChild(row);
    });
    attachEventListeners();
}

// Attach event listeners to dynamic elements
function attachEventListeners() {
    document.querySelectorAll('.edit-user').forEach(button => {
        button.addEventListener('click', handleEditClick);
    });

    document.querySelectorAll('.delete-user').forEach(button => {
        button.addEventListener('click', handleDeleteClick);
    });
}

// Handle add user form submission
if (addUserForm) {
    addUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(addUserForm);
        
        try {
            const result = await api.users.create({
                username: formData.get('username'),
                password: formData.get('password'),
                role: formData.get('role')
            });

            if (result.success) {
                showAlert('Pengguna berhasil ditambahkan', 'success');
                addUserForm.reset();
                $('#addUserModal').modal('hide');
                loadUsers();
            } else {
                showAlert(result.error || 'Gagal menambahkan pengguna', 'danger');
            }
        } catch (error) {
            console.error('Error menambahkan pengguna:', error);
            showAlert(error.message || 'Error menambahkan pengguna', 'danger');
        }
    });
}

// Handle edit user click
function handleEditClick(e) {
    const button = e.currentTarget;
    const username = button.dataset.username;
    const role = button.dataset.role;

    // Populate edit form
    if (editUserForm) {
        editUserForm.querySelector('#editUsername').value = username;
        editUserForm.querySelector('#editRole').value = role;
        $('#editUserModal').modal('show');
    }
}

// Handle edit user form submission
if (editUserForm) {
    editUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(editUserForm);
        const username = formData.get('username');
        const password = formData.get('password');
        const role = formData.get('role');
        
        try {
            const userData = {
                username,
                role
            };
            
            // Hanya sertakan password jika diisi
            if (password) {
                userData.password = password;
            }

            const result = await api.users.updateUser(username, userData);

            if (result.success) {
                showAlert('Pengguna berhasil diperbarui', 'success');
                editUserForm.reset();
                $('#editUserModal').modal('hide');
                loadUsers();
            } else {
                showAlert(result.error || 'Gagal memperbarui pengguna', 'danger');
            }
        } catch (error) {
            console.error('Error memperbarui pengguna:', error);
            showAlert(error.message || 'Error memperbarui pengguna', 'danger');
        }
    });
}

// Handle delete user click
function handleDeleteClick(e) {
    const button = e.currentTarget;
    const username = button.dataset.username;
    const id = button.dataset.id;
    
    if (!id) {
        showAlert('ID pengguna tidak valid', 'danger');
        return;
    }
    
    // Set username untuk konfirmasi
    document.getElementById('deleteUserName').textContent = username;
    userToDelete = id;
    
    // Show delete confirmation modal
    $('#deleteUserModal').modal('show');
}

// Handle delete confirmation
if (deleteUserModal) {
    document.getElementById('confirmDelete').addEventListener('click', async () => {
        if (!userToDelete) {
            showAlert('ID pengguna tidak valid', 'danger');
            return;
        }

        try {
            const result = await api.users.delete(userToDelete);
            if (result.success) {
                showAlert('Pengguna berhasil dihapus', 'success');
                $('#deleteUserModal').modal('hide');
                loadUsers();
            } else {
                showAlert(result.error || 'Gagal menghapus pengguna', 'danger');
            }
        } catch (error) {
            console.error('Error menghapus pengguna:', error);
            showAlert(error.message || 'Error menghapus pengguna', 'danger');
        }
        
        userToDelete = null;
    });
}

// Search functionality
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const rows = userTable.querySelectorAll('tr');
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    });
}

// Helper function to show alerts
function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="close" data-dismiss="alert" aria-label="Close">
            <span aria-hidden="true">&times;</span>
        </button>
    `;
    
    const alertPlaceholder = document.getElementById('alertPlaceholder');
    if (alertPlaceholder) {
        alertPlaceholder.appendChild(alertDiv);
        setTimeout(() => alertDiv.remove(), 5000);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadUsers();
    
    // Check authentication
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '../login.html';
    }
});
