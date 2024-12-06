// Inisialisasi DataTable
let table;

$(document).ready(function() {
    // Check authentication
    if (!checkAuth()) return;

    // Initialize Select2
    $('.select2').select2({
        theme: 'bootstrap4'
    });

    // Initialize DataTable
    table = $('#tabelPenjualan').DataTable({
        responsive: true,
        lengthChange: false,
        autoWidth: false,
        language: {
            url: '../vendor/datatables/Indonesian.json'
        }
    });

    // Load initial data
    loadPenjualan();
    loadProdukOptions();

    // Event listeners
    $('#btnTambahProduk').click(addProdukRow);
    $('#btnSimpanPenjualan').click(savePenjualan);
    
    // Event delegation for dynamic elements
    $(document).on('click', '.btn-remove-produk', function() {
        $(this).closest('.produk-item').remove();
        calculateTotal();
    });

    $(document).on('change', '.select-produk, .quantity', function() {
        const row = $(this).closest('.produk-item');
        updateSubtotal(row);
    });

    // Reset form when modal is hidden
    $('#modal-tambah-penjualan').on('hidden.bs.modal', function() {
        resetForm();
    });
});

// Format number to Rupiah
function formatRupiah(number) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR'
    }).format(number);
}

// Load all penjualan data
async function loadPenjualan() {
    try {
        const response = await fetch('http://localhost:8080/penjualan/getall', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        const result = await response.json();

        if (result.success && result.data) {
            table.clear();
            result.data.forEach(penjualan => {
                table.row.add([
                    penjualan.id_penjualan,
                    penjualan.nama_penjual,
                    moment(penjualan.tanggal).format('DD/MM/YYYY HH:mm'),
                    formatRupiah(penjualan.total),
                    `<div class="btn-group">
                        <button type="button" class="btn btn-info btn-sm" onclick="showDetail('${penjualan.id_penjualan}')">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button type="button" class="btn btn-danger btn-sm" onclick="deletePenjualan('${penjualan.id_penjualan}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>`
                ]);
            });
            table.draw();
        }
    } catch (error) {
        console.error('Error loading penjualan:', error);
        Swal.fire('Error', 'Gagal memuat data penjualan', 'error');
    }
}

// Load product options for select
async function loadProdukOptions() {
    try {
        const response = await fetch('http://localhost:8080/produk/getall', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        const result = await response.json();

        if (result.success && result.data) {
            const options = result.data
                .filter(produk => !produk.is_deleted)
                .map(produk => `<option value="${produk.id_produk}" data-harga="${produk.harga}" data-stok="${produk.stok_barang}">
                    ${produk.nama_produk} (Stok: ${produk.stok_barang})
                </option>`).join('');

            $('.select-produk').each(function() {
                const currentVal = $(this).val();
                $(this).html('<option value="">Pilih Produk</option>' + options);
                if (currentVal) $(this).val(currentVal).trigger('change');
            });
        }
    } catch (error) {
        console.error('Error loading products:', error);
        Swal.fire('Error', 'Gagal memuat data produk', 'error');
    }
}

// Add new product row
function addProdukRow() {
    const newRow = `
        <div class="row mb-3 produk-item">
            <div class="col-md-5">
                <select class="form-control select2 select-produk" style="width: 100%;" required>
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
    $('.select2').select2({
        theme: 'bootstrap4'
    });
}

// Update subtotal for a row
function updateSubtotal(row) {
    const selectProduk = row.find('.select-produk');
    const quantity = row.find('.quantity');
    const subtotalInput = row.find('.subtotal');
    
    if (selectProduk.val() && quantity.val()) {
        const harga = parseFloat(selectProduk.find(':selected').data('harga'));
        const stok = parseInt(selectProduk.find(':selected').data('stok'));
        const qty = parseInt(quantity.val());

        if (qty > stok) {
            Swal.fire('Error', 'Jumlah melebihi stok yang tersedia', 'error');
            quantity.val(stok);
            return updateSubtotal(row);
        }

        const subtotal = harga * qty;
        subtotalInput.val(formatRupiah(subtotal));
    } else {
        subtotalInput.val('');
    }
    calculateTotal();
}

// Calculate total from all subtotals
function calculateTotal() {
    let total = 0;
    $('.subtotal').each(function() {
        const value = $(this).val().replace(/[^\d]/g, '');
        if (value) total += parseInt(value);
    });
    $('#totalPenjualan').val(formatRupiah(total));
}

// Save new penjualan
async function savePenjualan() {
    try {
        const namaPenjual = $('#namaPenjual').val();
        if (!namaPenjual) {
            return Swal.fire('Error', 'Nama penjual harus diisi', 'error');
        }

        const produkItems = [];
        let isValid = true;

        $('.produk-item').each(function() {
            const idProduk = $(this).find('.select-produk').val();
            const quantity = $(this).find('.quantity').val();

            if (!idProduk || !quantity) {
                isValid = false;
                return false;
            }

            produkItems.push({
                id_produk: idProduk,
                quantity: parseInt(quantity)
            });
        });

        if (!isValid || produkItems.length === 0) {
            return Swal.fire('Error', 'Semua field produk harus diisi', 'error');
        }

        const response = await fetch('http://localhost:8080/penjualan/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                nama_penjual: namaPenjual,
                produk: produkItems
            })
        });

        const result = await response.json();
        if (result.success) {
            Swal.fire('Sukses', 'Penjualan berhasil disimpan', 'success');
            $('#modal-tambah-penjualan').modal('hide');
            loadPenjualan();
            loadProdukOptions();
        } else {
            throw new Error(result.message || 'Gagal menyimpan penjualan');
        }
    } catch (error) {
        console.error('Error saving penjualan:', error);
        Swal.fire('Error', error.message || 'Gagal menyimpan penjualan', 'error');
    }
}

// Show penjualan detail
async function showDetail(id) {
    try {
        const response = await fetch(`http://localhost:8080/penjualan/getbyid/${id}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        const result = await response.json();

        if (result.success && result.data) {
            const penjualan = result.data;
            
            $('#detailIdPenjualan').text(penjualan.id_penjualan);
            $('#detailNamaPenjual').text(penjualan.nama_penjual);
            $('#detailTanggal').text(moment(penjualan.tanggal).format('DD/MM/YYYY HH:mm'));
            $('#detailTotal').text(formatRupiah(penjualan.total));

            let produkHtml = '';
            penjualan.produk.forEach(item => {
                produkHtml += `
                    <tr>
                        <td>${item.nama_produk}</td>
                        <td>${item.quantity}</td>
                        <td>${formatRupiah(item.harga)}</td>
                        <td>${formatRupiah(item.quantity * item.harga)}</td>
                    </tr>
                `;
            });
            $('#detailProdukList').html(produkHtml);

            $('#modal-detail-penjualan').modal('show');
        }
    } catch (error) {
        console.error('Error loading penjualan detail:', error);
        Swal.fire('Error', 'Gagal memuat detail penjualan', 'error');
    }
}

// Delete penjualan
async function deletePenjualan(id) {
    try {
        const result = await Swal.fire({
            title: 'Konfirmasi Hapus',
            text: "Apakah Anda yakin ingin menghapus penjualan ini?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Ya, Hapus!',
            cancelButtonText: 'Batal'
        });

        if (result.isConfirmed) {
            const response = await fetch(`http://localhost:8080/penjualan/delete/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const result = await response.json();
            if (result.success) {
                Swal.fire('Sukses', 'Penjualan berhasil dihapus', 'success');
                loadPenjualan();
                loadProdukOptions();
            } else {
                throw new Error(result.message || 'Gagal menghapus penjualan');
            }
        }
    } catch (error) {
        console.error('Error deleting penjualan:', error);
        Swal.fire('Error', error.message || 'Gagal menghapus penjualan', 'error');
    }
}

// Reset form
function resetForm() {
    $('#formTambahPenjualan')[0].reset();
    $('#produkContainer').html(`
        <div class="row mb-3 produk-item">
            <div class="col-md-5">
                <select class="form-control select2 select-produk" style="width: 100%;" required>
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
    `);
    loadProdukOptions();
    $('.select2').select2({
        theme: 'bootstrap4'
    });
}
