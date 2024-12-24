# Template Import Data Produk

File template ini dapat digunakan untuk mengimpor data produk ke dalam sistem SIE-SRC.

## Format File

### Dengan Header (produk_template_v2.csv)
File ini memiliki baris header yang menjelaskan setiap kolom:
- Kolom 1: ID Produk (biarkan kosong, akan digenerate otomatis)
- Kolom 2: Nama Produk (wajib diisi)
- Kolom 3: Kategori (wajib diisi)
- Kolom 4: Sub Kategori (wajib diisi)
- Kolom 5: Barcode (wajib diisi)
- Kolom 6: Harga (wajib diisi, angka)
- Kolom 7: Stok (wajib diisi, angka)

### Tanpa Header (produk_template_v2_noheader.csv)
File ini tidak memiliki baris header, langsung berisi data produk dengan urutan kolom yang sama.

## Cara Penggunaan

1. Pilih salah satu template yang sesuai (dengan atau tanpa header)
2. Salin template ke file baru
3. Isi data produk sesuai format:
   - Kolom ID Produk dikosongkan (akan digenerate otomatis)
   - Isi semua kolom lain sesuai ketentuan
4. Simpan file
5. Import menggunakan fitur "Import Data" di sistem

## Catatan Penting

- ID Produk akan digenerate otomatis oleh sistem
- Pastikan format data sesuai (teks untuk nama/kategori, angka untuk harga/stok)
- Jangan menggunakan tanda koma (,) dalam nama produk atau kategori
- Harga dan stok harus berupa angka bulat
- Barcode harus unik untuk setiap produk
- Jangan gunakan simbol mata uang (Rp) pada kolom harga
