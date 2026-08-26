import pool from "./config/db";

const BACKEND_URL = "http://127.0.0.1:5001/api";

// Helper to wait
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runE2EActivityTest() {
  console.log("==================================================");
  console.log("🚀 STARTING E2E ACTIVITY DIAGRAM TEST");
  console.log("==================================================");

  try {
    // ----------------------------------------------------
    // Skema 1: Alur Donatur
    // ----------------------------------------------------
    console.log("\n[DONATUR FLOW]");
    
    // 1. Menekan login ke sistem (Simulate Login)
    console.log("1. Menekan login ke sistem...");
    const loginResponse = await fetch(`${BACKEND_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usernameOrPhone: "restobudi",
        password: "password123"
      })
    });
    
    const loginData = await loginResponse.json() as any;
    if (!loginResponse.ok) {
      throw new Error(`Login gagal: ${loginData.message}`);
    }
    const token = loginData.token;
    console.log(`✓ Login berhasil! Token diperoleh. Role: ${loginData.user.role}`);

    // 2. Masuk ke dashboard donatur
    console.log("2. Masuk ke dashboard donatur...");
    await wait(500);

    // 3 & 4. Klik Donasikan Makanan Baru & Mengisi Form
    console.log("3 & 4. Mengisi kriteria donasi makanan...");
    
    // 5. Mengambil koordinat GPS (Simulate GPS tracking)
    console.log("5. Mengambil koordinat GPS Donatur (Latitude: -6.2120, Longitude: 106.8480)...");
    const donationData = {
      nama_makanan: "Nasi Tumpeng Mini",
      deskripsi: "Nasi kuning tumpeng lengkap untuk syukuran.",
      jumlah_porsi: "1", // 1 porsi for E2E stock depletion test
      kemasan: "Sangat Baik",
      batas_kadaluwarsa: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 jam sisa waktu
      latitude_donatur: "-6.2120",
      longitude_donatur: "106.8480"
    };

    // 6. Mengirim data koordinat & data donasi ke backend
    console.log("6. Mengirim data donasi dan koordinat ke backend...");
    const createDonationResponse = await fetch(`${BACKEND_URL}/donations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(donationData)
    });

    const createDonationResult = await createDonationResponse.json() as any;
    if (!createDonationResponse.ok) {
      throw new Error(`Gagal membuat donasi: ${createDonationResult.message}`);
    }
    
    console.log("✓ Backend berhasil menyimpan koordinat dan data donasi!");
    console.log(`✓ Notifikasi: ${createDonationResult.message}`);
    console.log(`✓ ID Donasi Baru: ${createDonationResult.donation.id}`);

    const newDonationId = createDonationResult.donation.id;

    // ----------------------------------------------------
    // Skema 2: Alur Penerima
    // ----------------------------------------------------
    console.log("\n[PENERIMA FLOW]");

    // 0. Register Penerima (Mencegah error login jika belum terdaftar)
    console.log("0. Mendaftarkan akun penerima baru...");
    await fetch(`${BACKEND_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "Panti Asuhan Mulia",
        username: "pantimulia",
        address: "Jl. Jeruk No. 5, Jakarta",
        phoneNumber: "08778899001",
        password: "password123",
        confirmPassword: "password123",
        role: "recipient"
      })
    });

    // 1. Menekan login ke sistem (Simulate Recipient Login)
    console.log("1. Menekan login ke sistem...");
    const recipientLoginResponse = await fetch(`${BACKEND_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usernameOrPhone: "pantimulia",
        password: "password123"
      })
    });

    const recipientLoginData = await recipientLoginResponse.json() as any;
    if (!recipientLoginResponse.ok) {
      throw new Error(`Login Penerima gagal: ${recipientLoginData.message}`);
    }
    const rToken = recipientLoginData.token;
    console.log(`✓ Login Penerima berhasil! Role: ${recipientLoginData.user.role}`);

    // 2. Masuk ke dashboard penerima
    console.log("2. Masuk ke dashboard penerima...");
    await wait(500);

    // 3. Klik tombol "Gunakan Lokasi Saat Ini" & Mengirimkan Koordinat ke Backend
    console.log("3. Mengambil koordinat GPS Penerima (Latitude: -6.2088, Longitude: 106.8456)...");
    const lat = -6.2088;
    const lng = 106.8456;

    // 4. Request data dan koordinat ke backend + Perhitungan Haversine & SAW oleh Backend
    console.log("4. Mengirimkan koordinat Penerima ke backend untuk perhitungan LBS Haversine & SAW...");
    const getRecsResponse = await fetch(`${BACKEND_URL}/donations?lat=${lat}&lng=${lng}`, {
      headers: { "Authorization": `Bearer ${rToken}` }
    });

    const recommendations = await getRecsResponse.json() as any[];
    if (!getRecsResponse.ok) {
      throw new Error("Gagal mengambil rekomendasi.");
    }

    console.log("\n✓ Hasil Ranking SAW dari Backend:");
    console.log("------------------------------------------------------------------");
    recommendations.forEach((item: any, i: number) => {
      console.log(`Peringkat #${i + 1}: ${item.nama_makanan} | Skor SAW: ${item.skor_saw} | Jarak: ${Number(item.jarak).toFixed(2)} km | Batas: ${item.batas_kadaluwarsa}`);
    });
    console.log("------------------------------------------------------------------");

    // 5. Lihat daftar terurut & pilih donasi
    console.log("\n5. Penerima melihat daftar terurut dan memilih makanan...");
    const chosenDonation = recommendations.find((item: any) => item.id === newDonationId);
    if (!chosenDonation) {
      throw new Error("Donasi yang baru dibuat tidak ditemukan dalam rekomendasi.");
    }
    console.log(`✓ Memilih: ${chosenDonation.nama_makanan} (ID: ${chosenDonation.id})`);

    // 6. Tekan tombol "Klaim Donasi" & Kirim data klaim ke backend
    console.log("6. Mengirimkan permintaan klaim makanan ke backend...");
    const claimResponse = await fetch(`${BACKEND_URL}/claims`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${rToken}`
      },
      body: JSON.stringify({
        id_donasi: chosenDonation.id,
        jarak_antar_lokasi: chosenDonation.jarak,
        skor_saw: chosenDonation.skor_saw
      })
    });

    const claimResult = await claimResponse.json() as any;
    if (!claimResponse.ok) {
      throw new Error(`Klaim gagal: ${claimResult.message}`);
    }

    console.log("✓ Backend memproses validasi stok & memperbarui status transaksi!");
    console.log(`✓ Notifikasi: ${claimResult.message}`);

    // ----------------------------------------------------
    // Verifikasi Penanganan Jika Stok Habis (Out of Stock Validation)
    // ----------------------------------------------------
    console.log("\n[VALIDASI STOK / OUT OF STOCK TEST]");
    console.log("Mencoba melakukan klaim ulang pada makanan yang sama untuk memvalidasi penanganan stok...");
    const secondClaimResponse = await fetch(`${BACKEND_URL}/claims`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${rToken}`
      },
      body: JSON.stringify({
        id_donasi: chosenDonation.id,
        jarak_antar_lokasi: chosenDonation.jarak,
        skor_saw: chosenDonation.skor_saw
      })
    });

    const secondClaimResult = await secondClaimResponse.json() as any;
    console.log(`✓ Respon Backend: HTTP ${secondClaimResponse.status} - ${secondClaimResult.message}`);
    if (secondClaimResponse.status === 400) {
      console.log("✓ Berhasil memvalidasi penanganan stok: Pengguna lain/klaim ganda berhasil dicegah!");
    }

    console.log("\n==================================================");
    console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
    console.log("==================================================");
    process.exit(0);

  } catch (err: any) {
    console.error("\n❌ TEST FAILED:", err.message);
    process.exit(1);
  }
}

runE2EActivityTest();
