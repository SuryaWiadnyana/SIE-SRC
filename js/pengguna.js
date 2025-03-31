// API Base URL
const BASE_URL = "http://localhost:8080"; // Adjust this to match your backend URL

// Handle API Response
async function handleResponse(response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.message ||
        errorData?.error ||
        `HTTP error! status: ${response.status}`
    );
  }
  const data = await response.json();
  return { success: true, data };
}

// Authentication API
async function auth() {
  console.log("Starting penjualan page initialization...");

  try {
    // Show loading indicator
    $(".loading").show();

    // Check authentication
    const token = localStorage.getItem("token");
    let userData = null;
    try {
      userData = JSON.parse(localStorage.getItem("userData"));
    } catch (error) {
      console.error("Error parsing userData:", error);
      throw new Error("Invalid user data");
    }

    if (!token || !userData) {
      throw new Error("Missing authentication data");
    }

    // Set username if authentication is valid
    const displayName =
      userData.role === "owner"
        ? "OwnerSRC"
        : userData.username || userData.name || "User";
    $("#username").text(displayName);
    $("#namaPenjual").val(displayName);

    // Load products first
    await loadProdukOptions();

    // Initialize DataTable
    await initializeDataTable();
    await setupEventHandlers();

    console.log("Page initialization completed successfully");
  } catch (error) {
    console.error("Initialization Error:", error);
    alert("Terjadi kesalahan saat memuat halaman: " + error.message);
    window.location.href = "../login.html";
  } finally {
    // Hide loading indicator
    $(".loading").hide();
  }
}

// DOM Elements
const userTable = document.querySelector('#userTable tbody');
const addUserForm = document.querySelector('#addUserForm');
const editUserForm = document.querySelector('#editUserForm');
const searchInput = document.querySelector('#searchUser');
const deleteUserModal = document.querySelector('#deleteUserModal');
let userToDelete = null;

