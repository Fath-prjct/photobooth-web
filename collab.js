// collab.js — Modul Collab Photobooth via Firebase Realtime Database
// Config dibaca dari config.js (jangan di-commit ke git)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, set, get, onValue, off, remove, update }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

let app, db;
let roomCode = null;
let myUserId = null;
let myRole = null; // 'host' | 'guest'
let joinOrder = 0; // urutan masuk room (0 = host, 1 = guest pertama, dst)
let unsubscribeRoom = null;

// Throttle stream upload (max ~10fps ke Firebase)
let lastStreamUpload = 0;
const STREAM_THROTTLE_MS = 100;

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
    if (!config) throw new Error("config.js belum dimuat.");
    if (config.apiKey.startsWith("GANTI")) throw new Error("Isi config.js dengan API key Firebase kamu terlebih dahulu");
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
  myRole = 'host';
  joinOrder = 0;

  await set(ref(database, `rooms/${roomCode}/users/${myUserId}`), {
    joined: true,
    role: 'host',
    order: 0,
    ts: Date.now()
  });

  return { roomCode, userId: myUserId, role: myRole };
}

export async function gabungRoom(kode) {
  const database = await initFirebase();
  const snapshot = await get(ref(database, `rooms/${kode}`));
  if (!snapshot.exists()) throw new Error("Room tidak ditemukan. Periksa kode lagi.");

  roomCode = kode.toUpperCase();
  myUserId = generateUserId();
  myRole = 'guest';

  // Hitung urutan bergabung
  const roomData = snapshot.val();
  const existingUsers = roomData.users ? Object.keys(roomData.users) : [];
  joinOrder = existingUsers.length; // 0=host, 1=guest1, dst

  await set(ref(database, `rooms/${roomCode}/users/${myUserId}`), {
    joined: true,
    role: 'guest',
    order: joinOrder,
    ts: Date.now()
  });

  return { roomCode, userId: myUserId, role: myRole };
}

// Upload foto per slot ke Firebase (tetap ada untuk hasil foto)
export async function uploadFotoCollab(dataUrl, slotIndex) {
  if (!db || !roomCode || !myUserId) return;
  const canvas = document.createElement("canvas");
  const img = new Image();
  await new Promise(res => { img.onload = res; img.src = dataUrl; });
  canvas.width = img.width;
  canvas.height = img.height;
  canvas.getContext("2d").drawImage(img, 0, 0);
  const compressed = canvas.toDataURL("image/jpeg", 0.5);
  await set(ref(db, `rooms/${roomCode}/photos/${myUserId}/${slotIndex}`), {
    data: compressed,
    ts: Date.now()
  });
}

// Update stream live (throttled) — kirim frame dari canvas/video
export async function updateStreamKu(dataUrl) {
  if (!db || !roomCode || !myUserId) return;
  const now = Date.now();
  if (now - lastStreamUpload < STREAM_THROTTLE_MS) return;
  lastStreamUpload = now;

  try {
    await set(ref(db, `rooms/${roomCode}/streams/${myUserId}`), {
      data: dataUrl,
      ts: now,
      order: joinOrder
    });
  } catch (e) {
    // Abaikan error stream ringan
  }
}

// Dengarkan seluruh data room: stream, foto, command, users
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
    const streams = roomData.streams || {};
    const hostSettings = roomData.hostSettings || null;

    // Pisahkan stream: milik sendiri vs orang lain, dengan urutan
    const streamOrangLain = {};
    Object.entries(streams).forEach(([uid, streamData]) => {
      if (uid !== myUserId) {
        streamOrangLain[uid] = streamData;
      }
    });

    // Foto orang lain per slot
    const fotoOrangLain = {};
    Object.entries(photos).forEach(([uid, slots]) => {
      if (uid !== myUserId) fotoOrangLain[uid] = slots;
    });

    const jumlahPeserta = Object.keys(users).length;

    // Informasi urutan semua user (untuk layering)
    const userOrders = {};
    Object.entries(users).forEach(([uid, userData]) => {
      userOrders[uid] = userData.order ?? 999;
    });

    callback({
      fotoOrangLain,
      streamOrangLain,
      jumlahPeserta,
      roomCode,
      command,
      hostSettings,
      userOrders,
      myUserId,
      myOrder: joinOrder
    });
  });
}

export async function keluarRoom() {
  if (!db || !roomCode || !myUserId) return;
  try {
    await remove(ref(db, `rooms/${roomCode}/users/${myUserId}`));
    await remove(ref(db, `rooms/${roomCode}/photos/${myUserId}`));
    await remove(ref(db, `rooms/${roomCode}/streams/${myUserId}`));
  } catch (e) {}
  if (unsubscribeRoom) off(ref(db, `rooms/${roomCode}`));
  roomCode = null;
  myUserId = null;
  myRole = null;
  joinOrder = 0;
}

export function getRoomCode() { return roomCode; }
export function getUserId() { return myUserId; }
export function getMyRole() { return myRole; }
export function getMyOrder() { return joinOrder; }
export function isInRoom() { return !!roomCode; }

export async function kirimPerintah(perintah) {
  if (!db || !roomCode) return;
  await set(ref(db, `rooms/${roomCode}/command`), {
    ...perintah,
    ts: Date.now()
  });
}

// Host menyimpan pengaturan background ke room agar guest bisa sinkron
export async function simpanHostSettings(settings) {
  if (!db || !roomCode) return;
  await set(ref(db, `rooms/${roomCode}/hostSettings`), {
    ...settings,
    ts: Date.now()
  });
}
