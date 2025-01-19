// Format currency to Rupiah
function formatRupiah(angka) {
    if (!angka) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(angka);
}

$(document).ready(function() {
    // Check authentication
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '../login.html';
        return;
    }

    // Pastikan tabel ada sebelum inisialisasi DataTables
    if (!$('#tabelPenjualan').length) {
        console.error('Table element not found!');
        return;
    }

    // Initialize DataTable
    initializeDataTable();
    
    // Load product options
    loadProdukOptions();

    // Event handler untuk tombol simpan
    $('#btn-simpan-penjualan').on('click', function() {
        savePenjualan();
    });
});

// Initialize DataTable
function initializeDataTable() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        if ($.fn.DataTable.isDataTable('#tabelPenjualan')) {
            $('#tabelPenjualan').DataTable().destroy();
        }

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
                    if (!response.data) return [];
                    return response.data.map(item => {
                        if (item.penjualan) {
                            return {
                                ...item.penjualan,
                                user: item.penjualan.user
                            };
                        }
                        return item;
                    });
                },
                error: function(xhr, error, thrown) {
                    console.error('DataTables error:', error);
                    if (xhr.status === 401) {
                        alert('Sesi login telah berakhir. Silakan login kembali.');
                        localStorage.clear();
                        window.location.href = '../login.html';
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
                { 
                    data: 'id_penjualan',
                    defaultContent: '-'
                },
                { 
                    data: 'user',
                    render: function(data) {
                        return data && data.username ? data.username : '-';
                    }
                },
                { 
                    data: 'jumlah_produk',
                    defaultContent: '0'
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
                        return data ? moment(data).format('DD/MM/YYYY HH:mm:ss') : '-';
                    }
                },
                {
                    data: null,
                    orderable: false,
                    render: function(data, type, row) {
                        const userRole = getUserRole();
                        let buttons = `
                            <button class="btn btn-info btn-sm" onclick="showDetailPenjualan('${row.id_details}')">
                                <i class="fas fa-eye"></i> Detail
                            </button>
                        `;
                        
                        if (userRole === 'admin' || userRole === 'owner') {
                            buttons += `
                                <button class="btn btn-danger btn-sm ml-1" onclick="deletePenjualan('${row.id_penjualan}')">
                                    <i class="fas fa-trash"></i> Hapus
                                </button>
                            `;
                        }
                        
                        return buttons;
                    }
                }
            ],
            order: [[0, 'desc']],
            language: {
                processing: "Memproses...",
                search: "Cari:",
                lengthMenu: "Tampilkan _MENU_ data",
                info: "Menampilkan _START_ sampai _END_ dari _TOTAL_ data",
                infoEmpty: "Menampilkan 0 sampai 0 dari 0 data",
                infoFiltered: "(disaring dari _MAX_ data keseluruhan)",
                infoPostFix: "",
                loadingRecords: "Memuat...",
                zeroRecords: "Tidak ditemukan data yang sesuai",
                emptyTable: "Tidak ada data yang tersedia",
                paginate: {
                    first: "Pertama",
                    previous: "Sebelumnya",
                    next: "Selanjutnya",
                    last: "Terakhir"
                },
                aria: {
                    sortAscending: ": aktifkan untuk mengurutkan kolom ke atas",
                    sortDescending: ": aktifkan untuk mengurutkan kolom ke bawah"
                }
            }
        });
    } catch (error) {
        console.error('Error initializing DataTable:', error);
    }
}

