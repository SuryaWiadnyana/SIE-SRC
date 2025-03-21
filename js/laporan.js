// Constants
const API_URL = "http://localhost:8080";
const ENDPOINTS = {
    KATEGORI: '/kategori/getall',
    SUBKATEGORI: {
        ALL: '/subkategori/getall',
        BY_KATEGORI: '/subkategori/getbykategori/' // Perhatikan slash di akhir
    },
    LAPORAN: {
        PENJUALAN: '/laporan/penjualan',
        PRODUK: '/laporan/produk'
    }
};

// Initialize jsPDF
window.jsPDF = window.jspdf.jsPDF;

// Add loading overlay styles
const style = document.createElement('style');
style.textContent = `
.loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(255, 255, 255, 0.8);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 9999;
}
`;
document.head.appendChild(style);

// Helper Functions
function showAlert(type, message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    // Find alert container
    const alertContainer = document.getElementById('alert-container');
    if (!alertContainer) {
        // Create alert container if it doesn't exist
        const container = document.createElement('div');
        container.id = 'alert-container';
        container.style.position = 'fixed';
        container.style.top = '20px';
        container.style.right = '20px';
        container.style.zIndex = '1050';
        document.body.appendChild(container);
        container.appendChild(alertDiv);
    } else {
        alertContainer.appendChild(alertDiv);
    }

    // Auto dismiss after 5 seconds
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function formatDateForAPI(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD
}

function formatCurrency(value) {
    return `Rp ${parseFloat(value || 0).toLocaleString('id-ID')}`;
}

function getSortLabel(sort) {
    const sortLabels = {
        'tanggal_asc': 'Tanggal (A-Z)',
        'tanggal_desc': 'Tanggal (Z-A)',
        'total_asc': 'Total (Terendah)',
        'total_desc': 'Total (Tertinggi)',
        'nama_asc': 'Nama (A-Z)',
        'nama_desc': 'Nama (Z-A)',
        'stok_asc': 'Stok (Terendah)',
        'stok_desc': 'Stok (Tertinggi)',
        'harga_asc': 'Harga (Terendah)',
        'harga_desc': 'Harga (Tertinggi)'
    };
    return sortLabels[sort] || '';
}

function processSalesData(data) {
    // Kelompokkan data berdasarkan bulan dan hitung total
    const monthlyData = {};
    
    data.forEach(sale => {
        const date = new Date(sale.tanggal_penjualan);
        const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        
        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = {
                units: 0,
                total: 0
            };
        }
        
        monthlyData[monthKey].units += parseInt(sale.jumlah_produk) || 0;
        monthlyData[monthKey].total += parseFloat(sale.total) || 0;
    });

    // Urutkan bulan dan konversi ke format yang dibutuhkan Chart.js
    const sortedMonths = Object.keys(monthlyData).sort();
    
    return {
        labels: sortedMonths.map(month => {
            const [year, monthNum] = month.split('-');
            const date = new Date(year, parseInt(monthNum) - 1);
            return date.toLocaleString('id-ID', { month: 'short' });
        }),
        units: sortedMonths.map(month => monthlyData[month].units),
        totals: sortedMonths.map(month => monthlyData[month].total)
    };
}

