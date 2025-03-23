// Constants
const API_URL = "http://localhost:8080";
const ENDPOINTS = {
    KATEGORI: {
        ALL: '/kategori/getall',
        BY_ID: '/kategori/getbyid/',
        BY_NAME: '/kategori/getbyname/'
    },
    SUBKATEGORI: {
        ALL: '/subkategori/getall',
        BY_ID: '/subkategori/getbyid/',
        BY_NAME: '/subkategori/getbyname/',
        BY_KATEGORI: '/subkategori/getbykategori/'
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
    // Group data by month and calculate totals
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

    // Sort months and convert to Chart.js format
    const sortedMonths = Object.keys(monthlyData).sort();
    
    return {
        labels: sortedMonths.map(month => {
            const [year, monthNum] = month.split('-');
            const date = new Date(year, parseInt(monthNum) - 1);
            return date.toLocaleString('id-ID', { month: 'short', year: 'numeric' });
        }),
        units: sortedMonths.map(month => monthlyData[month].units),
        totals: sortedMonths.map(month => monthlyData[month].total)
    };
}

function createSalesChart(data) {
    const ctx = document.getElementById('salesChart');
    
    // Clear existing chart if any
    if (window.salesChart instanceof Chart) {
        window.salesChart.destroy();
    }

    // Create chart
    window.salesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: [
                {
                    label: 'Jumlah Terjual',
                    type: 'bar',
                    data: data.units,
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
                    data: data.totals,
                    borderColor: 'rgba(255, 99, 132, 1)',
                    backgroundColor: 'rgba(255, 99, 132, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    yAxisID: 'y1',
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Grafik Penjualan per Bulan',
                    font: {
                        size: 16
                    }
                },
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Jumlah Terjual'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: {
                        drawOnChartArea: false,
                    },
                    title: {
                        display: true,
                        text: 'Total Penjualan (Rp)'
                    },
                    ticks: {
                        callback: function(value) {
                            return 'Rp ' + value.toLocaleString('id-ID');
                        }
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Bulan'
                    }
                }
            }
        }
    });
}

// Update sort options based on report type
function updateSortOptions() {
    const reportType = document.getElementById('reportType').value;
    const sortSelect = document.getElementById('sortOption');
    const dateRangeFields = document.getElementById('dateRangeFields');
    
    if (!sortSelect) return;
    
    sortSelect.innerHTML = '';
    
    if (reportType === 'penjualan') {
        const salesOptions = [
            { value: '', label: 'Urutan Default' },
            { value: 'date_asc', label: 'Tanggal (A-Z)' },
            { value: 'date_desc', label: 'Tanggal (Z-A)' },
            { value: 'quantity_asc', label: 'Jumlah (Terendah)' },
            { value: 'quantity_desc', label: 'Jumlah (Tertinggi)' }
        ];
        
        salesOptions.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            sortSelect.appendChild(option);
        });

        // Show date range fields if they exist
        if (dateRangeFields) {
            dateRangeFields.style.display = 'block';
        }
    } else {
        const productOptions = [
            { value: '', label: 'Urutan Default' },
            { value: 'name_asc', label: 'Nama (A-Z)' },
            { value: 'name_desc', label: 'Nama (Z-A)' },
            { value: 'stock_asc', label: 'Stok (Terendah)' },
            { value: 'stock_desc', label: 'Stok (Tertinggi)' }
        ];
        
        productOptions.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            sortSelect.appendChild(option);
        });

        // Hide date range fields if they exist
        if (dateRangeFields) {
            dateRangeFields.style.display = 'none';
        }
    }
}

