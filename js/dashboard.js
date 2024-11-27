// Dashboard functionality

document.addEventListener('DOMContentLoaded', function() {
    // Initialize dashboard data
    loadDashboardData();
});

async function loadDashboardData() {
    try {
        // Load products
        const products = await ApiService.getProducts();
        updateProductsCard(products);

        // Load sales
        const sales = await ApiService.getSales();
        updateSalesCard(sales);

        // Update charts
        updateCharts(products, sales);
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        // Show error message to user
        showErrorAlert('Failed to load dashboard data. Please try again later.');
    }
}

function updateProductsCard(products) {
    const totalProducts = products.length;
    document.getElementById('totalProducts').textContent = totalProducts;
}

function updateSalesCard(sales) {
    const totalSales = sales.length;
    const totalRevenue = sales.reduce((sum, sale) => sum + sale.amount, 0);
    
    document.getElementById('totalSales').textContent = totalSales;
    document.getElementById('totalRevenue').textContent = formatCurrency(totalRevenue);
}

function updateCharts(products, sales) {
    // Update Area Chart - Monthly Sales
    updateAreaChart(sales);
    
    // Update Pie Chart - Product Categories
    updatePieChart(products);
}

function updateAreaChart(sales) {
    // Group sales by month
    const monthlySales = groupSalesByMonth(sales);
    
    // Update the existing area chart
    const ctx = document.getElementById('myAreaChart');
    if (window.myAreaChart) {
        window.myAreaChart.data.labels = monthlySales.labels;
        window.myAreaChart.data.datasets[0].data = monthlySales.data;
        window.myAreaChart.update();
    }
}

function updatePieChart(products) {
    // Group products by category
    const categories = groupProductsByCategory(products);
    
    // Update the existing pie chart
    const ctx = document.getElementById('myPieChart');
    if (window.myPieChart) {
        window.myPieChart.data.labels = categories.labels;
        window.myPieChart.data.datasets[0].data = categories.data;
        window.myPieChart.update();
    }
}

// Utility functions
function formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR'
    }).format(amount);
}

function groupSalesByMonth(sales) {
    const months = {};
    
    sales.forEach(sale => {
        const date = new Date(sale.date);
        const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
        months[monthKey] = (months[monthKey] || 0) + sale.amount;
    });
    
    return {
        labels: Object.keys(months),
        data: Object.values(months)
    };
}

function groupProductsByCategory(products) {
    const categories = {};
    
    products.forEach(product => {
        categories[product.category] = (categories[product.category] || 0) + 1;
    });
    
    return {
        labels: Object.keys(categories),
        data: Object.values(categories)
    };
}

function showErrorAlert(message) {
    // Add error alert to the page
    const alertHtml = `
        <div class="alert alert-danger alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                <span aria-hidden="true">&times;</span>
            </button>
        </div>
    `;
    
    const container = document.querySelector('.container-fluid');
    container.insertAdjacentHTML('afterbegin', alertHtml);
}
