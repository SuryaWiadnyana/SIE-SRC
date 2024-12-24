// Inisialisasi DataTable
let table;

$(document).ready(function() {
    // Check authentication
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '../login.html';
        return;
    }

    // Initialize DataTable
    table = $('#tabelPenjualan').DataTable({
        ajax: {
            url: 'http://localhost:8080/penjualan/getall',
            type: 'GET',
            headers: {
                'Authorization': 'Bearer ' + token
            },
            dataSrc: function(response) {
                // Jika data null, kembalikan array kosong
                if (!response.data) {
                    return [];
                }
                // Kembalikan array data dan urutkan berdasarkan tanggal
                return Array.isArray(response.data) ? response.data.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal)) : [];
            },
            error: function(xhr, error, thrown) {
                console.error('Error:', error);
                showNotification('error', 'Gagal memuat data penjualan');
            }
        },
        columns: [
            { 
                data: null,
                render: function (data, type, row, meta) {
                    return meta.row + 1;
                }
            },
            { data: 'id_penjualan' },
            { data: 'nama_penjual' },
            { 
                data: 'total',
                render: function(data) {
                    return 'Rp ' + formatRupiah(data);
                }
            },
            {   
                data: 'tanggal',
                render: function(data) {
                    return moment(data).format('DD/MM/YYYY HH:mm:ss');
                }
            },
            {
                data: null,
                className: 'text-center',
                orderable: false,
                render: function(data, type, row) {
                    return `
                        <div class="btn-group" role="group">
                            <button class="btn btn-info btn-sm btn-detail" data-id="${row.id_penjualan}">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-danger btn-sm btn-delete" data-id="${row.id_penjualan}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    `;
                }
            }
        ],
        order: [[4, 'desc']], // Sort by date column (index 4) descending
        responsive: true,
        language: {
            emptyTable: "Tidak ada data penjualan",
            info: "Menampilkan _START_ sampai _END_ dari _TOTAL_ data",
            infoEmpty: "Menampilkan 0 sampai 0 dari 0 data",
            infoFiltered: "(difilter dari _MAX_ total data)",
            lengthMenu: "Tampilkan _MENU_ data per halaman",
            loadingRecords: "Memuat...",
            processing: "Memproses...",
            search: "Cari:",
            zeroRecords: "Data tidak ditemukan",
            paginate: {
                first: "Pertama",
                last: "Terakhir",
                next: "Selanjutnya",
                previous: "Sebelumnya"
            }
        }
    });

    // Event handler untuk tombol detail dan delete
    $('#tabelPenjualan tbody').on('click', '.btn-detail', function() {
        const id = $(this).data('id');
        window.location.href = `detail-penjualan.html?id=${id}`;
    });

    $('#tabelPenjualan tbody').on('click', '.btn-delete', function() {
        const id = $(this).data('id');
        confirmDelete(id);
    });

    // Event handler untuk form
    $('#formTambahPenjualan').on('submit', function(e) {
        e.preventDefault(); // Mencegah form submit otomatis
    });

    // Event handler untuk tombol Simpan
    $('#btnSimpanPenjualan').on('click', function() {
        savePenjualan();
    });

    // Event handler untuk quantity
    $(document).on('input', '.quantity', function() {
        const row = $(this).closest('.produk-item');
        updateSubtotal(row);
    });

    // Event handler untuk tombol hapus produk
    $(document).on('click', '.btn-remove-produk', function() {
        $(this).closest('.produk-item').remove();
        calculateTotal();
    });

    // Event handler untuk tombol tambah produk
    $('#btnTambahProduk').on('click', function() {
        addProdukRow();
    });

    // Delete sale handler
    $(document).on('click', '.delete-btn', async function() {
        const saleId = $(this).data('id');
        
        if (confirm('Apakah Anda yakin ingin menghapus data penjualan ini?')) {
            try {
                const response = await fetch(`http://localhost:8080/penjualan/${saleId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Gagal menghapus data penjualan');
                }

                table.ajax.reload();
                showNotification('success', 'Data penjualan berhasil dihapus');

            } catch (error) {
                console.error('Error deleting sale:', error);
                showNotification('error', 'Gagal menghapus data penjualan');
            }
        }
    });

    // View sale details handler
    $(document).on('click', '.view-btn', function() {
        const saleId = $(this).data('id');
        showDetailPenjualan(saleId);
    });

    // Load product options
    loadProdukOptions();

    // Initialize event handlers
    $('#btnTambahProduk').on('click', addProdukRow);
    
    // Event delegation for dynamic buttons
    $('#tabelPenjualan').on('click', '.view-btn', function() {
        const id = $(this).data('id');
        showDetailPenjualan(id);
    });

    $('#tabelPenjualan').on('click', '.delete-btn', function() {
        const id = $(this).data('id');
        if (confirm('Apakah Anda yakin ingin menghapus data penjualan ini?')) {
            deletePenjualan(id);
        }
    });

    // Calculate subtotal for a row
    function updateSubtotal(row) {
        const select = row.find('.select-produk');
        const quantityInput = row.find('.quantity');
        const subtotalInput = row.find('.subtotal');
        
        const selectedOption = select.find('option:selected');
        const price = parseInt(selectedOption.data('harga')) || 0;
        const quantity = parseInt(quantityInput.val()) || 0;
        
        if (price && quantity) {
            const subtotal = price * quantity;
            subtotalInput.val('Rp ' + formatRupiah(subtotal));
        } else {
            subtotalInput.val('');
        }
        calculateTotal();
    }

    // Calculate total from all subtotals
    function calculateTotal() {
        let total = 0;
        $('.produk-item').each(function() {
            const row = $(this);
            const select = row.find('.select-produk');
            const quantity = parseInt(row.find('.quantity').val()) || 0;
            const selectedOption = select.find('option:selected');
            const price = parseInt(selectedOption.data('harga')) || 0;
            
            if (quantity && price) {
                total += quantity * price;
            }
        });
        $('#totalPenjualan').val('Rp ' + formatRupiah(total));
        return total;
    }

    // Helper function to get selected products
    function getSelectedProducts() {
        const products = [];
        $('.produk-item').each(function() {
            const row = $(this);
            const select = row.find('.select-produk');
            const selectedOption = select.find('option:selected');
            const productId = select.val();
            const quantity = parseInt(row.find('.quantity').val()) || 0;
            const price = parseInt(selectedOption.data('harga')) || 0;
            
            if (productId && quantity > 0 && price > 0) {
                products.push({
                    id_produk: productId,
                    jumlah_produk: quantity,
                    harga: price,
                    subtotal: quantity * price
                });
            }
        });
        return products;
    }

    // Load all penjualan data
    let penjualanTable;
    async function loadPenjualan() {
        try {
            // Destroy existing DataTable if it exists
            if ($.fn.DataTable.isDataTable('#tabelPenjualan')) {
                $('#tabelPenjualan').DataTable().destroy();
            }
            
            // Clear the table body
            $('#tabelPenjualan tbody').empty();
            
            // Initialize new DataTable
            penjualanTable = $('#tabelPenjualan').DataTable({
                ajax: {
                    url: 'http://localhost:8080/penjualan/getall',
                    type: 'GET',
                    headers: {
                        'Authorization': 'Bearer ' + token
                    },
                    dataSrc: 'data',
                    error: function(xhr, error, thrown) {
                        console.error('Error loading data:', error, thrown);
                        alert('Gagal memuat data penjualan. Silakan coba lagi.');
                    }
                },
                columns: [
                    { 
                        data: null,
                        render: function (data, type, row, meta) {
                            return meta.row + 1;
                        }
                    },
                    { data: 'nama_penjual' },
                    { 
                        data: 'total',
                        render: function(data) {
                            return 'Rp ' + formatRupiah(data);
                        }
                    },
                    {   
                        data: 'tanggal',
                        render: function(data) {
                            return moment(data).format('DD/MM/YYYY HH:mm:ss');
                        }
                    },
                    {
                        data: null,
                        render: function(data, type, row) {
                            return `
                                <button class="btn btn-info btn-sm btn-detail" data-id="${row.id_penjualan}">
                                    <i class="fas fa-eye"></i>
                                </button>
                                <button class="btn btn-danger btn-sm btn-delete" data-id="${row.id_penjualan}">
                                    <i class="fas fa-trash"></i>
                                </button>
                            `;
                        }
                    }
                ],
                order: [[3, 'desc']], // Sort by tanggal column descending
                responsive: true,
                language: {
                    emptyTable: "Tidak ada data penjualan",
                    info: "Menampilkan _START_ sampai _END_ dari _TOTAL_ data",
                    infoEmpty: "Menampilkan 0 sampai 0 dari 0 data",
                    infoFiltered: "(difilter dari _MAX_ total data)",
                    lengthMenu: "Tampilkan _MENU_ data per halaman",
                    loadingRecords: "Memuat...",
                    processing: "Memproses...",
                    search: "Cari:",
                    zeroRecords: "Data tidak ditemukan",
                    paginate: {
                        first: "Pertama",
                        last: "Terakhir",
                        next: "Selanjutnya",
                        previous: "Sebelumnya"
                    }
                }
            });

            // Add event handlers for detail and delete buttons
            $('#tabelPenjualan').on('click', '.btn-detail', function() {
                const id = $(this).data('id');
                window.location.href = `detail-penjualan.html?id=${id}`;
            });

            $('#tabelPenjualan').on('click', '.btn-delete', function() {
                const id = $(this).data('id');
                if (confirm('Apakah Anda yakin ingin menghapus data ini?')) {
                    deletePenjualan(id);
                }
            });

        } catch (error) {
            console.error('Error loading penjualan:', error);
            alert('Gagal memuat data penjualan');
        }
    }

    // Save new penjualan
    async function savePenjualan() {
        const namaPenjual = $('#namaPenjual').val().trim();
        const products = getSelectedProducts();
        const total = calculateTotal();

        // Validasi input
        if (!namaPenjual) {
            alert('Nama penjual harus diisi!');
            return;
        }

        if (products.length === 0) {
            alert('Minimal satu produk harus dipilih!');
            return;
        }

        // Format data sesuai dengan yang diharapkan API
        const penjualanData = [{
            nama_penjual: namaPenjual,
            tanggal: new Date().toISOString(),
            produk: products.map(p => ({
                id_produk: p.id_produk,
                nama_produk: $(`select option[value='${p.id_produk}']`).text(),
                jumlah_produk: p.jumlah_produk,
                harga: p.harga,
                subtotal: p.subtotal
            })),
            total: total,
            updated_at: new Date().toISOString()
        }];

        try {
            console.log('Sending data:', JSON.stringify(penjualanData, null, 2));
            
            const response = await $.ajax({
                url: 'http://localhost:8080/penjualan/create',
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                },
                data: JSON.stringify(penjualanData)
            });

            console.log('Response:', response);

            // Periksa apakah response mengandung pesan sukses
            if (response.message && response.message.includes('successfully')) {
                alert('Data penjualan berhasil disimpan');
                $('#modal-tambah-penjualan').modal('hide');
                resetForm();
                
                // Refresh table safely
                if (penjualanTable) {
                    penjualanTable.ajax.reload();
                } else {
                    loadPenjualan();
                }
            } else {
                throw new Error(response.message || 'Unknown error');
            }
        } catch (error) {
            console.error('Error saving penjualan:', error);
            alert('Gagal menyimpan data penjualan: ' + (error.message || 'Silakan coba lagi.'));
        }
    }

    // Fungsi untuk menampilkan detail penjualan
    async function showDetailPenjualan(id) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:8080/penjualan/by-id/${id}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
    
            const data = await response.json();
    
            if (data.success) {
                const penjualan = data.data;
                document.getElementById('detail-id').innerText = penjualan.id_penjualan;
                document.getElementById('detail-nama').innerText = penjualan.nama_penjual;
                document.getElementById('detail-tanggal').innerText = moment(penjualan.tanggal).format('DD/MM/YYYY HH:mm:ss');
                document.getElementById('detail-total').innerText = 'Rp ' + formatRupiah(penjualan.total);
    
                const produkBody = document.getElementById('detail-produk-body');
                produkBody.innerHTML = ''; // Kosongkan isi sebelumnya
                penjualan.items.forEach(item => {
                    const row = `<tr>
                                    <td>${item.nama_produk}</td>
                                    <td>${item.jumlah}</td>
                                    <td>Rp ${formatRupiah(item.harga)}</td>
                                    <td>Rp ${formatRupiah(item.subtotal)}</td>
                                 </tr>`;
                    produkBody.innerHTML += row;
                });
    
                // Tampilkan modal
                $('#modal-detail-penjualan').modal('show');
            } else {
                alert(data.message || 'Gagal mengambil detail penjualan');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Gagal memuat detail penjualan');
        }
    }
    
    // Event handler untuk tombol detail
    $('#tabelPenjualan tbody').on('click', '.btn-detail', function() {
        const id = $(this).data('id');
        window.location.href = `detail-penjualan.html?id=${id}`;
    });

    // Fungsi untuk menghapus penjualan
    async function deletePenjualan(id) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:8080/penjualan/delete/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            // Coba parse response, jika gagal berarti ada error
            let data;
            try {
                data = await response.json();
            } catch (e) {
                // Jika response bukan JSON, kita anggap sukses karena data sudah terhapus
                alert('Data penjualan berhasil dihapus');
                $('#tabelPenjualan').DataTable().ajax.reload(null, false);
                return true;
            }
            
            // Jika berhasil parse JSON
            if (data && (data.success || response.status === 200)) {
                alert('Data penjualan berhasil dihapus');
                $('#tabelPenjualan').DataTable().ajax.reload(null, false);
                return true;
            } else {
                const message = data?.message || 'Gagal menghapus penjualan';
                alert(message);
                // Tetap refresh jika error 500 karena kemungkinan data sudah terhapus
                if (response.status === 500) {
                    $('#tabelPenjualan').DataTable().ajax.reload(null, false);
                    return true;
                }
                return false;
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Gagal menghapus penjualan');
            // Tetap refresh untuk jaga-jaga data sudah terhapus
            $('#tabelPenjualan').DataTable().ajax.reload(null, false);
            return true;
        }
    }

    // Reset form
    function resetForm() {
        // Reset nama penjual
        $('#namaPenjual').val('');
        
        // Hapus semua baris produk kecuali yang pertama
        $('.produk-item:not(:first)').remove();
        
        // Reset baris pertama
        const firstRow = $('.produk-item:first');
        firstRow.find('.select-produk').val(null).trigger('change');
        firstRow.find('.quantity').val('');
        firstRow.find('.subtotal').text('Rp 0');
        
        // Reset total
        $('#totalPenjualan').val('Rp 0');
        
        // Reinisialisasi Select2
        initializeSelect2();
    }

    // Load product options for select
    async function loadProdukOptions() {
        try {
            const response = await fetch('http://localhost:8080/produk/getallproduk', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const result = await response.json();
            console.log('Response from server:', result);

            if (result.data && Array.isArray(result.data)) {
                const produkData = result.data.filter(produk => !produk.is_deleted);
                console.log('Filtered product data:', produkData);
                
                // Hapus opsi yang ada sebelumnya
                $('.select-produk').empty().append('<option value="">Pilih Produk</option>');
                
                // Tambahkan opsi baru
                produkData.forEach(produk => {
                    const harga = parseInt(produk.harga) || 0;
                    $('.select-produk').append(`
                        <option value="${produk.id_produk}" 
                                data-harga="${harga}" 
                                data-stok="${produk.stok_barang || 0}">
                            ${produk.nama_produk} - Rp ${formatRupiah(harga)}
                        </option>
                    `);
                });

                // Inisialisasi Select2 untuk semua dropdown produk
                initializeSelect2();
            } else {
                console.error('Invalid data structure:', result);
                showNotification('error', 'Format data produk tidak valid');
            }
        } catch (error) {
            console.error('Error loading products:', error);
            showNotification('error', 'Gagal memuat data produk');
        }
    }

    // Konfigurasi Select2 global
    $.fn.select2.defaults.set('theme', 'bootstrap4');
    $.fn.select2.defaults.set('width', '100%');
    $.fn.select2.defaults.set('closeOnSelect', true);

    // Tambahkan event handler passive untuk wheel events
    jQuery.event.special.wheel = {
        setup: function( _, ns, handle ) {
            this.addEventListener("wheel", handle, { passive: true });
        }
    };

    // Fungsi untuk menampilkan notifikasi
    function showNotification(type, message) {
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true
        });

        Toast.fire({
            icon: type,
            title: message
        });
    }

    // Fungsi untuk inisialisasi Select2
    function initializeSelect2() {
        $('.select-produk').select2({
            placeholder: 'Pilih produk',
            allowClear: true,
            templateResult: formatProduk,
            templateSelection: formatProduk
        }).on('select2:select', function(e) {
            const row = $(this).closest('.produk-item');
            updateSubtotal(row);
        }).on('select2:clear', function(e) {
            const row = $(this).closest('.produk-item');
            row.find('.subtotal').val('');
            calculateTotal();
        });
    }

    // Format produk untuk Select2
    function formatProduk(data) {
        if (!data.id) return data.text;
        
        const option = $(data.element);
        const stok = option.data('stok');
        const harga = option.data('harga');
        
        return $(`
            <div class="d-flex justify-content-between">
                <span>${data.text}</span>
                <span>
                    <small class="text-muted mr-2">Stok: ${stok}</small>
                    <small class="text-muted">Harga: Rp${formatRupiah(harga)}</small>
                </span>
            </div>
        `);
    }

    // Format Rupiah
    function formatRupiah(number) {
        return new Intl.NumberFormat('id-ID').format(number);
    }

    // Add new product row
    function addProdukRow() {
        const newRow = `
            <div class="row mb-3 produk-item">
                <div class="col-md-5">
                    <select class="form-control select-produk" style="width: 100%;" required>
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
                    <button type="button" class="btn btn-danger btn-sm btn-remove-produk">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `;
        $('#produkContainer').append(newRow);

        // Inisialisasi Select2 untuk baris baru
        const $newSelect = $('.produk-item:last .select-produk');
        $newSelect.select2({
            placeholder: 'Pilih Produk',
            allowClear: true,
            templateResult: formatProduk,
            templateSelection: formatProduk
        }).on('select2:select', function(e) {
            const row = $(this).closest('.produk-item');
            updateSubtotal(row);
        }).on('select2:clear', function(e) {
            const row = $(this).closest('.produk-item');
            row.find('.subtotal').val('');
            calculateTotal();
        });

        // Salin opsi dari select pertama ke select baru
        const firstSelect = $('.produk-item:first .select-produk');
        const options = firstSelect.find('option').clone();
        $newSelect.html(options);
    }

});

function generatePDF(products, sales, reportType, startDate, endDate) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Filter data berdasarkan tanggal hanya untuk penjualan dan pendapatan
    const filteredSales = sales.filter(sale => {
        if (!startDate || !endDate) return true;
        const saleDate = new Date(sale.tanggal);
        return saleDate >= new Date(startDate) && saleDate <= new Date(endDate);
    });

    // Tentukan judul dan konten berdasarkan jenis laporan
    switch (reportType) {
        case 'produk':
            doc.text(`Laporan Produk`, 10, 10);
            doc.autoTable({
                head: [['ID Produk', 'Nama Produk', 'Harga', 'Stok']],
                body: products.map(product => [
                    product.id_produk,
                    product.nama_produk,
                    `Rp ${formatRupiah(product.harga)}`,
                    product.stok_barang
                ]),
                startY: 20
            });
            doc.save('laporan_produk.pdf');
            break;

        case 'penjualan':
            doc.text(`Laporan Penjualan (${startDate} - ${endDate})`, 10, 10);
            doc.autoTable({
                head: [['ID Penjualan', 'Nama Penjual', 'Total', 'Tanggal']],
                body: filteredSales.map(sale => [
                    sale.id_penjualan,
                    sale.nama_penjual,
                    new Date(sale.tanggal).toLocaleDateString('id-ID')
                    `Rp ${formatRupiah(sale.total)}`,
                ]),
                startY: 20
            });
            doc.save('laporan_penjualan.pdf');
            break;

        case 'pendapatan':
            const totalPendapatan = filteredSales.reduce((total, sale) => total + sale.total, 0);
            
            doc.text(`Laporan Pendapatan (${startDate} - ${endDate})`, 10, 10);
            
            doc.autoTable({
                head: [['Total Pendapatan', 'Jumlah Transaksi']],
                body: [
                    [`Rp ${formatRupiah(totalPendapatan)}`, filteredSales.length]
                ],
                startY: 20
            });

            doc.text('Detail Penjualan', 10, doc.lastAutoTable.finalY + 10);
            doc.autoTable({
                head: [['ID Penjualan', 'Nama Penjual', 'Total', 'Tanggal']],
                body: filteredSales.map(sale => [
                    sale.id_penjualan,
                    sale.nama_penjual,
                    `Rp ${formatRupiah(sale.total)}`,
                    new Date(sale.tanggal).toLocaleDateString('id-ID')
                ]),
                startY: doc.lastAutoTable.finalY + 20
            });
            
            doc.save('laporan_pendapatan.pdf');
            break;
    }
}
// Fungsi format Rupiah
function formatRupiah(angka) {
    return new Intl.NumberFormat('id-ID').format(angka);
}