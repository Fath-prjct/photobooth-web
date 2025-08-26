document.addEventListener("DOMContentLoaded", () => {
  // --- BAGIAN PENGATURAN PENTING (HARAP ISI BAGIAN INI) ---
  const MONGO_APP_ID = "photobooth-app-yqcwhxl";
  const CLOUDINARY_CLOUD_NAME = "dpjdj5p5v"; // Contoh: "dpjdj5p5v"
  const CLOUDINARY_UPLOAD_PRESET = "ml_default"; // Contoh: "ml_default"

  // --- Deklarasi Variabel Elemen DOM ---
  const halamanPhotobooth = document.getElementById("halaman-utama");
  const halamankedua = document.getElementById("halaman-kedua");
  const umpanVideo = document.getElementById("umpan-video");
  const kanvasFoto = document.getElementById("kanvas-foto");
  const tombolAksiUtama = document.getElementById("tombol-aksi-utama");
  const tombolUnduh = document.getElementById("tombol-unduh");
  const tombolUlangiSemua = document.getElementById("tombol-ulangi-semua");
  const pilihanTimer = document.getElementById("pilihan-timer");
  const pilihanTataLetak = document.getElementById("pilihan-tata-letak");
  const wadahThumbnail = document.getElementById("wadah-thumbnail");
  const overlayTimer = document.getElementById("overlay-timer");
  const kanvasFinal = document.getElementById("kanvas-photostrip-final");
  const pesanErrorKamera = document.getElementById("pesan-error-kamera");
  const wadahTombolPilihanKamera = document.getElementById(
    "wadah-tombol-pilihan-kamera"
  );
  const tombolPilihKamera = document.getElementById("tombol-pilih-kamera");
  const daftarPilihanKamera = document.getElementById("daftar-pilihan-kamera");
  const kanvasFilter = document.getElementById("kanvas-filter");
  const ctxFilter = kanvasFilter.getContext("2d");
  const overlayChangelog = document.getElementById("overlay-changelog");
  const popupChangelog = document.getElementById("popup-changelog");
  const tombolTutupChangelog = document.getElementById(
    "tombol-tutup-changelog"
  );
  const areaKamera = document.querySelector(".area-kamera");

  const labelTataLetak = document.querySelector(
    'label[for="pilihan-tata-letak"]'
  );
  const labelTimer = document.querySelector('label[for="pilihan-timer"]');

  // --- Konfigurasi dan State Aplikasi ---
  const PENGATURAN_LAYOUT = { strip3: { jumlah: 3 }, grid4: { jumlah: 4 } };
  let idTataLetakSaatIni = "strip3";
  let slotTerpilih = 0;
  let daftarFoto = [];
  let sedangHitungMundur = false;
  let frameTerpilih = "none";
  let instanceSortable = null;
  let daftarKamera = [];
  let idAnimasiFilter = null;
  let userMongoDB = null;
  const appMongoDB = new Realm.App({ id: MONGO_APP_ID });

  // --- Fungsi-Fungsi Aplikasi ---

  async function loginMongoDB() {
    try {
      if (!userMongoDB) {
        const credentials = Realm.Credentials.anonymous();
        userMongoDB = await appMongoDB.logIn(credentials);
        console.log("user:", userMongoDB.id);
      }
      return userMongoDB;
    } catch (err) {
      console.error("error 102005", err);
      return null;
    }
  }

  async function uploadKeCloudinary(dataUrl) {
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
    const formData = new FormData();
    formData.append("file", dataUrl);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    try {
      const response = await fetch(url, { method: "POST", body: formData });
      const data = await response.json();
      if (data.secure_url) {
        console.log("src", data.secure_url);
        return data.secure_url;
      } else {
        throw new Error(
          "Succesfully failed: " +
            (data.error ? data.error.message : "tidak valid")
        );
      }
    } catch (err) {
      console.error("--- error 102005 ---", err);
      return null;
    }
  }

  async function simpanKeMongoDB(imageUrl) {
    if (!userMongoDB) {
      await loginMongoDB();
      if (!userMongoDB) return;
    }
    try {
      await userMongoDB.functions.savePhotostrip(imageUrl);
      console.log("Succesfully failed: ");
    } catch (err) {
      console.error("--- error 102005 ---", err);
    }
  }

  async function inisialisasiKamera(deviceId = null) {
    if (umpanVideo.srcObject) {
      umpanVideo.srcObject.getTracks().forEach((track) => track.stop());
    }
    const constraints = {
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    };
    if (deviceId) {
      constraints.video.deviceId = { exact: deviceId };
    } else {
      constraints.video.facingMode = "user";
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      umpanVideo.srcObject = stream;
      pesanErrorKamera.style.display = "none";
      const devices = await navigator.mediaDevices.enumerateDevices();
      daftarKamera = devices.filter((device) => device.kind === "videoinput");
      if (daftarKamera.length > 1) {
        daftarPilihanKamera.innerHTML = "";
        daftarKamera.forEach((camera) => {
          const tombolOpsi = document.createElement("button");
          tombolOpsi.className = "tombol-opsi-kamera";
          tombolOpsi.textContent =
            camera.label || `Kamera ${daftarPilihanKamera.children.length + 1}`;
          tombolOpsi.dataset.deviceId = camera.deviceId;
          tombolOpsi.onclick = () => {
            if (
              umpanVideo.srcObject.getVideoTracks()[0].getSettings()
                .deviceId !== camera.deviceId
            ) {
              inisialisasiKamera(camera.deviceId);
            }
            daftarPilihanKamera.classList.remove("tampil");
          };
          daftarPilihanKamera.appendChild(tombolOpsi);
        });
        wadahTombolPilihanKamera.style.display = "block";
      } else {
        wadahTombolPilihanKamera.style.display = "none";
      }
    } catch (err) {
      console.error("Gagal mengakses kamera: ", err);
      pesanErrorKamera.style.display = "block";
    }
  }

  async function inisialisasi() {
    await inisialisasiKamera();
    aturTataLetak(pilihanTataLetak.value);
    loginMongoDB();
  }

  function aturTataLetak(idTataLetak) {
    idTataLetakSaatIni = idTataLetak;
    const tataLetak = PENGATURAN_LAYOUT[idTataLetak];
    daftarFoto = new Array(tataLetak.jumlah).fill(null);
    wadahThumbnail.innerHTML = "";
    for (let i = 0; i < tataLetak.jumlah; i++) {
      const slot = document.createElement("div");
      slot.className = "slot-thumbnail";
      slot.dataset.slot = i;
      slot.addEventListener("click", (event) => {
        const indexSlotSaatIni = parseInt(event.currentTarget.dataset.slot);
        pilihSlotUntukUlangi(indexSlotSaatIni);
      });
      wadahThumbnail.appendChild(slot);
    }
    pilihSlotUntukUlangi(0);
    inisialisasiSortable();
  }

  function inisialisasiSortable() {
    if (instanceSortable) instanceSortable.destroy();
    instanceSortable = new Sortable(wadahThumbnail, {
      animation: 150,
      ghostClass: "sortable-ghost",
      chosenClass: "sortable-chosen",
      onEnd: () => {
        const fotoTerurut = [];
        wadahThumbnail
          .querySelectorAll(".slot-thumbnail")
          .forEach((slot, index) => {
            slot.dataset.slot = index;
            const img = slot.querySelector("img");
            fotoTerurut.push(img ? img.src : null);
          });
        daftarFoto = fotoTerurut;
      },
    });
  }

  function tanganiKlikAksiUtama() {
    const siapUntukkedua =
      daftarFoto.filter((foto) => foto !== null).length ===
      PENGATURAN_LAYOUT[idTataLetakSaatIni].jumlah;
    if (siapUntukkedua) {
      tampilkankedua();
      return;
    }
    if (sedangHitungMundur) return;
    const durasiTimer = parseInt(pilihanTimer.value, 10);
    if (durasiTimer > 0) {
      mulaiHitungMundur(durasiTimer);
    } else {
      ambilFoto();
    }
  }

  function mulaiHitungMundur(detik) {
    sedangHitungMundur = true;
    tombolAksiUtama.disabled = true;
    let sisaWaktu = detik;
    overlayTimer.textContent = sisaWaktu;
    overlayTimer.classList.add("visible");
    const interval = setInterval(() => {
      sisaWaktu--;
      overlayTimer.textContent = sisaWaktu;
      if (sisaWaktu <= 0) {
        clearInterval(interval);
        overlayTimer.classList.remove("visible");
        ambilFoto();
        sedangHitungMundur = false;
        tombolAksiUtama.disabled = false;
      }
    }, 1000);
  }

  function ambilFoto() {
    if (!umpanVideo.srcObject) return;

    // Cek filter aktif saat ini
    const filterAktif = document.querySelector(
      ".opsi-filter .tombol-opsi.aktif"
    ).dataset.filter;

    const context = kanvasFoto.getContext("2d");
    const sumberGambar = filterAktif === "pixel" ? kanvasFilter : umpanVideo;

    kanvasFoto.width = umpanVideo.videoWidth;
    kanvasFoto.height = umpanVideo.videoHeight;

    // Terapkan filter CSS hanya jika bukan mode pixel
    if (filterAktif !== "pixel") {
      context.filter = getComputedStyle(umpanVideo).filter;
    } else {
      context.filter = "none"; // Pastikan tidak ada filter ganda
    }

    context.translate(kanvasFoto.width, 0);
    context.scale(-1, 1);

    // Gunakan sumberGambar yang sudah ditentukan
    context.drawImage(sumberGambar, 0, 0, kanvasFoto.width, kanvasFoto.height);

    daftarFoto[slotTerpilih] = kanvasFoto.toDataURL("image/jpeg", 0.9);
    tampilkanFotoDiSlot(slotTerpilih, daftarFoto[slotTerpilih]);
    pilihSlotUntukUlangi(cariSlotKosongBerikutnya());
  }
  function cariSlotKosongBerikutnya() {
    const slotBerikutnya = daftarFoto.indexOf(null);
    return slotBerikutnya === -1 ? slotTerpilih : slotBerikutnya;
  }

  function tampilkanFotoDiSlot(indexSlot, dataUrl) {
    const slot = document.querySelector(
      `.slot-thumbnail[data-slot='${indexSlot}']`
    );
    slot.innerHTML = `<img src="${dataUrl}" />`;
  }

  function pilihSlotUntukUlangi(indexSlot) {
    slotTerpilih = indexSlot;
    document.querySelectorAll(".slot-thumbnail").forEach((slot) => {
      slot.classList.toggle(
        "terpilih",
        parseInt(slot.dataset.slot) === indexSlot
      );
    });
  }

  async function tampilkankedua() {
    frameTerpilih = "none";
    document
      .querySelectorAll("#halaman-kedua .tombol-opsi")
      .forEach((btn) => btn.classList.remove("aktif"));
    document
      .querySelector("#halaman-kedua .tombol-opsi[data-theme='none']")
      .classList.add("aktif");
    halamanPhotobooth.classList.add("kedua");
    halamankedua.classList.remove("kedua");
    await buatGambarAkhir();
    const dataUrlFinal = kanvasFinal.toDataURL("image/png");
    const imageUrl = await uploadKeCloudinary(dataUrlFinal);
    if (imageUrl) {
      await simpanKeMongoDB(imageUrl);
    }
  }

  async function buatGambarAkhir() {
    const ctx = kanvasFinal.getContext("2d");
    const tataLetak = PENGATURAN_LAYOUT[idTataLetakSaatIni];
    const gambarFoto = await Promise.all(
      daftarFoto
        .filter((p) => p)
        .map(
          (p) =>
            new Promise((res) => {
              const img = new Image();
              img.onload = () => res(img);
              img.onerror = () => res(null);
              img.src = p;
            })
        )
    );
    if (tataLetak.jumlah === 3) {
      kanvasFinal.width = 660;
      kanvasFinal.height = 2370;
    }
    const gambarFrame = await new Promise((res) => {
      if (!frameTerpilih || frameTerpilih === "none") return res(null);
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => {
        console.error("Gagal memuat frame:", frameTerpilih);
        res(null);
      };
      img.src = frameTerpilih;
    });
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, kanvasFinal.width, kanvasFinal.height);
    gambarFoto.forEach((img, index) => {
      if (!img) return;
      let w = 528,
        h = 612,
        x = 66,
        y = 237 + (h + 30) * index;
      const rasioTujuan = w / h,
        rasioSumber = img.width / img.height;
      let sx = 0,
        sy = 0,
        sWidth = img.width,
        sHeight = img.height;
      if (rasioSumber > rasioTujuan) {
        sWidth = img.height * rasioTujuan;
        sx = (img.width - sWidth) / 2;
      } else {
        sHeight = img.width / rasioTujuan;
        sy = (img.height - sHeight) / 2;
      }
      ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, w, h);
    });
    if (gambarFrame) {
      ctx.drawImage(gambarFrame, 0, 0, kanvasFinal.width, kanvasFinal.height);
    }
  }

  function unduhGambar() {
    const link = document.createElement("a");
    link.download = `photobooth-lateral-${Date.now()}.png`;
    link.href = kanvasFinal.toDataURL("image/png");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function kembaliKePhotobooth() {
    halamankedua.classList.add("kedua");
    halamanPhotobooth.classList.remove("kedua");
    aturTataLetak(pilihanTataLetak.value);
  }

  // --- Fungsi Baru: Menangani Tombol Fisik ---
  function tanganiTombolVolume(event) {
    // Cek apakah tombol yang ditekan adalah Volume Down
    // dan pastikan kita berada di halaman utama (bukan halaman hasil)
    if (
      event.key === "AudioVolumeDown" &&
      !halamanPhotobooth.classList.contains("kedua")
    ) {
      // Mencegah browser menurunkan volume audio (aksi default)
      event.preventDefault();

      // Memanggil fungsi shutter yang sudah ada, seolah-olah tombol di layar ditekan
      tanganiKlikAksiUtama();
    }
  }

  // GANTI DENGAN FUNGSI BARU INI
  function jalankanFilterPixelArt() {
    if (idAnimasiFilter) cancelAnimationFrame(idAnimasiFilter);

    kanvasFilter.style.display = "block";
    umpanVideo.style.display = "none";

    kanvasFilter.width = umpanVideo.videoWidth;
    kanvasFilter.height = umpanVideo.videoHeight;

    // --- PENGATURAN FILTER POSTERIZE ---
    const PIXEL_SIZE = 9; // Ukuran block pixel. Semakin besar angka, semakin kotak-kotak.
    const COLOR_LEVELS = 10; // KUNCI UTAMA: Jumlah tingkatan warna per channel (Merah/Hijau/Biru).
    // Coba ganti ke 2, 3, 5, atau 8 untuk efek berbeda.

    // Fungsi untuk mengurangi tingkatan warna (posterize) pada satu channel (R, G, atau B)
    function posterizeChannel(value) {
      const step = 255 / (COLOR_LEVELS - 1);
      return Math.round(value / step) * step;
    }

    // Fungsi utama untuk menggambar frame filter
    function gambarFrame() {
      if (!umpanVideo.srcObject || umpanVideo.paused || umpanVideo.ended) {
        idAnimasiFilter = requestAnimationFrame(gambarFrame);
        return;
      }

      // 1. Gambar video ke canvas dalam ukuran kecil untuk pixelasi
      const tempCanvas = document.createElement("canvas");
      const tempCtx = tempCanvas.getContext("2d");
      const smallWidth = Math.floor(kanvasFilter.width / PIXEL_SIZE);
      const smallHeight = Math.floor(kanvasFilter.height / PIXEL_SIZE);

      tempCanvas.width = smallWidth;
      tempCanvas.height = smallHeight;

      tempCtx.drawImage(umpanVideo, 0, 0, smallWidth, smallHeight);

      const imageData = tempCtx.getImageData(0, 0, smallWidth, smallHeight);
      const data = imageData.data;

      // 2. Proses setiap pixel kecil: terapkan efek posterize
      for (let i = 0; i < data.length; i += 4) {
        // Ambil warna asli
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Terapkan posterization pada setiap channel warna
        data[i] = posterizeChannel(r); // Proses channel Merah
        data[i + 1] = posterizeChannel(g); // Proses channel Hijau
        data[i + 2] = posterizeChannel(b); // Proses channel Biru
      }

      tempCtx.putImageData(imageData, 0, 0);

      // 3. Gambar kembali ke kanvas utama dengan ukuran besar
      ctxFilter.imageSmoothingEnabled = false;
      ctxFilter.clearRect(0, 0, kanvasFilter.width, kanvasFilter.height);
      ctxFilter.drawImage(
        tempCanvas,
        0,
        0,
        kanvasFilter.width,
        kanvasFilter.height
      );

      idAnimasiFilter = requestAnimationFrame(gambarFrame);
    }

    gambarFrame();
  }

  function hentikanFilterPixelArt() {
    if (idAnimasiFilter) {
      cancelAnimationFrame(idAnimasiFilter);
      idAnimasiFilter = null;
    }
    kanvasFilter.style.display = "none";
    umpanVideo.style.display = "block";
  }

  function jalankanFilterArtistic() {
    if (idAnimasiFilter) cancelAnimationFrame(idAnimasiFilter);

    kanvasFilter.style.display = "block";
    umpanVideo.style.display = "none";

    kanvasFilter.width = umpanVideo.videoWidth;
    kanvasFilter.height = umpanVideo.videoHeight;

    // --- PENGATURAN FILTER ARTISTIC (SESUAI GAMBAR ANDA) ---
    const POSTERIZATION_LEVELS = 6;
    const EDGE_THRESHOLD = 140;
    const COLOR_INTENSITY = 0.99; // 99% lebih intens -> 199% atau 1.99

    // --- Helper Functions ---
    function posterizeChannel(value) {
      const step = 255 / (POSTERIZATION_LEVELS - 1);
      return Math.round(value / step) * step;
    }

    function saturate(r, g, b, amount) {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      const newR = -gray * amount + r * (1 + amount);
      const newG = -gray * amount + g * (1 + amount);
      const newB = -gray * amount + b * (1 + amount);
      return [
        Math.max(0, Math.min(255, newR)),
        Math.max(0, Math.min(255, newG)),
        Math.max(0, Math.min(255, newB)),
      ];
    }

    function gambarFrame() {
      if (!umpanVideo.srcObject || umpanVideo.paused || umpanVideo.ended) {
        idAnimasiFilter = requestAnimationFrame(gambarFrame);
        return;
      }

      // Gambar video ke canvas untuk diproses
      const tempCtx = kanvasFilter.getContext("2d");
      tempCtx.drawImage(
        umpanVideo,
        0,
        0,
        kanvasFilter.width,
        kanvasFilter.height
      );

      const imageData = tempCtx.getImageData(
        0,
        0,
        kanvasFilter.width,
        kanvasFilter.height
      );
      const data = imageData.data;

      // Buat salinan grayscale untuk deteksi tepi
      const grayData = new Uint8ClampedArray(
        kanvasFilter.width * kanvasFilter.height
      );
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        grayData[i / 4] = gray;
      }

      const w = kanvasFilter.width;
      for (let i = 0; i < data.length; i += 4) {
        const y = Math.floor(i / 4 / w);
        const x = (i / 4) % w;

        // --- 1. Edge Detection (Sobel Operator) ---
        // (Abaikan piksel di pinggir gambar)
        if (y > 0 && y < kanvasFilter.height - 1 && x > 0 && x < w - 1) {
          const i_tl = x - 1 + (y - 1) * w; // top-left
          const i_t = x + (y - 1) * w; // top
          const i_tr = x + 1 + (y - 1) * w; // top-right
          const i_l = x - 1 + y * w; // left
          const i_r = x + 1 + y * w; // right
          const i_bl = x - 1 + (y + 1) * w; // bottom-left
          const i_b = x + (y + 1) * w; // bottom
          const i_br = x + 1 + (y + 1) * w; // bottom-right

          const gx =
            -grayData[i_tl] -
            2 * grayData[i_l] -
            grayData[i_bl] +
            grayData[i_tr] +
            2 * grayData[i_r] +
            grayData[i_br];

          const gy =
            -grayData[i_tl] -
            2 * grayData[i_t] -
            grayData[i_tr] +
            grayData[i_bl] +
            2 * grayData[i_b] +
            grayData[i_br];

          const magnitude = Math.sqrt(gx * gx + gy * gy);

          if (magnitude > EDGE_THRESHOLD) {
            data[i] = 0; // Garis tepi hitam
            data[i + 1] = 0;
            data[i + 2] = 0;
          } else {
            // --- 2. Posterization & Color Intensity ---
            const r = posterizeChannel(data[i]);
            const g = posterizeChannel(data[i + 1]);
            const b = posterizeChannel(data[i + 2]);

            const [satR, satG, satB] = saturate(r, g, b, COLOR_INTENSITY - 1);

            data[i] = satR;
            data[i + 1] = satG;
            data[i + 2] = satB;
          }
        }
      }

      tempCtx.putImageData(imageData, 0, 0);
      idAnimasiFilter = requestAnimationFrame(gambarFrame);
    }

    gambarFrame();
  }

  function tampilkanChangelog() {
    overlayChangelog.classList.add("tampil");
    popupChangelog.classList.add("tampil");
  }

  function sembunyikanChangelog() {
    overlayChangelog.classList.remove("tampil");
    popupChangelog.classList.remove("tampil");
  }

  // --- Pemasangan Event Listener ---
  tombolAksiUtama.addEventListener("click", tanganiKlikAksiUtama);
  tombolUnduh.addEventListener("click", unduhGambar);
  document.addEventListener("keydown", tanganiTombolVolume);
  tombolUlangiSemua.addEventListener("click", kembaliKePhotobooth);

  pilihanTataLetak.addEventListener("change", (e) => {
    const opsiTerpilih = e.target.options[e.target.selectedIndex].text;
    labelTataLetak.textContent = opsiTerpilih;
    aturTataLetak(e.target.value);
  });

  pilihanTimer.addEventListener("change", (e) => {
    const opsiTerpilih = e.target.options[e.target.selectedIndex].text;
    labelTimer.textContent = opsiTerpilih;
  });

  areaKamera.addEventListener("click", (event) => {
    // Pastikan kita tidak mengklik tombol lain di dalam area kamera (seperti tombol pilih kamera)
    if (event.target === umpanVideo || event.target === kanvasFilter) {
      tanganiKlikAksiUtama();
    }
  });

  document.querySelector(".opsi-filter").addEventListener("click", (e) => {
    if (e.target.matches(".tombol-opsi")) {
      hentikanFilterPixelArt();
      document
        .querySelectorAll(".opsi-filter .tombol-opsi")
        .forEach((btn) => btn.classList.remove("aktif"));
      e.target.classList.add("aktif");
      const filter = e.target.dataset.filter;
      umpanVideo.className = "";
      if (filter === "pixel") {
        jalankanFilterPixelArt();
      } else if (filter === "artistic") {
        // TAMBAHKAN BLOK INI
        jalankanFilterArtistic();
      } else if (filter !== "none") {
        umpanVideo.classList.add(`filter-${filter}`);
      }
    }
  });
  halamankedua.addEventListener("click", (e) => {
    const tombol = e.target.closest(".opsi-frame .tombol-opsi");
    if (tombol) {
      document
        .querySelectorAll("#halaman-kedua .tombol-opsi")
        .forEach((btn) => btn.classList.remove("aktif"));
      tombol.classList.add("aktif");
      frameTerpilih = tombol.dataset.frame || "none";
      buatGambarAkhir();
    }
  });
  tombolPilihKamera.addEventListener("click", (event) => {
    event.stopPropagation();
    daftarPilihanKamera.classList.toggle("tampil");
  });
  document.addEventListener("click", () => {
    if (daftarPilihanKamera.classList.contains("tampil")) {
      daftarPilihanKamera.classList.remove("tampil");
    }
  });
  tombolTutupChangelog.addEventListener("click", sembunyikanChangelog);
  overlayChangelog.addEventListener("click", sembunyikanChangelog);
  if (!sessionStorage.getItem("changelogDitampilkan")) {
    tampilkanChangelog();
    sessionStorage.setItem("changelogDitampilkan", "true");
  }

  inisialisasi();
});