// Load product options
async function loadProdukOptions() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('No token found');
        }

        const response = await fetch('http://localhost:8080/produk/getallproduk', {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();
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
            jumlah_produk: products.length,
            subtotal: parseInt(total),
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
                    total_pendapatan: parseInt(product.harga_produk) * parseInt(product.jumlah_produk)
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
                jumlah_produk: jumlahProduk,
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
    
    // Load product options for the new select
    const newSelect = $('#produkContainer .produk-item:last-child .select-produk');
    loadProdukOptions();
}

// Reset form
function resetForm() {
    $('#produkContainer').empty();
    addProductRow();
    updateTotal();
}

// Event handlers
$(document).ready(function() {
    // Add first product row
    loadProdukOptions();
    
    // Add product button click handler
    $('#btnTambahProduk').click(addProductRow);
    
    // Remove product button click handler
    $(document).on('click', '.btn-remove-produk', function() {
        if ($('.produk-item').length > 1) {
            $(this).closest('.produk-item').remove();
            updateTotal();
        } else {
            alert('Minimal harus ada satu produk!');
        }
    });
    
    // Quantity change handler
    $(document).on('input', '.quantity', updateTotal);
    
    // Product selection change handler
    $(document).on('change', '.select-produk', updateTotal);
    
    // Fill seller name when modal opens
    $('#modal-tambah-penjualan').on('show.bs.modal', function() {
        const userData = JSON.parse(localStorage.getItem('userData'));
        if (userData && userData.username) {
            $('#namaPenjual').val(userData.username);
        }
        // Reset form when modal opens
        resetForm();
        // Add first product row
        addProductRow();
    });

    // Auto refresh table every 30 seconds
    setInterval(function() {
        if (penjualanTable) {
            penjualanTable.ajax.reload(null, false);
        }
    }, 30000);

    // Save button click handler
    $('#btnSimpanPenjualan').click(async function() {
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

            const penjualanRequests = products.map(product => ({
                penjualan: {
                    user: {
                        username: userData.username
                    },
                    tanggal_penjualan: new Date().toISOString(),
                    jumlah_produk: product.jumlah_produk,
                    subtotal: product.subtotal,
                    total: product.subtotal,
                    updated_at: new Date().toISOString()
                },
                produk: {
                    id_produk: product.id_produk,
                    nama_produk: product.nama_produk,
                    harga_produk: product.harga_produk
                }
            }));

            // Create penjualan
            const response = await fetch('http://localhost:8080/penjualan/create', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(penjualanRequests)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to save sale');
            }

            const responsePenjualan = await response.json();
            if (!responsePenjualan.data || !responsePenjualan.data.length) {
                throw new Error('No sale data returned from server');
            }

            alert('Data penjualan berhasil disimpan');
            $('#modal-tambah-penjualan').modal('hide');
            
            // Reload table immediately after successful save
            if (penjualanTable) {
                penjualanTable.ajax.reload();
            }

            // Reset form
            resetForm();
            
        } catch (error) {
            console.error('Error saving penjualan:', error);
            if (error.message.includes('401') || error.message.includes('Unauthorized')) {
                alert('Sesi login telah berakhir. Silakan login kembali.');
                localStorage.clear();
                window.location.href = '../login.html';
            } else {
                alert('Error saving penjualan: ' + error.message);
            }
        }
    });

    // Show detail penjualan
    async function showDetailPenjualan(id_details) {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                alert('Sesi login telah berakhir. Silakan login kembali.');
                localStorage.clear();
                window.location.href = '../login.html';
                return;
            }

            // Get penjualan data
            const response = await fetch(`http://localhost:8080/penjualan/by-id/${id_penjualan}`, {
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch sale data');
            }

            const penjualanData = await response.json();
            if (!penjualanData.data) {
                throw new Error('Sale data not found');
            }

            const penjualan = penjualanData.data;

            // Get detail penjualan
            const detailResponse = await fetch(`http://localhost:8080/detail-penjualan/by-id/${id_details}`, {
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            });

            if (!detailResponse.ok) {
                throw new Error('Failed to fetch sale details');
            }

            const detailData = await detailResponse.json();
            const details = detailData.data || [];

            // Update modal content
            $('#detail-id-penjualan').text(penjualan.id_penjualan);
            $('#detail-nama-penjual').text(penjualan.User.username);
            $('#detail-tanggal-penjualan').text(formatDate(penjualan.tanggal_penjualan));
            $('#detail-jumlah-produk').text(penjualan.jumlah_produk);
            $('#detail-total').text(formatRupiah(penjualan.total));

            // Clear and populate product details table
            const tbody = $('#tabel-detail-produk tbody');
            tbody.empty();

            details.forEach(detail => {
                tbody.append(`
                    <tr>
                        <td>${detail.produk.nama_produk}</td>
                        <td>${formatRupiah(detail.produk.harga_produk)}</td>
                        <td>${detail.produk.stok}</td>
                        <td>${formatRupiah(detail.total_pendapatan)}</td>
                    </tr>
                `);
            });

            // Show modal
            $('#modal-detail-penjualan').modal('show');
        } catch (error) {
            console.error('Error showing sale details:', error);
            alert('Gagal menampilkan detail penjualan: ' + error.message);
        }
    }

    // Delete penjualan
    async function deletePenjualan(id_penjualan) {
        try {
            if (!confirm('Apakah Anda yakin ingin menghapus data penjualan ini?')) {
                return;
            }

            const token = localStorage.getItem('token');
            if (!token) {
                alert('Sesi login telah berakhir. Silakan login kembali.');
                localStorage.clear();
                window.location.href = '../login.html';
                return;
            }

            // Delete detail penjualan first
            const detailResponse = await fetch(`http://localhost:8080/detail-penjualan/delete/${id_details}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            });

            if (!detailResponse.ok) {
                throw new Error('Failed to delete sale details');
            }

            // Then delete penjualan
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
            console.error('Error deleting sale:', error);
            alert('Gagal menghapus data penjualan: ' + error.message);
        }
    }

    // Format date
    function formatDate(dateString) {
        const options = { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return new Date(dateString).toLocaleDateString('id-ID', options);
    }

    // Initialize DataTable
    let penjualanTable;
    $(document).ready(function() {
        const token = localStorage.getItem('token');
        if (!token) {
            alert('Sesi login telah berakhir. Silakan login kembali.');
            localStorage.clear();
            window.location.href = '../login.html';
            return;
        }

        penjualanTable = $('#tabel-penjualan').DataTable({
            ajax: {
                url: 'http://localhost:8080/penjualan/getall',
                headers: {
                    'Authorization': 'Bearer ' + token
                },
                dataSrc: 'data'
            },
            columns: [
                { 
                    data: null,
                    render: function(data, type, row, meta) {
                        return meta.row + 1;
                    }
                },
                { data: 'id_penjualan' },
            { data: 'User.username' },
                { 
                    data: 'tanggal_penjualan',
                    render: function(data) {
                        return formatDate(data);
                    }
                },
                { data: 'jumlah_produk' },
                { 
                    data: 'total',
                    render: function(data) {
                        return formatRupiah(data);
                    }
                },
                {
                    data: null,
                    render: function(data) {
                        return `
                            <button class="btn btn-info btn-sm" onclick="showDetailPenjualan('${data.id_penjualan}')">
                                <i class="fas fa-eye"></i> Detail
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="deletePenjualan('${data.id_penjualan}')">
                                <i class="fas fa-trash"></i> Hapus
                            </button>
                        `;
                    }
                }
            ],
            order: [[1, 'desc']]
        });
    });
});
