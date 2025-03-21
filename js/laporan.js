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
    return `Rp ${amount.toLocaleString('id-ID')}`;
}

// Format date to DD-MM-YYYY
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
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
    const sortOptionSelect = document.getElementById("sortOption");
    const salesChartCard = document.getElementById("salesChartCard");
    
    // Reset sort options
    sortOptionSelect.innerHTML = '<option value="">Pilih Urutan</option>';
    
    if (reportType === "penjualan") {
        dateFilterSection.style.display = "flex";
        salesChartCard.style.display = "block";
        // Opsi sorting untuk laporan penjualan
        const salesSortOptions = [
            { value: "most_sold", text: "Produk Terlaris" },
            { value: "least_sold", text: "Produk Kurang Laris" }
        ];
        salesSortOptions.forEach(option => {
            sortOptionSelect.add(new Option(option.text, option.value));
        });
    } else {
        dateFilterSection.style.display = "none";
        salesChartCard.style.display = "none";
        // Opsi sorting untuk laporan produk
        const productSortOptions = [
            { value: "stock_asc", text: "Stok Terendah ke Tertinggi" },
            { value: "stock_desc", text: "Stok Tertinggi ke Terendah" },
            { value: "name_asc", text: "Nama Produk (A-Z)" },
            { value: "name_desc", text: "Nama Produk (Z-A)" }
        ];
        productSortOptions.forEach(option => {
            sortOptionSelect.add(new Option(option.text, option.value));
        });
    }
}

// Function to process sales data for chart
function processSalesData(data) {
    // Group data by product and sum quantities
    const productSales = {};
    data.forEach(sale => {
        const productName = sale.produk?.nama_produk;
        if (!productName) return; // Skip if no product name

        if (!productSales[productName]) {
            productSales[productName] = {
                quantity: 0,
                total: 0
            };
        }
        productSales[productName].quantity += sale.jumlah_produk || 0;
        productSales[productName].total += (sale.produk?.harga_produk || 0) * (sale.jumlah_produk || 0);
    });

    // Convert to array and sort by quantity
    const sortedProducts = Object.entries(productSales)
        .sort(([, a], [, b]) => b.quantity - a.quantity)
        .slice(0, 10); // Get top 10

    return {
        labels: sortedProducts.map(([name]) => name),
        quantities: sortedProducts.map(([, data]) => data.quantity)
    };
}

// Function to create sales chart
async function createSalesChart(data) {
    // Destroy existing chart if any
    const existingChart = Chart.getChart("salesChart");
    if (existingChart) {
        existingChart.destroy();
    }

    // Process data for chart
    const processedData = processSalesData(data);

    // Create chart
    const ctx = document.getElementById('salesChart');
    if (!ctx) {
        console.error('Canvas element not found');
        return;
    }

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: processedData.labels,
            datasets: [{
                label: 'Jumlah Terjual',
                data: processedData.quantities,
                backgroundColor: 'rgba(78, 115, 223, 0.8)',
                borderColor: 'rgba(78, 115, 223, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Jumlah Terjual'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Grafik Penjualan Produk'
                }
            }
        }
    });

    // Tunggu sebentar agar chart selesai di-render
    await new Promise(resolve => setTimeout(resolve, 500));
}

