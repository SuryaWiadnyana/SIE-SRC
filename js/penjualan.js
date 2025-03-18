// Handle logout
document.getElementById('logoutButton').addEventListener('click', function(e) {
    e.preventDefault();
    localStorage.clear();
    window.location.href = '../login.html';
});

// Format currency to Rupiah
function formatRupiah(angka) {
    if (!angka) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(angka);
}

// Format date
function formatDate(dateString) {
    if (!dateString) return '-';
    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString('id-ID', options);
}

let penjualanTable;
let produkList = [];

// Initialize page
async function initializePage() {
    console.log('Starting penjualan page initialization...');
    
    try {
        // Show loading indicator
        $('.loading').show();
        
        // Check authentication
        const token = localStorage.getItem('token');
        let userData = null;
        try {
            userData = JSON.parse(localStorage.getItem('userData'));
        } catch (error) {
            console.error('Error parsing userData:', error);
            throw new Error('Invalid user data');
        }

        if (!token || !userData) {
            throw new Error('Missing authentication data');
        }

        // Set username if authentication is valid
        const displayName = userData.username || userData.name || 'User';
        $('#username').text(displayName);
        $('#namaPenjual').val(displayName);

        // Load products first
        await loadProdukOptions();

        // Initialize DataTable
        await initializeDataTable();
        await setupEventHandlers();
        
        console.log('Page initialization completed successfully');
    } catch (error) {
        console.error('Initialization Error:', error);
        alert('Terjadi kesalahan saat memuat halaman: ' + error.message);
        window.location.href = '../login.html';
    } finally {
        // Hide loading indicator
        $('.loading').hide();
    }
}


// Start initialization
initializePage();

// Load product options
async function loadProdukOptions() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('Token tidak ditemukan');
        }

        console.log('Fetching products with token:', token);
        const response = await fetch('http://127.0.0.1:8080/produk/getallproduk', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server response:', {
                status: response.status,
                statusText: response.statusText,
                body: errorText
            });
            throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        console.log('API Response:', result);

        if (!result) {
            throw new Error('Response kosong dari server');
        }

        if (!result.data) {
            throw new Error('Data tidak ditemukan dalam response');
        }

        // Pastikan kita memiliki array produk
        const products = Array.isArray(result.data) ? result.data : [];
        console.log('Products array:', products);

        // Map produk ke format yang dibutuhkan
        produkList = products.map(item => {
            if (!item || !item.produk) {
                console.warn('Produk tidak valid:', item);
                return null;
            }

            const product = item.produk;
            
            // Format tanggal kadaluarsa
            let tanggalKadaluarsa = null;
            if (product.tanggal_kadaluarsa && product.tanggal_kadaluarsa !== "0001-01-01T00:00:00Z") {
                const date = new Date(product.tanggal_kadaluarsa);
                if (!isNaN(date.getTime())) {
                    tanggalKadaluarsa = date.toISOString();
                }
            }

            return {
                id_produk: product.id_produk || '',
                nama_produk: product.nama_produk || '',
                kategori: product.kategori || {
                    id_kategori: '',
                    nama_kategori: ''
                },
                subkategori: product.subkategori || {
                    id_subkategori: '',
                    nama_subkategori: '',
                    kategori: product.kategori || {
                        id_kategori: '',
                        nama_kategori: ''
                    }
                },
                kode_produk: product.kode_produk || '',
                harga_produk: parseInt(product.harga_produk) || 0,
                stok_barang: parseInt(product.stok_barang) || 0,
                tanggal_kadaluarsa: tanggalKadaluarsa
            };
        }).filter(product => product !== null);

        console.log('Processed product list:', produkList);

        if (produkList.length === 0) {
            console.warn('Tidak ada produk yang valid ditemukan');
        }

        // Generate options untuk dropdown
        const options = produkList.map(product => {
            const hargaFormatted = formatRupiah(product.harga_produk).replace('IDR', 'Rp');
            const kadaluarsaText = product.tanggal_kadaluarsa ? 
                new Date(product.tanggal_kadaluarsa).toLocaleDateString('id-ID', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }) : '-';
                
            return `<option value="${product.id_produk}" 
                data-harga="${product.harga_produk}"
                data-nama="${product.nama_produk}"
                data-kadaluarsa="${product.tanggal_kadaluarsa || ''}"
                data-stok="${product.stok_barang}">
                ${product.nama_produk} (${hargaFormatted})
            </option>`;
        }).join('');

        // Update dropdown
        const $selectProduk = $('.select-produk');
        if ($selectProduk.length === 0) {
            throw new Error('Element select-produk tidak ditemukan');
        }
        
        $selectProduk.html('<option value="">Pilih Produk</option>' + options);
        console.log('Dropdown updated successfully');

    } catch (error) {
        console.error('Error detail:', error);
        console.error('Error stack:', error.stack);
        throw new Error(`Gagal memuat data produk: ${error.message}`);
    }
}

