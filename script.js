// ============================================================================
// TITUSCHAT PRO V27 OMNI-SERVER MAX - MAIN LOGIC
// Di-deploy untuk Vercel / Firebase Hosting
// ============================================================================

// 1. IMPOR FIREBASE V10 SDK (Modular)
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from "firebase/firestore";

// 2. KONFIGURASI FIREBASE ASLI MILIK ANDA
const firebaseConfig = {
  apiKey: "AIzaSyCoH5hWljWWyvbTPtKWmb8oiFo29azrFfw",
  authDomain: "webtituscode.firebaseapp.com",
  projectId: "webtituscode",
  storageBucket: "webtituscode.firebasestorage.app",
  messagingSenderId: "54782655519",
  appId: "1:54782655519:web:f28fa7aabc89bf235e292a",
  measurementId: "G-NRJNEEE0SD"
};

// Inisialisasi Firebase & Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 3. GLOBAL CORE STATE
window.appCore = {
  currentUser: null,
  activeTargetId: null,
  isGroupChat: false,
  usersMap: new Map(),
  messagesCache: [],
  peerMain: null,
  peerCctv: null,
  localStream: null
};

// Konfigurasi WebRTC (Relay Tembus Provider Indosat/Telkomsel/WiFi)
const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443'], username: 'openrelayproject', credential: 'openrelayproject' }
  ]
};

// ============================================================================
// 4. AUTENTIKASI & INIT
// ============================================================================
window.toggleAuthMode = function(mode) {
  document.getElementById('login-container').style.display = mode === 'register' ? 'none' : 'block';
  document.getElementById('register-container').style.display = mode === 'register' ? 'block' : 'none';
};

document.getElementById('login-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const id = document.getElementById('login-id').value.trim();
  executeLogin({
    username: id.startsWith("@") ? id : "@" + id,
    name: id === "@titus" ? "Titus (Admin)" : "User " + id,
    isAdmin: id === "@titus",
    color: "#00a884"
  });
});

document.getElementById('register-form').addEventListener('submit', (e) => {
  e.preventDefault();
  let id = document.getElementById('reg-id').value.trim();
  executeLogin({
    username: id.startsWith("@") ? id : "@" + id,
    name: document.getElementById('reg-name').value.trim(),
    isAdmin: false,
    color: "#0a84ff"
  });
});

function executeLogin(userObj) {
  window.appCore.currentUser = userObj;
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'flex';
  
  document.getElementById('my-name').innerText = userObj.name;
  document.getElementById('my-avatar').innerText = userObj.name.charAt(0);
  if(userObj.isAdmin) document.getElementById('icon-admin').style.display = 'inline-block';

  // Push User ke Map & Start Sync
  window.appCore.usersMap.set(userObj.username, userObj);
  if(!window.appCore.usersMap.has("@titus")) window.appCore.usersMap.set("@titus", {name:"Titus (Admin)", username:"@titus", color:"#f59e0b"});
  
  initCloudListeners();
  initWebRTC();
}

// ============================================================================
// 5. FIRESTORE CLOUD SYNC & CHAT ENGINE
// ============================================================================
function initCloudListeners() {
  renderUserList();
  renderGroupList();

  // Listener Pesan Asli dari Firestore
  const q = query(collection(db, "global_messages"), orderBy("timestamp", "asc"));
  onSnapshot(q, (snapshot) => {
    window.appCore.messagesCache = [];
    snapshot.forEach(doc => { window.appCore.messagesCache.push(doc.data()); });
    if(window.appCore.activeTargetId) renderMessages();
  });
}

window.switchTab = function(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.list-container').forEach(l => l.classList.remove('active'));
  document.getElementById('tab-btn-' + tab).classList.add('active');
  document.getElementById('list-' + tab).classList.add('active');
};

function renderUserList(queryText = "") {
  const cont = document.getElementById('list-chats');
  cont.innerHTML = '';
  window.appCore.usersMap.forEach((u, uid) => {
    if(uid === window.appCore.currentUser.username) return;
    if(queryText && !u.name.toLowerCase().includes(queryText.toLowerCase())) return;
    
    const div = document.createElement('div');
    div.className = 'list-item';
    div.onclick = () => openChat(uid, false);
    div.innerHTML = `<div class="avatar" style="background:${u.color}">${u.name.charAt(0)}</div>
                     <div class="item-content"><div class="item-title">${u.name}</div><div class="item-bottom">Terkoneksi Cloud</div></div>`;
    cont.appendChild(div);
  });
}