// Generate PDF report
async function generateReport() {
    try {
        // Get filter values
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const kategoriId = document.getElementById('kategoriFilter').value;
        const subkategoriId = document.getElementById('subkategoriFilter').value;
        const sortBy = document.getElementById('sortOption').value;

        // Validate required dates for sales report
        if (document.getElementById("reportType").value === 'penjualan' && (!startDate || !endDate)) {
            alert('Tanggal awal dan akhir harus diisi untuk laporan penjualan');
            return;
        }

        // Fetch data from the appropriate endpoint
        const params = new URLSearchParams();
        if (startDate) params.append('tanggal_mulai', startDate);
        if (endDate) params.append('tanggal_akhir', endDate);
        if (kategoriId) params.append('id_kategori', kategoriId);
        if (subkategoriId) params.append('id_subkategori', subkategoriId);
        if (sortBy) params.append('sort', sortBy);

        const endpoint = document.getElementById("reportType").value === 'penjualan' ? '/laporan/penjualan' : '/laporan/produk';
        const response = await fetch(`${API_URL}${endpoint}?${params.toString()}`);
        if (!response.ok) throw new Error('Failed to fetch report data');
        const data = await response.json();

        // Initialize PDF
        const doc = new jsPDF({
            orientation: document.getElementById("reportType").value === 'penjualan' ? 'landscape' : 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        // Add header
        doc.setFontSize(16);
        doc.text('SURYA MART', doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
        doc.setFontSize(14);
        const reportTitle = document.getElementById("reportType").value === 'penjualan' ? 'Laporan Penjualan' : 'Laporan Produk';
        doc.text(reportTitle, doc.internal.pageSize.getWidth() / 2, 25, { align: 'center' });
        
        // Add filter information
        doc.setFontSize(10);
        let yPos = 35;
        if (document.getElementById("reportType").value === 'penjualan') {
            doc.text(`Periode: ${formatDate(startDate)} s/d ${formatDate(endDate)}`, 15, yPos);
            yPos += 7;
        }
        if (kategoriId) {
            const kategori = document.querySelector('#kategoriFilter option:checked');
            doc.text(`Kategori: ${kategori?.textContent || '-'}`, 15, yPos);
            yPos += 7;
        }
        if (subkategoriId) {
            const subkategori = document.querySelector('#subkategoriFilter option:checked');
            doc.text(`Subkategori: ${subkategori?.textContent || '-'}`, 15, yPos);
            yPos += 7;
        }

        // Add table header
        yPos += 5;
        const startY = yPos;
        const headers = document.getElementById("reportType").value === 'penjualan' 
            ? ['No', 'Tanggal', 'Nama Produk', 'Kategori', 'Subkategori', 'Jumlah', 'Harga', 'Total']
            : ['No', 'Nama Produk', 'Kategori', 'Subkategori', 'Stok', 'Harga'];

        // Calculate column widths
        const pageWidth = doc.internal.pageSize.getWidth();
        const margins = 30; // 15mm on each side
        const tableWidth = pageWidth - margins;
        const colWidths = document.getElementById("reportType").value === 'penjualan'
            ? [10, 25, 50, 30, 30, 20, 30, 30] // Sales report column widths
            : [10, 60, 35, 35, 20, 30]; // Product report column widths

        // Draw table
        let currentY = yPos;
        
        // Helper function to draw row
        function drawRow(rowData, isHeader = false) {
            doc.setFillColor(isHeader ? 220 : 255);
            doc.setTextColor(0);
            doc.setFontStyle(isHeader ? 'bold' : 'normal');
            
            let x = 15;
            rowData.forEach((text, i) => {
                doc.rect(x, currentY, colWidths[i], 7, 'F');
                doc.text(String(text), x + 2, currentY + 5);
                x += colWidths[i];
            });
            currentY += 7;

            // Add new page if needed
            if (currentY > doc.internal.pageSize.getHeight() - 20) {
                doc.addPage();
                currentY = 20;
            }
        }

        // Draw header row
        drawRow(headers, true);

        // Draw data rows
        let totalAmount = 0;
        data.forEach((item, index) => {
            const row = document.getElementById("reportType").value === 'penjualan'
                ? [
                    index + 1,
                    formatDate(item.tanggal_penjualan),
                    item.produk?.nama_produk || '-',
                    item.produk?.kategori?.nama_kategori || '-',
                    item.produk?.subkategori?.nama_subkategori || '-',
                    item.jumlah_produk,
                    formatCurrency(item.produk?.harga_produk || 0),
                    formatCurrency((item.produk?.harga_produk || 0) * item.jumlah_produk)
                ]
                : [
                    index + 1,
                    item.nama_produk,
                    item.kategori?.nama_kategori || '-',
                    item.subkategori?.nama_subkategori || '-',
                    item.stok,
                    formatCurrency(item.harga_produk)
                ];
            
            drawRow(row);
            
            if (document.getElementById("reportType").value === 'penjualan') {
                totalAmount += (item.produk?.harga_produk || 0) * item.jumlah_produk;
            }
        });

        // Add total for sales report
        if (document.getElementById("reportType").value === 'penjualan') {
            currentY += 5;
            doc.setFontStyle('bold');
            doc.text(`Total Penjualan: ${formatCurrency(totalAmount)}`, 15, currentY);
        }

        // If it's a sales report, add the chart
        if (document.getElementById("reportType").value === 'penjualan') {
            // Get the chart canvas
            const canvas = document.getElementById('salesChart');
            if (canvas) {
                // Add new page for chart
                doc.addPage();
                
                // Add chart title
                doc.setFontSize(14);
                doc.text('Grafik Penjualan', doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
                
                // Convert chart to image and add to PDF
                const chartImage = canvas.toDataURL('image/png');
                const imgWidth = doc.internal.pageSize.getWidth() - 30;
                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                doc.addImage(chartImage, 'PNG', 15, 30, imgWidth, imgHeight);
            }
        }

        // Save the PDF
        const fileName = `${reportTitle}_${formatDate(new Date())}.pdf`;
        doc.save(fileName);

    } catch (error) {
        console.error('Error generating report:', error);
        alert('Terjadi kesalahan saat membuat laporan. Silakan coba lagi.');
    }
}
