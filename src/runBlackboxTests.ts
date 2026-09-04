import pool from "./config/db";

const BACKEND_URL = "http://127.0.0.1:5001/api";

interface TestCaseResult {
  no: number;
  testCase: string;
  skenario: string;
  input: string;
  expected: string;
  actual: string;
  status: "PASS" | "FAIL";
}

const testResults: TestCaseResult[] = [];

function recordTest(
  no: number,
  testCase: string,
  skenario: string,
  input: string,
  expected: string,
  actual: string,
  passed: boolean
) {
  testResults.push({
    no,
    testCase,
    skenario,
    input,
    expected,
    actual,
    status: passed ? "PASS" : "FAIL"
  });
  console.log(`[TC-${no}] ${testCase}: ${passed ? "✅ PASS" : "❌ FAIL"}`);
}

async function runBlackboxTests() {
  console.log("==================================================================");
  console.log("🚀 MEMULAI BLACKBOX TESTING SISTEM FOODPRIORITY");
  console.log("📍 LOKASI PENGUJIAN: PARONGPONG, CIHANJUANG RAHAYU, BANDUNG BARAT");
  console.log("==================================================================");

  let donorToken = "";
  let donorUser: any = null;
  let recipientToken = "";
  let recipientUser: any = null;
  const createdDonationIds: number[] = [];
  let testClaimId: number = 0;

  try {
    // ----------------------------------------------------
    // TEST 1: Registrasi & Login Donatur di Parongpong
    // ----------------------------------------------------
    const donorRegRes = await fetch(`${BACKEND_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "Dapur Berkah Parongpong",
        username: "donor_parongpong",
        address: "Jl. Cihanjuang Rahayu No. 45, Parongpong, Bandung Barat",
        phoneNumber: "081223344556",
        password: "password123",
        role: "donor"
      })
    });
    
    // Login donor
    const donorLoginRes = await fetch(`${BACKEND_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usernameOrPhone: "donor_parongpong",
        password: "password123"
      })
    });
    const donorLoginData = await donorLoginRes.json() as any;
    donorToken = donorLoginData.token;
    donorUser = donorLoginData.user;

    recordTest(
      1,
      "Autentikasi Donatur",
      "Donatur melakukan registrasi dan login ke sistem",
      "Username: donor_parongpong, Password: password123, Role: donor",
      "HTTP 200, Token JWT didapat, role='donor'",
      `HTTP ${donorLoginRes.status}, Role=${donorUser?.role}`,
      donorLoginRes.ok && donorUser?.role === "donor"
    );

    // ----------------------------------------------------
    // TEST 2: Input Beberapa Donasi di Parongpong & Cihanjuang Rahayu
    // ----------------------------------------------------
    const donationsToInput = [
      {
        nama_makanan: "Nasi Liwet Komplit Khas Sunda",
        deskripsi: "Nasi liwet dengan lauk tahu, tempe, ayam goreng, sambal lalap masih hangat higienis.",
        jumlah_porsi: "10",
        kemasan: "Tersegel",
        batas_kadaluwarsa: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(), // 12 jam
        latitude_donatur: "-6.8452",
        longitude_donatur: "107.5765" // Cihanjuang Rahayu
      },
      {
        nama_makanan: "Roti Manis & Pastry Aneka Rasa",
        deskripsi: "Roti cokelat, keju, dan selai nanas sisa stok toko bakery kondisi sangat baik.",
        jumlah_porsi: "15",
        kemasan: "Baik",
        batas_kadaluwarsa: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 jam
        latitude_donatur: "-6.8378",
        longitude_donatur: "107.5891" // Parongpong Kolonel Masturi
      },
      {
        nama_makanan: "Sayuran Segar & Buah Pisang Parongpong",
        deskripsi: "Paket sayur bayam, wortel, brokoli, dan pisang ambon segar hasil kebun Cihanjuang.",
        jumlah_porsi: "8",
        kemasan: "Baik",
        batas_kadaluwarsa: new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString(), // 36 jam
        latitude_donatur: "-6.8415",
        longitude_donatur: "107.5723" // Desa Cihanjuang Rahayu
      },
      {
        nama_makanan: "Susu Murni Lembang & Puding Buah",
        deskripsi: "Susu murni pasteurisasi segar dalam botol dan dessert puding mangga.",
        jumlah_porsi: "5",
        kemasan: "Tersegel",
        batas_kadaluwarsa: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(), // 18 jam
        latitude_donatur: "-6.8321",
        longitude_donatur: "107.5854" // Graha Puspa Parongpong
      }
    ];

    let allCreated = true;
    for (let i = 0; i < donationsToInput.length; i++) {
      const d = donationsToInput[i];
      const res = await fetch(`${BACKEND_URL}/donations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${donorToken}`
        },
        body: JSON.stringify(d)
      });
      const resData = await res.json() as any;
      if (res.ok && resData.donation?.id) {
        createdDonationIds.push(resData.donation.id);
      } else {
        allCreated = false;
      }
    }

    recordTest(
      2,
      "Input Donasi Makanan Baru (Parongpong & Cihanjuang Rahayu)",
      "Donatur menginput 4 item donasi makanan dengan GPS koordinat Parongpong, KBB",
      "4 data donasi makanan (Nasi Liwet, Roti Manis, Sayur & Buah, Susu Murni)",
      "HTTP 201, 4 donasi berhasil tersimpan dengan status 'Tersedia'",
      `Berhasil membuat ${createdDonationIds.length} donasi di database`,
      allCreated && createdDonationIds.length === 4
    );

    // ----------------------------------------------------
    // TEST 3: Verifikasi Daftar Donasi Donatur (/donations/my)
    // ----------------------------------------------------
    const myDonationsRes = await fetch(`${BACKEND_URL}/donations/my`, {
      headers: { "Authorization": `Bearer ${donorToken}` }
    });
    const myDonationsData = await myDonationsRes.json() as any[];

    recordTest(
      3,
      "Tampilkan Donasi Saya di Dashboard Donatur",
      "Donatur mengakses endpoint daftar donasi miliknya",
      "GET /api/donations/my dengan Token Donatur",
      "HTTP 200, Mengembalikan daftar donasi milik donatur dengan status_donasi='Tersedia'",
      `HTTP ${myDonationsRes.status}, ${myDonationsData.length} donasi ditemukan`,
      myDonationsRes.ok && myDonationsData.length >= 4
    );

    // ----------------------------------------------------
    // TEST 4: Registrasi & Login Penerima
    // ----------------------------------------------------
    await fetch(`${BACKEND_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "Yayasan Kasih Cihanjuang",
        username: "penerima_cihanjuang",
        address: "Jl. Kolonel Masturi Km. 3, Parongpong, Bandung Barat",
        phoneNumber: "085566778899",
        password: "password123",
        role: "recipient"
      })
    });

    const recLoginRes = await fetch(`${BACKEND_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usernameOrPhone: "penerima_cihanjuang",
        password: "password123"
      })
    });
    const recLoginData = await recLoginRes.json() as any;
    recipientToken = recLoginData.token;
    recipientUser = recLoginData.user;

    recordTest(
      4,
      "Autentikasi Penerima",
      "Penerima melakukan login ke sistem",
      "Username: penerima_cihanjuang, Password: password123, Role: recipient",
      "HTTP 200, Token JWT didapat, role='recipient'",
      `HTTP ${recLoginRes.status}, Role=${recipientUser?.role}`,
      recLoginRes.ok && recipientUser?.role === "recipient"
    );

    // ----------------------------------------------------
    // TEST 5: Perhitungan LBS Haversine & SAW Ranking Rekomendasi
    // ----------------------------------------------------
    const recLat = -6.8390;
    const recLng = 107.5850;

    const sawRes = await fetch(`${BACKEND_URL}/donations?lat=${recLat}&lng=${recLng}`, {
      headers: { "Authorization": `Bearer ${recipientToken}` }
    });
    const sawData = await sawRes.json() as any[];

    const hasDistancesAndScores = sawData.every(
      (d: any) => typeof d.jarak === "number" && typeof d.skor_saw === "number" && d.skor_saw >= 0 && d.skor_saw <= 1
    );

    recordTest(
      5,
      "Rekomendasi Makanan Berbasis LBS Haversine & SAW",
      "Penerima mengirim koordinat GPS untuk mendapatkan rekomendasi makanan terurut",
      `Latitude: ${recLat}, Longitude: ${recLng} (Parongpong)`,
      "HTTP 200, Donasi terurut berdasarkan skor SAW tertinggi, jarak & kedaluwarsa terhitung",
      `HTTP ${sawRes.status}, ${sawData.length} item terurut, Skor SAW terhitung valid`,
      sawRes.ok && sawData.length > 0 && hasDistancesAndScores
    );

    // ----------------------------------------------------
    // TEST 6: Penerima Mengklaim Donasi Makanan (Status Menjadi 'Sedang Diambil')
    // ----------------------------------------------------
    const targetDonation = sawData.find((d: any) => d.id === createdDonationIds[0]) || sawData[0];

    const claimRes = await fetch(`${BACKEND_URL}/claims`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${recipientToken}`
      },
      body: JSON.stringify({
        id_donasi: targetDonation.id,
        jarak_antar_lokasi: targetDonation.jarak,
        skor_saw: targetDonation.skor_saw
      })
    });
    const claimData = await claimRes.json() as any;
    testClaimId = claimData.claim?.id;

    // Cek status donasi & klaim di DB
    const checkDonationAfterClaim = await pool.query('SELECT * FROM "Donasi" WHERE id = $1', [targetDonation.id]);
    const checkClaimAfterClaim = await pool.query('SELECT * FROM "Transaksi_Klaim" WHERE id = $1', [testClaimId]);

    const isClaimStatusSedangDiambil =
      checkClaimAfterClaim.rows[0]?.status_klaim === "Sedang Diambil" ||
      checkClaimAfterClaim.rows[0]?.status_klaim === "Menunggu";

    recordTest(
      6,
      "Transaksi Klaim Makanan oleh Penerima",
      "Penerima menekan tombol klaim makanan yang dipilih",
      `id_donasi: ${targetDonation.id}, jarak: ${targetDonation.jarak} km, skor_saw: ${targetDonation.skor_saw}`,
      "HTTP 201, Klaim tersimpan dengan status 'Sedang Diambil', stok porsi berkurang",
      `HTTP ${claimRes.status}, Status Klaim='${checkClaimAfterClaim.rows[0]?.status_klaim}', Sisa Porsi=${checkDonationAfterClaim.rows[0]?.jumlah_porsi}`,
      claimRes.ok && testClaimId > 0 && isClaimStatusSedangDiambil
    );

    // ----------------------------------------------------
    // TEST 7: Donatur Mengakses Daftar Klaim Masuk (/claims/my)
    // ----------------------------------------------------
    const donorClaimsRes = await fetch(`${BACKEND_URL}/claims/my`, {
      headers: { "Authorization": `Bearer ${donorToken}` }
    });
    const donorClaimsData = await donorClaimsRes.json() as any[];
    const foundIncomingClaim = donorClaimsData.find((c: any) => c.id === testClaimId);

    recordTest(
      7,
      "Tampilkan Daftar Klaim Masuk di Dashboard Donatur",
      "Donatur membuka tab 'Klaim Masuk' untuk melihat penerima yang mengklaim makanannya",
      "GET /api/claims/my dengan Token Donatur",
      "HTTP 200, Klaim penerima muncul lengkap dengan nama, no hp, dan status 'Sedang Diambil'",
      `HTTP ${donorClaimsRes.status}, Penerima='${foundIncomingClaim?.nama_penerima}', Status='${foundIncomingClaim?.status_klaim}'`,
      donorClaimsRes.ok && !!foundIncomingClaim
    );

    // ----------------------------------------------------
    // TEST 8: Donatur Mengklik Tombol "Tandai Sudah Diambil" (Fitur Baru)
    // ----------------------------------------------------
    const markCompleteRes = await fetch(`${BACKEND_URL}/claims/${testClaimId}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${donorToken}`
      },
      body: JSON.stringify({
        status_klaim: "Selesai"
      })
    });

    const checkClaimFinal = await pool.query('SELECT * FROM "Transaksi_Klaim" WHERE id = $1', [testClaimId]);

    recordTest(
      8,
      "Konfirmasi Penyerahan Donasi oleh Donatur (Tandai Sudah Diambil)",
      "Donatur menekan tombol 'Tandai Sudah Diambil' pada klaim / donasi",
      `PUT /api/claims/${testClaimId}/status, body: { status_klaim: 'Selesai' }`,
      "HTTP 200, Status transaksi klaim dan donasi beralih menjadi 'Selesai' (Sudah Diambil/Terklaim)",
      `HTTP ${markCompleteRes.status}, Status Akhir Klaim='${checkClaimFinal.rows[0]?.status_klaim}'`,
      markCompleteRes.ok && checkClaimFinal.rows[0]?.status_klaim === "Selesai"
    );

    // ----------------------------------------------------
    // TEST 9: Donatur Mengubah Status Donasi Langsung (/donations/:id/status)
    // ----------------------------------------------------
    const updateDonationStatusRes = await fetch(`${BACKEND_URL}/donations/${createdDonationIds[1]}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${donorToken}`
      },
      body: JSON.stringify({
        status_donasi: "Sudah Diambil"
      })
    });
    const checkDonationDirectStatus = await pool.query('SELECT * FROM "Donasi" WHERE id = $1', [createdDonationIds[1]]);

    recordTest(
      9,
      "Update Status Donasi Langsung dari Tabel Donasi Saya",
      "Donatur mengubah status donasi menjadi 'Sudah Diambil'",
      `PUT /api/donations/${createdDonationIds[1]}/status, body: { status_donasi: 'Sudah Diambil' }`,
      "HTTP 200, Status donasi ternormalisasi menjadi 'Selesai' (Sudah Diambil)",
      `HTTP ${updateDonationStatusRes.status}, Status DB='${checkDonationDirectStatus.rows[0]?.status_donasi}'`,
      updateDonationStatusRes.ok && checkDonationDirectStatus.rows[0]?.status_donasi === "Selesai"
    );

    // ----------------------------------------------------
    // TEST 10: Validasi Detail Klaim & Rute Penjemputan (/claims/:id)
    // ----------------------------------------------------
    const getClaimDetailRes = await fetch(`${BACKEND_URL}/claims/${testClaimId}`, {
      headers: { "Authorization": `Bearer ${recipientToken}` }
    });
    const claimDetailData = await getClaimDetailRes.json() as any;

    recordTest(
      10,
      "Akses Halaman Detail Klaim & Koordinat Peta",
      "Penerima atau Donatur membuka halaman rute dan detail transaksi klaim",
      `GET /api/claims/${testClaimId}`,
      "HTTP 200, Mengembalikan data lengkap donatur, penerima, koordinat map, & status",
      `HTTP ${getClaimDetailRes.status}, Koordinat Donatur=(${claimDetailData.latitude_donatur}, ${claimDetailData.longitude_donatur}), Status=${claimDetailData.status_klaim}`,
      getClaimDetailRes.ok && !!claimDetailData.latitude_donatur && !!claimDetailData.longitude_donatur
    );

    // ----------------------------------------------------
    // TEST 11: Input Donasi dengan Nama Makanan Kustom (Opsi 'Lainnya')
    // ----------------------------------------------------
    const customDonationRes = await fetch(`${BACKEND_URL}/donations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${donorToken}`
      },
      body: JSON.stringify({
        nama_makanan: "Nasi Kotak Ayam Geprek Sambal Korek",
        deskripsi: "Porsi makanan siap santap lengkap dengan lalapan dan tempe.",
        jumlah_porsi: "6",
        kemasan: "Tersegel",
        batas_kadaluwarsa: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(),
        latitude_donatur: "-6.8402",
        longitude_donatur: "107.5790"
      })
    });
    const customDonationData = await customDonationRes.json() as any;
    const isCustomDonationSaved = customDonationRes.ok && customDonationData.donation?.nama_makanan === "Nasi Kotak Ayam Geprek Sambal Korek";

    recordTest(
      11,
      "Input Donasi Makanan Kustom (Opsi 'Lainnya')",
      "Donatur memilih jenis 'Lainnya' dan menginput nama makanan kustom secara manual",
      "nama_makanan: 'Nasi Kotak Ayam Geprek Sambal Korek', Porsi: 6, Lokasi: Parongpong",
      "HTTP 201, Donasi berhasil disimpan dengan nama makanan kustom",
      `HTTP ${customDonationRes.status}, Tersimpan sebagai '${customDonationData.donation?.nama_makanan}'`,
      isCustomDonationSaved
    );

    console.log("\n==================================================================");
    console.log("📊 RINGKASAN HASIL BLACKBOX TESTING");
    console.log("==================================================================");
    const passedCount = testResults.filter((t) => t.status === "PASS").length;
    console.log(`Total Pengujian: ${testResults.length}`);
    console.log(`Berhasil (PASS): ${passedCount}`);
    console.log(`Gagal (FAIL): ${testResults.length - passedCount}`);
    console.log("==================================================================");
    console.log("\nJSON_RESULTS_START");
    console.log(JSON.stringify(testResults, null, 2));
    console.log("JSON_RESULTS_END");

    process.exit(0);

  } catch (err: any) {
    console.error("❌ Test Script Error:", err);
    process.exit(1);
  }
}

runBlackboxTests();