// Add event listener for report type change
document.getElementById('reportType')?.addEventListener('change', updateSortOptions);

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
    const kategoriId = document.getElementById('kategoriFilter').value;
    const subkategoriSelect = document.getElementById('subkategoriFilter');
    
    // Reset subkategori dropdown
    subkategoriSelect.innerHTML = '<option value="">Semua Subkategori</option>';
    
    if (!kategoriId) return;

    try {
        const response = await fetch(`${API_URL}/subkategori/getbykategori/${kategoriId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Gagal mengambil data subkategori');
        }

        const responseData = await response.json();
        const subkategoriData = responseData.data || [];
        const subkategoriSelect = document.getElementById('subkategoriFilter');

        // Sort subkategori by name
        subkategoriData.sort((a, b) => a.nama_subkategori.localeCompare(b.nama_subkategori));

        subkategoriData.forEach(subkategori => {
            const option = document.createElement('option');
            option.value = subkategori.id_subkategori;
            option.textContent = subkategori.nama_subkategori;
            subkategoriSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error:', error);
        showAlert('error', 'Gagal memuat data subkategori');
    }
}

// Event listener untuk perubahan kategori
document.addEventListener("DOMContentLoaded", function() {
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
            window.location.href = "../login.html";
        });
    }

    // const kategoriFilter = document.getElementById("kategoriFilter");
    // if (kategoriFilter) {
    //     kategoriFilter.addEventListener('change', updateSubkategori);
    // }
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

        // Get kategori and subkategori details if selected
        let kategoriName = "Semua Kategori";
        let subkategoriName = "Semua Subkategori";

        if (kategoriId) {
            try {
                const kategoriResponse = await fetch(`${API_URL}${ENDPOINTS.KATEGORI.BY_ID}${kategoriId}`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
                if (!kategoriResponse.ok) {
                    throw new Error('Failed to fetch kategori');
                }
                const kategoriData = await kategoriResponse.json();
                if (kategoriData.data) {
                    kategoriName = kategoriData.data.nama_kategori;
                }
            } catch (error) {
                console.error('Error fetching kategori:', error);
                showAlert('error', 'Gagal mengambil data kategori');
            }
        }

        if (subkategoriId) {
            try {
                const subkategoriResponse = await fetch(`${API_URL}${ENDPOINTS.SUBKATEGORI.BY_ID}${subkategoriId}`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
                if (!subkategoriResponse.ok) {
                    throw new Error('Failed to fetch subkategori');
                }
                const subkategoriData = await subkategoriResponse.json();
                if (subkategoriData.data) {
                    subkategoriName = subkategoriData.data.nama_subkategori;
                }
            } catch (error) {
                console.error('Error fetching subkategori:', error);
                showAlert('error', 'Gagal mengambil data subkategori');
            }
        }

        // Prepare parameters
        const params = new URLSearchParams();
        if (reportType === 'penjualan') {
            params.append('tanggal_mulai', formatDateForAPI(startDate));
            params.append('tanggal_akhir', formatDateForAPI(endDate));
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
            throw new Error(`Gagal mengambil data laporan: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        
        if (!result.data || result.data.length === 0) {
            document.body.querySelector('.loading-overlay')?.remove();
            showAlert('warning', 'Tidak ada data untuk periode yang dipilih');
            return;
        }

        // Initialize PDF
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        // Add header
        doc.setFontSize(16);
        doc.text('SIE SRC Sarin Jagir', doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
        doc.text('Laporan ' + (reportType === 'penjualan' ? 'Penjualan' : 'Produk'), doc.internal.pageSize.getWidth() / 2, 25, { align: 'center' });

        // Add filter information
        doc.setFontSize(10);
        let yPos = 35;

        if (reportType === 'penjualan') {
            doc.text(`Periode: ${formatDate(startDate)} s/d ${formatDate(endDate)}`, 15, yPos);
            yPos += 7;
        }

        doc.text(`Kategori: ${kategoriName}`, 15, yPos);
        yPos += 7;
        doc.text(`Subkategori: ${subkategoriName}`, 15, yPos);
        yPos += 7;

        // Generate table
        const headers = reportType === 'penjualan' 
            ? ['Tanggal', 'Kode Produk', 'Nama Produk', 'Kategori', 'Subkategori', 'Jumlah', 'Total']
            : ['Kode Produk', 'Nama Produk', 'Kategori', 'Subkategori', 'Stok', 'Harga'];

        // Prepare table data
        const tableData = result.data.map(item => 
            reportType === 'penjualan'
                ? [
                    formatDate(item.tanggal_penjualan),
                    item.kode_produk || '-',
                    item.nama_produk || '-',
                    item.kategori || '-',
                    item.subkategori || '-',
                    item.jumlah_produk?.toString() || '0',
                    formatCurrency(item.total || 0)
                ]
                : [
                    item.kode_produk || '-',
                    item.nama_produk || '-',
                    item.kategori || '-',
                    item.subkategori || '-',
                    item.stok?.toString() || '0',
                    formatCurrency(item.harga || 0)
                ]
        );

        // Add table
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

        // Add chart for sales report
        if (reportType === 'penjualan' && result.data.length > 0) {
            try {
                const chartData = processSalesData(result.data);
                createSalesChart(chartData);
                
                // Wait for chart animation
                await new Promise(resolve => setTimeout(resolve, 500));

                const chartCanvas = document.getElementById('salesChart');
                if (chartCanvas) {
                    const chartImage = chartCanvas.toDataURL('image/png', 1.0);
                    
                    // Add new page for chart
                    doc.addPage();
                    
                    // Add chart title
                    doc.setFontSize(14);
                    doc.text('Grafik Penjualan', doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
                    
                    // Add chart
                    const chartWidth = doc.internal.pageSize.getWidth() - 30;
                    const chartHeight = 120;
                    doc.addImage(chartImage, 'PNG', 15, 30, chartWidth, chartHeight);
                }
            } catch (error) {
                console.error('Error adding chart:', error);
            }
        }

        // Add footer with page numbers
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.text(`Halaman ${i} dari ${pageCount}`, doc.internal.pageSize.getWidth() - 20, doc.internal.pageSize.getHeight() - 10);
        }

        // Save the PDF
        doc.save(`Laporan_${reportType}_${formatDateForAPI(new Date())}.pdf`);

    } catch (error) {
        console.error('Error generating report:', error);
        showAlert('danger', 'Gagal menghasilkan laporan: ' + error.message);
    } finally {
        // Remove loading overlay
        document.body.querySelector('.loading-overlay')?.remove();
    }
}