// Fungsi untuk membuat grafik kombinasi bar dan line
function createSalesChart(data) {
    const ctx = document.getElementById('salesChart');
    
    // Clear existing chart if any
    if (window.salesChart instanceof Chart) {
        window.salesChart.destroy();
    }

    // Process data for chart
    const monthlyData = {};
    data.forEach(item => {
        const date = new Date(item.tanggal_penjualan);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = {
                count: 0,
                total: 0
            };
        }
        
        monthlyData[monthKey].count += item.jumlah_produk;
        monthlyData[monthKey].total += item.total;
    });

    // Sort months
    const sortedMonths = Object.keys(monthlyData).sort();

    // Prepare chart data
    const chartData = {
        labels: sortedMonths.map(month => {
            const [year, monthNum] = month.split('-');
            return new Date(year, monthNum - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
        }),
        datasets: [
            {
                label: 'Jumlah Terjual',
                type: 'bar',
                data: sortedMonths.map(month => monthlyData[month].count),
                backgroundColor: 'rgba(53, 162, 235, 0.7)',
                borderColor: 'rgba(53, 162, 235, 1)',
                borderWidth: 1,
                yAxisID: 'y',
                barPercentage: 0.6,
                categoryPercentage: 0.7
            },
            {
                label: 'Total Penjualan (Rp)',
                type: 'line',
                data: sortedMonths.map(month => monthlyData[month].total),
                borderColor: 'rgba(255, 99, 132, 1)',
                backgroundColor: 'rgba(255, 99, 132, 0.1)',
                borderWidth: 2,
                fill: true,
                yAxisID: 'y1',
                tension: 0.3
            }
        ]
    };

    // Create chart
    window.salesChart = new Chart(ctx, {
        type: 'bar',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 11
                        },
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Jumlah Terjual',
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    ticks: {
                        font: {
                            size: 11
                        }
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Total Penjualan (Rp)',
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    },
                    grid: {
                        display: false
                    },
                    ticks: {
                        callback: function(value) {
                            return 'Rp ' + value.toLocaleString('id-ID');
                        },
                        font: {
                            size: 11
                        }
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Grafik Penjualan Bulanan',
                    font: {
                        size: 16,
                        weight: 'bold'
                    },
                    padding: {
                        top: 10,
                        bottom: 20
                    }
                },
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        font: {
                            size: 12
                        },
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    titleColor: '#000',
                    bodyColor: '#000',
                    bodyFont: {
                        size: 12
                    },
                    borderColor: '#ddd',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.datasetIndex === 1) {
                                label += 'Rp ' + context.parsed.y.toLocaleString('id-ID');
                            } else {
                                label += context.parsed.y;
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });

    return ctx;
}

// Update sort options based on report type
function updateSortOptions() {
    const reportType = document.getElementById('reportType').value;
    const sortSelect = document.getElementById('sortOption');
    sortSelect.innerHTML = ''; // Clear existing options
    
    // Default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Pilih Urutan';
    sortSelect.appendChild(defaultOption);
    
    if (reportType === 'produk') {
        // Sort options for product report
        const productSortOptions = [
            { value: 'stock_asc', text: 'Stok: Terendah ke Tertinggi' },
            { value: 'stock_desc', text: 'Stok: Tertinggi ke Terendah' },
            { value: 'name_asc', text: 'Nama Produk: A-Z' },
            { value: 'name_desc', text: 'Nama Produk: Z-A' }
        ];
        
        productSortOptions.forEach(option => {
            const element = document.createElement('option');
            element.value = option.value;
            element.textContent = option.text;
            sortSelect.appendChild(element);
        });
    } else {
        // Sort options for sales report
        const salesSortOptions = [
            { value: 'qty_asc', text: 'Jumlah Terjual: Terendah ke Tertinggi' },
            { value: 'qty_desc', text: 'Jumlah Terjual: Tertinggi ke Terendah' },
            { value: 'date_asc', text: 'Tanggal: Terlama ke Terbaru' },
            { value: 'date_desc', text: 'Tanggal: Terbaru ke Terlama' }
        ];
        
        salesSortOptions.forEach(option => {
            const element = document.createElement('option');
            element.value = option.value;
            element.textContent = option.text;
            sortSelect.appendChild(element);
        });
    }
}

