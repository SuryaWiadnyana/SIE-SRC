const fs = require('fs');

// Fungsi untuk generate tanggal random antara dua tanggal
function randomDate(start, end) {
    const startDate = new Date(start).getTime();
    const endDate = new Date(end).getTime();
    const randomTime = startDate + Math.random() * (endDate - startDate);
    return new Date(randomTime).toISOString();
}

// Generate 200 transaksi dengan tanggal random
const startDate = '2020-01-01';
const endDate = '2025-04-11';
const numberOfTransactions = 200;
const sales = [];
const detailSales = [];

// Mulai dari PJ1389
let currentPenjualanId = 1301;
let currentDetailId = 1301;

for (let i = 0; i < numberOfTransactions; i++) {
    const tanggal = randomDate(startDate, endDate);
    const idPenjualan = `PJ${String(currentPenjualanId).padStart(3, '0')}`;
    
    // Data penjualan
    const transaction = {
        id_penjualan: idPenjualan,
        tanggal_penjualan: tanggal,
        jumlah_produk: 1,
        subtotal: 7000,
        total: 7000,
        user: {
            id_user: "US001",
            username: "AdminSRC",
            password: "$2a$10$CiiFxxsz0eZdjRKwg83BD.JKwyciFNVlJXwuH/ZoSoFcREergmD1K",
            role: "admin",
            status: "Aktif"
        },
        updated_at: new Date().toISOString()
    };
    
    // Data detail penjualan
    const detailPenjualan = {
        id_details: `DP${String(currentDetailId).padStart(3, '0')}`,
        penjualan: transaction,
        produk: [
            {
                id_produk: "231",
                nama_produk: "Dettol Sabun Mandi",
                kategori: {
                    id_kategori: "KT006",
                    nama_kategori: "Perlengkapan Mandi"
                },
                subkategori: {
                    id_subkategori: "SK020",
                    nama_subkategori: "Sabun Mandi",
                    kategori: {
                        id_kategori: "KT006",
                        nama_kategori: "Perlengkapan Mandi"
                    }
                },
                kode_produk: "8999999038768",
                harga_produk: 7000,
                tanggal_kedaluwarsa: "2025-10-20T00:00:00Z",
                stok_barang: 45,
                updated_at: "2025-04-11T13:26:23.324Z",
                is_deleted: null
            }
        ],
        total_pendapatan: 7000
    };
    currentDetailId++;
    
    sales.push(transaction);
    detailSales.push(detailPenjualan);
    currentPenjualanId++;
}

// Tulis ke file untuk di-copy ke MongoDB Compass
const mongoCommands = `
db.penjualan.insertMany(${JSON.stringify(sales, null, 2)});
db.detail_penjualan.insertMany(${JSON.stringify(detailSales, null, 2)});
`;

fs.writeFileSync('mongo_insert_single.js', mongoCommands);

console.log('File mongo_insert_single.js telah dibuat.');
console.log('Silakan copy isi file tersebut dan paste ke MongoDB Compass Shell.');
