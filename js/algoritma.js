const BASE_URL = 'http://localhost:8080'; // Adjust this to match your backend URL

// Function to get product recommendations
async function getRekomendasiProduk(transactions, selectedProduct, minSupport) {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('Tidak terautentikasi');
        }

        const response = await fetch(`${BASE_URL}/algoritma/rekomendasi`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ transactions, selectedProduct, minSupport })
        });

        const data = await handleResponse(response);
        return { success: true, data };
    } catch (error) {
        console.error('Get recommendations error:', error);
        return { success: false, error: error.message };
    }
}

// Export the function for use in other modules
export { getRekomendasiProduk };
