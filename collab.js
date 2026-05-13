// collab.js — Modul Collab Photobooth via Firebase Realtime Database
// Config dibaca dari config.js (jangan di-commit ke git)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, set, get, onValue, off, remove }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

let app, db;
let roomCode = null;
let myUserId = null;
let unsubscribeRoom = null;

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function generateUserId() {
  return "user_" + Math.random().toString(36).slice(2, 9);
}

async function initFirebase() {
  if (db) return db;
  try {
    const config = window.APP_CONFIG?.firebase;
    if (!config) {
      throw new Error("config.js belum dimuat. Pastikan tag <script src='config.js'> ada sebelum collab.js di home.html");
    }
    if (config.apiKey.startsWith("GANTI")) {
      throw new Error("Isi config.js dengan API key Firebase kamu terlebih dahulu");
    }
    app = initializeApp(config);
    db = getDatabase(app);
    return db;
  } catch (e) {
    console.warn("[Collab] Firebase init gagal:", e.message);
    throw e;
  }
}

export async function buatRoom() {
  const database = await initFirebase();
  roomCode = generateRoomCode();
  myUserId = generateUserId();
  await set(ref(database, `rooms/${roomCode}/users/${myUserId}`), {
    joined: true,
    ts: Date.now()
  });
  return { roomCode, userId: myUserId };
}

export async function gabungRoom(kode) {
  const database = await initFirebase();
  const snapshot = await get(ref(database, `rooms/${kode}`));
  if (!snapshot.exists()) throw new Error("Room tidak ditemukan. Periksa kode lagi.");
  roomCode = kode.toUpperCase();
  myUserId = generateUserId();
  await set(ref(database, `rooms/${roomCode}/users/${myUserId}`), {
    joined: true,
    ts: Date.now()
  });
  return { roomCode, userId: myUserId };
}

export async function uploadFotoCollab(dataUrl, slotIndex) {
  if (!db || !roomCode || !myUserId) return;
  const canvas = document.createElement("canvas");
  const img = new Image();
  await new Promise(res => { img.onload = res; img.src = dataUrl; });
  canvas.width = img.width;
  canvas.height = img.height;
  canvas.getContext("2d").drawImage(img, 0, 0);
  const compressed = canvas.toDataURL("image/jpeg", 0.4);
  await set(ref(db, `rooms/${roomCode}/photos/${myUserId}/${slotIndex}`), {
    data: compressed,
    ts: Date.now()
  });
}



export function dengarkânFotoCollab(callback) {
  if (!db || !roomCode) return;
  const roomRef = ref(db, `rooms/${roomCode}`);
  if (unsubscribeRoom) off(roomRef);
  unsubscribeRoom = onValue(roomRef, (snapshot) => {
    if (!snapshot.exists()) return;
    const roomData = snapshot.val();
const command = roomData.command || null;
    const photos = roomData.photos || {};
    const users = roomData.users || {};
    const fotoOrangLain = {};
    Object.entries(photos).forEach(([uid, slots]) => {
      if (uid !== myUserId) fotoOrangLain[uid] = slots;
    });
    const jumlahPeserta = Object.keys(users).length;
    callback({ fotoOrangLain, jumlahPeserta, roomCode, command });
  });
}

export async function keluarRoom() {
  if (!db || !roomCode || !myUserId) return;
  try {
    await remove(ref(db, `rooms/${roomCode}/users/${myUserId}`));
    await remove(ref(db, `rooms/${roomCode}/photos/${myUserId}`));
  } catch (e) {}
  if (unsubscribeRoom) off(ref(db, `rooms/${roomCode}`));
  roomCode = null;
  myUserId = null;
}


export function getRoomCode() { return roomCode; }
export function getUserId() { return myUserId; }
export function isInRoom() { return !!roomCode; }

export async function kirimPerintah(perintah) {
  if (!db || !roomCode) return;
  await set(ref(db, `rooms/${roomCode}/command`), {
    ...perintah,
    ts: Date.now()
  });
}

export async function updateStreamKu(dataUrl) {
  if (!db || !roomCode || !myUserId) return;
  // Gunakan set agar data lama tertimpa (menghemat storage Firebase)
  await set(ref(db, `rooms/${roomCode}/streams/${myUserId}`), {
    data: dataUrl,
    ts: Date.now()
  });
}
