// Inisialisasi komponen
$(function () {
    // Load data dashboard
    loadDashboardData();
    
    // Setup refresh interval (setiap 5 menit)
    setInterval(loadDashboardData, 5 * 60 * 1000);
});

// Load semua data dashboard
async function loadDashboardData() {
    await Promise.all([
        loadStatistics(),
        loadSalesChart(),
        loadTopProducts(),
        loadRecentSales()
    ]);
}

// Load statistik
async function loadStatistics() {
    try {
        // Load total produk
        const produkResponse = await fetch('http://localhost:8080/produk/getall', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        const produkResult = await produkResponse.json();
        if (produkResult.data) {
            const activeProducts = produkResult.data.filter(p => !p.is_deleted);
            $('#totalProduk').text(activeProducts.length);
            
            // Hitung produk dengan stok menipis (kurang dari 10)
            const lowStock = activeProducts.filter(p => p.stok_barang < 10).length;
            $('#lowStockCount').text(lowStock);
        }

        // Load total penjualan dan pendapatan
        const penjualanResponse = await fetch('http://localhost:8080/penjualan/getall', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        const penjualanResult = await penjualanResponse.json();
        if (penjualanResult.data) {
            $('#totalPenjualan').text(penjualanResult.data.length);
            
            // Hitung total pendapatan
            const totalPendapatan = penjualanResult.data.reduce((acc, curr) => acc + curr.total, 0);
            $('#totalPendapatan').text(formatRupiah(totalPendapatan));
        }
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

// Load grafik penjualan
async function loadSalesChart() {
    try {
        const response = await fetch('http://localhost:8080/penjualan/getall', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        const result = await response.json();
        
        if (result.data) {
            // Kelompokkan penjualan per hari
            const salesByDate = {};
            result.data.forEach(sale => {
                const date = moment(sale.tanggal).format('YYYY-MM-DD');
                if (!salesByDate[date]) {
                    salesByDate[date] = 0;
                }
                salesByDate[date] += sale.total;
            });

            // Ambil 7 hari terakhir
            const dates = Object.keys(salesByDate).sort().slice(-7);
            const values = dates.map(date => salesByDate[date]);

            // Update grafik
            const ctx = document.getElementById('salesChart').getContext('2d');
            if (window.salesChart) {
                window.salesChart.destroy();
            }
            window.salesChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: dates.map(date => moment(date).format('DD/MM')),
                    datasets: [{
                        label: 'Penjualan',
                        data: values,
                        borderColor: '#00a65a',
                        tension: 0.1,
                        fill: false
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return formatRupiah(value);
                                }
                            }
                        }
                    },
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return formatRupiah(context.raw);
                                }
                            }
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error loading sales chart:', error);
    }
}

// Load produk terlaris
async function loadTopProducts() {
    try {
        const [produkResponse, penjualanResponse] = await Promise.all([
            fetch('http://localhost:8080/produk/getall', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            }),
            fetch('http://localhost:8080/penjualan/getall', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            })
        ]);

        const [produkResult, penjualanResult] = await Promise.all([
            produkResponse.json(),
            penjualanResponse.json()
        ]);

        if (produkResult.data && penjualanResult.data) {
            // Hitung total penjualan per produk
            const productSales = {};
            penjualanResult.data.forEach(sale => {
                sale.produk.forEach(item => {
                    if (!productSales[item.id_produk]) {
                        productSales[item.id_produk] = 0;
                    }
                    productSales[item.id_produk] += item.quantity;
                });
            });

            // Sort dan ambil 5 produk terlaris
            const topProducts = Object.entries(productSales)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([id, quantity]) => {
                    const product = produkResult.data.find(p => p.id_produk === id);
                    return { ...product, totalSold: quantity };
                });

            // Render list produk terlaris
            const html = topProducts.map(product => `
                <li class="item">
                    <div class="product-info">
                        <a href="javascript:void(0)" class="product-title">
                            ${product.nama_produk}
                            <span class="badge badge-success float-right">${product.totalSold} Terjual</span>
                        </a>
                        <span class="product-description">
                            Stok: ${product.stok_barang} | Harga: ${formatRupiah(product.harga)}
                        </span>
                    </div>
                </li>
            `).join('');

            $('#topProductsList').html(html);
        }
    } catch (error) {
        console.error('Error loading top products:', error);
    }
}

// Load penjualan terbaru
async function loadRecentSales() {
    try {
        const response = await fetch('http://localhost:8080/penjualan/getall', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        const result = await response.json();
        
        if (result.data) {
            const table = $('#tabelPenjualan').DataTable();
            table.clear();
            
            // Sort berdasarkan tanggal terbaru
            const recentSales = result.data
                .sort((a, b) => moment(b.tanggal).valueOf() - moment(a.tanggal).valueOf())
                .slice(0, 10); // Ambil 10 transaksi terbaru
            
            recentSales.forEach(penjualan => {
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
        console.error('Error loading recent sales:', error);
    }
}

// Tampilkan grafik pendapatan
function showPendapatanChart() {
    // Implementasi tampilan grafik pendapatan (modal atau halaman baru)
    Swal.fire({
        title: 'Grafik Pendapatan',
        text: 'Fitur ini akan segera hadir!',
        icon: 'info'
    });
}

// Tampilkan produk dengan stok menipis
function showLowStockProducts() {
    // Implementasi tampilan produk stok menipis
    window.location.href = 'produk.html?filter=low-stock';
}