// Initialize DataTable
async function initializeDataTable() {
    console.log('Initializing DataTable...');
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://127.0.0.1:8080/penjualan/getall', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Fetched sales data:', result);

        // Extract penjualan data from the response
        const penjualanData = result.data ? result.data.map(item => {
            console.log('Processing item:', item);
            
            // Jika item adalah detail penjualan
            if (item.id_details) {
                console.log('Found detail penjualan:', item);
                // Jika item memiliki penjualan, gunakan data penjualan
                if (item.penjualan) {
                    const penjualan = item.penjualan;
                    penjualan.id_details = item.id_details;
                    return penjualan;
                }
                // Jika tidak, gunakan item langsung
                return item;
            }
            
            // Jika item tidak memiliki id_details tapi memiliki id_penjualan
            if (item.id_penjualan) {
                console.log('Found penjualan:', item);
                return item;
            }
            
            console.log('No identifiers found in item');
            return item;
        }) : [];
        
        console.log('Processed penjualan data:', penjualanData);

        // Destroy existing DataTable if it exists
        if ($.fn.DataTable.isDataTable('#penjualanTable')) {
            $('#penjualanTable').DataTable().destroy();
        }

        // Initialize DataTable with the fetched data
        penjualanTable = $('#penjualanTable').DataTable({
            data: penjualanData,
            columns: [
                { 
                    data: 'id_penjualan',
                    render: function(data) {
                        return data || '-';
                    }
                },
                { 
                    data: 'user.username',
                    render: function(data, type, row) {
                        return data || row.nama_penjual || '-';
                    }
                },
                { 
                    data: 'total',
                    render: function(data) {
                        return formatRupiah(data || 0);
                    }
                },
                { 
                    data: 'tanggal_penjualan',
                    render: function(data) {
                        return data ? formatDate(data) : '-';
                    }
                },
                {
                    data: null,
                    render: function(data, type, row) {
                        console.log('Rendering row data:', row);
                        return `
                            <button class="btn btn-info btn-sm detail-btn" data-id_details="${row.id_details || ''}" data-id_penjualan="${row.id_penjualan || ''}">
                                <i class="fas fa-eye"></i> Detail
                            </button>
                            <button class="btn btn-danger btn-sm delete-btn" data-id_penjualan="${row.id_penjualan || ''}">
                                <i class="fas fa-trash"></i> Hapus
                            </button>
                        `;
                    }
                }
            ],
            order: [[0, 'asc']], // Sort by ID Penjualan ascending
            responsive: true,
            language: {
                emptyTable: "Tidak Ada Data Penjualan",
                info: "Menampilkan _START_ sampai _END_ dari _TOTAL_ data",
                infoEmpty: "Menampilkan 0 sampai 0 dari 0 data",
                infoFiltered: "(disaring dari _MAX_ total data)",
                infoPostFix: "",
                thousands: ".",
                lengthMenu: "Tampilkan _MENU_ data per halaman",
                loadingRecords: "Memuat...",
                processing: "Memproses...",
                search: "Cari:",
                zeroRecords: "Tidak Ada Data Penjualan",
                paginate: {
                    first: "Pertama",
                    last: "Terakhir",
                    next: "Selanjutnya",
                    previous: "Sebelumnya"
                },
                aria: {
                    sortAscending: ": aktifkan untuk mengurutkan kolom ke atas",
                    sortDescending: ": aktifkan untuk mengurutkan kolom ke bawah"
                }
            }
        });

        // Add event listeners for buttons
        $('#penjualanTable tbody').on('click', '.detail-btn', function() {
            const button = $(this);
            const id_details = button.data('id_details');
            const id_penjualan = button.data('id_penjualan');
            
            console.log('Detail button clicked:', {
                button: button.prop('outerHTML'),
                id_details: id_details,
                id_penjualan: id_penjualan,
                allData: button.data()
            });
            
            if (id_details) {
                console.log('Using id_details:', id_details);
                window.location.href = `detail-penjualan.html?id_details=${id_details}`;
            } else if (id_penjualan) {
                // Jika tidak ada id_details, coba cari detail berdasarkan id_penjualan
                console.log('Using id_penjualan as fallback:', id_penjualan);
                window.location.href = `detail-penjualan.html?id_penjualan=${id_penjualan}`;
            } else {
                console.error('No identifiers found in button');
                alert('ID Detail Penjualan tidak ditemukan');
            }
        });

        $('#penjualanTable tbody').on('click', '.delete-btn', function() {
            const id_penjualan = $(this).data('id_penjualan');
            console.log('Delete button clicked for ID:', id_penjualan);
            
            if (id_penjualan) {
                showDeleteConfirmation(
                    "Konfirmasi Hapus Penjualan",
                    `Apakah Anda yakin ingin menghapus data penjualan dengan ID: ${id_penjualan}?`,
                    async function() {
                        await deletePenjualan(id_penjualan);
                    }
                );
            } else {
                console.error('No id_penjualan found for delete button');
                alert('ID Penjualan tidak ditemukan');
            }
        });

        console.log('DataTable initialized successfully');
    } catch (error) {
        console.error('Error initializing DataTable:', error);
        throw error;
    }
}

