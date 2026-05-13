// config.js — Konfigurasi API Keys
// PENTING: File ini ada di .gitignore, jangan di-push ke GitHub.

const APP_CONFIG = {
  firebase: {
    
  apiKey: "AIzaSyD-tzoXzA8ZkjzfAQKF_TH50W-PuxUQC5g",
  authDomain: "photobooth-66060.firebaseapp.com",
  databaseURL: "https://photobooth-66060-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "photobooth-66060",
  storageBucket: "photobooth-66060.firebasestorage.app",
  messagingSenderId: "307429287076",
  appId: "1:307429287076:web:0c1b1e613b54fcafbdb231",
  measurementId: "G-YECZGCSPCS"

  }
};

// Expose ke window agar bisa dibaca collab.js sebagai ES Module
window.APP_CONFIG = APP_CONFIG;
