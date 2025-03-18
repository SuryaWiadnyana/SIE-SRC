// Fungsi untuk menampilkan konfirmasi hapus
function showDeleteConfirmation(title, message, onConfirm) {
    // Hapus modal lama jika ada
    $('.delete-confirmation-modal').remove();

    // Buat modal baru
    const modalHtml = `
        <div class="modal fade delete-confirmation-modal" tabindex="-1" role="dialog">
            <div class="modal-dialog" role="document">
                <div class="modal-content">
                    <div class="modal-header bg-danger text-white">
                        <h5 class="modal-title">${title}</h5>
                        <button type="button" class="close text-white" data-dismiss="modal" aria-label="Close">
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                    <div class="modal-body text-center">
                        <div class="mb-4">
                            <div class="warning-triangle">
                                <i class="fas fa-exclamation-triangle text-danger" style="font-size: 64px;"></i>
                            </div>
                        </div>
                        <p class="mb-0">${message}</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-danger" id="confirmDelete">Ya</button>
                        <button type="button" class="btn btn-secondary" data-dismiss="modal" autofocus>Tidak</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Tambahkan modal ke body
    $('body').append(modalHtml);

    // Tambahkan CSS untuk animasi warning triangle
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        .warning-triangle {
            animation: warning-shake 0.5s ease-in-out;
        }
        @keyframes warning-shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
        }
    `;
    document.head.appendChild(styleElement);

    // Dapatkan referensi modal
    const modal = $('.delete-confirmation-modal');

    // Handler untuk tombol konfirmasi
    $('#confirmDelete').on('click', function() {
        modal.modal('hide');
        onConfirm();
    });

    // Handler untuk tombol close dan tidak
    modal.find('[data-dismiss="modal"]').on('click', function() {
        modal.modal('hide');
    });

    // Tampilkan modal
    modal.modal('show');

    // Fokus ke tombol "Tidak" saat modal dibuka
    modal.on('shown.bs.modal', function() {
        modal.find('.btn-secondary').focus();
    });

    // Bersihkan modal dan style saat ditutup
    modal.on('hidden.bs.modal', function() {
        styleElement.remove();
        modal.remove();
    });
}
