// Initialize DataTable
let detailTable;

document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Check authentication
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('No token found');
            window.location.href = '../login.html';
            return;
        }

        // Set username from localStorage
        const userData = JSON.parse(localStorage.getItem('userData'));
        if (userData && userData.username) {
            const usernameElement = document.getElementById('navbarDropdown');
            if (usernameElement) {
                usernameElement.textContent = userData.role === 'owner' ? 'OwnerSRC' : userData.username;
            }
        }

        // Initialize DataTable
        detailTable = $('#tabelDetailPenjualan').DataTable({
            responsive: true,
            searching: false,
            paging: false,
            info: false,
            language: {
                emptyTable: "Tidak ada data produk"
            }
        });

        // Get IDs from URL
        const urlParams = new URLSearchParams(window.location.search);
        const id_details = urlParams.get('id_details');
        const id_penjualan = urlParams.get('id_penjualan');
        
        console.log('URL parameters:', {
            id_details: id_details,
            id_penjualan: id_penjualan
        });
        
        if (!id_details && !id_penjualan) {
            console.error('No ID found in URL parameters');
            showNotification('error', 'ID Penjualan tidak ditemukan');
            setTimeout(() => {
                window.location.href = 'penjualan.html';
            }, 2000);
            return;
        }

        // Load detail penjualan
        if (id_details) {
            console.log('Loading detail by id_details:', id_details);
            await loadDetailPenjualan(id_details);
        } else {
            console.log('Loading detail by id_penjualan:', id_penjualan);
            await loadDetailByPenjualanID(id_penjualan);
        }
    } catch (error) {
        console.error('Error in initialization:', error);
        showNotification('error', 'Terjadi kesalahan saat memuat data');
        setTimeout(() => {
            window.location.href = 'penjualan.html';
        }, 2000);
    }
});

// Function to load detail penjualan by id_details
async function loadDetailPenjualan(id_details) {
    try {
        const token = localStorage.getItem('token');
        console.log('Fetching detail penjualan with ID:', id_details);

        const response = await fetch(`http://127.0.0.1:8080/detail-penjualan/by-id/${id_details}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('Response status:', response.status);
        const responseText = await response.text();

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}, message: ${responseText}`);
        }

        const result = JSON.parse(responseText);
        console.log('Parsed result:', result);

        if (!result.data) {
            throw new Error('Data detail penjualan tidak ditemukan');
        }

        await updateUI(result.data);
    } catch (error) {
        console.error('Error in loadDetailPenjualan:', error);
        throw error;
    }
}

// Function to load detail by penjualan ID
async function loadDetailByPenjualanID(id_penjualan) {
    try {
        const token = localStorage.getItem('token');
        console.log('Fetching detail by penjualan ID:', id_penjualan);

        const response = await fetch(`http://127.0.0.1:8080/detail-penjualan/by-penjualan-id/${id_penjualan}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('Response status:', response.status);
        const responseText = await response.text();

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('Detail penjualan tidak ditemukan');
            }
            throw new Error(`HTTP error! status: ${response.status}, message: ${responseText}`);
        }

        const result = JSON.parse(responseText);
        console.log('Parsed result:', result);

        if (!result.data || result.data.length === 0) {
            throw new Error('Data detail penjualan tidak ditemukan');
        }

        // Ambil detail penjualan pertama
        await updateUI(result.data[0]);
    } catch (error) {
        console.error('Error in loadDetailByPenjualanID:', error);
        throw error;
    }
}

// Function to update UI with detail data
async function updateUI(detail) {
    try {
        console.log('Updating UI with detail:', detail);
        
        // Update info penjualan
        $('#id_details').text(detail.id_details || '-');
        
        const penjualan = detail.penjualan || {};
        $('#id_penjualan').text(penjualan.id_penjualan || '-');
        
        const user = penjualan.user || {};
        // $('#id_user').text(user.id_user || '-');
        $('#username').text(user.username || '-');
        $('#role').text(user.role || '-');
        
        // Format tanggal
        $('#tanggal_penjualan').text(penjualan.tanggal_penjualan ? 
            moment(penjualan.tanggal_penjualan).format('DD/MM/YYYY HH:mm:ss') : '-');

        // Update jumlah produk (total dari produk_terjual)
        $('#jumlah_produk').text(penjualan.jumlah_produk || '0');

        // Update total pendapatan berdasarkan perhitungan dari backend
        $('#total_pendapatan').text(formatRupiah(detail.total_pendapatan || 0));
        
        // Format updated_at
        $('#updated_at').text(penjualan.updated_at ? 
            moment(penjualan.updated_at).format('DD/MM/YYYY HH:mm:ss') : '-');

        // Clear existing table rows
        detailTable.clear();

        // Add product details
        const products = detail.produk || [];
        if (Array.isArray(products) && products.length > 0) {
            products.forEach(produk => {
                // Ekstrak nama kategori dengan penanganan yang lebih baik
                let kategoriDisplay = '-';
                let subKategoriDisplay = '-';
                
                // Penanganan kategori
                if (produk.kategori) {
                    if (typeof produk.kategori === 'object' && produk.kategori !== null) {
                        kategoriDisplay = produk.kategori.nama_kategori || '-';
                    } else if (typeof produk.kategori === 'string') {
                        kategoriDisplay = produk.kategori;
                    }
                } else if (produk.nama_kategori) {
                    kategoriDisplay = produk.nama_kategori;
                }
                
                // Penanganan subkategori
                if (produk.subkategori) {
                    if (typeof produk.subkategori === 'object' && produk.subkategori !== null) {
                        subKategoriDisplay = produk.subkategori.nama_subkategori || '-';
                    } else if (typeof produk.subkategori === 'string') {
                        subKategoriDisplay = produk.subkategori;
                    }
                } else if (produk.nama_subkategori) {
                    subKategoriDisplay = produk.nama_subkategori;
                }
                
                // Format tanggal kedaluwarsa jika ada
                let tanggalKedaluwarsa = '-';
                if (produk.tanggal_kedaluwarsa) {
                    const date = new Date(produk.tanggal_kedaluwarsa);
                    if (!isNaN(date.getTime())) {
                        // Pastikan tanggal valid sebelum memformat
                        if (date.getFullYear() > 1970) {
                            tanggalKedaluwarsa = date.toLocaleDateString('id-ID', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                            });
                        }
                    }
                }
                
                detailTable.row.add([
                    produk.id_produk || '-',
                    produk.nama_produk || '-',
                    kategoriDisplay,
                    subKategoriDisplay,
                    produk.kode_produk || '-',
                    formatRupiah(produk.harga_produk || 0),
                    produk.stok_barang || '0',
                    tanggalKedaluwarsa
                ]);
            });
        } else {
            console.warn('No product data or invalid format');
        }

        // Draw the table
        detailTable.draw();

        // Update total pendapatan
        $('#total_pendapatan').text(formatRupiah(detail.total_pendapatan || 0));

    } catch (error) {
        console.error('Error updating UI:', error);
        showNotification('error', 'Terjadi kesalahan saat memperbarui tampilan');
    }
}

// Function to format currency to Rupiah
function formatRupiah(angka) {
    return 'Rp ' + angka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Function to show notifications
function showNotification(type, message) {
    console.log(`${type} notification:`, message);
    alert(message);
}

// Event handler untuk logout
document.getElementById('logoutButton').addEventListener('click', function() {
    localStorage.removeItem('token');
    window.location.href = '../login.html';
});

// Button to go back to penjualan list
$('#btnKembali').on('click', function() {
    window.location.href = 'penjualan.html';
});