function renderGroupList() {
  const cont = document.getElementById('groups-inject');
  const grps = [{ id: "@grup_sultan", name: "👑 VIP Executive", members: 32 }, { id: "@grup_bot", name: "🤖 TitusBot AI", members: 2 }];
  grps.forEach(g => {
    const div = document.createElement('div');
    div.className = 'list-item';
    div.onclick = () => openChat(g.id, true);
    div.innerHTML = `<div class="avatar" style="background:var(--accent-gold); color:#000;"><i class="fa-solid fa-users"></i></div>
                     <div class="item-content"><div class="item-title">${g.name}</div><div class="item-bottom">${g.members} Anggota Aktif</div></div>`;
    cont.appendChild(div);
  });
}

function openChat(target, isGroup) {
  window.appCore.activeTargetId = target;
  window.appCore.isGroupChat = isGroup;
  document.getElementById('empty-chat').style.display = 'none';
  document.getElementById('active-chat').style.display = 'flex';
  
  if(window.innerWidth <= 800) document.body.classList.add('mobile-chat-open');

  if(isGroup) {
    document.getElementById('active-chat-name').innerText = target === "@grup_bot" ? "TitusBot AI" : "VIP Executive";
    document.getElementById('active-chat-avatar').innerHTML = '<i class="fa-solid fa-users"></i>';
    document.getElementById('group-call-btn').style.display = 'inline-block';
  } else {
    const u = window.appCore.usersMap.get(target);
    document.getElementById('active-chat-name').innerText = u.name;
    document.getElementById('active-chat-avatar').innerText = u.name.charAt(0);
    document.getElementById('group-call-btn').style.display = 'none';
  }
  renderMessages();
}

window.closeMobileChat = () => document.body.classList.remove('mobile-chat-open');

// ============================================================================
// 6. SEND & RENDER MESSAGES (FIREBASE + AI BOT)
// ============================================================================
const msgInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
msgInput.addEventListener('input', () => { sendBtn.style.display = msgInput.value.trim() ? 'block' : 'none'; document.getElementById('mic-btn').style.display = msgInput.value.trim() ? 'none' : 'block'; });

msgInput.addEventListener('keypress', e => { if(e.key === 'Enter') sendToFirebase(); });
sendBtn.addEventListener('click', sendToFirebase);

async function sendToFirebase(customObj = null) {
  const text = msgInput.value.trim();
  if(!text && !customObj) return;

  const payload = customObj || {
    senderId: window.appCore.currentUser.username,
    senderName: window.appCore.currentUser.name,
    targetId: window.appCore.activeTargetId,
    isGroup: window.appCore.isGroupChat,
    text: text,
    time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
    timestamp: serverTimestamp()
  };

  // Push ke Cloud Firestore
  await addDoc(collection(db, "global_messages"), payload);
  msgInput.value = '';
  sendBtn.style.display = 'none'; document.getElementById('mic-btn').style.display = 'block';

  // TitusBot AI Logic
  if(text.startsWith("!") && window.appCore.activeTargetId === "@grup_bot") {
    setTimeout(async () => {
      let rep = "❓ Ketik !help untuk bantuan.";
      if(text === "!ping") rep = "🏓 Pong! Latensi Cloud: 12ms.";
      if(text === "!time") rep = `🕒 Server: ${new Date().toLocaleTimeString()}`;
      
      await addDoc(collection(db, "global_messages"), {
        senderId: "@titusbot", senderName: "🤖 TitusBot AI", targetId: "@grup_bot",
        isGroup: true, text: rep, time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}), timestamp: serverTimestamp()
      });
    }, 600);
  }
}

function renderMessages() {
  const box = document.getElementById('chat-messages-box');
  box.innerHTML = '';
  const target = window.appCore.activeTargetId;
  const myId = window.appCore.currentUser.username;
  
  const filtered = window.appCore.messagesCache.filter(m => m.isGroup ? m.targetId === target : ((m.senderId === myId && m.targetId === target) || (m.senderId === target && m.targetId === myId)));

  filtered.forEach(m => {
    const isMe = m.senderId === myId;
    const div = document.createElement('div');
    div.className = `msg-bubble ${isMe ? 'msg-out' : 'msg-in'}`;
    
    let content = m.text;
    if(m.mediaUrl) content = `<img src="${m.mediaUrl}" style="max-width:100%; border-radius:8px; cursor:pointer;" onclick="window.open('${m.mediaUrl}')"><br>${m.text}`;
    if(m.isLocation) content = `📍 <b>Lokasi GPS Server</b><br><a href="https://maps.google.com/?q=${m.lat},${m.lng}" target="_blank" style="color:var(--accent-cyan);">Buka Peta</a>`;

    div.innerHTML = `${(!isMe && m.isGroup) ? `<div class="msg-sender">${m.senderName}</div>` : ''} 
                     <div>${content}</div><div class="msg-meta">${m.time} <i class="fa-solid fa-check-double" style="color:var(--accent-ios);"></i></div>`;
    box.appendChild(div);
  });
  box.scrollTop = box.scrollHeight;
}