function updateSubtotal(row) {
    const quantity = parseInt(row.find('.produk-terjual').val()) || 0;
    const selectedOption = row.find('.select-produk option:selected');
    const harga = parseInt(selectedOption.data('harga')) || 0;
    const subtotal = quantity * harga;
    
    row.find('.subtotal').val(formatRupiah(subtotal).replace('IDR', 'Rp'));
    updateTotal();
}

function updateTotal() {
    let total = 0;
    $('.produk-item').each(function() {
        const subtotalStr = $(this).find('.subtotal').val();
        if (subtotalStr) {
            const subtotalNum = parseInt(subtotalStr.replace(/[^0-9]/g, ''));
            total += subtotalNum;
        }
    });
    $('#totalPenjualan').val(formatRupiah(total).replace('IDR', 'Rp'));
}

function addProductRow() {
    const newRow = `
        <div class="row mb-3 produk-item">
            <div class="col-md-5">
                <select class="form-control select-produk" required>
                    <option value="">Pilih Produk</option>
                    ${$('.select-produk').first().html()}
                </select>
            </div>
            <div class="col-md-3">
                <input type="number" class="form-control produk-terjual" placeholder="Jumlah" min="1" required>
            </div>
            <div class="col-md-3">
                <input type="text" class="form-control subtotal" placeholder="Rp 0" readonly>
            </div>
            <div class="col-md-1">
                <button type="button" class="btn btn-danger btn-sm btn-remove-produk">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;
    $('#produkContainer').append(newRow);
}

async function setupEventHandlers() {
    // Set max date untuk input tanggal ke hari ini
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('tanggalPenjualan').max = today;

    // Event handler untuk form submit
    $('#formTambahPenjualan').on('submit', async function(e) {
        e.preventDefault();
        console.log('Form submitted');

        try {
            // Validasi form
            const tanggalInput = document.getElementById('tanggalPenjualan');
            if (!tanggalInput.value) {
                throw new Error('Tanggal penjualan harus diisi');
            }

            let hasValidProduct = false;
            $('.produk-item').each(function() {
                const $select = $(this).find('.select-produk');
                const $quantity = $(this).find('.produk-terjual');
                
                if ($select.val() && $quantity.val()) {
                    const qty = parseInt($quantity.val());
                    const stok = parseInt($select.data('stok'));
                    
                    if (qty <= 0) {
                        throw new Error('Jumlah produk harus lebih dari 0');
                    }
                    
                    if (qty > stok) {
                        throw new Error(`Stok produk ${$select.find('option:selected').text()} tidak mencukupi`);
                    }
                    
                    hasValidProduct = true;
                }
            });

            if (!hasValidProduct) {
                throw new Error('Pilih minimal satu produk dan masukkan jumlahnya');
            }

            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Token tidak ditemukan');
            }

            // Collect all product data
            const penjualanData = [];
            $('.produk-item').each(function() {
                const $row = $(this);
                const $select = $row.find('.select-produk');
                const $quantity = $row.find('.produk-terjual');
                
                if ($select.val() && $quantity.val()) {
                    const selectedProduct = produkList.find(p => p.id_produk === $select.val());
                    if (selectedProduct) {
                        // Get tanggal value
                        const tanggalInput = document.getElementById('tanggalPenjualan').value;
                        // Convert YYYY-MM-DD to DD-MM-YYYY
                        const [year, month, day] = tanggalInput.split('-');
                        const formattedDate = `${day}-${month}-${year}`;
                        
                        penjualanData.push({
                            penjualan: {
                                produk_terjual: parseInt($quantity.val()),
                                tanggal_penjualan: formattedDate
                            },
                            produk: {
                                id_produk: selectedProduct.id_produk,
                                nama_produk: selectedProduct.nama_produk,
                                kategori: selectedProduct.kategori,
                                subkategori: selectedProduct.subkategori,
                                kode_produk: selectedProduct.kode_produk,
                                harga_produk: selectedProduct.harga_produk,
                                stok_barang: selectedProduct.stok_barang,
                                tanggal_kadaluarsa: selectedProduct.tanggal_kadaluarsa,
                                is_deleted: null
                            }
                        });
                    }
                }
            });

            if (penjualanData.length === 0) {
                throw new Error('Tidak ada produk yang dipilih');
            }

            console.log('Sending data:', penjualanData);

            const response = await fetch('http://127.0.0.1:8080/penjualan/create', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(penjualanData)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server error: ${errorText}`);
            }

            const result = await response.json();
            console.log('Server response:', result);

            if (result.error) {
                throw new Error(result.error);
            }

            // Show success message
            Swal.fire({
                icon: 'success',
                title: 'Berhasil',
                text: 'Data penjualan berhasil disimpan',
                showConfirmButton: false,
                timer: 1500
            }).then(() => {
                // Reset form
                $('#formTambahPenjualan')[0].reset();
                $('#modal-tambah-penjualan').modal('hide');
                
                // Reload data
                refreshDataTable();
                loadProdukOptions();
            });

        } catch (error) {
            console.error('Error submitting form:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message
            });
        }
    });

    // Event handler untuk perubahan jumlah produk
    $(document).on('input', '.produk-terjual', function() {
        const row = $(this).closest('.produk-item');
        const quantity = parseInt($(this).val()) || 0;
        const selectedOption = row.find('.select-produk option:selected');
        
        // Validasi stok
        const produkId = selectedOption.val();
        if (produkId) {
            const produk = produkList.find(p => p.id_produk === produkId);
            if (produk && quantity > produk.stok_barang) {
                alert(`Stok tidak mencukupi. Stok tersedia: ${produk.stok_barang}`);
                $(this).val(produk.stok_barang);
            }
        }
        
        updateSubtotal(row);
    });

    // Event handler untuk perubahan produk
    $(document).on('change', '.select-produk', function() {
        const row = $(this).closest('.produk-item');
        const produkId = $(this).val();
        const selectedOption = $(this).find('option:selected');
        const quantityInput = row.find('.produk-terjual');
        
        // Reset jumlah saat produk berubah
        quantityInput.val('');
        
        // Hapus info produk sebelumnya
        row.find('.produk-info').remove();
        
        // Set max quantity dan tampilkan info produk
        if (produkId) {
            const produk = produkList.find(p => p.id_produk === produkId);
            if (produk) {
                quantityInput.attr('max', produk.stok_barang);
                
                // Format tanggal kadaluarsa
                const kadaluarsaText = produk.tanggal_kadaluarsa ? 
                    new Date(produk.tanggal_kadaluarsa).toLocaleDateString('id-ID', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    }) : '-';

                // Tampilkan info produk
                const infoHtml = `
                    <div class="produk-info small text-muted mt-2">
                        <div>Kode: ${produk.kode_produk || '-'}</div>
                        <div>Kategori: ${produk.kategori?.nama_kategori || '-'}</div>
                        <div>Subkategori: ${produk.subkategori?.nama_subkategori || '-'}</div>
                        <div>Kadaluarsa: ${kadaluarsaText}</div>
                        <div>Harga: ${formatRupiah(produk.harga_produk)}</div>
                        <div>Stok: ${produk.stok_barang}</div>
                    </div>
                `;
                row.find('.select-produk').after(infoHtml);
            }
        }
        
        updateSubtotal(row);
    });

    // Event handler untuk tombol tambah produk
    $('#btnTambahProduk').on('click', addProductRow);

    // Event handler untuk tombol hapus produk
    $(document).on('click', '.btn-remove-produk', function() {
        if ($('.produk-item').length > 1) {
            $(this).closest('.produk-item').remove();
            updateTotal();
        } else {
            alert('Minimal harus ada satu produk!');
        }
    });
}

