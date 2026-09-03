import pool from "./config/db";
import bcrypt from "bcryptjs";

async function seedTestData() {
  console.log("[seeder] Starting mock data seeding...");

  try {
    // 1. Create Donors
    const passwordHash = await bcrypt.hash("password123", 10);

    // Donor 1
    const donor1 = await pool.query(
      `INSERT INTO "User" (nama_lengkap, username, no_hp, alamat, password, role, status)
       VALUES ('Restoran Budi', 'restobudi', '08123456781', 'Jl. Sudirman No. 12, Jakarta', $1, 'donor', 'Terverifikasi')
       ON CONFLICT (username) DO UPDATE SET nama_lengkap = EXCLUDED.nama_lengkap
       RETURNING id`,
      [passwordHash]
    );
    const donor1Id = donor1.rows[0]?.id;

    // Donor 2
    const donor2 = await pool.query(
      `INSERT INTO "User" (nama_lengkap, username, no_hp, alamat, password, role, status)
       VALUES ('Toko Roti Indah', 'rotiindah', '08123456782', 'Jl. Thamrin No. 45, Jakarta', $1, 'donor', 'Terverifikasi')
       ON CONFLICT (username) DO UPDATE SET nama_lengkap = EXCLUDED.nama_lengkap
       RETURNING id`,
      [passwordHash]
    );
    const donor2Id = donor2.rows[0]?.id;

    // Donor 3
    const donor3 = await pool.query(
      `INSERT INTO "User" (nama_lengkap, username, no_hp, alamat, password, role, status)
       VALUES ('Supermarket Segar', 'supersegar', '08123456783', 'Jl. Gatot Subroto No. 78, Jakarta', $1, 'donor', 'Terverifikasi')
       ON CONFLICT (username) DO UPDATE SET nama_lengkap = EXCLUDED.nama_lengkap
       RETURNING id`,
      [passwordHash]
    );
    const donor3Id = donor3.rows[0]?.id;

    console.log("[seeder] Donors seeded successfully!");

    // 2. Clear old test donations to avoid duplicate testing spam
    await pool.query(`DELETE FROM "Donasi" WHERE nama_makanan IN ('Nasi Box Budi', 'Roti Tawar Indah', 'Apel Manis Segar')`);

    // 3. Create Donations
    const now = new Date();
    
    // Donation 1 (Restoran Budi - Nasi Box)
    // Coords: -6.2100, 106.8450 (close to Jakarta center -6.2088, 106.8456)
    const expiry1 = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days
    await pool.query(
      `INSERT INTO "Donasi" (id_donatur, nama_makanan, deskripsi, foto_makanan, jumlah_porsi, latitude_donatur, longitude_donatur, batas_kadaluwarsa, kemasan, status_donasi)
       VALUES ($1, 'Nasi Box Budi', 'Nasi dengan lauk ayam goreng dan sambal.', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500', 15, -6.2100, 106.8450, $2, 'Baik', 'Tersedia')`,
      [donor1Id, expiry1]
    );

    // Donation 2 (Toko Roti Indah - Roti Tawar)
    // Coords: -6.2050, 106.8500
    const expiry2 = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000); // 4 days
    await pool.query(
      `INSERT INTO "Donasi" (id_donatur, nama_makanan, deskripsi, foto_makanan, jumlah_porsi, latitude_donatur, longitude_donatur, batas_kadaluwarsa, kemasan, status_donasi)
       VALUES ($1, 'Roti Tawar Indah', 'Roti tawar gandum kupas utuh.', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500', 8, -6.2050, 106.8500, $2, 'Sangat Baik', 'Tersedia')`,
      [donor2Id, expiry2]
    );

    // Donation 3 (Supermarket Segar - Apel Manis)
    // Coords: -6.2200, 106.8350
    const expiry3 = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000); // 6 days
    await pool.query(
      `INSERT INTO "Donasi" (id_donatur, nama_makanan, deskripsi, foto_makanan, jumlah_porsi, latitude_donatur, longitude_donatur, batas_kadaluwarsa, kemasan, status_donasi)
       VALUES ($1, 'Apel Manis Segar', 'Apel merah manis segar fuji.', 'https://images.unsplash.com/photo-1619546813926-a78fa6372cd2?w=500', 25, -6.2200, 106.8350, $2, 'Sedang', 'Tersedia')`,
      [donor3Id, expiry3]
    );

    console.log("[seeder] Test donations seeded successfully!");
    process.exit(0);

  } catch (error) {
    console.error("[seeder] Error seeding test data:", error);
    process.exit(1);
  }
}

seedTestData();