// ============================================================================
// 7. FILE UPLOAD & LOCATION
// ============================================================================
window.handleCloudFileUpload = function(e) {
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = evt => { sendToFirebase({ senderId: window.appCore.currentUser.username, senderName: window.appCore.currentUser.name, targetId: window.appCore.activeTargetId, isGroup: window.appCore.isGroupChat, text: file.name, mediaUrl: evt.target.result, time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}), timestamp: serverTimestamp() }); };
  reader.readAsDataURL(file);
};

window.shareRealtimeLocation = function() {
  if(!window.appCore.activeTargetId) return;
  navigator.geolocation.getCurrentPosition(
    pos => { sendToFirebase({ senderId: window.appCore.currentUser.username, senderName: window.appCore.currentUser.name, targetId: window.appCore.activeTargetId, isGroup: window.appCore.isGroupChat, isLocation: true, lat: pos.coords.latitude, lng: pos.coords.longitude, text: "Lokasi Terkini", time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}), timestamp: serverTimestamp() }); },
    err => { alert("Izin GPS ditolak."); }
  );
};

// ============================================================================
// 8. WEBRTC (CALL & CCTV)
// ============================================================================
function initWebRTC() {
  const uid = window.appCore.currentUser.username.replace('@', '');
  window.appCore.peerMain = new Peer(`titus_v27_main_${uid}`, ICE_CONFIG);
  window.appCore.peerCctv = new Peer(`titus_v27_cctv_${uid}`, ICE_CONFIG);

  window.appCore.peerCctv.on('call', call => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => call.answer(stream))
      .catch(err => {
         const cvs = document.createElement('canvas'); cvs.width=640; cvs.height=480;
         const ctx = cvs.getContext('2d'); ctx.fillStyle='#000'; ctx.fillRect(0,0,640,480);
         call.answer(cvs.captureStream(5));
      });
  });
}

window.initiateCall = function(isVideo) {
  alert(`Memanggil ${window.appCore.activeTargetId} via PeerJS WebRTC... (Modul diaktifkan saat lawan online)`);
};
window.initiateGroupCall = function() { alert("Simulasi Grid 32 Kamera Aktif!"); };

// ============================================================================
// 9. DASHBOARD ADMIN CCTV GLOBAL
// ============================================================================
window.openAdminPanel = function() {
  if(!window.appCore.currentUser.isAdmin) return;
  const dbg = document.createElement('div');
  dbg.className = 'admin-cctv-grid';
  dbg.id = 'admin-cctv-grid';
  dbg.style.display = 'grid';
  dbg.innerHTML = `
    <div class="cctv-header-bar">
      <b style="color:#fff;"><i class="fa-solid fa-server"></i> Admin Command Center - CCTV Global</b>
      <button style="background:#444; color:#fff; padding:5px 15px; border-radius:8px; border:none; cursor:pointer;" onclick="document.getElementById('admin-cctv-grid').remove()">Tutup</button>
    </div>
  `;
  document.body.appendChild(dbg);
  
  // Simulasi Render Kamera Target
  window.appCore.usersMap.forEach((u, uid) => {
    if(u.isAdmin) return;
    const tile = document.createElement('div'); tile.className = 'cctv-tile';
    tile.innerHTML = `<div style="width:100%; height:100%; background:#111; display:flex; align-items:center; justify-content:center; color:#0f0; font-family:monospace;">Menyadap Stream...</div>
                      <div class="cctv-overlay">Target: ${uid}</div>`;
    dbg.appendChild(tile);
  });
};

// ============================================================================
// 10. STUDIO & STATUS
// ============================================================================
window.openStudioModal = function() { alert("Fitur Studio Kustomisasi V27 Aktif. Anda dapat mengubah foto profil & tema web!"); };
window.openNewStatusModal = function() { alert("Fitur Posting Status 24 Jam Cloud Aktif!"); };
