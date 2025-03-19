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

// Format table data based on report type
function formatTableData(data, reportType) {
    if (!Array.isArray(data)) {
        console.error('Data is not an array:', data);
        return [];
    }

    return data.map(item => {
        try {
            if (reportType === 'penjualan') {
                return [
                    formatDate(item.tanggal_penjualan),
                    item.kode_produk || '',
                    item.nama_produk || '',
                    item.kategori?.nama_kategori || '',
                    item.subkategori?.nama_subkategori || '',
                    item.jumlah_produk || 0,
                    formatCurrency(item.total || 0)
                ];
            } else {
                return [
                    item.kode_produk || '',
                    item.nama_produk || '',
                    item.kategori?.nama_kategori || '',
                    item.subkategori?.nama_subkategori || '',
                    item.stok || 0,
                    formatCurrency(item.harga_produk || 0),
                    formatDate(item.tanggal_kadaluarsa)
                ];
            }
        } catch (error) {
            console.error('Error formatting row:', error, item);
            // Return empty row on error
            return reportType === 'penjualan' ? 
                ['', '', '', '', '', 0, formatCurrency(0)] :
                ['', '', '', '', 0, formatCurrency(0), ''];
        }
    });
}

// Get table columns based on report type
function getTableColumns(reportType) {
    if (reportType === 'penjualan') {
        return ['Tanggal', 'Kode Produk', 'Nama Produk', 'Kategori', 'Subkategori', 'Jumlah', 'Total'];
    } else {
        return ['Kode', 'Nama', 'Kategori', 'Subkategori', 'Stok', 'Harga', 'Kadaluarsa'];
    }
}

// Format date to DD-MM-YYYY
function formatDate(date) {
    if (!date) return '';
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString('id-ID', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).replace(/\//g, '-');
    } catch (error) {
        console.error('Error formatting date:', error);
        return '';
    }
}

// Format currency to IDR
function formatCurrency(amount) {
    try {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    } catch (error) {
        console.error('Error formatting currency:', error);
        return 'Rp 0';
    }
}

