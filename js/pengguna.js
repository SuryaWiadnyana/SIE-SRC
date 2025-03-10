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
        const userId = user.id_user || user.id_user;
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
                    data-id_user="${userId}">
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
            const result = await users.create({
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

            const result = await users.updateUser(username, userData);

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
    const id = button.dataset.id_user;
    
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
            const result = await users.delete(userToDelete);
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
