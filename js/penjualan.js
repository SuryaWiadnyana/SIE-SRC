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
let subtotal = 0;

$(document).ready(function() {
    // Check authentication
    const token = localStorage.getItem('token');
    if (!token) {
        console.log('No token found, redirecting to login');
        window.location.href = '../login.html';
        return;
    }

    // Verify token format
    try {
        const tokenParts = token.split('.');
        if (tokenParts.length !== 3) {
            console.error('Invalid token format');
            localStorage.clear();
            window.location.href = '../login.html';
            return;
        }
    } catch (error) {
        console.error('Error parsing token:', error);
        localStorage.clear();
        window.location.href = '../login.html';
        return;
    }

    // Set username
    const userData = JSON.parse(localStorage.getItem('userData'));
    if (!userData || !userData.username) {
        console.error('No user data found');
        localStorage.clear();
        window.location.href = '../login.html';
        return;
    }
    $('#username').text(userData.username);
    $('#namaPenjual').val(userData.username);

    // Test API connection
    fetch('http://localhost:8080/penjualan/getall', {
        headers: {
            'Authorization': 'Bearer ' + token
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('API test failed with status: ' + response.status);
        }
        console.log('API connection successful');
        initializeDataTable();
    })
    .catch(error => {
        console.error('API test failed:', error);
        if (error.message.includes('401')) {
            localStorage.clear();
            window.location.href = '../login.html';
        }
    });
});

