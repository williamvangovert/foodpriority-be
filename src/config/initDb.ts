import pool from "./db";
import bcrypt from "bcryptjs";

const createTablesQuery = `
  -- Create User Table
  CREATE TABLE IF NOT EXISTS "User" (
    id SERIAL PRIMARY KEY,
    role VARCHAR(50) NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    nama_lengkap VARCHAR(255) NOT NULL,
    alamat TEXT,
    no_hp VARCHAR(20),
    status VARCHAR(50) DEFAULT 'Terverifikasi',
    join_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- Create Donasi Table
  CREATE TABLE IF NOT EXISTS "Donasi" (
    id SERIAL PRIMARY KEY,
    id_donatur INTEGER REFERENCES "User"(id) ON DELETE CASCADE,
    nama_makanan VARCHAR(255) NOT NULL,
    deskripsi TEXT,
    foto_makanan VARCHAR(255),
    jumlah_porsi INTEGER NOT NULL,
    latitude_donatur DOUBLE PRECISION,
    longitude_donatur DOUBLE PRECISION,
    waktu_input TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    batas_kadaluwarsa TIMESTAMP NOT NULL,
    status_donasi VARCHAR(50) DEFAULT 'Tersedia',
    kemasan VARCHAR(50) DEFAULT 'Baik'
  );

  -- Create Transaksi_Klaim Table
  CREATE TABLE IF NOT EXISTS "Transaksi_Klaim" (
    id SERIAL PRIMARY KEY,
    id_donasi INTEGER REFERENCES "Donasi"(id) ON DELETE CASCADE,
    id_penerima INTEGER REFERENCES "User"(id) ON DELETE CASCADE,
    waktu_klaim TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    jarak_antar_lokasi DOUBLE PRECISION,
    skor_saw DOUBLE PRECISION,
    status_klaim VARCHAR(50) DEFAULT 'Menunggu'
  );

  -- Create Pengaturan_SAW Table
  CREATE TABLE IF NOT EXISTS "Pengaturan_SAW" (
    id SERIAL PRIMARY KEY,
    id_admin INTEGER REFERENCES "User"(id) ON DELETE CASCADE,
    nama_kriteria VARCHAR(100) UNIQUE NOT NULL,
    nilai_bobot DOUBLE PRECISION NOT NULL,
    tipe VARCHAR(20) NOT NULL -- 'cost' or 'benefit'
  );
`;

const seedData = async () => {
  const client = await pool.connect();
  try {
    console.log("[db] Initializing database tables...");
    await client.query(createTablesQuery);
    console.log("[db] Tables created or already exist.");

    // Seed default admin user
    const adminCheck = await client.query('SELECT * FROM "User" WHERE username = $1', ["admin"]);
    let adminId: number;

    if (adminCheck.rows.length === 0) {
      console.log("[db] Seeding default admin user...");
      const hashedPassword = await bcrypt.hash("admin123", 10);
      const res = await client.query(
        `INSERT INTO "User" (role, username, password, nama_lengkap, alamat, no_hp)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        ["admin", "admin", hashedPassword, "Super Admin", "Sistem Utama FoodPriority", "080000000000"]
      );
      adminId = res.rows[0].id;
      console.log("[db] Default admin created successfully.");
    } else {
      adminId = adminCheck.rows[0].id;
      console.log("[db] Admin user already exists.");
    }

    // Re-seed SAW criteria weights (clear old ones to enforce new schema)
    console.log("[db] Seeding default SAW criteria weights (2 criteria: Jarak & Kadaluwarsa)...");
    await client.query('DELETE FROM "Pengaturan_SAW"');
    const defaultCriteria = [
      { name: "jarak", weight: 0.40, type: "cost" },
      { name: "kadaluwarsa", weight: 0.60, type: "cost" }
    ];

    for (const criteria of defaultCriteria) {
      await client.query(
        `INSERT INTO "Pengaturan_SAW" (id_admin, nama_kriteria, nilai_bobot, tipe)
         VALUES ($1, $2, $3, $4)`,
        [adminId, criteria.name, criteria.weight, criteria.type]
      );
    }
    console.log("[db] Default SAW criteria weights created successfully.");

  } catch (error) {
    console.error("[db] Error initializing database:", error);
  } finally {
    client.release();
  }
};

seedData().then(() => {
  console.log("[db] Database initialization completed.");
  process.exit(0);
});
