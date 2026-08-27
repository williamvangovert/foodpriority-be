import pool from "./config/db";
import bcrypt from "bcryptjs";

async function seedUnaiData() {
  console.log("[seeder] Seeding donations around Universitas Advent Indonesia (UNAI)...");

  try {
    const passwordHash = await bcrypt.hash("password123", 10);

    // 1. Seed Donor: Kantin UNAI
    const donorUnai = await pool.query(
      `INSERT INTO "User" (nama_lengkap, username, no_hp, alamat, password, role, status)
       VALUES ('Kantin Sehat UNAI', 'kantinunai', '08987654329', 'Jl. Kolonel Masturi No. 96, Universitas Advent Indonesia, Parongpong', $1, 'donor', 'Terverifikasi')
       ON CONFLICT (username) DO UPDATE SET nama_lengkap = EXCLUDED.nama_lengkap
       RETURNING id`,
      [passwordHash]
    );
    const unaiDonorId = donorUnai.rows[0]?.id;

    console.log("[seeder] UNAI region donor seeded successfully!");

    // 2. Clear old UNAI donations to avoid duplicate keys or clutter
    const namesToClear = [
      'Nasi Goreng Vegetarian',
      'Roti Gandum Sehat',
      'Susu Kedelai Murni',
      'Sate Jamur Tiram'
    ];
    await pool.query(
      `DELETE FROM "Donasi" WHERE nama_makanan = ANY($1)`,
      [namesToClear]
    );

    const now = new Date();

    // 3. Insert 4 different donations around Universitas Advent Indonesia (UNAI) center (-6.8122, 107.5936)
    const unaiDonations = [
      {
        name: "Nasi Goreng Vegetarian",
        desc: "Nasi goreng sehat tanpa daging menggunakan bahan-bahan organik kantin kampus.",
        portions: 12,
        lat: -6.8123,
        lng: 107.5935,
        expiryHours: 12,
        kemasan: "Baik"
      },
      {
        name: "Roti Gandum Sehat",
        desc: "Roti gandum utuh buatan rumah, kaya serat dan baik untuk kesehatan.",
        portions: 15,
        lat: -6.8118,
        lng: 107.5942,
        expiryHours: 36,
        kemasan: "Sangat Baik"
      },
      {
        name: "Susu Kedelai Murni",
        desc: "Susu kedelai murni hangat tanpa pemanis buatan, dibuat segar pagi ini.",
        portions: 20,
        lat: -6.8130,
        lng: 107.5930,
        expiryHours: 8, // Very soon expiry = High SAW priority!
        kemasan: "Baik"
      },
      {
        name: "Sate Jamur Tiram",
        desc: "Sate jamur tiram bumbu kacang gurih khas vegetarian.",
        portions: 10,
        lat: -6.8128,
        lng: 107.5945,
        expiryHours: 18,
        kemasan: "Sangat Baik"
      }
    ];

    for (const item of unaiDonations) {
      const expiry = new Date(now.getTime() + item.expiryHours * 60 * 60 * 1000);
      await pool.query(
        `INSERT INTO "Donasi" (id_donatur, nama_makanan, deskripsi, foto_makanan, jumlah_porsi, latitude_donatur, longitude_donatur, batas_kadaluwarsa, kemasan, status_donasi)
         VALUES ($1, $2, $3, 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500', $4, $5, $6, $7, $8, 'Tersedia')`,
        [unaiDonorId, item.name, item.desc, item.portions, item.lat, item.lng, expiry, item.kemasan]
      );
      console.log(`[seeder] Seeded donation around UNAI: ${item.name} at coordinate ${item.lat}, ${item.lng}`);
    }

    console.log("[seeder] Successfully seeded all UNAI area donations!");
    process.exit(0);

  } catch (error) {
    console.error("[seeder] Error seeding UNAI data:", error);
    process.exit(1);
  }
}

seedUnaiData();
