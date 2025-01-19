$(document).ready(function() {
    // Check authentication
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '../login.html';
        return;
    }

    // Get ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    
    if (!id) {
        showNotification('error', 'ID Penjualan tidak ditemukan');
        return;
    }

    // Initialize DataTable
    const table = $('#tabelDetailPenjualan').DataTable({
        responsive: true,
        language: {
            url: '//cdn.datatables.net/plug-ins/1.13.7/i18n/id.json',
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
                
                // Update info penjualan
                $('#idPenjualan').text(detail.penjualan.id_penjualan);
                $('#namaPenjual').text(detail.penjualan.nama_penjual);
                $('#tanggalPenjualan').text(moment(detail.penjualan.tanggal_penjualan).format('DD/MM/YYYY HH:mm:ss'));
                $('#totalPenjualan').text('Rp ' + formatRupiah(detail.penjualan.total));

                // Clear existing table rows
                table.clear();

                // Add product details
                if (detail.produk) {
                    table.row.add([
                        detail.produk.nama_produk,
                        detail.produk.kategori,
                        detail.produk.sub_kategori,
                        'Rp ' + formatRupiah(detail.produk.harga_produk),
                        detail.produk.stok,
                        'Rp ' + formatRupiah(detail.total_pendapatan)
                    ]).draw();
                }
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
});
