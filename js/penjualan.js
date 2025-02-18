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
let currentSubTotal = 0;

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

// Initialize DataTable
async function initializeDataTable() {
    console.log('Initializing DataTable...');
    
    try {
        const token = localStorage.getItem('token');
        console.log('Fetching sales data...');
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

        if (!result.data) {
            console.warn('No sales data received');
            return;
        }

        // Destroy existing DataTable if it exists
        if (penjualanTable) {
            penjualanTable.destroy();
        }

        // Initialize DataTable with the fetched data
        penjualanTable = $('#penjualanTable').DataTable({
            data: result.data,
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
                        return formatRupiah(data);
                    }
                },
                { 
                    data: 'tanggal_penjualan',
                    render: function(data) {
                        return formatDate(data);
                    }
                },
                {
                    data: null,
                    render: function(data, type, row) {
                        return `
                            <button class="btn btn-danger btn-sm delete-btn" data-id="${row.id_penjualan}">
                                <i class="fas fa-trash"></i> Hapus
                            </button>
                        `;
                    }
                }
            ],
            order: [[3, 'desc']], // Sort by date descending
            responsive: true,
            language: {
                url: '//cdn.datatables.net/plug-ins/1.13.7/i18n/id.json'
            }
        });

        // Add delete event listener
        $('#penjualanTable tbody').on('click', '.delete-btn', async function() {
            const id = $(this).data('id');
            if (confirm('Apakah Anda yakin ingin menghapus data penjualan ini?')) {
                await deletePenjualan(id);
            }
        });

        console.log('DataTable initialized successfully');
    } catch (error) {
        console.error('Error initializing DataTable:', error);
        throw error;
    }
}

async function setupEventHandlers() {
    // Load initial product options
    loadProdukOptions();

    // Event handler untuk perubahan jumlah produk
    $(document).on('input', '.quantity', function() {
        updateSubtotalForRow($(this).closest('.produk-item'));
    });

    // Event handler untuk perubahan produk
    $(document).on('change', '.select-produk', function() {
        updateSubtotalForRow($(this).closest('.produk-item'));
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

    // Event handler untuk tombol simpan
    $('#btnSimpanPenjualan').on('click', savePenjualan);
}

async function loadProdukOptions() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://127.0.0.1:8080/produk/getallproduk', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'include'
        });

        if (!response.ok) throw new Error('Failed to fetch products');

        const data = await response.json();
        if (data.data) {
            const options = data.data.map(product => 
                `<option value="${product.id_produk}" 
                    data-nama="${product.nama_produk}"
                    data-harga="${product.harga_produk}">
                    ${product.nama_produk} - ${formatRupiah(product.harga_produk)}
                </option>`
            ).join('');

            $('.select-produk').html('<option value="">Pilih Produk</option>' + options);
        }
    } catch (error) {
        console.error('Error loading products:', error);
        alert('Gagal memuat data produk');
    }
}

function updateSubtotalForRow(row) {
    const quantity = parseInt(row.find('.quantity').val()) || 0;
    const selectedOption = row.find('.select-produk option:selected');
    const harga = parseInt(selectedOption.data('harga')) || 0;
    const subtotal = quantity * harga;
    
    row.find('.subtotal').val(formatRupiah(subtotal));
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
    $('#totalPenjualan').val(formatRupiah(total));
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
                <input type="number" class="form-control quantity" placeholder="Jumlah" min="1" required>
            </div>
            <div class="col-md-3">
                <input type="text" class="form-control subtotal" placeholder="Subtotal" readonly>
            </div>
            <div class="col-md-1">
                <button type="button" class="btn btn-danger btn-remove-produk">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;
    $('#produkContainer').append(newRow);
}

