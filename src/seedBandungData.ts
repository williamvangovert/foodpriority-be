import pool from "./config/db";
import bcrypt from "bcryptjs";

async function seedBandungData() {
  console.log("[seeder] Starting Bandung, Parongpong, Cisarua, and Lembang data seeding...");

  try {
    const passwordHash = await bcrypt.hash("password123", 10);

    // 1. Seed Donor: Warung Dago Bandung
    const donorDago = await pool.query(
      `INSERT INTO "User" (nama_lengkap, username, no_hp, alamat, password, role, status)
       VALUES ('Warung Dago Bandung', 'warungdago', '08987654321', 'Jl. Ir. H. Juanda No. 120, Dago, Bandung', $1, 'donor', 'Terverifikasi')
       ON CONFLICT (username) DO UPDATE SET nama_lengkap = EXCLUDED.nama_lengkap
       RETURNING id`,
      [passwordHash]
    );
    const dagoId = donorDago.rows[0]?.id;

    // 2. Seed Donor: Resto Parongpong
    const donorParongpong = await pool.query(
      `INSERT INTO "User" (nama_lengkap, username, no_hp, alamat, password, role, status)
       VALUES ('Resto Parongpong', 'restoparongpong', '08987654322', 'Jl. Kolonel Masturi No. 50, Parongpong, Bandung Barat', $1, 'donor', 'Terverifikasi')
       ON CONFLICT (username) DO UPDATE SET nama_lengkap = EXCLUDED.nama_lengkap
       RETURNING id`,
      [passwordHash]
    );
    const parongpongId = donorParongpong.rows[0]?.id;

    // 3. Seed Donor: Cafe Cisarua Indah
    const donorCisarua = await pool.query(
      `INSERT INTO "User" (nama_lengkap, username, no_hp, alamat, password, role, status)
       VALUES ('Cafe Cisarua Indah', 'cafecisarua', '08987654323', 'Jl. Pasirhalang No. 15, Cisarua, Bandung Barat', $1, 'donor', 'Terverifikasi')
       ON CONFLICT (username) DO UPDATE SET nama_lengkap = EXCLUDED.nama_lengkap
       RETURNING id`,
      [passwordHash]
    );
    const cisaruaId = donorCisarua.rows[0]?.id;

    // 4. Seed Donor: Lembang Bakery
    const donorLembang = await pool.query(
      `INSERT INTO "User" (nama_lengkap, username, no_hp, alamat, password, role, status)
       VALUES ('Lembang Bakery', 'lembangbakery', '08987654324', 'Jl. Raya Lembang No. 250, Lembang, Bandung Barat', $1, 'donor', 'Terverifikasi')
       ON CONFLICT (username) DO UPDATE SET nama_lengkap = EXCLUDED.nama_lengkap
       RETURNING id`,
      [passwordHash]
    );
    const lembangId = donorLembang.rows[0]?.id;

    console.log("[seeder] Bandung region donors seeded successfully!");

    // 5. Clear old Bandung test donations to avoid clutter
    await pool.query(
      `DELETE FROM "Donasi" WHERE nama_makanan IN ('Paket Nasi Timbel', 'Sop Buntut Parongpong', 'Kue Balok Cisarua', 'Roti Susu Lembang')`
    );

    const now = new Date();

    // 6. Seed Donation: Bandung (Dago)
    // Coords: -6.8850, 107.6140
    const expiryDago = new Date(now.getTime() + 36 * 60 * 60 * 1000); // 36 jam
    await pool.query(
      `INSERT INTO "Donasi" (id_donatur, nama_makanan, deskripsi, foto_makanan, jumlah_porsi, latitude_donatur, longitude_donatur, batas_kadaluwarsa, kemasan, status_donasi)
       VALUES ($1, 'Paket Nasi Timbel', 'Nasi timbel komplit hangat khas Sunda.', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500', 10, -6.8850, 107.6140, $2, 'Baik', 'Tersedia')`,
      [dagoId, expiryDago]
    );

    // 7. Seed Donation: Parongpong
    // Coords: -6.8208, 107.5750
    const expiryParongpong = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 jam
    await pool.query(
      `INSERT INTO "Donasi" (id_donatur, nama_makanan, deskripsi, foto_makanan, jumlah_porsi, latitude_donatur, longitude_donatur, batas_kadaluwarsa, kemasan, status_donasi)
       VALUES ($1, 'Sop Buntut Parongpong', 'Sop buntut sapi hangat porsi keluarga.', 'https://images.unsplash.com/photo-1547592180-85f173990554?w=500', 5, -6.8208, 107.5750, $2, 'Sangat Baik', 'Tersedia')`,
      [parongpongId, expiryParongpong]
    );

    // 8. Seed Donation: Cisarua
    // Coords: -6.8050, 107.5450
    const expiryCisarua = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 jam
    await pool.query(
      `INSERT INTO "Donasi" (id_donatur, nama_makanan, deskripsi, foto_makanan, jumlah_porsi, latitude_donatur, longitude_donatur, batas_kadaluwarsa, kemasan, status_donasi)
       VALUES ($1, 'Kue Balok Cisarua', 'Kue balok cokelat meleleh khas Bandung.', 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=500', 12, -6.8050, 107.5450, $2, 'Baik', 'Tersedia')`,
      [cisaruaId, expiryCisarua]
    );

    // 9. Seed Donation: Lembang
    // Coords: -6.8188, 107.6180
    const expiryLembang = new Date(now.getTime() + 72 * 60 * 60 * 1000); // 72 jam
    await pool.query(
      `INSERT INTO "Donasi" (id_donatur, nama_makanan, deskripsi, foto_makanan, jumlah_porsi, latitude_donatur, longitude_donatur, batas_kadaluwarsa, kemasan, status_donasi)
       VALUES ($1, 'Roti Susu Lembang', 'Roti lembut dengan isian susu Lembang asli.', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500', 8, -6.8188, 107.6180, $2, 'Sangat Baik', 'Tersedia')`,
      [lembangId, expiryLembang]
    );

    console.log("[seeder] Bandung region donations seeded successfully!");
    process.exit(0);

  } catch (error) {
    console.error("[seeder] Error seeding Bandung data:", error);
    process.exit(1);
  }
}

seedBandungData();
