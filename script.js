document.addEventListener("DOMContentLoaded", () => {
  const halamanPhotobooth = document.getElementById("halaman-utama");
  const halamankedua = document.getElementById("halaman-kedua");
  const umpanVideo = document.getElementById("umpan-video");
  const kanvasFoto = document.getElementById("kanvas-foto");
  const tombolAksiUtama = document.getElementById("tombol-aksi-utama");
  const tombolLanjut = document.getElementById("tombol-lanjut");
  const CLOUDINARY_UPLOAD_PRESET = "ml_default";
  const tombolUnduh = document.getElementById("tombol-unduh");
  const tombolUlangiSemua = document.getElementById("tombol-ulangi-semua");
  const pilihanTimer = document.getElementById("pilihan-timer");
  const pilihanTataLetak = document.getElementById("pilihan-tata-letak");
  const wadahThumbnail = document.getElementById("wadah-thumbnail");
  const CLOUDINARY_CLOUD_NAME = "dpjdj5p5v";
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

  // --- BARU: Referensi untuk elemen Share ---
  const tombolBagikan = document.getElementById("tombol-bagikan");
  const kanvasStoryFinal = document.getElementById("kanvas-story-final");
  // ----------------------------------------

  const labelTataLetak = document.querySelector(
    'label[for="pilihan-tata-letak"]'
  );
  const labelTimer = document.querySelector('label[for="pilihan-timer"]');

  const PENGATURAN_LAYOUT = { strip3: { jumlah: 3 }, grid4: { jumlah: 4 } };
  let idTataLetakSaatIni = "strip3";
  let slotTerpilih = 0;
  let daftarFoto = [];
  let sedangHitungMundur = false;
  let frameTerpilih = "none";
  let instanceSortable = null;
  let daftarKamera = [];
  let idAnimasiFilter = null;
let amIHost = false;
let lastCommandTs = 0;
let inCollabMode = false;

 

  async function uploadKeCloudinary(dataUrl) {
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
    const formData = new FormData();
    formData.append("file", dataUrl);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    try {
      const response = await fetch(url, { method: "POST", body: formData });
      const data = await response.json();
      if (data.secure_url) {
        return data.secure_url;
      } else {
        throw new Error(
          "Upload to Cloudinary failed: " +
            (data.error ? data.error.message : "Unknown error")
        );
      }
    } catch (err) {
      return null;
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
      pesanErrorKamera.style.display = "block";
    }
  }

  async function inisialisasi() {
    await inisialisasiKamera();
    aturTataLetak(pilihanTataLetak.value);
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
    perbaruiVisibilitasTombolLanjut();
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

    const filterAktif = document.querySelector(
      ".opsi-filter .tombol-opsi.aktif"
    ).dataset.filter;

    const context = kanvasFoto.getContext("2d");

    const sumberGambar =
      filterAktif === "pixel" || filterAktif === "artistic"
        ? kanvasFilter
        : umpanVideo;

    kanvasFoto.width = umpanVideo.videoWidth;
    kanvasFoto.height = umpanVideo.videoHeight;

    
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, kanvasFoto.width, kanvasFoto.height);
  
  // PENTING: Lakukan transformasi mirror di sini
  context.translate(kanvasFoto.width, 0);
  context.scale(-1, 1);

    if (sumberGambar === umpanVideo || sumberGambar === kanvasBgRemoval) {
      const cssFilterString = getComputedStyle(sumberGambar).filter;

      if (filterAktif === "blur") {
        context.filter = "blur(6px)";
      } else {
        context.filter = cssFilterString;
      }
    }

    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, kanvasFoto.width, kanvasFoto.height);
    
    // Balik horizontal (Mirror)
    context.translate(kanvasFoto.width, 0);
    context.scale(-1, 1);

    // Jika Remove BG aktif, ambil dari kanvasBgRemoval, jika tidak dari video
    const sumber = removeBgAktif ? kanvasBgRemoval : sumberGambar;
    
    context.drawImage(sumber, 0, 0, kanvasFoto.width, kanvasFoto.height);
    context.restore(); // Kembalikan ke normal

    daftarFoto[slotTerpilih] = kanvasFoto.toDataURL("image/jpeg", 0.9);
    tampilkanFotoDiSlot(slotTerpilih, daftarFoto[slotTerpilih]);
    pilihSlotUntukUlangi(cariSlotKosongBerikutnya());
    perbaruiVisibilitasTombolLanjut();
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

  // --- BARU: Fungsi untuk membuat gambar format Story ---
  function buatGambarStory() {
    const ctx = kanvasStoryFinal.getContext("2d");
    const sourceCanvas = kanvasFinal;

    // Set dimensi kanvas Story (rasio 9:16)
    kanvasStoryFinal.width = 1080;
    kanvasStoryFinal.height = 1920;

    // 1. Gambar latar belakang yang blur
    ctx.filter = "blur(25px) brightness(0.7)";
    ctx.drawImage(
      sourceCanvas,
      0,
      0,
      kanvasStoryFinal.width,
      kanvasStoryFinal.height
    );

    // Reset filter
    ctx.filter = "none";

    // 2. Gambar photostrip utama di tengah
    const margin = 0.9; // 90% dari tinggi kanvas
    const canvasRatio = kanvasStoryFinal.width / kanvasStoryFinal.height;
    const sourceRatio = sourceCanvas.width / sourceCanvas.height;

    let targetWidth, targetHeight, x, y;

    // Skalakan photostrip agar pas di dalam kanvas dengan margin
    targetHeight = kanvasStoryFinal.height * margin;
    targetWidth = targetHeight * sourceRatio;

    if (targetWidth > kanvasStoryFinal.width * margin) {
      targetWidth = kanvasStoryFinal.width * margin;
      targetHeight = targetWidth / sourceRatio;
    }

    // Posisikan di tengah
    x = (kanvasStoryFinal.width - targetWidth) / 2;
    y = (kanvasStoryFinal.height - targetHeight) / 2;

    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 10;

    ctx.drawImage(sourceCanvas, x, y, targetWidth, targetHeight);

    ctx.shadowColor = "transparent"; // Reset bayangan
  }

  // --- BARU: Fungsi untuk berbagi atau mengunduh gambar Story ---
  async function bagikanGambar() {
    buatGambarStory();
    const fileName = `story-lateral-${Date.now()}.png`;

    // Cek apakah Web Share API didukung
    if (navigator.share) {
      kanvasStoryFinal.toBlob(async (blob) => {
        const file = new File([blob], fileName, { type: blob.type });
        const shareData = {
          files: [file],
          title: "Hasil Photobooth-ku!",
          text: "Dibuat dengan Lateral Photobooth",
        };
        try {
          if (navigator.canShare(shareData)) {
            await navigator.share(shareData);
          } else {
            throw new Error("Tidak dapat membagikan data ini");
          }
        } catch (err) {
          // Jika pengguna membatalkan atau terjadi error, fallback ke unduh
          console.error("Share failed:", err.message);
          const link = document.createElement("a");
          link.download = fileName;
          link.href = kanvasStoryFinal.toDataURL("image/png");
          link.click();
        }
      }, "image/png");
    } else {
      // Fallback untuk desktop: langsung unduh
      alert(
        "Browser Anda tidak mendukung fitur berbagi. File akan diunduh sebagai gantinya."
      );
      const link = document.createElement("a");
      link.download = fileName;
      link.href = kanvasStoryFinal.toDataURL("image/png");
      link.click();
    }
  }

  function kembaliKePhotobooth() {
    halamankedua.classList.add("kedua");
    halamanPhotobooth.classList.remove("kedua");
    aturTataLetak(pilihanTataLetak.value);
  }

  function tanganiTombolVolume(event) {
    if (
      event.key === "AudioVolumeDown" &&
      !halamanPhotobooth.classList.contains("kedua")
    ) {
      event.preventDefault();
      tanganiKlikAksiUtama();
    }
  }

  function perbaruiVisibilitasTombolLanjut() {
    const semuaFotoDiambil = daftarFoto.every((foto) => foto !== null);
    if (semuaFotoDiambil) {
      tombolLanjut.style.display = "block";
    } else {
      tombolLanjut.style.display = "none";
    }
  }

  function jalankanFilterPixelArt() {
    if (idAnimasiFilter) cancelAnimationFrame(idAnimasiFilter);

    kanvasFilter.style.display = "block";
    umpanVideo.style.display = "none";

    kanvasFilter.width = umpanVideo.videoWidth;
    kanvasFilter.height = umpanVideo.videoHeight;
    const PIXEL_SIZE = 9;
    const COLOR_LEVELS = 10;

    function posterizeChannel(value) {
      const step = 255 / (COLOR_LEVELS - 1);
      return Math.round(value / step) * step;
    }

    function gambarFrame() {
      if (!umpanVideo.srcObject || umpanVideo.paused || umpanVideo.ended) {
        idAnimasiFilter = requestAnimationFrame(gambarFrame);
        return;
      }

      const tempCanvas = document.createElement("canvas");
      const tempCtx = tempCanvas.getContext("2d");
      const smallWidth = Math.floor(kanvasFilter.width / PIXEL_SIZE);
      const smallHeight = Math.floor(kanvasFilter.height / PIXEL_SIZE);

      tempCanvas.width = smallWidth;
      tempCanvas.height = smallHeight;

      tempCtx.drawImage(umpanVideo, 0, 0, smallWidth, smallHeight);

      const imageData = tempCtx.getImageData(0, 0, smallWidth, smallHeight);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        data[i] = posterizeChannel(data[i]);
        data[i + 1] = posterizeChannel(data[i + 1]);
        data[i + 2] = posterizeChannel(data[i + 2]);
      }

      tempCtx.putImageData(imageData, 0, 0);

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
    const POSTERIZATION_LEVELS = 6;
    const EDGE_THRESHOLD = 140;
    const COLOR_INTENSITY = 0.99;

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
      const grayData = new Uint8ClampedArray(
        kanvasFilter.width * kanvasFilter.height
      );
      for (let i = 0; i < data.length; i += 4) {
        const gray =
          0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        grayData[i / 4] = gray;
      }

      const w = kanvasFilter.width;
      for (let i = 0; i < data.length; i += 4) {
        const y = Math.floor(i / 4 / w);
        const x = (i / 4) % w;

        if (y > 0 && y < kanvasFilter.height - 1 && x > 0 && x < w - 1) {
          const i_tl = x - 1 + (y - 1) * w;
          const i_t = x + (y - 1) * w;
          const i_tr = x + 1 + (y - 1) * w;
          const i_l = x - 1 + y * w;
          const i_r = x + 1 + y * w;
          const i_bl = x - 1 + (y + 1) * w;
          const i_b = x + (y + 1) * w;
          const i_br = x + 1 + (y + 1) * w;

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
            data[i] = 0;
            data[i + 1] = 0;
            data[i + 2] = 0;
          } else {
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

tombolAksiUtama.addEventListener("click", function _soloShutter() {
    // Solo mode saja — collab mode pasang listener sendiri di masukRoom()
    if (!inCollabMode) tanganiKlikAksiUtama();
  });

  tombolLanjut.addEventListener("click", tampilkankedua);
  tombolUnduh.addEventListener("click", unduhGambar);
  tombolBagikan.addEventListener("click", bagikanGambar); // --- BARU: Event listener untuk tombol share ---
  document.addEventListener("keydown", tanganiTombolVolume);
  tombolUlangiSemua.addEventListener("click", kembaliKePhotobooth);

  pilihanTataLetak.addEventListener("change", (e) => {
    if (e.target.value === "grid4") {
      alert("Maaf, fitur ini belum tersedia.");
      e.target.value = idTataLetakSaatIni;
      return;
    }
    const opsiTerpilih = e.target.options[e.target.selectedIndex].text;
    labelTataLetak.textContent = opsiTerpilih;
    aturTataLetak(e.target.value);
  });

  // 1. Saat Host ganti Timer
pilihanTimer.addEventListener("change", (e) => {
    const opsiTerpilih = e.target.options[e.target.selectedIndex].text;
    labelTimer.textContent = opsiTerpilih;
    
    // BARU: Host lapor ke Firebase kalau timer diubah
    if (collabModule && amIHost) {
      collabModule.kirimPerintah({ aksi: 'SYNC_SETTING', timer: e.target.value });
    }
  });



  areaKamera.addEventListener("click", (event) => {
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
      kanvasBgRemoval.className = "";
      
      // BARU: Host lapor ke Firebase kalau filter diubah
      if (collabModule && amIHost) {
        collabModule.kirimPerintah({ aksi: 'SYNC_SETTING', filter: filter });
      }

      if (filter === "pixel") {
        jalankanFilterPixelArt();
      } else if (filter === "artistic") {
        jalankanFilterArtistic();
      } else if (filter !== "none") {
        umpanVideo.classList.add(`filter-${filter}`);
        kanvasBgRemoval.classList.add(`filter-${filter}`);
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

  const tombolHarga = document.getElementById("tombol-harga");
  tombolHarga.addEventListener("click", (event) => {
    event.preventDefault(); // Mencegah link berpindah halaman
    alert("It's freemium for now and it will be paid soon.");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // REMOVE BACKGROUND (MediaPipe) + COLLAB REALTIME COMPOSITOR
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Remove Background ────────────────────────────────────────────────────
  const tombolRemoveBg = document.getElementById("tombol-remove-bg");
  const kanvasBgRemoval = document.getElementById("kanvas-bg-removal");
  const ctxBgRemoval = kanvasBgRemoval.getContext("2d");
  const inputWarnaCustom = document.getElementById("input-warna-bg-custom");

  let removeBgAktif = false;
  let warnaBgSaatIni = "#ffffff";
  let selfieSegmentation = null;
  let idAnimasiBgRemoval = null;

  function buatSelfieSegmentation() {
    if (!window.SelfieSegmentation) return null;
    const seg = new SelfieSegmentation({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
    });
    seg.setOptions({ modelSelection: 0, selfieMode: false });
    seg.onResults((results) => {
      if (!removeBgAktif) return;
      kanvasBgRemoval.width = results.image.width;
      kanvasBgRemoval.height = results.image.height;
      ctxBgRemoval.save();
      ctxBgRemoval.clearRect(0, 0, kanvasBgRemoval.width, kanvasBgRemoval.height);
      // A. Mask dengan feathering
      ctxBgRemoval.filter = 'blur(4px)';
      ctxBgRemoval.drawImage(results.segmentationMask, 0, 0, kanvasBgRemoval.width, kanvasBgRemoval.height);
      ctxBgRemoval.filter = 'none';
      // B. Orang masuk ke dalam mask
      ctxBgRemoval.globalCompositeOperation = 'source-in';
      ctxBgRemoval.drawImage(results.image, 0, 0, kanvasBgRemoval.width, kanvasBgRemoval.height);
      // C. Warna background di belakang orang
      ctxBgRemoval.globalCompositeOperation = 'destination-atop';
      ctxBgRemoval.fillStyle = warnaBgSaatIni;
      ctxBgRemoval.fillRect(0, 0, kanvasBgRemoval.width, kanvasBgRemoval.height);
      ctxBgRemoval.restore();
    });
    return seg;
  }

  async function aktifkanRemoveBg() {
    if (!window.SelfieSegmentation) {
      alert("MediaPipe belum termuat. Coba segarkan halaman.");
      return;
    }
    removeBgAktif = true;
    tombolRemoveBg.classList.add("aktif");
    kanvasBgRemoval.style.display = "block";
    umpanVideo.style.opacity = "0";
    if (!selfieSegmentation) selfieSegmentation = buatSelfieSegmentation();
    async function kirimFrame() {
      if (!removeBgAktif) return;
      if (umpanVideo.readyState >= 2) await selfieSegmentation.send({ image: umpanVideo });
      idAnimasiBgRemoval = requestAnimationFrame(kirimFrame);
    }
    kirimFrame();
  }

  function nonaktifkanRemoveBg() {
    removeBgAktif = false;
    tombolRemoveBg.classList.remove("aktif");
    kanvasBgRemoval.style.display = "none";
    umpanVideo.style.opacity = "1";
    if (idAnimasiBgRemoval) { cancelAnimationFrame(idAnimasiBgRemoval); idAnimasiBgRemoval = null; }
  }

  tombolRemoveBg.addEventListener("click", () => {
    if (removeBgAktif) {
      nonaktifkanRemoveBg();
    } else {
      inputWarnaCustom.click();
      aktifkanRemoveBg();
    }
    if (inCollabMode && amIHost && window.collabMod) {
      window.collabMod.simpanHostSettings({ removeBg: !removeBgAktif, warnaBg: warnaBgSaatIni });
      window.collabMod.kirimPerintah({ aksi: 'SYNC_SETTING', removeBg: !removeBgAktif, warnaBg: warnaBgSaatIni });
    }
  });

  inputWarnaCustom.addEventListener("input", (e) => {
    warnaBgSaatIni = e.target.value;
    if (inCollabMode && amIHost && window.collabMod) {
      window.collabMod.simpanHostSettings({ removeBg: removeBgAktif, warnaBg: warnaBgSaatIni });
      window.collabMod.kirimPerintah({ aksi: 'SYNC_SETTING', removeBg: removeBgAktif, warnaBg: warnaBgSaatIni });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // COLLAB COMPOSITOR — Canvas yang menggabungkan semua stream secara real-time
  // Layering: guest (order tinggi) di bawah → host (order=0) di atas
  // ═══════════════════════════════════════════════════════════════════════════

  // Canvas compositor untuk collab — hidden, dipakai sebagai sumber stream & foto
  const kanvasCompositor = document.createElement("canvas");
  kanvasCompositor.id = "kanvas-compositor-collab";
  kanvasCompositor.style.cssText = `
    position:absolute; top:0; left:0; width:100%; height:100%;
    display:none; object-fit:cover; z-index:5; pointer-events:none;
    transform:scaleX(-1);
  `;
  areaKamera.appendChild(kanvasCompositor);
  const ctxCompositor = kanvasCompositor.getContext("2d");

  // State stream orang lain: { userId: { img: HTMLImageElement, order: number, ts: number } }
  let streamCache = {};
  let idLoopCompositor = null;
  let myStreamOrder = 0; // order saya (0=host, 1=guest1, dst)

  // Fungsi utama compositor: gambar frame composite
  function gambarFrameCompositor() {
    if (!inCollabMode) { idLoopCompositor = requestAnimationFrame(gambarFrameCompositor); return; }

    const vidW = umpanVideo.videoWidth || 640;
    const vidH = umpanVideo.videoHeight || 480;
    if (kanvasCompositor.width !== vidW) kanvasCompositor.width = vidW;
    if (kanvasCompositor.height !== vidH) kanvasCompositor.height = vidH;

    ctxCompositor.clearRect(0, 0, vidW, vidH);

    // Kumpulkan semua layer: { order, drawFn }
    // Semua peserta dirender, yang order lebih besar (bergabung belakangan) digambar lebih dulu (di belakang)
    const layers = [];

    // Layer saya sendiri
    const mySrc = removeBgAktif ? kanvasBgRemoval : (
      (document.querySelector(".opsi-filter .tombol-opsi.aktif")?.dataset.filter === "pixel" ||
       document.querySelector(".opsi-filter .tombol-opsi.aktif")?.dataset.filter === "artistic")
        ? kanvasFilter : umpanVideo
    );
    layers.push({ order: myStreamOrder, src: mySrc, isCanvas: true });

    // Layer orang lain dari cache
    Object.entries(streamCache).forEach(([uid, info]) => {
      if (info.img && info.img.complete && info.img.naturalWidth > 0) {
        layers.push({ order: info.order, src: info.img, isCanvas: false });
      }
    });

    // Urutkan: order besar (guest) digambar lebih dulu (bawah), order kecil (host) terakhir (atas)
    layers.sort((a, b) => b.order - a.order);

    layers.forEach(({ src }) => {
      if (!src) return;
      const srcW = src.videoWidth || src.width || src.naturalWidth || vidW;
      const srcH = src.videoHeight || src.height || src.naturalHeight || vidH;
      // Object-fit: cover — crop tengah
      const scaleX = vidW / srcW, scaleY = vidH / srcH;
      const scale = Math.max(scaleX, scaleY);
      const drawW = srcW * scale, drawH = srcH * scale;
      const ox = (vidW - drawW) / 2, oy = (vidH - drawH) / 2;
      ctxCompositor.drawImage(src, ox, oy, drawW, drawH);
    });

    // Kirim stream composite saya ke Firebase (tanpa mirroring — mirroring ada di CSS)
    if (window.collabMod) {
      // Ambil dari composite tapi tanpa flip (Firebase menyimpan raw, CSS yang flip)
      const streamData = kanvasCompositor.toDataURL("image/webp", 0.25);
      window.collabMod.updateStreamKu(streamData);
    }

    idLoopCompositor = requestAnimationFrame(gambarFrameCompositor);
  }

  function mulaiCompositor() {
    kanvasCompositor.style.display = "block";
    // Sembunyikan video asli dan kanvas lain, compositor yang tampil
    umpanVideo.style.display = "none";
    kanvasBgRemoval.style.display = "none";
    kanvasFilter.style.display = "none";
    if (!idLoopCompositor) gambarFrameCompositor();
  }

  function hentikanCompositor() {
    if (idLoopCompositor) { cancelAnimationFrame(idLoopCompositor); idLoopCompositor = null; }
    kanvasCompositor.style.display = "none";
    umpanVideo.style.display = "block";
    if (removeBgAktif) kanvasBgRemoval.style.display = "block";
  }

  // Update cache stream dari Firebase
  function updateStreamCache(streamOrangLain, userOrders) {
    // Hapus stream user yang sudah keluar
    const activeUids = Object.keys(streamOrangLain);
    Object.keys(streamCache).forEach(uid => {
      if (!activeUids.includes(uid)) delete streamCache[uid];
    });

    // Update atau buat entry baru
    activeUids.forEach(uid => {
      const streamData = streamOrangLain[uid];
      if (!streamData || !streamData.data) return;
      if (!streamCache[uid]) {
        streamCache[uid] = { img: new Image(), order: streamData.order ?? 999, ts: 0 };
      }
      // Hanya update gambar jika ada data baru (ts berbeda)
      if (streamData.ts !== streamCache[uid].ts) {
        streamCache[uid].ts = streamData.ts;
        streamCache[uid].order = streamData.order ?? (userOrders[uid] ?? 999);
        streamCache[uid].img.src = streamData.data;
      }
    });
  }

  // ── Ambil foto composite (sumber = kanvasCompositor saat collab, normal jika solo) ──
  // Override ambilFoto agar saat collab pakai kanvas compositor sebagai sumber
  const _ambilFotoOriginal = ambilFoto;
  function ambilFotoCollab() {
    if (!umpanVideo.srcObject) return;

    const filterAktif = document.querySelector(".opsi-filter .tombol-opsi.aktif")?.dataset.filter || "none";
    const context = kanvasFoto.getContext("2d");

    if (inCollabMode) {
      // Sumber adalah compositor (sudah composite semua orang)
      kanvasFoto.width = kanvasCompositor.width || umpanVideo.videoWidth;
      kanvasFoto.height = kanvasCompositor.height || umpanVideo.videoHeight;
      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, kanvasFoto.width, kanvasFoto.height);
      // Mirror: compositor sudah scaleX(-1) via CSS tapi data canvas tidak ikut CSS,
      // jadi kita mirror manual saat ambil foto
      context.translate(kanvasFoto.width, 0);
      context.scale(-1, 1);
      context.drawImage(kanvasCompositor, 0, 0, kanvasFoto.width, kanvasFoto.height);
      context.restore();
    } else {
      // Solo mode: perilaku asli
      const sumberGambar = (filterAktif === "pixel" || filterAktif === "artistic")
        ? kanvasFilter : umpanVideo;
      kanvasFoto.width = umpanVideo.videoWidth;
      kanvasFoto.height = umpanVideo.videoHeight;
      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, kanvasFoto.width, kanvasFoto.height);
      context.translate(kanvasFoto.width, 0);
      context.scale(-1, 1);
      const sumber = removeBgAktif ? kanvasBgRemoval : sumberGambar;
      context.drawImage(sumber, 0, 0, kanvasFoto.width, kanvasFoto.height);
      context.restore();
    }

    const filterCss = getComputedStyle(umpanVideo).filter;
    if (filterAktif !== "none" && filterAktif !== "pixel" && filterAktif !== "artistic" && !inCollabMode) {
      // Apply CSS filter ke kanvas hasil
      const temp = document.createElement("canvas");
      temp.width = kanvasFoto.width;
      temp.height = kanvasFoto.height;
      const tCtx = temp.getContext("2d");
      tCtx.filter = filterCss;
      tCtx.drawImage(kanvasFoto, 0, 0);
      context.clearRect(0, 0, kanvasFoto.width, kanvasFoto.height);
      context.drawImage(temp, 0, 0);
    }

    daftarFoto[slotTerpilih] = kanvasFoto.toDataURL("image/jpeg", 0.9);
    tampilkanFotoDiSlot(slotTerpilih, daftarFoto[slotTerpilih]);

    // Upload foto ke collab
    if (window._collabUploadFoto) {
      window._collabUploadFoto(daftarFoto[slotTerpilih], slotTerpilih);
    }

    pilihSlotUntukUlangi(cariSlotKosongBerikutnya());
    perbaruiVisibilitasTombolLanjut();
  }

  // Ganti fungsi ambilFoto global dengan versi collab-aware
  // Karena ambilFoto adalah closure, kita replace referensi di event listeners
  // dengan memonitor apakah inCollabMode aktif
  const observerThumbnail = new MutationObserver((mutations) => {
    // Tidak perlu re-process jika collab sudah handle sendiri
    if (inCollabMode) return;
    if (!removeBgAktif) return;
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1 && node.tagName === "IMG") {
          const slotIndex = parseInt(node.closest(".slot-thumbnail")?.dataset.slot ?? "-1");
          if (slotIndex < 0) return;
          const bgCanvas = document.createElement("canvas");
          bgCanvas.width = kanvasBgRemoval.width;
          bgCanvas.height = kanvasBgRemoval.height;
          const bgCtx = bgCanvas.getContext("2d");
          bgCtx.translate(bgCanvas.width, 0);
          bgCtx.scale(-1, 1);
          bgCtx.drawImage(kanvasBgRemoval, 0, 0);
          const newDataUrl = bgCanvas.toDataURL("image/jpeg", 0.9);
          node.src = newDataUrl;
          daftarFoto[slotIndex] = newDataUrl;
        }
      });
    });
  });
  observerThumbnail.observe(wadahThumbnail, { childList: true, subtree: true });

  // ── Collab UI ─────────────────────────────────────────────────────────────
  const tombolCollab = document.getElementById("tombol-collab");
  const overlayCollab = document.getElementById("overlay-collab");
  const popupCollab = document.getElementById("popup-collab");
  const tombolTutupCollab = document.getElementById("tombol-tutup-collab");
  const tombolBuatRoom = document.getElementById("tombol-buat-room");
  const tombolGabungRoom = document.getElementById("tombol-gabung-room");
  const inputKodeRoom = document.getElementById("input-kode-room");
  const collabPesanEl = document.getElementById("collab-popup-pesan");
  const collabStatusBar = document.getElementById("collab-status-bar");
  const collabRoomCodeDisplay = document.getElementById("collab-room-code-display");
  const collabNotchInfo = document.getElementById("collab-notch-info");
  const tombolKeluarRoom = document.getElementById("tombol-keluar-room");

  function tampilkanPopupCollab() {
    overlayCollab.classList.add("tampil");
    popupCollab.classList.add("tampil");
    collabPesanEl.textContent = "";
    inputKodeRoom.value = "";
  }
  function sembunyikanPopupCollab() {
    overlayCollab.classList.remove("tampil");
    popupCollab.classList.remove("tampil");
  }

  tombolCollab.addEventListener("click", (e) => { e.preventDefault(); tampilkanPopupCollab(); });
  tombolTutupCollab.addEventListener("click", sembunyikanPopupCollab);
  overlayCollab.addEventListener("click", sembunyikanPopupCollab);

  let collabModule = null;
  async function muatModulCollab() {
    if (collabModule) return collabModule;
    try {
      collabModule = await import("./collab.js");
      return collabModule;
    } catch (e) {
      throw new Error("Gagal memuat modul collab.");
    }
  }

  function aktifkanStatusBar(kode) {
    collabStatusBar.classList.add("tampil");
    collabRoomCodeDisplay.textContent = kode;
    if (!amIHost) {
      // Guest: shutter dinonaktifkan, host yang kontrol
      tombolAksiUtama.style.pointerEvents = "none";
      tombolAksiUtama.style.opacity = "0.5";
      pilihanTimer.disabled = true;
      document.querySelector(".opsi-filter").style.display = "none";
    } else {
      tombolAksiUtama.style.pointerEvents = "auto";
      tombolAksiUtama.style.opacity = "1";
      pilihanTimer.disabled = false;
      document.querySelector(".opsi-filter").style.display = "flex";
    }
  }

  async function masukRoom(mode, kode = null) {
    collabPesanEl.textContent = "Menghubungkan...";
    tombolBuatRoom.disabled = true;
    tombolGabungRoom.disabled = true;
    try {
      const mod = await muatModulCollab();
      window.collabMod = mod;
      let result;
      if (mode === "buat") {
        result = await mod.buatRoom();
        amIHost = true;
      } else {
        if (!kode || kode.trim().length < 4) throw new Error("Masukkan kode room yang valid.");
        result = await mod.gabungRoom(kode.trim().toUpperCase());
        amIHost = false;
      }

      inCollabMode = true;
      myStreamOrder = mod.getMyOrder();

      // Setup upload foto
      window._collabUploadFoto = (dataUrl, slotIndex) => {
        mod.uploadFotoCollab(dataUrl, slotIndex).catch(console.warn);
      };

      // Mulai compositor canvas
      mulaiCompositor();

      // Override ambilFoto dengan versi collab
      // Patch tombol & timer agar gunakan ambilFotoCollab
      tombolAksiUtama.removeEventListener("click", tanganiKlikAksiUtama);
      tombolAksiUtama.addEventListener("click", () => {
        if (inCollabMode && amIHost && window.collabMod) {
          window.collabMod.kirimPerintah({ aksi: 'MULAI_FOTO' });
        }
        if (!inCollabMode || amIHost) tanganiKlikAksiUtamaCollab();
      });

      // Dengarkan Firebase
      mod.dengarkânFotoCollab(({ streamOrangLain, command, userOrders }) => {
        // Update stream cache → compositor akan otomatis pakai data terbaru
        updateStreamCache(streamOrangLain, userOrders);

        // Guest ikuti perintah host
        if (!amIHost && command && command.ts > lastCommandTs) {
          lastCommandTs = command.ts;
          if (command.aksi === 'MULAI_FOTO') {
            tanganiKlikAksiUtamaCollab();
          }
          if (command.aksi === 'SYNC_SETTING') {
            if (command.timer !== undefined) pilihanTimer.value = command.timer;
            if (command.filter) {
              const btn = document.querySelector(`.opsi-filter .tombol-opsi[data-filter='${command.filter}']`);
              if (btn) btn.click();
            }
            // Sinkronkan background dari host
            if (command.removeBg !== undefined) {
              if (command.removeBg && !removeBgAktif) aktifkanRemoveBg();
              else if (!command.removeBg && removeBgAktif) nonaktifkanRemoveBg();
            }
            if (command.warnaBg) {
              warnaBgSaatIni = command.warnaBg;
              inputWarnaCustom.value = command.warnaBg;
            }
          }
        }
      });

      collabPesanEl.textContent = `Berhasil masuk room ${result.roomCode}! 🎉`;
      setTimeout(() => {
        sembunyikanPopupCollab();
        aktifkanStatusBar(result.roomCode);
      }, 1000);

    } catch (err) {
      collabPesanEl.textContent = `Error: ${err.message}`;
    } finally {
      tombolBuatRoom.disabled = false;
      tombolGabungRoom.disabled = false;
    }
  }

  // Versi tanganiKlikAksiUtama yang pakai ambilFotoCollab
  function tanganiKlikAksiUtamaCollab() {
    if (sedangHitungMundur) return;
    const durasiTimer = parseInt(pilihanTimer.value, 10);
    if (durasiTimer > 0) {
      mulaiHitungMundurCollab(durasiTimer);
    } else {
      ambilFotoCollab();
    }
  }

  function mulaiHitungMundurCollab(detik) {
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
        ambilFotoCollab();
        sedangHitungMundur = false;
        tombolAksiUtama.disabled = false;
      }
    }, 1000);
  }

  tombolBuatRoom.addEventListener("click", () => masukRoom("buat"));
  tombolGabungRoom.addEventListener("click", () => masukRoom("gabung", inputKodeRoom.value));
  inputKodeRoom.addEventListener("keydown", (e) => {
    if (e.key === "Enter") masukRoom("gabung", inputKodeRoom.value);
    inputKodeRoom.value = inputKodeRoom.value.toUpperCase();
  });

  collabNotchInfo.addEventListener("click", () => {
    const kode = collabRoomCodeDisplay.textContent;
    if (kode && kode !== "----" && kode !== "Disalin!") {
      navigator.clipboard.writeText(kode).then(() => {
        collabRoomCodeDisplay.textContent = "Disalin!";
        setTimeout(() => { collabRoomCodeDisplay.textContent = kode; }, 2000);
      });
    }
  });

  tombolKeluarRoom.addEventListener("click", async () => {
    if (!collabModule) return;
    await collabModule.keluarRoom();
    window._collabUploadFoto = null;
    window.collabMod = null;
    inCollabMode = false;
    streamCache = {};
    hentikanCompositor();
    collabStatusBar.classList.remove("tampil");
    // Kembalikan kontrol normal
    tombolAksiUtama.style.pointerEvents = "auto";
    tombolAksiUtama.style.opacity = "1";
    pilihanTimer.disabled = false;
    document.querySelector(".opsi-filter").style.display = "flex";
  });

  // ── Fine ─────────────────────────────────────────────────────────────────

  inisialisasi();
  const tombolHamburger = document.getElementById("tombol-hamburger");
  const menuNavigasi = document.getElementById("menu-navigasi");

  tombolHamburger.addEventListener("click", () => {
    menuNavigasi.classList.toggle("tampil");
    const icon = tombolHamburger.querySelector("i");
    if (menuNavigasi.classList.contains("tampil")) {
      icon.classList.replace("fa-bars", "fa-xmark");
    } else {
      icon.classList.replace("fa-xmark", "fa-bars");
    }
  });

  menuNavigasi.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      menuNavigasi.classList.remove("tampil");
      tombolHamburger.querySelector("i").classList.replace("fa-xmark", "fa-bars");
    });
  });
});
