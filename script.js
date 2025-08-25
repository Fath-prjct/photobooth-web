document.addEventListener("DOMContentLoaded", () => {
  // --- Deklarasi Variabel Elemen DOM (Halaman Web) ---
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
  const overlayChangelog = document.getElementById("overlay-changelog");
  const popupChangelog = document.getElementById("popup-changelog");
  const tombolTutupChangelog = document.getElementById(
    "tombol-tutup-changelog"
  );
  // Variabel popup sudah dihapus

  const labelTataLetak = document.querySelector(
    'label[for="pilihan-tata-letak"]'
  );
  const labelTimer = document.querySelector('label[for="pilihan-timer"]');

  // --- Konfigurasi dan State (Status) Aplikasi ---
  const PENGATURAN_LAYOUT = {
    strip3: { jumlah: 3 },
    grid4: { jumlah: 4 },
  };
  let idTataLetakSaatIni = "strip3";
  let slotTerpilih = 0;
  let daftarFoto = [];
  let sedangHitungMundur = false;
  let frameTerpilih = "none";
  let temaTerpilih = "none";
  let instanceSortable = null;
  let daftarKamera = [];

  // --- Fungsi-Fungsi Aplikasi ---

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

  function tampilkanChangelog() {
    overlayChangelog.classList.add("tampil");
    popupChangelog.classList.add("tampil");
  }

  function sembunyikanChangelog() {
    overlayChangelog.classList.remove("tampil");
    popupChangelog.classList.remove("tampil");
  }

  async function inisialisasi() {
    await inisialisasiKamera();
    aturTataLetak(pilihanTataLetak.value);
    // Inisialisasi frameTerpilih dihapus dari sini karena sudah tidak relevan di halaman awal
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
    perbaruiTombolAksi();
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
    const context = kanvasFoto.getContext("2d");
    kanvasFoto.width = umpanVideo.videoWidth;
    kanvasFoto.height = umpanVideo.videoHeight;
    context.filter = getComputedStyle(umpanVideo).filter;
    context.translate(kanvasFoto.width, 0);
    context.scale(-1, 1);
    context.drawImage(umpanVideo, 0, 0, kanvasFoto.width, kanvasFoto.height);
    daftarFoto[slotTerpilih] = kanvasFoto.toDataURL("image/jpeg", 0.9);
    tampilkanFotoDiSlot(slotTerpilih, daftarFoto[slotTerpilih]);
    perbaruiTombolAksi();
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

  function perbaruiTombolAksi() {}

  async function tampilkankedua() {
    // Reset pilihan frame ke default saat masuk halaman kedua
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
    if (pilihanTataLetak.value === "grid4") {
      pilihanTataLetak.value = "strip3";
    }
    aturTataLetak(pilihanTataLetak.value);
  }

  // Fungsi popup sembunyikankeduaFrame() sudah dihapus

  // --- Pemasangan Event Listener (Pendengar Aksi Pengguna) ---
  tombolAksiUtama.addEventListener("click", tanganiKlikAksiUtama);
  tombolUnduh.addEventListener("click", unduhGambar);
  tombolUlangiSemua.addEventListener("click", kembaliKePhotobooth);
  tombolTutupChangelog.addEventListener("click", sembunyikanChangelog);
  overlayChangelog.addEventListener("click", sembunyikanChangelog);

  pilihanTataLetak.addEventListener("change", (e) => {
    const opsiTerpilih = e.target.options[e.target.selectedIndex].text;
    if (e.target.value === "grid4") {
      alert("Fitur 4 foto belum tersedia saat ini.");
      e.target.value = idTataLetakSaatIni;
    } else {
      labelTataLetak.textContent = opsiTerpilih;
      aturTataLetak(e.target.value);
    }
  });

  pilihanTimer.addEventListener("change", (e) => {
    const opsiTerpilih = e.target.options[e.target.selectedIndex].text;
    labelTimer.textContent = opsiTerpilih;
  });

  document.querySelector(".opsi-filter").addEventListener("click", (e) => {
    if (e.target.matches(".tombol-opsi")) {
      document
        .querySelectorAll(".opsi-filter .tombol-opsi")
        .forEach((btn) => btn.classList.remove("aktif"));
      e.target.classList.add("aktif");
      const filter = e.target.dataset.filter;
      umpanVideo.className = "";
      if (filter !== "none") {
        umpanVideo.classList.add(`filter-${filter}`);
      }
    }
  });

  // Event listener untuk .opsi-frame yang lama dihapus dari sini

  // Event listener untuk popup dihapus dari sini

  tombolPilihKamera.addEventListener("click", (event) => {
    event.stopPropagation();
    daftarPilihanKamera.classList.toggle("tampil");
  });

  document.addEventListener("click", () => {
    if (daftarPilihanKamera.classList.contains("tampil")) {
      daftarPilihanKamera.classList.remove("tampil");
    }
  });

  // EVENT LISTENER BARU untuk pilihan frame di halaman kedua
  halamankedua.addEventListener("click", (e) => {
    const tombol = e.target.closest(".opsi-frame .tombol-opsi");
    if (tombol) {
      document
        .querySelectorAll("#halaman-kedua .tombol-opsi")
        .forEach((btn) => btn.classList.remove("aktif"));
      tombol.classList.add("aktif");
      frameTerpilih = tombol.dataset.frame || "none";
      // Gambar ulang kanvas dengan frame yang baru dipilih
      buatGambarAkhir();
    }
  });

  if (!sessionStorage.getItem("changelogDitampilkan")) {
    tampilkanChangelog();
    sessionStorage.setItem("changelogDitampilkan", "true");
  }

  inisialisasi();
});
