// Initialize jsPDF
window.jsPDF = window.jspdf.jsPDF;

// Definisi API_URL sebagai variabel global
const API_URL = "http://localhost:8080";

document.addEventListener("DOMContentLoaded", function () {
    // Check authentication
    const token = localStorage.getItem("token");
    if (!token) {
        window.location.href = "../login.html";
        return;
    }

    // Set username
    const username = localStorage.getItem("username");
    if (username) {
        document.getElementById("username").textContent = username;
    }

    // Logout handler
    document.getElementById("logoutButton").addEventListener("click", function() {
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        window.location.href = "../login.html";
    });

    // Set tanggal default untuk filter
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    document.getElementById("startDate").value = firstDayOfMonth.toISOString().split('T')[0];
    document.getElementById("endDate").value = today.toISOString().split('T')[0];

    // Load kategori untuk filter
    loadKategori();
    
    // Event listeners
    document.getElementById("reportType").addEventListener("change", updateSortingOptions);
    document.getElementById("kategoriFilter").addEventListener("change", function() {
        loadSubkategori(this.value);
    });

    // Set opsi sorting awal
    updateSortingOptions();
});

// Format currency to IDR
function formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

// Format date to DD-MM-YYYY
function formatDate(date) {
    if (!date) return '';
    try {
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
    } catch (error) {
        console.error('Error formatting date:', error);
        return '';
    }
}

// Fungsi untuk memuat kategori
async function loadKategori() {
    try {
        const token = localStorage.getItem("token");
        const response = await fetch(`${API_URL}/kategori/getall`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load categories');
        }

        const responseData = await response.json();
        const data = responseData.data || [];
        
        if (!Array.isArray(data)) {
            throw new Error('Invalid data format received from server');
        }

        const kategoriSelect = document.getElementById("kategoriFilter");
        
        // Clear existing options except the first one
        while (kategoriSelect.options.length > 1) {
            kategoriSelect.remove(1);
        }

        // Add new options
        data.forEach(kategori => {
            const option = new Option(kategori.nama_kategori, kategori.id_kategori);
            kategoriSelect.add(option);
        });

    } catch (error) {
        console.error("Error loading categories:", error);
        alert("Gagal memuat data kategori");
    }
}

// Fungsi untuk memuat subkategori
async function loadSubkategori(kategoriId) {
    const subkategoriSelect = document.getElementById("subkategoriFilter");
    
    // Reset subkategori options
    while (subkategoriSelect.options.length > 1) {
        subkategoriSelect.remove(1);
    }

    if (!kategoriId) {
        return;
    }

    try {
        const token = localStorage.getItem("token");
        const response = await fetch(`${API_URL}/subkategori/getall`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load subcategories');
        }

        const responseData = await response.json();
        const data = responseData.data || [];

        if (!Array.isArray(data)) {
            throw new Error('Invalid data format received from server');
        }
        
        // Filter and add subcategories for selected category
        data.filter(subkategori => 
            subkategori.kategori && 
            subkategori.kategori.id_kategori === kategoriId
        ).forEach(subkategori => {
            const option = new Option(subkategori.nama_subkategori, subkategori.id_subkategori);
            subkategoriSelect.add(option);
        });

        subkategoriSelect.disabled = false;

    } catch (error) {
        console.error("Error loading subcategories:", error);
        alert("Gagal memuat data subkategori");
    }
}

// Update sorting options based on report type
function updateSortingOptions() {
    const reportType = document.getElementById("reportType").value;
    const dateFilterSection = document.getElementById("dateFilterSection");
    
    if (reportType === "penjualan") {
        dateFilterSection.style.display = "flex";
    } else {
        dateFilterSection.style.display = "none";
    }
}

