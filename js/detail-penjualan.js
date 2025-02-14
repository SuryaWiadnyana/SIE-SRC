$(document).ready(function() {
    // Check authentication
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '../login.html';
        return;
    }

    // Get ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id_details');
    
    if (!id) {
        showNotification('error', 'ID Detail Penjualan tidak ditemukan');
        return;
    }

    // Initialize DataTable
    const table = $('#tabelDetailPenjualan').DataTable({
        responsive: true,
        searching: false,
        paging: false,
        info: false,
        language: {
            url: '//cdn.datatables.net/plug-ins/1.13.7/i18n/id.json',
            emptyTable: "Tidak ada data produk"
        }
    });

    // Load detail penjualan
    loadDetailPenjualan(id);

    // Function to load detail penjualan
    async function loadDetailPenjualan(id) {
        try {
            const response = await $.ajax({
                url: `http://localhost:8080/detail-penjualan/by-id/${id}`,
                type: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            });

            if (response.data) {
                const detail = response.data;
                console.log('Detail data:', detail); // For debugging
                
                // Update info penjualan
                $('#id_details').text(detail.id_details || '-');
                
                if (detail.penjualan) {
                    $('#id_penjualan').text(detail.penjualan.id_penjualan || '-');
                    
                    if (detail.penjualan.user) {
                        $('#id_user').text(detail.penjualan.user.id_user || '-');
                        $('#username').text(detail.penjualan.user.username || '-');
                        $('#role').text(detail.penjualan.user.role || '-');
                    } else {
                        console.log('User data not found in penjualan');
                    }
                    
                    // Handle tanggal_penjualan
                    if (detail.penjualan.tanggal_penjualan) {
                        let tanggal = detail.penjualan.tanggal_penjualan;
                        // Check if it's a MongoDB date object
                        if (tanggal.$date) {
                            tanggal = tanggal.$date;
                        }
                        $('#tanggal_penjualan').text(moment(tanggal).format('DD/MM/YYYY HH:mm:ss'));
                    } else {
                        $('#tanggal_penjualan').text('-');
                    }

                    $('#jumlah_produk').text(detail.penjualan.jumlah_produk || '0');
                    $('#total').text('Rp ' + formatRupiah(detail.penjualan.total || 0));
                    
                    // Handle updated_at
                    if (detail.penjualan.updated_at) {
                        let updatedAt = detail.penjualan.updated_at;
                        if (updatedAt.$date) {
                            updatedAt = updatedAt.$date;
                        }
                        $('#updated_at').text(moment(updatedAt).format('DD/MM/YYYY HH:mm:ss'));
                    } else {
                        $('#updated_at').text('-');
                    }
                } else {
                    console.log('Penjualan data not found in detail');
                }

                $('#total_pendapatan').text('Rp ' + formatRupiah(detail.total_pendapatan || 0));

                // Clear existing table rows
                table.clear();

                // Add product details
                if (detail.produk) {
                    console.log('Product data:', detail.produk); // Debug product data
                    table.row.add([
                        detail.produk.id_produk || detail.produk.id_produk || '-',
                        detail.produk.nama_produk || '-',
                        'Rp ' + formatRupiah(detail.produk.harga_produk || 0),
                        detail.penjualan ? detail.penjualan.jumlah_produk || 0 : 0,
                        'Rp ' + formatRupiah(detail.total_pendapatan || 0)
                    ]).draw();
                } else {
                    console.log('Product data not found in detail');
                    table.row.add(['-', '-', 'Rp 0', 0, 'Rp 0']).draw();
                }
            } else {
                showNotification('error', 'Data detail penjualan tidak ditemukan');
            }
        } catch (error) {
            console.error('Error:', error);
            showNotification('error', 'Gagal memuat detail penjualan');
        }
    }

    // Helper function to format currency
    function formatRupiah(angka) {
        return new Intl.NumberFormat('id-ID').format(angka);
    }

    // Function to show notifications
    function showNotification(type, message) {
        toastr[type](message, '', {
            closeButton: true,
            tapToDismiss: false,
            timeOut: 3000
        });
    }

    // Button to go back to penjualan list
    $('#btnKembali').on('click', function() {
        window.location.href = 'penjualan.html';
    });
});