async function refreshDataTable() {
    try {
        const token = localStorage.getItem('token');
        console.log('Refreshing DataTable...');

        const response = await fetch('http://127.0.0.1:8080/penjualan/getall', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Refreshed sales data:', result);

        // Extract penjualan data from the response
        const penjualanData = result.data ? result.data.map(item => {
            console.log('Processing item:', item);
            
            // Jika item adalah detail penjualan
            if (item.id_details) {
                console.log('Found detail penjualan:', item);
                // Jika item memiliki penjualan, gunakan data penjualan
                if (item.penjualan) {
                    const penjualan = item.penjualan;
                    penjualan.id_details = item.id_details;
                    return penjualan;
                }
                // Jika tidak, gunakan item langsung
                return item;
            }
            
            // Jika item tidak memiliki id_details tapi memiliki id_penjualan
            if (item.id_penjualan) {
                console.log('Found penjualan:', item);
                return item;
            }
            
            console.log('No identifiers found in item');
            return item;
        }) : [];
        
        console.log('Processed penjualan data:', penjualanData);

        // Clear and reload data
        penjualanTable.clear();
        penjualanTable.rows.add(penjualanData);
        penjualanTable.draw();
        
        console.log('DataTable refreshed successfully');
    } catch (error) {
        console.error('Error refreshing DataTable:', error);
        alert('Gagal memperbarui data penjualan');
    }
}

async function deletePenjualan(id_penjualan) {
    try {
        const token = localStorage.getItem('token');
        console.log('Deleting penjualan with ID:', id_penjualan);

        const response = await fetch(`http://127.0.0.1:8080/penjualan/delete/${id_penjualan}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Delete response:', response.status, errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Refresh the table after successful deletion
        await refreshDataTable();
        alert('Data penjualan berhasil dihapus');
    } catch (error) {
        console.error('Error deleting penjualan:', error);
        alert('Gagal menghapus data penjualan: ' + error.message);
    }
}

// Export initialization function
export function initializePenjualan() {
    $(document).ready(() => {
        initializePage().catch(error => {
            console.error('Failed to initialize page:', error);
            alert('Failed to initialize page. Please try again.');
        });
    });
}