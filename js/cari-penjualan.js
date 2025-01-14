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
            { data: 'username' },
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

    // View sale details handler
    $(document).on('click', '.view-btn', function() {
        const saleId = $(this).data('id');
        showDetailPenjualan(saleId);
    });
    
    // Event delegation for dynamic buttons
    $('#tabelPenjualan').on('click', '.view-btn', function() {
        const id = $(this).data('id');
        showDetailPenjualan(id);
    });

    // Helper function to get selected products
    function getSelectedProducts() {
        const products = [];
        $('.produk-item').each(function() {
            const row = $(this);
            const select = row.find('.select-produk');
            const selectedOption = select.find('option:selected');
            const productId = select.val();
            const quantity = parseInt(row.find('.quantity').val()) || 0;
            const price = parseInt(selectedOption.data('harga_produk')) || 0;
            
            if (productId && quantity > 0 && price > 0) {
                products.push({
                    id_produk: productId,
                    jumlah_produk: quantity,
                    harga_produk: price,
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

    // View sale details handler
    $(document).on('click', '.view-btn', function() {
        const saleId = $(this).data('id');
        showDetailPenjualan(saleId);
    });

        } catch (error) {
            console.error('Error loading penjualan:', error);
            alert('Gagal memuat data penjualan');
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
                    `Rp ${formatRupiah(product.harga_produk)}`,
                    product.stok_barang
                ]),
                startY: 20
            });
            doc.save('laporan_produk.pdf');
            break;

        case 'penjualan':
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
            
            doc.save('laporan_penjualan.pdf');
            break;
    }
}
// Fungsi format Rupiah
function formatRupiah(angka) {
    return new Intl.NumberFormat('id-ID').format(angka);
}