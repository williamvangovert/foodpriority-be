import pool from "./config/db";

async function seedMoreParongpong() {
  console.log("[seeder] Seeding multiple donations in Parongpong area...");

  try {
    // 1. Get the Parongpong donor ID
    const donorRes = await pool.query(`SELECT id FROM "User" WHERE username = 'restoparongpong'`);
    let donorId = donorRes.rows[0]?.id;

    if (!donorId) {
      console.log("[seeder] Parongpong donor not found, creating it first...");
      // Fallback create donor
      const passwordHash = "$2a$10$wE4H7rRj7x7x7x7x7x7x7eR11N.xY5lZ1k7O6l.0M1Lg8zLw/sIki"; // prehashed password123
      const insertDonor = await pool.query(
        `INSERT INTO "User" (nama_lengkap, username, no_hp, alamat, password, role, status)
         VALUES ('Resto Parongpong', 'restoparongpong', '08987654322', 'Jl. Kolonel Masturi No. 50, Parongpong, Bandung Barat', $1, 'donor', 'Terverifikasi')
         RETURNING id`,
        [passwordHash]
      );
      donorId = insertDonor.rows[0].id;
    }

    // 2. Clear previous Parongpong mock donations to avoid duplicate keys or clutter
    const namesToClear = [
      'Nasi Goreng Parongpong',
      'Ayam Bakar Madu',
      'Bakso Cuanki Anget',
      'Siomay Bandung Asli',
      'Batagor Renyah Parongpong'
    ];
    await pool.query(
      `DELETE FROM "Donasi" WHERE nama_makanan = ANY($1)`,
      [namesToClear]
    );

    const now = new Date();

    // 3. Insert 5 different donations in Parongpong with slightly different coordinates (around -6.8208, 107.5750)
    const parongpongDonations = [
      {
        name: "Nasi Goreng Parongpong",
        desc: "Nasi goreng spesial dengan telur mata sapi dan kerupuk.",
        portions: 15,
        lat: -6.8220,
        lng: 107.5760,
        expiryHours: 12,
        kemasan: "Baik"
      },
      {
        name: "Ayam Bakar Madu",
        desc: "Ayam bakar kecap madu lezat gurih.",
        portions: 8,
        lat: -6.8190,
        lng: 107.5730,
        expiryHours: 24,
        kemasan: "Sangat Baik"
      },
      {
        name: "Bakso Cuanki Anget",
        desc: "Bakso cuanki hangat lengkap dengan siomay kering dan tahu.",
        portions: 20,
        lat: -6.8250,
        lng: 107.5780,
        expiryHours: 8, // Sooner expiry = higher priority in SAW!
        kemasan: "Baik"
      },
      {
        name: "Siomay Bandung Asli",
        desc: "Siomay ikan tenggiri asli Bandung dengan bumbu kacang kental.",
        portions: 10,
        lat: -6.8150,
        lng: 107.5710,
        expiryHours: 18,
        kemasan: "Sangat Baik"
      },
      {
        name: "Batagor Renyah Parongpong",
        desc: "Bakso tahu goreng renyah bumbu kacang terpisah.",
        portions: 14,
        lat: -6.8235,
        lng: 107.5745,
        expiryHours: 30,
        kemasan: "Baik"
      }
    ];

    for (const item of parongpongDonations) {
      const expiry = new Date(now.getTime() + item.expiryHours * 60 * 60 * 1000);
      await pool.query(
        `INSERT INTO "Donasi" (id_donatur, nama_makanan, deskripsi, foto_makanan, jumlah_porsi, latitude_donatur, longitude_donatur, batas_kadaluwarsa, kemasan, status_donasi)
         VALUES ($1, $2, $3, 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500', $4, $5, $6, $7, $8, 'Tersedia')`,
        [donorId, item.name, item.desc, item.portions, item.lat, item.lng, expiry, item.kemasan]
      );
      console.log(`[seeder] Seeded donation: ${item.name} at coordinate ${item.lat}, ${item.lng}`);
    }

    console.log("[seeder] Successfully seeded all Parongpong donations!");
    process.exit(0);

  } catch (error) {
    console.error("[seeder] Error seeding more Parongpong data:", error);
    process.exit(1);
  }
}

seedMoreParongpong();
