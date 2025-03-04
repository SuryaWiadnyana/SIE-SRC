// Initialize jsPDF
window.jsPDF = window.jspdf.jsPDF;

document.addEventListener("DOMContentLoaded", function () {
  // Check authentication
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "../login.html";
    return;
  }

  const API_URL = "http://localhost:8080";

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("id-ID", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Fetch sales data
  const fetchSalesData = async (startDate, endDate) => {
    try {
      const response = await fetch(`${API_URL}/penjualan/getall`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.clear();
          window.location.href = "../login.html";
          return;
        }
        throw new Error("Gagal mengambil data penjualan");
      }

      const result = await response.json();
      const data = result.data;

      return data.filter((sale) => {
        const saleDate = new Date(sale.tanggal_penjualan);
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59);
        return saleDate >= start && saleDate <= end;
      });
    } catch (error) {
      console.error("Error mengambil data penjualan:", error);
      throw error;
    }
  };

  // Fetch product data
  const fetchProductData = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        window.location.href = "../login.html";
        return;
      }

      const response = await fetch(`${API_URL}/produk/getallproduk`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.clear();
          window.location.href = "../login.html";
          return;
        }
        const errorData = await response.json();
        throw new Error(errorData.message || "Gagal mengambil data produk");
      }

      const result = await response.json();
      console.log("Raw API response:", result); // Debug log
      
      if (!result || !result.data) {
        console.error("Invalid response format:", result);
        throw new Error("Format response tidak valid - data tidak ditemukan");
      }

      // Extract products from the response format
      const products = result.data.map(item => item.produk || item).filter(Boolean);
      console.log("Processed products:", products); // Debug log

      if (products.length === 0) {
        throw new Error("Tidak ada data produk yang tersedia");
      }

      return products.map(product => ({
        id_produk: product.id_produk || "-",
        nama_produk: product.nama_produk || "-",
        kategori: product.kategori || "-",
        sub_kategori: product.sub_kategori || "-",
        harga_produk: product.harga_produk ? parseInt(product.harga_produk) : 0,
        stok_barang: product.stok_barang || 0
      })).filter(product => product.id_produk !== "-");
    } catch (error) {
      console.error("Error in fetchProductData:", error);
      throw new Error(`Gagal mengambil data produk: ${error.message}`);
    }
  };

  // Generate PDF button click handler
  document
    .getElementById("generatePdf")
    .addEventListener("click", async function () {
      try {
        const reportType = document.getElementById("reportType").value;
        const doc = new jsPDF();

        if (reportType === "penjualan") {
          const startDate = document.getElementById("startDate").value;
          const endDate = document.getElementById("endDate").value;

          if (!startDate || !endDate) {
            alert("Mohon pilih periode tanggal untuk laporan penjualan");
            return;
          }

          const reportData = await fetchSalesData(startDate, endDate);

          // Add header
          doc.setFontSize(16);
          doc.text(
            "Laporan Penjualan",
            doc.internal.pageSize.getWidth() / 2,
            20,
            { align: "center" }
          );

          // Add period
          doc.setFontSize(12);
          doc.text(
            `Periode: ${formatDate(startDate)} s/d ${formatDate(endDate)}`,
            20,
            30
          );

          // Add table
          const tableData = reportData.map((sale, index) => [
            index + 1,
            formatDate(sale.tanggal_penjualan),
            sale.id_penjualan,
            formatCurrency(sale.total),
          ]);

          // Calculate total
          const total = reportData.reduce((sum, sale) => sum + sale.total, 0);
          tableData.push(["", "", "Total Pendapatan:", formatCurrency(total)]);

          doc.autoTable({
            startY: 40,
            head: [["No", "Tanggal Penjual", "ID Penjualan", "Total"]],
            body: tableData,
            theme: "grid",
            headStyles: { fillColor: [41, 128, 185] },
            footStyles: { fillColor: [41, 128, 185] },
          });

          doc.save(`laporan_penjualan_${startDate}_${endDate}.pdf`);
        } else if (reportType === "produk") {
          try {
            const productData = await fetchProductData();
            console.log("Product data for PDF:", productData);

            if (!productData || productData.length === 0) {
              alert("Tidak ada data produk yang tersedia");
              return;
            }

            // Add header
            doc.setFontSize(16);
            doc.text(
              "Laporan Produk",
              doc.internal.pageSize.getWidth() / 2,
              20,
              { align: "center" }
            );

            // Add current date
            doc.setFontSize(12);
            doc.text(
              `Tanggal: ${formatDate(new Date())}`,
              20,
              30
            );

            // Prepare table data
            const tableData = productData.map((product, index) => [
              index + 1,
              product.id_produk,
              product.nama_produk,
              product.kategori,
              product.sub_kategori,
              formatCurrency(product.harga_produk),
              product.stok_barang.toString()
            ]);

            // Add table
            doc.autoTable({
              startY: 40,
              head: [["No", "ID Produk", "Nama Produk", "Kategori", "Sub Kategori", "Harga", "Stok"]],
              body: tableData,
              theme: "grid",
              headStyles: { fillColor: [41, 128, 185] },
              columnStyles: {
                0: { cellWidth: 10 }, // No
                1: { cellWidth: 25 }, // ID Produk
                2: { cellWidth: 50 }, // Nama Produk
                3: { cellWidth: 30 }, // Kategori
                4: { cellWidth: 30 }, // Sub Kategori
                5: { cellWidth: 30 }, // Harga
                6: { cellWidth: 20 }  // Stok
              },
              margin: { left: 10 },
              didDrawPage: function(data) {
                // Add page number at the bottom
                doc.text(
                  `Halaman ${doc.internal.getCurrentPageInfo().pageNumber}`,
                  data.settings.margin.left,
                  doc.internal.pageSize.height - 10
                );
              }
            });

            doc.save(`laporan_produk_${formatDate(new Date()).replace(/ /g, "_")}.pdf`);
          } catch (error) {
            console.error("Error generating product report:", error);
            alert("Gagal membuat laporan produk: " + error.message);
          }
        }
      } catch (error) {
        console.error("Error membuat PDF:", error);
        alert("Gagal membuat laporan: " + error.message);
      }
    });

  // Set user info and initialize components
  const username = localStorage.getItem("username");
  if (username) {
    document.getElementById("userDropdown").innerHTML = `
                    <span class="mr-2 d-none d-lg-inline text-gray-600 small">${username}</span>
                    <img class="img-profile rounded-circle" src="../img/undraw_profile.svg">
                `;
  }

  // Initialize date inputs with current month
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  document.getElementById("startDate").value = firstDayOfMonth
    .toISOString()
    .split("T")[0];
  document.getElementById("endDate").value = today.toISOString().split("T")[0];

  // Handle report type change
  document.getElementById("reportType").addEventListener("change", function () {
    const dateRangeFields = document.querySelectorAll(".date-range");
    dateRangeFields.forEach((field) => {
      field.style.display = this.value === "penjualan" ? "block" : "none";
    });
  });

  // Set initial visibility of date range fields
  const initialReportType = document.getElementById("reportType").value;
  const dateRangeFields = document.querySelectorAll(".date-range");
  dateRangeFields.forEach((field) => {
    field.style.display = initialReportType === "penjualan" ? "block" : "none";
  });

  // Handle logout
  document
    .getElementById("logoutButton")
    .addEventListener("click", function () {
      localStorage.clear();
      window.location.href = "../login.html";
    });
});
