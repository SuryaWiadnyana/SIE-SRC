import { api } from './api.js';

// Fungsi untuk memuat data dashboard
async function loadDashboardData() {
    try {
        // Load product statistics
        const productStats = await api.products.getAll();
        const productCount = document.getElementById('totalProducts');
        if (productCount) {
            if (productStats.success && productStats.data) {
                const products = Array.isArray(productStats.data) ? productStats.data :
                               Array.isArray(productStats.data.data) ? productStats.data.data : [];
                productCount.textContent = products.length.toString();
            } else {
                productCount.textContent = '0';
            }
        }

        // Load user statistics
        const userStats = await api.users.getAll();
        const userCount = document.getElementById('activeUsers');
        if (userCount) {
            if (userStats.success && userStats.data) {
                const users = Array.isArray(userStats.data) ? userStats.data :
                            Array.isArray(userStats.data.data) ? userStats.data.data : [];
                userCount.textContent = users.length.toString();
            } else {
                userCount.textContent = '0';
            }
        }
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        const elements = ['totalProducts', 'activeUsers'];
        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.textContent = '0';
        });
    }
}

// Set username di navbar
function setUserInfo() {
    try {
        const userDataStr = localStorage.getItem('userData');
        if (!userDataStr) return;
        
        const userData = JSON.parse(userDataStr);
        console.log('Setting user info:', userData);
        
        const userDropdown = document.getElementById('userDropdown');
        if (userDropdown) {
            const usernameSpan = userDropdown.querySelector('span');
            if (usernameSpan && userData.username) {
                usernameSpan.textContent = userData.username;
            }
        }
    } catch (error) {
        console.error('Error setting user info:', error);
    }
}

// Format currency to Indonesian Rupiah
function formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount);
}

// Format date to Indonesian format
function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
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
    const ctx = document.getElementById('myAreaChart');
    if (!ctx) {
        console.warn('Sales chart element not found');
        return;
    }

    // Sample data for sales chart
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
            data: [10000000, 15000000, 12000000, 18000000, 15000000, 20000000, 
                   17000000, 25000000, 22000000, 30000000, 27000000, 35000000],
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
                            return formatCurrency(value);
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
                        return 'Penjualan: ' + formatCurrency(tooltipItem.yLabel);
                    }
                }
            }
        }
    });
}

// Initialize Product Chart
function initializeProductChart() {
    const ctx = document.getElementById('myPieChart');
    if (!ctx) {
        console.warn('Product chart element not found');
        return;
    }

    // Sample data for product categories
    const productData = {
        labels: ["Makanan", "Minuman", "Snack"],
        datasets: [{
            data: [45, 30, 25],
            backgroundColor: ['#4e73df', '#1cc88a', '#36b9cc'],
            hoverBackgroundColor: ['#2e59d9', '#17a673', '#2c9faf'],
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
                display: true,
                position: 'bottom'
            },
            cutoutPercentage: 80,
        },
    });
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Initializing dashboard...');
    
    // Check authentication first
    if (!checkAuth()) {
        console.log('Authentication check failed');
        window.location.href = '../login.html';
        return;
    }

    try {
        // Initialize logout button
        const logoutBtn = document.getElementById('logoutButton');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
        }

        // Load dashboard data
        await loadDashboardData();
        
        // Set user info in navbar
        setUserInfo();
        
        // Initialize charts if they exist
        if (typeof initializeCharts === 'function') {
            initializeCharts();
        }
    } catch (error) {
        console.error('Error initializing dashboard:', error);
    }
});