// Update sorting options based on report type
function updateSortingOptions() {
    const reportType = document.getElementById("reportType").value;
    const sortSelect = document.getElementById("sortOption");
    
    // Clear existing options
    sortSelect.innerHTML = '<option value="">Pilih Urutan</option>';
    
    // Add options based on report type
    if (reportType === 'penjualan') {
        const salesOptions = {
            'tanggal_asc': 'Tanggal (A-Z)',
            'tanggal_desc': 'Tanggal (Z-A)',
            'total_asc': 'Total (Terendah)',
            'total_desc': 'Total (Tertinggi)'
        };
        
        Object.entries(salesOptions).forEach(([value, text]) => {
            const option = new Option(text, value);
            sortSelect.add(option);
        });
    } else {
        const productOptions = {
            'nama_asc': 'Nama (A-Z)',
            'nama_desc': 'Nama (Z-A)',
            'stok_asc': 'Stok (Terendah)',
            'stok_desc': 'Stok (Tertinggi)',
            'harga_asc': 'Harga (Terendah)',
            'harga_desc': 'Harga (Tertinggi)'
        };
        
        Object.entries(productOptions).forEach(([value, text]) => {
            const option = new Option(text, value);
            sortSelect.add(option);
        });
    }
}

// Fungsi untuk mengupdate subkategori berdasarkan kategori yang dipilih
async function updateSubkategori() {
    try {
        const kategoriId = document.getElementById('kategoriFilter').value;
        const subkategoriSelect = document.getElementById('subkategoriFilter');
        
        // Reset subkategori options
        subkategoriSelect.innerHTML = '<option value="">Semua Subkategori</option>';
        
        if (!kategoriId) return; // Jika tidak ada kategori dipilih, biarkan default
        
        const response = await fetch(`${API_URL}${ENDPOINTS.SUBKATEGORI.BY_KATEGORI}${kategoriId}`);
        const responseData = await response.json();
        
        // Ambil data dari properti data jika ada
        const subkategoriData = responseData.data || responseData;

        // Loop dan tambahkan setiap subkategori ke dropdown (tanpa Set karena sudah handle di backend)
        if (Array.isArray(subkategoriData)) {
            for (const subkategori of subkategoriData) {
                const option = document.createElement('option');
                option.value = subkategori.id_subkategori;
                option.textContent = subkategori.nama_subkategori;
                subkategoriSelect.appendChild(option);
            }
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Event listener untuk perubahan kategori
document.addEventListener("DOMContentLoaded", function () {
    // Check authentication
    const token = localStorage.getItem("token");
    if (!token) {
        window.location.href = "login.html";
        return;
    }

    // Set username
    const username = localStorage.getItem("username");
    if (username) {
        document.getElementById("username").textContent = username;
    }

    // Set default dates
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const startDateInput = document.getElementById("startDate");
    const endDateInput = document.getElementById("endDate");
    if (startDateInput && endDateInput) {
        startDateInput.value = firstDayOfMonth.toISOString().split('T')[0];
        endDateInput.value = today.toISOString().split('T')[0];
    }

    // Initialize components
    loadKategori();

    // Setup event listeners
    const reportTypeSelect = document.getElementById("reportType");
    const kategoriFilter = document.getElementById("kategoriFilter");
    const generateButton = document.getElementById("generateReportButton");
    const logoutButton = document.getElementById("logoutButton");
    const dateRangeFields = document.querySelectorAll('.date-range');
    const salesChartCard = document.getElementById("salesChartCard");

    if (reportTypeSelect) {
        reportTypeSelect.addEventListener("change", function() {
            const isProductReport = this.value === 'produk';
            
            // Toggle date inputs visibility
            dateRangeFields.forEach(field => {
                field.style.display = isProductReport ? 'none' : 'block';
            });
            
            // Toggle chart visibility
            if (salesChartCard) {
                salesChartCard.style.display = isProductReport ? 'none' : 'block';
            }
            
            // Update sorting options
            updateSortOptions();
        });

        // Set initial state
        reportTypeSelect.dispatchEvent(new Event('change'));
    }

    if (generateButton) {
        generateButton.addEventListener("click", generateReport);
    }

    if (logoutButton) {
        logoutButton.addEventListener("click", function() {
            localStorage.clear();
            window.location.href = "login.html";
        });
    }
});

// Load kategori saat halaman dimuat
async function loadKategori() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/kategori/getall`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Gagal mengambil data kategori');
        }

        const result = await response.json();
        const kategoriList = result.data || [];
        const kategoriSelect = document.getElementById('kategoriFilter');

        kategoriSelect.innerHTML = '<option value="">Semua Kategori</option>';
        kategoriList.forEach(kategori => {
            const option = document.createElement('option');
            option.value = kategori.id_kategori;
            option.textContent = kategori.nama_kategori;
            kategoriSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error:', error);
        showAlert('error', 'Gagal memuat data kategori');
    }
}

// Function to generate PDF report
async function generateReport() {
    try {
        const reportType = document.getElementById("reportType").value;
        const startDate = document.getElementById("startDate").value;
        const endDate = document.getElementById("endDate").value;
        const kategoriId = document.getElementById("kategoriFilter").value;
        const subkategoriId = document.getElementById("subkategoriFilter").value;
        const sort = document.getElementById("sortOption").value;

        if (reportType === 'penjualan' && (!startDate || !endDate)) {
            showAlert('warning', 'Tanggal awal dan akhir harus diisi untuk laporan penjualan');
            return;
        }

        // Show loading overlay
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading-overlay';
        loadingDiv.innerHTML = `
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <div class="mt-2">Menghasilkan laporan...</div>
        `;
        document.body.appendChild(loadingDiv);

        // Prepare parameters
        const params = new URLSearchParams();
        if (reportType === 'penjualan') {
            params.append('tanggal_mulai', startDate);
            params.append('tanggal_akhir', endDate);
        }
        if (kategoriId) params.append('id_kategori', kategoriId);
        if (subkategoriId) params.append('id_subkategori', subkategoriId);
        if (sort) params.append('sort', sort);

        // Fetch data from API
        const response = await fetch(`${API_URL}${ENDPOINTS.LAPORAN[reportType.toUpperCase()]}?${params.toString()}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Gagal mengambil data laporan');
        }

        const result = await response.json();
        
        if (!result.data || result.data.length === 0) {
            document.querySelector('.loading-overlay')?.remove();
            showAlert('warning', 'Tidak ada data untuk periode yang dipilih');
            return;
        }

        // Initialize PDF
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        // Tambahkan header
        doc.setFontSize(16);
        doc.text('SIE SRC Sarin Jagir', doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
        doc.text('Laporan ' + (reportType === 'penjualan' ? 'Penjualan' : 'Produk'), doc.internal.pageSize.getWidth() / 2, 25, { align: 'center' });

        // Informasi filter
        doc.setFontSize(10);
        let yPos = 35;

        if (reportType === 'penjualan') {
            doc.text(`Periode: ${formatDate(startDate)} s/d ${formatDate(endDate)}`, 15, yPos);
            yPos += 7;
        }

        if (kategoriId) {
            const kategoriEl = document.getElementById('kategoriFilter');
            const kategoriText = kategoriEl.options[kategoriEl.selectedIndex].text;
            doc.text(`Kategori: ${kategoriText}`, 15, yPos);
            yPos += 7;
        }

        if (subkategoriId) {
            const subkategoriEl = document.getElementById('subkategoriFilter');
            const subkategoriText = subkategoriEl.options[subkategoriEl.selectedIndex].text;
            doc.text(`Subkategori: ${subkategoriText}`, 15, yPos);
            yPos += 7;
        }

        // Generate tabel
        const headers = reportType === 'penjualan' 
            ? ['Tanggal', 'Kode Produk', 'Nama Produk', 'Kategori', 'Subkategori', 'Jumlah', 'Total']
            : ['Kode Produk', 'Nama Produk', 'Kategori', 'Subkategori', 'Stok', 'Harga'];

        // Data untuk tabel
        const tableData = result.data.map(item => 
            reportType === 'penjualan'
                ? [
                    formatDate(item.tanggal_penjualan),
                    item.kode_produk || '-',
                    item.nama_produk || '-',
                    item.kategori?.nama_kategori || '-',
                    item.subkategori?.nama_subkategori || '-',
                    item.jumlah_produk?.toString() || '0',
                    formatCurrency(item.total || 0)
                ]
                : [
                    item.kode_produk || '-',
                    item.nama_produk || '-',
                    item.kategori?.nama_kategori || '-',
                    item.subkategori?.nama_subkategori || '-',
                    item.stok?.toString() || '0',
                    formatCurrency(item.harga || 0)
                ]
        );

        // Tambahkan tabel dengan autoTable
        doc.autoTable({
            startY: yPos,
            head: [headers],
            body: tableData,
            theme: 'grid',
            styles: {
                fontSize: 8,
                cellPadding: 2
            },
            headStyles: {
                fillColor: [63, 81, 181],
                textColor: 255,
                fontSize: 9,
                fontStyle: 'bold'
            },
            alternateRowStyles: {
                fillColor: [245, 245, 245]
            },
            margin: { top: 15 }
        });

        // Tambahkan grafik setelah tabel jika ada
        if (reportType === 'penjualan') {
            try {
                // Create and render chart
                createSalesChart(result.data);
                
                // Wait for chart animation to complete
                await new Promise(resolve => setTimeout(resolve, 500));

                // Get chart canvas
                const chartCanvas = document.getElementById('salesChart');
                if (!chartCanvas) {
                    throw new Error('Chart canvas not found');
                }

                // Convert chart to image with higher quality
                const chartImage = chartCanvas.toDataURL('image/png', 1.0);
                
                // Add chart to PDF with proper positioning
                const pdfWidth = doc.internal.pageSize.getWidth();
                const pdfHeight = doc.internal.pageSize.getHeight();
                const chartAspectRatio = chartCanvas.width / chartCanvas.height;
                const chartWidth = pdfWidth - 40; // 20mm margins on each side
                const chartHeight = chartWidth / chartAspectRatio;
                
                const finalY = doc.previousAutoTable.finalY + 20;
                
                // Tambahkan halaman baru jika tidak cukup ruang
                if (finalY + 100 > doc.internal.pageSize.getHeight()) {
                    doc.addPage();
                    yPos = 20;
                } else {
                    yPos = finalY;
                }

                // Tambahkan judul grafik
                doc.setFontSize(12);
                doc.text('Grafik Penjualan', doc.internal.pageSize.getWidth() / 2, yPos, { align: 'center' });
                
                // Tambahkan grafik
                const chartWidthPdf = doc.internal.pageSize.getWidth() - 30;
                const chartHeightPdf = 100;
                doc.addImage(chartImage, 'PNG', 15, yPos + 10, chartWidthPdf, chartHeightPdf);
            } catch (error) {
                console.error('Error adding chart:', error);
            }
        }

        // Footer
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFontSize(8);
        for(let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.text(
                `Halaman ${i} dari ${pageCount}`,
                doc.internal.pageSize.getWidth() - 20,
                doc.internal.pageSize.getHeight() - 10,
                { align: 'right' }
            );
            doc.text(
                `Dicetak pada: ${new Date().toLocaleString('id-ID')}`,
                15,
                doc.internal.pageSize.getHeight() - 10
            );
        }

        // Simpan PDF
        const fileName = `laporan_${reportType}_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(fileName);

        // Hapus loading overlay
        document.querySelector('.loading-overlay')?.remove();
        showAlert('success', 'Laporan berhasil dibuat');

    } catch (error) {
        console.error('Error generating report:', error);
        document.querySelector('.loading-overlay')?.remove();
        showAlert('danger', 'Gagal menghasilkan laporan: ' + error.message);
    }
}