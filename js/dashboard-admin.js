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
 
 // Check authentication
 function checkAuth() {
   const token = localStorage.getItem("token");
   const role = localStorage.getItem("role");
 
   if (!token || !role || (role !== "admin" && role !== "owner")) {
     window.location.href = "../login.html";
     return false;
   }
   return true;
 }
 
 // Format currency in Indonesian Rupiah
 function formatRupiah(number) {
   return new Intl.NumberFormat("id-ID", {
     style: "currency",
     currency: "IDR",
     minimumFractionDigits: 0,
     maximumFractionDigits: 0,
   }).format(number);
 }
 
 // Fungsi untuk mengambil data pengguna aktif, total produk, dan total penjualan
 async function fetchDashboardData() {
   if (!checkAuth()) return;
 
   try {
     // Fetch products
     const productsResponse = await products.getAll();
     const productCountElement = document.getElementById("totalProducts");
 
     if (productsResponse.success && productsResponse.data) {
       const products = Array.isArray(productsResponse.data)
         ? productsResponse.data
         : Array.isArray(productsResponse.data.data)
         ? productsResponse.data.data
         : [];
 
       if (productCountElement) {
         productCountElement.textContent = products.length.toString();
       }
     } else {
       if (productCountElement) {
         productCountElement.textContent = "0";
       }
       console.error("Failed to fetch products:", productsResponse.error);
     }
 
     // Fetch users
     const usersResponse = await users.getAll();
     const userCountElement = document.getElementById("activeUsers");
 
     if (usersResponse.success && usersResponse.data) {
       const users = Array.isArray(usersResponse.data)
         ? usersResponse.data
         : Array.isArray(usersResponse.data.data)
         ? usersResponse.data.data
         : [];
 
       if (userCountElement) {
         userCountElement.textContent = users.length.toString();
       }
     } else {
       if (userCountElement) {
         userCountElement.textContent = "0";
       }
       console.error("Failed to fetch users:", usersResponse.error);
     }
 
     /// Fetch sales
     const salesResponse = await sales.getAll();
     const salesElement = document.getElementById("totalSales");
 
     if (salesResponse.success && salesResponse.data) {
       const sales = Array.isArray(salesResponse.data)
         ? salesResponse.data
         : Array.isArray(salesResponse.data.data)
         ? salesResponse.data.data
         : [];
 
       // Get current year
       const currentYear = new Date().getFullYear();
 
       // Filter sales for current year
       const currentYearSales = sales.filter(sale => {
         const saleYear = new Date(sale.tanggal_penjualan).getFullYear();
         return saleYear === currentYear;
       });
 
       // Calculate total sales for current year
       const totalSales = currentYearSales.reduce((total, sale) => {
         return total + (sale.total || 0);
       }, 0);
 
       if (salesElement) {
         salesElement.textContent = formatRupiah(totalSales);
       }
     } else {
       if (salesElement) {
         salesElement.textContent = formatRupiah(0);
       }
       console.error("Failed to fetch sales:", salesResponse.error);
     }
   } catch (error) {
     console.error("Error fetching dashboard data:", error);
 
     // Update elements to show 0 if there's an error
     const productCountElement = document.getElementById("totalProducts");
     const userCountElement = document.getElementById("activeUsers");
     const salesElement = document.getElementById("totalSales");
 
     if (productCountElement) productCountElement.textContent = "0";
     if (userCountElement) userCountElement.textContent = "0";
     if (salesElement) salesElement.textContent = formatRupiah(0);
   }
 }
 
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
       }
       return data;
     } catch (error) {
       console.error("Login error:", error);
       return { success: false, error: error.message };
     }
   },
 
   logout() {
     localStorage.removeItem("token");
     localStorage.removeItem("role");
     localStorage.removeItem("userData");
     window.location.href = "../login.html";
   },
 
   getAll: async () => {
     try {
       const response = await fetch(`${BASE_URL}/user/getall`, {
         method: "GET",
         headers: {
           Authorization: `Bearer ${localStorage.getItem("token")}`,
           "Content-Type": "application/json",
         },
       });
       return await handleResponse(response);
     } catch (error) {
       console.error("Error fetching users:", error);
       return { success: false, error: error.message };
     }
   },
 
   create: async (userData) => {
     try {
       const response = await fetch(`${BASE_URL}/user/register`, {
         method: "POST",
         headers: {
           Authorization: `Bearer ${localStorage.getItem("token")}`,
           "Content-Type": "application/json",
         },
         body: JSON.stringify(userData),
       });
       return await handleResponse(response);
     } catch (error) {
       console.error("Error creating user:", error);
       return { success: false, error: error.message };
     }
   },
 
   updateUser: async (username, userData) => {
     try {
       const response = await fetch(`${BASE_URL}/user/update/${username}`, {
         method: "PUT",
         headers: {
           Authorization: `Bearer ${localStorage.getItem("token")}`,
           "Content-Type": "application/json",
         },
         body: JSON.stringify(userData),
       });
       return await handleResponse(response);
     } catch (error) {
       console.error("Error updating user:", error);
       return { success: false, error: error.message };
     }
   },
 
   delete: async (id_user) => {
     try {
       const response = await fetch(`${BASE_URL}/user/delete/${id_user}`, {
         method: "DELETE",
         headers: {
           Authorization: `Bearer ${localStorage.getItem("token")}`,
           "Content-Type": "application/json",
         },
       });
       return await handleResponse(response);
     } catch (error) {
       console.error("Error deleting user:", error);
       return { success: false, error: error.message };
     }
   },
 };
 
 // Products API
 const products = {
   getAll: async () => {
     try {
       const response = await fetch(`${BASE_URL}/produk/getallproduk`, {
         method: "GET",
         headers: {
           Authorization: `Bearer ${localStorage.getItem("token")}`,
           "Content-Type": "application/json",
         },
       });
       return await handleResponse(response);
     } catch (error) {
       console.error("Error fetching products:", error);
       return { success: false, error: error.message };
     }
   },
 
   getById: async (id) => {
     try {
       const response = await fetch(`${BASE_URL}/produk/getprodukbyid/${id}`, {
         method: "GET",
         headers: {
           Authorization: `Bearer ${localStorage.getItem("token")}`,
           "Content-Type": "application/json",
         },
       });
       return await handleResponse(response);
     } catch (error) {
       console.error(`Error fetching product with ID ${id}:`, error);
       return { success: false, error: error.message };
     }
   },
 
   create: async (productData) => {
     try {
       const response = await fetch(`${BASE_URL}/produk/createproduk`, {
         method: "POST",
         headers: {
           Authorization: `Bearer ${localStorage.getItem("token")}`,
           "Content-Type": "application/json",
         },
         body: JSON.stringify(productData),
       });
       return await handleResponse(response);
     } catch (error) {
       console.error("Error creating product:", error);
       return { success: false, error: error.message };
     }
   },
 
   update: async (id, productData) => {
     try {
       const response = await fetch(`${BASE_URL}/produk/updateproduk/${id}`, {
         method: "PUT",
         headers: {
           Authorization: `Bearer ${localStorage.getItem("token")}`,
           "Content-Type": "application/json",
         },
         body: JSON.stringify(productData),
       });
       return await handleResponse(response);
     } catch (error) {
       console.error(`Error updating product with ID ${id}:`, error);
       return { success: false, error: error.message };
     }
   },
 
   delete: async (id) => {
     try {
       const response = await fetch(`${BASE_URL}/produk/deleteproduk/${id}`, {
         method: "DELETE",
         headers: {
           Authorization: `Bearer ${localStorage.getItem("token")}`,
           "Content-Type": "application/json",
         },
       });
       return await handleResponse(response);
     } catch (error) {
       console.error(`Error deleting product with ID ${id}:`, error);
       return { success: false, error: error.message };
     }
   },
 
   getLowestStock: async () => {
     try {
       const response = await fetch(`${BASE_URL}/produk/getloweststock`, {
         method: "GET",
         headers: {
           Authorization: `Bearer ${localStorage.getItem("token")}`,
           "Content-Type": "application/json",
         },
       });
       const result = await handleResponse(response);
       return result.data;
     } catch (error) {
       console.error("Error fetching products with lowest stock:", error);
       return [];
     }
   },
 };
 
 // Sales API
 const sales = {
   getAll: async () => {
     try {
       const response = await fetch(`${BASE_URL}/penjualan/getall`, {
         method: "GET",
         headers: {
           Authorization: `Bearer ${localStorage.getItem("token")}`,
           "Content-Type": "application/json",
         },
       });
       return await handleResponse(response);
     } catch (error) {
       console.error("Error fetching sales:", error);
       return { success: false, error: error.message };
     }
   },
 
   create: async (salesData) => {
     try {
       const response = await fetch(`${BASE_URL}/penjualan/create`, {
         method: "POST",
         headers: {
           Authorization: `Bearer ${localStorage.getItem("token")}`,
           "Content-Type": "application/json",
         },
         body: JSON.stringify(salesData),
       });
       return await handleResponse(response);
     } catch (error) {
       console.error("Error creating sale:", error);
       return { success: false, error: error.message };
     }
   },
 
   delete: async (id) => {
     try {
       const response = await fetch(`${BASE_URL}/penjualan/delete/${id}`, {
         method: "DELETE",
         headers: {
           Authorization: `Bearer ${localStorage.getItem("token")}`,
           "Content-Type": "application/json",
         },
       });
       return await handleResponse(response);
     } catch (error) {
       console.error(`Error deleting sale with ID ${id}:`, error);
       return { success: false, error: error.message };
     }
   },
 };
 
 // Fungsi untuk menampilkan produk dengan stok paling sedikit
 const displayLowestStockProduct = async () => {
   try {
     // Ambil data produk dengan stok terendah
     const lowestStockProducts = await products.getLowestStock();
     
     console.log("Produk dengan stok terendah:", lowestStockProducts);
     
     // Jika tidak ada produk dengan stok terendah, keluar dari fungsi
     if (!lowestStockProducts || lowestStockProducts.length === 0) {
       console.log("Tidak ada data produk dengan stok terendah");
       return;
     }
     
     // Ambil produk dengan stok paling sedikit (index 0)
     const lowestStockProduct = lowestStockProducts[0];
     
     // Perbarui elemen sisa stok untuk menampilkan produk dengan stok terendah
     const remainingStockElement = document.getElementById("stok_barang");
     
     if (remainingStockElement) {
       // Tampilkan stok terendah
       remainingStockElement.textContent = lowestStockProduct.stok_barang;
       
       // Tambahkan informasi nama produk jika elemen ada
       const stockInfoElement = document.querySelector(".sisa-stok-info");
       if (stockInfoElement) {
         stockInfoElement.textContent = `(${lowestStockProduct.nama_produk})`;
       } else {
         // Jika elemen tidak ada, buat elemen baru
         const stockCard = remainingStockElement.closest(".card-body");
         if (stockCard) {
           const infoElement = document.createElement("div");
           infoElement.className = "sisa-stok-info";
           infoElement.style.fontSize = "14px";
           infoElement.style.color = "#666";
           infoElement.textContent = `(${lowestStockProduct.nama_produk})`;
           stockCard.appendChild(infoElement);
         }
       }
     } else {
       console.log("Elemen stok_barang tidak ditemukan");
     }
   } catch (error) {
     console.error("Error dalam displayLowestStockProduct:", error);
   }
 };
 
 // Inisialisasi dashboard saat halaman dimuat
 document.addEventListener("DOMContentLoaded", async () => {
   try {
     console.log("Halaman dimuat, memperbarui dashboard...");
     
     // Periksa autentikasi terlebih dahulu
     if (!checkAuth()) {
       console.log("Autentikasi gagal");
       return;
     }
 
     console.log("Autentikasi berhasil, memperbarui data dashboard");
     
     // Perbarui data dashboard
     await fetchDashboardData();
     
     // Tampilkan produk dengan stok terendah
     await displayLowestStockProduct();
 
     console.log("Setup interval untuk pembaruan data");
     
     // Perbarui data setiap 1 jam (3600000 milidetik)
     setInterval(async () => {
       console.log("Memperbarui data dashboard (interval)");
       await fetchDashboardData();
       await displayLowestStockProduct();
     }, 3600000); // 1 jam = 3600000 milidetik
   } catch (error) {
     console.error("Error initializing dashboard:", error);
   }
 });