// Fungsi untuk memuat kategori
async function loadKategori() {
    const token = localStorage.getItem("token");
    if (!token) {
        window.location.href = "../login.html";
        return;
    }

    try {
        const response = await fetch(`${API_URL}/kategori/getall`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("username");
                window.location.href = "../login.html";
                return;
            }
            throw new Error('Gagal memuat data kategori');
        }
        
        let responseData = await response.json();
        console.log('Response kategori:', responseData); // Debug log

        // Pastikan data adalah array
        let kategoriData;
        if (Array.isArray(responseData)) {
            kategoriData = responseData;
        } else if (responseData.data && Array.isArray(responseData.data)) {
            kategoriData = responseData.data;
        } else {
            throw new Error('Format data kategori tidak valid');
        }
        
        const kategoriSelect = document.getElementById("kategoriFilter");
        kategoriSelect.innerHTML = '<option value="">Semua Kategori</option>';
        
        kategoriData.forEach(kategori => {
            const option = document.createElement("option");
            option.value = kategori.id_kategori; // Menggunakan id_kategori
            option.textContent = kategori.nama_kategori; // Menggunakan nama_kategori
            kategoriSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Error loading categories:", error);
        alert("Gagal memuat data kategori. Silakan coba lagi atau hubungi administrator.");
    }
}

// Fungsi untuk memuat subkategori
async function loadSubkategori(kategoriId) {
    const token = localStorage.getItem("token");
    if (!token) {
        window.location.href = "../login.html";
        return;
    }

    const subkategoriSelect = document.getElementById("subkategoriFilter");
    subkategoriSelect.innerHTML = '<option value="">Semua Subkategori</option>';
    
    if (!kategoriId) {
        console.log('No kategori ID provided, disabling subkategori dropdown');
        subkategoriSelect.disabled = true;
        return;
    }

    try {
        const url = `${API_URL}/subkategori/getall`;
        console.log('Fetching all subcategories from:', url);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            if (response.status === 401) {
                console.error('Unauthorized access');
                localStorage.removeItem("token");
                localStorage.removeItem("username");
                window.location.href = "../login.html";
                return;
            }
            
            let errorText;
            try {
                const errorData = await response.json();
                errorText = errorData.error || errorData.message || `HTTP error! status: ${response.status}`;
            } catch (e) {
                errorText = `HTTP error! status: ${response.status}`;
            }
            console.error('Error response:', errorText);
            throw new Error(errorText);
        }
        
        let responseData = await response.json();
        console.log('Raw response data:', responseData);

        // Pastikan data adalah array
        let subkategoriData;
        if (responseData.data && Array.isArray(responseData.data)) {
            subkategoriData = responseData.data;
            console.log('Using response.data array');
        } else if (Array.isArray(responseData)) {
            subkategoriData = responseData;
            console.log('Using direct response array');
        } else if (responseData && typeof responseData === 'object') {
            subkategoriData = [responseData];
            console.log('Converting single object to array');
        } else {
            console.error('Invalid response format:', responseData);
            throw new Error('Format data subkategori tidak valid');
        }
        
        console.log('Processed subkategori data:', subkategoriData);
        
        // Filter subkategori berdasarkan kategori_id
        subkategoriData = subkategoriData.filter(subkategori => {
            console.log('Checking subkategori:', subkategori);
            // Periksa apakah subkategori memiliki kategori yang valid
            if (!subkategori.kategori) {
                console.warn('Subkategori missing kategori:', subkategori);
                return false;
            }
            return subkategori.kategori.id_kategori === kategoriId;
        });
        
        console.log('Filtered subkategori data:', subkategoriData);
        
        if (subkategoriData.length === 0) {
            console.log('No subcategories found for kategori:', kategoriId);
            subkategoriSelect.disabled = true;
            return;
        }
        
        // Gunakan Map untuk menghilangkan duplikasi
        const uniqueSubkategori = new Map();
        
        subkategoriData.forEach(subkategori => {
            console.log('Processing subkategori:', subkategori);
            if (subkategori.id_subkategori && subkategori.nama_subkategori) {
                uniqueSubkategori.set(subkategori.id_subkategori, {
                    id_subkategori: subkategori.id_subkategori,
                    nama_subkategori: subkategori.nama_subkategori
                });
            } else {
                console.warn('Invalid subkategori data:', subkategori);
            }
        });
        
        // Konversi Map kembali ke array dan tambahkan ke dropdown
        const uniqueSubkategoriArray = Array.from(uniqueSubkategori.values());
        console.log('Unique subkategori:', uniqueSubkategoriArray);
        
        uniqueSubkategoriArray.forEach(subkategori => {
            const option = document.createElement("option");
            option.value = subkategori.id_subkategori;
            option.textContent = subkategori.nama_subkategori;
            subkategoriSelect.appendChild(option);
        });
        
        console.log('Successfully populated subkategori dropdown');
        subkategoriSelect.disabled = false;
    } catch (error) {
        console.error("Error loading subcategories:", error);
        alert(`Gagal memuat data subkategori: ${error.message}`);
        subkategoriSelect.disabled = true;
    }
}

// Update sorting options based on report type
function updateSortingOptions() {
    const reportType = document.getElementById("reportType").value;
    const sortSelect = document.getElementById("sortOption");
    const dateRangeElements = document.querySelectorAll('.date-range');
    
    sortSelect.innerHTML = '';
    
    if (reportType === 'produk') {
        dateRangeElements.forEach(el => el.style.display = 'none');
        
        const options = [
            { value: 'nama_asc', text: 'Nama Produk (A-Z)' },
            { value: 'nama_desc', text: 'Nama Produk (Z-A)' },
            { value: 'stok_asc', text: 'Stok (Terendah-Tertinggi)' },
            { value: 'stok_desc', text: 'Stok (Tertinggi-Terendah)' }
        ];
        
        options.forEach(opt => {
            const option = document.createElement("option");
            option.value = opt.value;
            option.textContent = opt.text;
            sortSelect.appendChild(option);
        });
    } else {
        dateRangeElements.forEach(el => el.style.display = 'block');
        
        const options = [
            { value: 'terjual_desc', text: 'Paling Banyak Terjual' },
            { value: 'terjual_asc', text: 'Paling Sedikit Terjual' },
            { value: 'tanggal_desc', text: 'Tanggal Terbaru' },
            { value: 'tanggal_asc', text: 'Tanggal Terlama' }
        ];
        
        options.forEach(opt => {
            const option = document.createElement("option");
            option.value = opt.value;
            option.textContent = opt.text;
            sortSelect.appendChild(option);
        });
    }
}

