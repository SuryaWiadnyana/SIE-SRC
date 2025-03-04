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
        const displayName = userData.role === 'owner' ? 'OwnerSRC' : (userData.username || userData.name || 'User');
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
        const response = await fetch('http://127.0.0.1:8080/produk/getallproduk', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch products');
        }

        const result = await response.json();
        console.log('Fetched products:', result);

        if (result.data) {
            produkList = result.data.map(product => ({
                ...product,
                kategori: product.kategori || '',
                sub_kategori: product.sub_kategori || '',
                kode_produk: product.kode_produk || '',
                harga_produk: parseInt(product.harga_produk) || 0,
                stok_barang: parseInt(product.stok_barang) || 0
            }));

            // Pisahkan nama produk dan harga dalam dropdown
            const options = produkList.map(product => {
                const hargaFormatted = formatRupiah(product.harga_produk).replace('IDR', 'Rp');
                return `<option value="${product.id_produk}" 
                    data-harga="${product.harga_produk}"
                    data-nama="${product.nama_produk}">
                    ${product.nama_produk} (${hargaFormatted})
                </option>`;
            }).join('');

            $('.select-produk').html('<option value="">Pilih Produk</option>' + options);
        }
    } catch (error) {
        console.error('Error loading products:', error);
        throw new Error('Gagal memuat data produk: ' + error.message);
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
        const quantityInput = row.find('.produk-terjual');
        
        // Reset jumlah saat produk berubah
        quantityInput.val('');
        
        // Set max quantity berdasarkan stok
        if (produkId) {
            const produk = produkList.find(p => p.id_produk === produkId);
            if (produk) {
                quantityInput.attr('max', produk.stok_barang);
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

    // Handle form submission
    $('#formTambahPenjualan').on('submit', async function(e) {
        e.preventDefault();
        
        try {
            const token = localStorage.getItem('token');
            const userData = JSON.parse(localStorage.getItem('userData'));
            
            const penjualanItems = [];
            let totalProdukTerjual = 0;
            let totalHarga = 0;
            const currentTime = new Date().toISOString();

            $('.produk-item').each(function() {
                const row = $(this);
                const produkId = row.find('.select-produk').val();
                const quantity = parseInt(row.find('.produk-terjual').val()) || 0;
                
                if (produkId && quantity > 0) {
                    const selectedProduct = produkList.find(p => p.id_produk === produkId);
                    if (selectedProduct) {
                        const subtotal = quantity * selectedProduct.harga_produk;
                        totalProdukTerjual += quantity;
                        totalHarga += subtotal;

                        penjualanItems.push({
                            penjualan: {
                                id_user: userData.id_user,
                                produk_terjual: quantity,
                                subtotal: subtotal,
                                total: subtotal,
                                tanggal_penjualan: currentTime,
                                created_at: currentTime,
                                updated_at: currentTime,
                                is_deleted: false
                            },
                            produk: selectedProduct
                        });
                    }
                }
            });

            if (penjualanItems.length === 0) {
                throw new Error('Minimal satu produk harus dipilih!');
            }

            // Update total di setiap item penjualan
            penjualanItems.forEach(item => {
                item.penjualan.total = totalHarga;
            });

            console.log('Creating new penjualan:', penjualanItems);
            const response = await fetch('http://127.0.0.1:8080/penjualan/create', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(penjualanItems)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('Create penjualan result:', result);

            // Refresh DataTable
            await refreshDataTable();
            
            // Close modal and reset form
            $('#modal-tambah-penjualan').modal('hide');
            this.reset();
            $('#produkContainer').empty();
            addProductRow();
            
            alert('Data penjualan berhasil ditambahkan');
        } catch (error) {
            console.error('Error creating penjualan:', error);
            alert('Gagal menambahkan data penjualan: ' + error.message);
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

// Export initialization function
export function initializePenjualan() {
    $(document).ready(() => {
        initializePage().catch(error => {
            console.error('Failed to initialize page:', error);
            alert('Failed to initialize page. Please try again.');
        });
    });
}