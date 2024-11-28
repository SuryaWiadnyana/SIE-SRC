// Dashboard Initialization
document.addEventListener('DOMContentLoaded', async function() {
    try {
        await loadDashboardData();
        initializeCharts();
    } catch (error) {
        console.error('Error initializing dashboard:', error);
    }
});

// Load Dashboard Data
async function loadDashboardData() {
    try {
        // Simulasi data dashboard (ganti dengan API call nanti)
        const dummyData = {
            monthlySales: 150000000,
            totalProducts: 250,
            bestSellingProduct: "Produk A",
            totalTransactions: 1500
        };

        // Update card values - dengan pengecekan elemen
        const updateElement = (id, value) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        };

        updateElement('monthlySales', formatCurrency(dummyData.monthlySales));
        updateElement('totalProducts', dummyData.totalProducts);
        updateElement('bestSellingProduct', dummyData.bestSellingProduct);
        updateElement('totalTransactions', dummyData.totalTransactions);

    } catch (error) {
        console.error('Error loading dashboard data:', error);
        throw new Error('Failed to load dashboard data');
    }
}

// Initialize Charts
function initializeCharts() {
    try {
        initializeSalesChart();
        initializeProductChart();
    } catch (error) {
        console.error('Error initializing charts:', error);
    }
}

// Initialize Sales Chart
function initializeSalesChart() {
    const ctx = document.getElementById('salesChart');
    if (!ctx) {
        console.log('Sales chart element not found');
        return;
    }

    // Dummy data untuk grafik penjualan
    const salesData = {
        labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
        datasets: [{
            label: "Penjualan",
            lineTension: 0.3,
            backgroundColor: "rgba(78, 115, 223, 0.05)",
            borderColor: "rgba(78, 115, 223, 1)",
            pointRadius: 3,
            pointBackgroundColor: "rgba(78, 115, 223, 1)",
            pointBorderColor: "rgba(78, 115, 223, 1)",
            pointHoverRadius: 3,
            pointHoverBackgroundColor: "rgba(78, 115, 223, 1)",
            pointHoverBorderColor: "rgba(78, 115, 223, 1)",
            pointHitRadius: 10,
            pointBorderWidth: 2,
            data: [0, 10000, 5000, 15000, 10000, 20000, 15000, 25000, 20000, 30000, 25000, 40000],
        }],
    };

    new Chart(ctx, {
        type: 'line',
        data: salesData,
        options: {
            maintainAspectRatio: false,
            layout: {
                padding: {
                    left: 10,
                    right: 25,
                    top: 25,
                    bottom: 0
                }
            },
            scales: {
                xAxes: [{
                    gridLines: {
                        display: false,
                        drawBorder: false
                    },
                    ticks: {
                        maxTicksLimit: 7
                    }
                }],
                yAxes: [{
                    ticks: {
                        maxTicksLimit: 5,
                        padding: 10,
                        callback: function(value) {
                            return 'Rp' + value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                        }
                    },
                    gridLines: {
                        color: "rgb(234, 236, 244)",
                        zeroLineColor: "rgb(234, 236, 244)",
                        drawBorder: false,
                        borderDash: [2],
                        zeroLineBorderDash: [2]
                    }
                }],
            },
            legend: {
                display: false
            },
            tooltips: {
                backgroundColor: "rgb(255,255,255)",
                bodyFontColor: "#858796",
                titleMarginBottom: 10,
                titleFontColor: '#6e707e',
                titleFontSize: 14,
                borderColor: '#dddfeb',
                borderWidth: 1,
                xPadding: 15,
                yPadding: 15,
                displayColors: false,
                intersect: false,
                mode: 'index',
                caretPadding: 10,
                callbacks: {
                    label: function(tooltipItem, chart) {
                        var datasetLabel = chart.datasets[tooltipItem.datasetIndex].label || '';
                        return datasetLabel + ': Rp' + tooltipItem.yLabel.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                    }
                }
            }
        }
    });
}

// Initialize Product Chart
function initializeProductChart() {
    const ctx = document.getElementById('productChart');
    if (!ctx) {
        console.log('Product chart element not found');
        return;
    }

    // Dummy data untuk grafik produk
    const productData = {
        labels: ["Produk A", "Produk B", "Produk C", "Produk D", "Produk E"],
        datasets: [{
            data: [55, 30, 15, 10, 5],
            backgroundColor: ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b'],
            hoverBackgroundColor: ['#2e59d9', '#17a673', '#2c9faf', '#dda20a', '#be2617'],
            hoverBorderColor: "rgba(234, 236, 244, 1)",
        }],
    };

    new Chart(ctx, {
        type: 'doughnut',
        data: productData,
        options: {
            maintainAspectRatio: false,
            tooltips: {
                backgroundColor: "rgb(255,255,255)",
                bodyFontColor: "#858796",
                borderColor: '#dddfeb',
                borderWidth: 1,
                xPadding: 15,
                yPadding: 15,
                displayColors: false,
                caretPadding: 10,
            },
            legend: {
                display: false
            },
            cutoutPercentage: 80,
        },
    });
}

// Format Currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}