async function savePenjualan() {
    try {
        const token = localStorage.getItem('token');
        const userData = JSON.parse(localStorage.getItem('userData'));
        
        if (!token || !userData) {
            alert('Sesi login telah berakhir');
            window.location.href = '../login.html';
            return;
        }

        const penjualanItems = [];
        let totalJumlahProduk = 0;
        let totalHarga = 0;

        $('.produk-item').each(function() {
            const row = $(this);
            const selectProduk = row.find('.select-produk');
            const selectedOption = selectProduk.find('option:selected');
            const quantity = parseInt(row.find('.quantity').val()) || 0;
            const harga = parseInt(selectedOption.data('harga')) || 0;
            const subtotal = quantity * harga;

            if (selectProduk.val() && quantity > 0) {
                penjualanItems.push({
                    id_penjualan: '', // Will be generated by backend
                    user: {
                        username: userData.username
                    },
                    tanggal_penjualan: new Date().toISOString(),
                    jumlah_produk: quantity,
                    subtotal: subtotal,
                    total: subtotal,
                    produk: {
                        id_produk: selectProduk.val(),
                        nama_produk: selectedOption.data('nama'),
                        harga: harga
                    }
                });
                totalJumlahProduk += quantity;
                totalHarga += subtotal;
            }
        });

        if (penjualanItems.length === 0) {
            alert('Minimal satu produk harus dipilih!');
            return;
        }

        const response = await fetch('http://127.0.0.1:8080/penjualan/create', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(penjualanItems)
        });

        if (!response.ok) {
            let errorMessage = 'Failed to save penjualan';
            try {
                const errorData = await response.json();
                errorMessage = errorData.message || errorData.error || `Status: ${response.status}`;
            } catch (e) {
                const errorText = await response.text();
                errorMessage = `${errorMessage}. Status: ${response.status}. Error: ${errorText}`;
            }
            throw new Error(errorMessage);
        }

        alert('Data penjualan berhasil disimpan');
        $('#modal-tambah-penjualan').modal('hide');
        resetForm();
        penjualanTable.ajax.reload();

    } catch (error) {
        console.error('Error saving penjualan:', error);
        alert('Gagal menyimpan data penjualan: ' + error.message);
    }
}

function resetForm() {
    $('#produkContainer').empty();
    addProductRow();
    updateTotal();
}

async function showDetailPenjualan(id_penjualan) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`http://127.0.0.1:8080/penjualan/${id_penjualan}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'include'
        });

        if (!response.ok) throw new Error('Failed to fetch penjualan details');

        const data = await response.json();
        console.log('Detail penjualan:', data);

        let detailsHtml = `
            <div class="table-responsive">
                <table class="table table-bordered">
                    <thead>
                        <tr>
                            <th>ID Penjualan</th>
                            <th>Penjual</th>
                            <th>Jumlah Produk</th>
                            <th>Subtotal</th>
                            <th>Total</th>
                            <th>Tanggal</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>${data.id_penjualan}</td>
                            <td>${data.user ? data.user.username : '-'}</td>
                            <td>${data.jumlah_produk}</td>
                            <td>${formatRupiah(data.subtotal)}</td>
                            <td>${formatRupiah(data.total)}</td>
                            <td>${formatDate(data.tanggal_penjualan)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;

        $('#detailPenjualanContent').html(detailsHtml);
        $('#modalDetailPenjualan').modal('show');
    } catch (error) {
        console.error('Error showing penjualan details:', error);
        alert('Gagal menampilkan detail penjualan');
    }
}

async function deletePenjualan(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus data penjualan ini?')) {
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`http://127.0.0.1:8080/penjualan/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'include'
        });

        if (!response.ok) throw new Error('Failed to delete penjualan');

        alert('Data penjualan berhasil dihapus');
        penjualanTable.ajax.reload();
    } catch (error) {
        console.error('Error deleting penjualan:', error);
        alert('Gagal menghapus data penjualan');
    }
}

async function refreshDataTable() {
    try {
        // Clear existing table
        penjualanTable.clear();
        
        // Fetch new data
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
        
        // Add new data
        penjualanTable.rows.add(result.data);
        
        // Redraw table
        penjualanTable.draw();
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