// Initialize DataTable
function initializeDataTable() {
    const token = localStorage.getItem('token');
    
    penjualanTable = $('#tabelPenjualan').DataTable({
        processing: true,
        serverSide: false,
        ajax: {
            url: 'http://localhost:8080/penjualan/getall',
            type: 'GET',
            headers: {
                'Authorization': 'Bearer ' + token
            },
            dataSrc: function(response) {
                console.log('Response from server:', response);
                if (!response.data) {
                    console.warn('No data in response');
                    return [];
                }
                return response.data;
            },
            error: function(xhr, error, thrown) {
                console.error('DataTables error:', error);
                console.error('XHR:', xhr);
                console.error('Thrown:', thrown);
                if (xhr.status === 401) {
                    console.error('Authentication failed');
                    localStorage.clear();
                    window.location.href = '../login.html';
                } else {
                    console.error('Other error occurred:', xhr.responseText);
                }
            }
        },
        columns: [
            { 
                data: null,
                render: function(data, type, row, meta) {
                    return meta.row + 1;
                }
            },
            { data: 'id_penjualan' },
            { 
                data: 'user',
                render: function(data) {
                    return data ? data.username : '-';
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
                        <button class="btn btn-info btn-sm" onclick="showDetailPenjualan('${row.id_penjualan}')">
                            <i class="fas fa-info-circle"></i> Detail
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="deletePenjualan('${row.id_penjualan}')">
                            <i class="fas fa-trash"></i> Hapus
                        </button>
                    `;
                }
            }
        ],
        order: [[1, 'desc']]
    });

    // Load product options
    loadProdukOptions();

    // Event handlers
    setupEventHandlers();
}

// Setup event handlers
function setupEventHandlers() {
    // Event handler untuk tombol simpan
    $('#btnSimpanPenjualan').on('click', function() {
        savePenjualan();
    });

    // Event handler untuk perubahan jumlah produk
    $(document).on('input', '.quantity', function() {
        const row = $(this).closest('.produk-item');
        const selectedOption = row.find('.select-produk option:selected');
        const quantity = parseInt($(this).val()) || 0;
        const harga = parseInt(selectedOption.data('harga')) || 0;
        subtotal = quantity * harga;
        row.find('.subtotal').val(formatRupiah(subtotal));
        updateTotal();
    });

    // Event handler untuk perubahan produk
    $(document).on('change', '.select-produk', function() {
        const row = $(this).closest('.produk-item');
        const quantity = parseInt(row.find('.quantity').val()) || 0;
        const selectedOption = $(this).find('option:selected');
        const harga = parseInt(selectedOption.data('harga')) || 0;
        subtotal = quantity * harga;
        row.find('.subtotal').val(formatRupiah(subtotal));
        updateTotal();
    });

    // Event handler untuk tombol tambah produk
    $('#btnTambahProduk').on('click', function() {
        addProductRow();
    });

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

// Load product options
async function loadProdukOptions() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:8080/produk/getallproduk', {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch products');
        }

        const data = await response.json();
        console.log('Product data:', data);
        
        if (data.data) {
            const options = data.data.map(product => {
                const formattedPrice = formatRupiah(product.harga_produk);
                return `<option value="${product.id_produk}" 
                    data-nama="${product.nama_produk}"
                    data-harga="${product.harga_produk}">
                    ${product.nama_produk} - ${formattedPrice}
                </option>`;
            }).join('');

            $('.select-produk').html('<option value="">Pilih Produk</option>' + options);
        }
    } catch (error) {
        console.error('Error loading products:', error);
        if (error.message.includes('401')) {
            alert('Sesi login telah berakhir. Silakan login kembali.');
            localStorage.clear();
            window.location.href = '../login.html';
        } else {
            alert('Gagal memuat data produk');
        }
    }
}

// Save new penjualan
async function savePenjualan() {
    try {
        const products = getSelectedProducts();
        const total = calculateTotal();

        if (products.length === 0) {
            alert('Minimal satu produk harus dipilih!');
            return;
        }

        const token = localStorage.getItem('token');
        const userData = JSON.parse(localStorage.getItem('userData'));
        
        if (!token || !userData || !userData.username) {
            alert('Sesi login telah berakhir. Silakan login kembali.');
            localStorage.clear();
            window.location.href = '../login.html';
            return;
        }

        const penjualanData = {
            nama_penjual: userData.username,
            tanggal_penjualan: new Date().toISOString(),
            subtotal: parseInt(subtotal),
            total: parseInt(total),
            updated_at: new Date().toISOString()
        };

        const response = await fetch('http://localhost:8080/penjualan/create', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify([penjualanData])
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to save sale');
        }

        const responsePenjualan = await response.json();

        if (responsePenjualan.data && responsePenjualan.data.length > 0) {
            const idPenjualan = responsePenjualan.data[0].id_penjualan;
            
            for (const product of products) {
                const detailData = {
                    penjualan: responsePenjualan.data[0],
                    produk: {
                        id_produk: product.id_produk,
                        nama_produk: product.nama_produk,
                        harga_produk: parseInt(product.harga_produk),
                        stok: parseInt(product.jumlah_produk)
                    },
                    // total_pendapatan: parseInt(product.harga_produk) * parseInt(product.jumlah_produk)
                };

                const detailResponse = await fetch('http://localhost:8080/detail-penjualan/create', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(detailData)
                });

                if (!detailResponse.ok) {
                    throw new Error('Failed to save sale detail');
                }
            }

            alert('Data penjualan berhasil disimpan');
            $('#modal-tambah-penjualan').modal('hide');
            resetForm();
            
            if (penjualanTable) {
                penjualanTable.ajax.reload();
            }
        }
    } catch (error) {
        console.error('Error saving penjualan:', error);
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            alert('Sesi login telah berakhir. Silakan login kembali.');
            localStorage.clear();
            window.location.href = '../login.html';
        } else {
            alert('Gagal menyimpan data penjualan: ' + error.message);
        }
    }
}

// Get username from userData
function getUsernameFromToken() {
    const userData = JSON.parse(localStorage.getItem('userData'));
    return userData?.username || null;
}

// Fill seller name automatically when modal opens
$('#modal-tambah-penjualan').on('show.bs.modal', function () {
    const username = getUsernameFromToken();
    if (username) {
        $('#namaPenjual').val(username);
        $('#namaPenjual').prop('readonly', true);
    } else {
        alert('Sesi login telah berakhir. Silakan login kembali.');
        localStorage.clear();
        window.location.href = '../login.html';
    }
});

// Function to get user role
function getUserRole() {
    const userData = JSON.parse(localStorage.getItem('userData'));
    return userData?.role || null;
}

// Function to delete penjualan
async function deletePenjualan(id_penjualan_) {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('No token found');
        }

        const response = await fetch(`http://localhost:8080/penjualan/delete/${id_penjualan}`, {
            method: 'DELETE',
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });

        if (!response.ok) {
            throw new Error('Failed to delete sale');
        }

        alert('Data penjualan berhasil dihapus');
        if (penjualanTable) {
            penjualanTable.ajax.reload();
        }
    } catch (error) {
        console.error('Error deleting penjualan:', error);
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            alert('Sesi login telah berakhir. Silakan login kembali.');
            localStorage.clear();
            window.location.href = '../login.html';
        } else {
            alert('Gagal menghapus data penjualan: ' + error.message);
        }
    }
}

// Get selected products from the form
function getSelectedProducts() {
    const products = [];
    $('.produk-item').each(function() {
        const row = $(this);
        const selectProduk = row.find('.select-produk');
        const selectedOption = selectProduk.find('option:selected');
        const jumlahProduk = parseInt(row.find('.quantity').val()) || 0;
        const hargaProduk = parseInt(selectedOption.data('harga')) || 0;
        
        if (selectProduk.val() && jumlahProduk > 0) {
            products.push({
                id_produk: selectProduk.val(),
                nama_produk: selectedOption.data('nama'),
                harga_produk: hargaProduk,
                // jumlah_produk: jumlahProduk,
                subtotal: jumlahProduk * hargaProduk
            });
        }
    });
    return products;
}

// Calculate total from selected products
function calculateTotal() {
    let total = 0;
    $('.produk-item').each(function() {
        const row = $(this);
        const selectProduk = row.find('.select-produk');
        const selectedOption = selectProduk.find('option:selected');
        const jumlahProduk = parseInt(row.find('.quantity').val()) || 0;
        const hargaProduk = selectedOption.data('harga') || 0;
        const subtotal = jumlahProduk * hargaProduk;
        
        row.find('.subtotal').val(formatRupiah(subtotal));
        total += subtotal;
    });
    return total;
}

// Update total when quantity changes
function updateTotal() {
    const total = calculateTotal();
    $('#totalPenjualan').val(formatRupiah(total));
}

// Add product row
function addProductRow() {
    const newRow = `
        <div class="row mb-3 produk-item">
            <div class="col-md-5">
                <select class="form-control select-produk" required>
                    <option value="">Pilih Produk</option>
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
    
    // Load product options for new select
    const newSelect = $('#produkContainer .produk-item:last-child .select-produk');
    const existingOptions = $('.select-produk').first().html();
    newSelect.html(existingOptions);
}

// Update total
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

// Save penjualan
async function savePenjualan() {
    try {
        const token = localStorage.getItem('token');
        const userData = JSON.parse(localStorage.getItem('userData'));
        
        if (!token || !userData) {
            alert('Sesi login telah berakhir. Silakan login kembali.');
            localStorage.clear();
            window.location.href = '../login.html';
            return;
        }

        const products = [];
        let total = 0;

        $('.produk-item').each(function() {
            const row = $(this);
            const selectProduk = row.find('.select-produk');
            const selectedOption = selectProduk.find('option:selected');
            const quantity = parseInt(row.find('.quantity').val()) || 0;
            const harga = parseInt(selectedOption.data('harga')) || 0;
            const subtotal = quantity * harga;

            if (selectProduk.val() && quantity > 0) {
                products.push({
                    id_produk: selectProduk.val(),
                    nama_produk: selectedOption.data('nama'),
                    harga_produk: harga,
                    jumlah_produk: quantity,
                    subtotal: subtotal
                });
                total += subtotal;
            }
        });

        if (products.length === 0) {
            alert('Minimal satu produk harus dipilih!');
            return;
        }

        const penjualanData = {
            user: {
                username: userData.username
            },
            tanggal_penjualan: new Date().toISOString(),
            total: total,
            details: products.map(product => ({
                produk: {
                    id_produk: product.id_produk,
                    nama_produk: product.nama_produk,
                    harga: product.harga_produk
                },
                jumlah_produk: product.jumlah_produk,
                subtotal: product.subtotal
            }))
        };

        console.log('Sending data:', penjualanData);

        const response = await fetch('http://localhost:8080/penjualan/create', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(penjualanData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to save sale');
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

// Reset form
function resetForm() {
    $('#produkContainer').empty();
    addProductRow();
    updateTotal();
}

// Show detail penjualan
async function showDetailPenjualan(id_penjualan) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`http://localhost:8080/penjualan/${id_penjualan}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch penjualan details');
        }

        const data = await response.json();
        console.log('Detail penjualan:', data);

        let detailsHtml = `
            <div class="table-responsive">
                <table class="table table-bordered">
                    <thead>
                        <tr>
                            <th>No</th>
                            <th>Nama Produk</th>
                            <th>Jumlah</th>
                            <th>Harga</th>
                            <th>Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        data.details.forEach((detail, index) => {
            detailsHtml += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${detail.produk ? detail.produk.nama_produk : '-'}</td>
                    <td>${detail.jumlah_produk}</td>
                    <td>${formatRupiah(detail.produk ? detail.produk.harga : 0)}</td>
                    <td>${formatRupiah(detail.subtotal)}</td>
                </tr>
            `;
        });

        detailsHtml += `
                    </tbody>
                    <tfoot>
                        <tr>
                            <th colspan="4" class="text-right">Total:</th>
                            <th>${formatRupiah(data.total)}</th>
                        </tr>
                    </tfoot>
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

// Delete penjualan
async function deletePenjualan(id_penjualan) {
    if (!confirm('Apakah Anda yakin ingin menghapus data penjualan ini?')) {
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`http://localhost:8080/penjualan/${id_penjualan}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to delete penjualan');
        }

        penjualanTable.ajax.reload();
        alert('Data penjualan berhasil dihapus');
    } catch (error) {
        console.error('Error deleting penjualan:', error);
        alert('Gagal menghapus data penjualan');
    }
}