// Users API
const users = {
    login: async (credentials) => {
      try {
        const response = await fetch(`${BASE_URL}/user/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(credentials),
        });
        const data = await handleResponse(response);
        if (data.success && data.data.token) {
          localStorage.setItem("token", data.data.token);
          localStorage.setItem("role", data.data.role);
          localStorage.setItem(
            "userData",
            JSON.stringify({
              username: credentials.username,
              role: data.data.role,
              name: data.data.name || credentials.username,
            })
          );
  
          // Check if role is admin or owner
          if (["admin", "owner"].includes(data.data.role)) {
            return { success: true, data: data.data };
          }
          return { success: false, error: "Unauthorized role" };
        }
        return { success: false, error: "Invalid response from server" };
      } catch (error) {
        console.error("Login error:", error);
        return { success: false, error: error.message };
      }
    },
  
    logout: () => {
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("userData");
      window.location.href = "../login.html";
    },
  
    getAll: async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          throw new Error("Tidak terautentikasi");
        }
  
        const response = await fetch(`${BASE_URL}/user/getall`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await handleResponse(response);
        return { success: true, data: data.data };
      } catch (error) {
        console.error("Get users error:", error);
        return { success: false, error: error.message };
      }
    },
  
    getByUsername: async (username) => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          throw new Error("Tidak terautentikasi");
        }
  
        const response = await fetch(`${BASE_URL}/user/by-username/${username}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await handleResponse(response);
        return { success: true, data: data.data };
      } catch (error) {
        console.error("Get user error:", error);
        return { success: false, error: error.message };
      }
    },
  
    getAllUsers: async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          throw new Error("Tidak terautentikasi");
        }
  
        const response = await fetch(`${BASE_URL}/user/getall`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        return handleResponse(response);
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
  
    create: async (userData) => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          throw new Error("Tidak terautentikasi");
        }
  
        const response = await fetch(`${BASE_URL}/user/admin/register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(userData),
        });
        return handleResponse(response);
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
  
    updateUser: async (username, userData) => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          throw new Error("Tidak terautentikasi");
        }
  
        console.log("Sending request with token:", token); // Debug log
  
        const response = await fetch(
          `${BASE_URL}/user/admin/update/${username}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(userData),
          }
        );
  
        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(
            errorData?.message || `HTTP error! status: ${response.status}`
          );
        }
  
        const data = await response.json();
        return { success: true, data: data.data };
      } catch (error) {
        console.error("Update user error:", error);
        return { success: false, error: error.message };
      }
    },
  
    delete: async (id_user) => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          throw new Error("Tidak terautentikasi");
        }
  
        const response = await fetch(
          `${BASE_URL}/user/admin/delete-user/${id_user}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        return handleResponse(response);
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
  };

// Load all users
async function loadUsers() {
    try {
        const result = await users.getAll();
        if (result.success) {
            populateUserTable(result.data.data || []);
        } else {
            showNotification('error', result.error || 'Gagal memuat data pengguna');
        }
    } catch (error) {
        console.error('Error loading users:', error);
        showNotification('error', 'Error memuat data pengguna');
    }
}

// Populate user table
function populateUserTable(users) {
    const userTable = document.querySelector('#userTable tbody');
    if (!userTable) return;
    
    userTable.innerHTML = '';
    
    users.forEach(user => {
        // Tentukan status dan badge
        const status = user.status || 'Aktif';
        const statusClass = status === 'Aktif' ? 'success' : 'danger';
        const statusBadge = `<span class="badge badge-${statusClass}">${status}</span>`;
        
        // Buat ID user jika tidak ada
        const userId = user.id_user || '';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.username}</td>
            <td>${user.role}</td>
            <td>${statusBadge}</td>
            <td class="text-center">
                <button class="btn btn-warning btn-sm edit-user" 
                    data-username="${user.username}" 
                    data-role="${user.role}"
                    data-status="${status}">
                    <i class="fas fa-edit"></i> Edit
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
        
        const formData = new FormData(e.target);
        const userData = {
            username: formData.get('username'),
            password: formData.get('password'),
            role: formData.get('role')
        };

        try {
            const result = await users.create(userData);

            if (result.success) {
                showNotification('success', 'Pengguna berhasil ditambahkan');
                $('#addUserModal').modal('hide');
                loadUsers();
            } else {
                showNotification('error', `Error menambahkan pengguna: ${result.error}`);
            }
        } catch (error) {
            showNotification('error', `Error menambahkan pengguna: ${error.message}`);
        }
    });
}

// Handle edit user click
function handleEditClick(e) {
    const button = e.currentTarget;
    const username = button.dataset.username;
    const role = button.dataset.role;
    const status = button.dataset.status || 'Aktif';
    
    // Populate edit form
    if (editUserForm) {
        editUserForm.querySelector('#editUsername').value = username;
        editUserForm.querySelector('#editRole').value = role;
        editUserForm.querySelector('#editStatus').value = status;
        
        $('#editUserModal').modal('show');
    }
}

// Handle edit user form submission
if (editUserForm) {
    editUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const username = formData.get('username');
        const userData = {
            password: formData.get('password'),
            role: formData.get('role')
        };

        try {
            const result = await users.updateUser(username, userData);

            if (result.success) {
                showNotification('success', 'Pengguna berhasil diperbarui');
                $('#editUserModal').modal('hide');
                loadUsers();
            } else {
                showNotification('error', `Error memperbarui pengguna: ${result.error}`);
            }
        } catch (error) {
            showNotification('error', `Error memperbarui pengguna: ${error.message}`);
        }
    });
}

// Handle delete user click
function handleDeleteClick(e) {
    const button = e.currentTarget;
    const username = button.dataset.username;
    const id = button.dataset.id_user;
    
    if (!id) {
        showNotification('error', 'ID pengguna tidak valid');
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
            showNotification('error', 'ID pengguna tidak valid');
            return;
        }

        try {
            const result = await users.delete(userToDelete);
            if (result.success) {
                showNotification('success', 'Pengguna berhasil dihapus');
                $('#deleteUserModal').modal('hide');
                loadUsers();
            } else {
                showNotification('error', `Error menghapus pengguna: ${result.error}`);
            }
        } catch (error) {
            showNotification('error', `Error menghapus pengguna: ${error.message}`);
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

// Function to show notification
function showNotification(type, message) {
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
    const title = type === 'success' ? 'Berhasil!' : 'Error!';
    const bgClass = type === 'success' ? 'bg-success' : 'bg-danger';

    // Create notification modal if not exists
    if (!$('#notificationModal').length) {
        const modalHtml = `
            <div class="modal fade" id="notificationModal" tabindex="-1" role="dialog">
                <div class="modal-dialog modal-dialog-centered" role="document">
                    <div class="modal-content">
                        <div class="modal-header ${bgClass} text-white">
                            <h5 class="modal-title">${title}</h5>
                            <button type="button" class="close text-white" data-dismiss="modal" aria-label="Close">
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <div class="modal-body text-center py-4">
                            <i class="fas ${icon} ${type === 'success' ? 'text-success' : 'text-danger'} mb-3" style="font-size: 64px;"></i>
                            <p class="mb-0" id="notificationMessage"></p>
                        </div>
                        <div class="modal-footer justify-content-center">
                            <button type="button" class="btn ${type === 'success' ? 'btn-success' : 'btn-danger'} px-4" data-dismiss="modal">OK</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        $('body').append(modalHtml);

        // Handle modal hidden event
        $('#notificationModal').on('hidden.bs.modal', function () {
            // Reset forms if success
            if (type === 'success') {
                $('#addUserForm')[0]?.reset();
                $('#editUserForm')[0]?.reset();
                loadUsers();
            }
        });
    }

    // Set message and show modal
    $('#notificationMessage').text(message);
    $('#notificationModal').modal({
        backdrop: 'static',
        keyboard: false
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadUsers();
    
    // Setup password toggle functionality
    const setupPasswordToggle = (toggleId, passwordId) => {
        const toggleBtn = document.getElementById(toggleId);
        if (toggleBtn) {
            toggleBtn.addEventListener('click', function() {
                const passwordInput = document.getElementById(passwordId);
                const icon = this.querySelector('i');
                
                if (passwordInput.type === 'password') {
                    passwordInput.type = 'text';
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash');
                } else {
                    passwordInput.type = 'password';
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                }
            });
        }
    };

    // Setup toggle for both password fields
    setupPasswordToggle('togglePassword', 'password');
    setupPasswordToggle('toggleEditPassword', 'editPassword');

    // Check authentication
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '../login.html';
    }
});