// Generate PDF
function generatePDF(data, reportType) {
    const doc = new jsPDF('l'); // landscape orientation
    
    // Set font
    doc.setFont("helvetica");
    
    // Header
    doc.setFontSize(18);
    doc.text("SRC Sarin Jagir", 14, 15);
    doc.setFontSize(14);
    doc.text(reportType === 'penjualan' ? "Laporan Penjualan" : "Laporan Produk", 14, 25);
    
    // Periode (untuk laporan penjualan)
    if (reportType === 'penjualan') {
        const startDate = document.getElementById("startDate").value;
        const endDate = document.getElementById("endDate").value;
        doc.setFontSize(12);
        doc.text(`Periode: ${formatDate(startDate)} - ${formatDate(endDate)}`, 14, 35);
    }
    
    // Table
    const columns = getTableColumns(reportType);
    const tableData = formatTableData(data, reportType);
    
    doc.autoTable({
        startY: reportType === 'penjualan' ? 40 : 35,
        head: [columns],
        body: tableData,
        theme: 'grid',
        styles: {
            fontSize: 10,
            cellPadding: 2,
            overflow: 'linebreak'
        },
        columnStyles: {
            0: { cellWidth: 25 }, // Tanggal/Kode
            1: { cellWidth: 30 }, // Kode/Nama
            2: { cellWidth: 40 }, // Nama/Kategori
            3: { cellWidth: 30 }, // Kategori/Subkategori
            4: { cellWidth: 30 }, // Subkategori/Stok
            5: { cellWidth: 30 }, // Jumlah/Harga
            6: { cellWidth: 35 }  // Total/Tanggal
        }
    });
    
    // Footer with page numbers
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.text(`Halaman ${i} dari ${pageCount}`, doc.internal.pageSize.width - 20, doc.internal.pageSize.height - 10);
    }
    
    // Save PDF
    const timestamp = new Date().toISOString().split('T')[0];
    doc.save(`laporan_${reportType}_${timestamp}.pdf`);
}

// Fungsi untuk menghasilkan laporan
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
        const startDate = document.getElementById("startDate").value;
        const endDate = document.getElementById("endDate").value;
        const sortOption = document.getElementById("sortOption").value;

        console.log('Report parameters:', {
            reportType, kategoriId, subkategoriId, startDate, endDate, sortOption
        });

        // Validasi tanggal untuk laporan penjualan
        if (reportType === 'penjualan' && (!startDate || !endDate)) {
            alert('Mohon isi periode tanggal untuk laporan penjualan');
            return;
        }

        // Gunakan endpoint laporan yang sesuai
        const endpoint = `laporan/${reportType}`;

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

        const queryString = params.toString();
        const url = `${API_URL}/${endpoint}${queryString ? '?' + queryString : ''}`;
        
        console.log('Fetching report from:', url);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Response status:', response.status);

        if (!response.ok) {
            if (response.status === 401) {
                console.error('Unauthorized access');
                localStorage.removeItem("token");
                localStorage.removeItem("username");
                window.location.href = "../login.html";
                return;
            }

            let errorMessage;
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorData.message || 'Gagal menghasilkan laporan';
            } catch (e) {
                errorMessage = 'Gagal menghasilkan laporan';
            }
            console.error('Error response:', errorMessage);
            throw new Error(errorMessage);
        }

        const responseData = await response.json();
        console.log('Report data:', responseData);

        // Extract data array from response
        const data = responseData.data || responseData;
        if (!data || !Array.isArray(data) || data.length === 0) {
            alert('Tidak ada data yang ditemukan untuk kriteria yang dipilih');
            return;
        }

        // Generate PDF berdasarkan data
        generatePDF(data, reportType);
    } catch (error) {
        console.error("Error generating report:", error);
        alert(`Gagal menghasilkan laporan: ${error.message}`);
    }
}