// Generate PDF report
async function generateReport() {
    const token = localStorage.getItem("token");
    if (!token) {
        window.location.href = "../login.html";
        return;
    }

    try {
        const reportType = document.getElementById("reportType").value;
        const kategoriId = document.getElementById("kategoriFilter").value;
        const subkategoriId = document.getElementById("subkategoriFilter").value;
        const startDate = document.getElementById("startDate")?.value || '';
        const endDate = document.getElementById("endDate")?.value || '';
        const sortOption = document.getElementById("sortOption").value;

        // Validasi tanggal untuk laporan penjualan
        if (reportType === 'penjualan' && (!startDate || !endDate)) {
            alert('Mohon isi periode tanggal untuk laporan penjualan');
            return;
        }

        // Bangun URL dengan query parameters
        const params = new URLSearchParams();
        
        if (kategoriId) {
            params.append('id_kategori', kategoriId);
        }
        if (subkategoriId) {
            params.append('id_subkategori', subkategoriId);
        }
        if (startDate) {
            params.append('tanggal_mulai', startDate);
        }
        if (endDate) {
            params.append('tanggal_akhir', endDate);
        }
        if (sortOption) {
            params.append('sort', sortOption);
        }

        const endpoint = `laporan/${reportType}`;
        const url = `${API_URL}/${endpoint}${params.toString() ? '?' + params.toString() : ''}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("username");
                window.location.href = "../login.html";
                return;
            }
            throw new Error('Gagal mengambil data laporan');
        }

        const responseData = await response.json();
        const data = responseData.data || [];

        if (!Array.isArray(data) || data.length === 0) {
            alert('Tidak ada data yang ditemukan untuk kriteria yang dipilih');
            return;
        }

        // Generate PDF
        const doc = new jsPDF();
        
        // Add header
        doc.setFontSize(16);
        doc.text('SIE SRC Sarin Jagir', 105, 15, { align: 'center' });
        doc.setFontSize(14);
        doc.text(reportType === 'penjualan' ? 'Laporan Penjualan' : 'Laporan Produk', 105, 25, { align: 'center' });
        
        // Add filter information
        doc.setFontSize(10);
        let yPos = 35;
        
        if (reportType === 'penjualan') {
            doc.text(`Periode: ${formatDate(startDate)} s/d ${formatDate(endDate)}`, 14, yPos);
            yPos += 7;
        }
        
        // Add table
        const columns = reportType === 'penjualan' 
            ? ['Tanggal', 'Kode', 'Nama Produk', 'Kategori', 'Subkategori', 'Jumlah', 'Total']
            : ['Kode', 'Nama', 'Kategori', 'Subkategori', 'Stok', 'Harga', 'Kadaluarsa'];

        const rows = data.map(item => {
            if (reportType === 'penjualan') {
                return [
                    formatDate(item.tanggal_penjualan),
                    item.kode_produk || '',
                    item.nama_produk || '',
                    item.kategori?.nama_kategori || '',
                    item.subkategori?.nama_subkategori || '',
                    item.jumlah_produk?.toString() || '0',
                    formatCurrency(item.total || 0)
                ];
            } else {
                return [
                    item.kode_produk || '',
                    item.nama_produk || '',
                    item.kategori?.nama_kategori || '',
                    item.subkategori?.nama_subkategori || '',
                    item.stok?.toString() || '0',
                    formatCurrency(item.harga_produk || 0),
                    formatDate(item.tanggal_kadaluarsa)
                ];
            }
        });

        doc.autoTable({
            startY: yPos,
            head: [columns],
            body: rows,
            theme: 'grid',
            styles: {
                fontSize: 8,
                cellPadding: 2
            },
            headStyles: {
                fillColor: [63, 81, 181],
                textColor: [255, 255, 255],
                fontStyle: 'bold'
            }
        });

        // Add footer
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFontSize(8);
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.text(
                `Halaman ${i} dari ${pageCount}`,
                doc.internal.pageSize.width - 20,
                doc.internal.pageSize.height - 10,
                { align: 'right' }
            );
            doc.text(
                `Dicetak pada: ${formatDate(new Date())}`,
                20,
                doc.internal.pageSize.height - 10
            );
        }

        // Save PDF
        const fileName = `laporan_${reportType}_${formatDate(new Date())}.pdf`;
        doc.save(fileName);

    } catch (error) {
        console.error("Error generating report:", error);
        alert(`Gagal membuat laporan: ${error.message}`);
    }
}
