const express = require('express');
const multer  = require('multer');
const fs      = require('fs');
const path    = require('path');
const cors    = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { fileSize: 20 * 1024 * 1024 } });

const dbPath = path.join('/tmp', 'tituscode_v5_db.json');

let serverData = {
  users: [
    { name: "Administrator Server", username: "@admin", password: "admin123", role: "admin", color: "#f59e0b", about: "Sistem Eksekutif TitusCode", avatar: null },
    { name: "Client Satu (Dev)", username: "@client1", password: "client123", role: "user", color: "#3b82f6", about: "Siap berdiskusi", avatar: null },
    { name: "Client Dua (Network)", username: "@client2", password: "client123", role: "user", color: "#10b981", about: "Online dari PC", avatar: null },
    { name: "Client Tiga (Security)", username: "@client3", password: "client123", role: "user", color: "#8b5cf6", about: "Memantau server", avatar: null }
  ],
  chats: [
    {
      id: "group-general",
      name: "Komunitas Publik TitusCode",
      bsuid: "Grup Umum",
      isGroup: true,
      participants: ["ALL"], // Semua orang bisa lihat
      color: "#06b6d4",
      creator: "@admin",
      messages: [
        { id: 1, senderName: "Administrator Server", senderUsername: "@admin", text: "Selamat datang di TitusCode V5! Klik Call/Vidcall di grup ini untuk tes panggilan massal.", time: "10:00" }
      ]
    }
  ],
  activeCalls: {} // Format: { [chatId]: { type: 'audio'|'video', initiator: '@admin', participants: ['@admin', '@client1'] } }
};

function loadData() {
  try { if (fs.existsSync(dbPath)) serverData = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch (e) {}
  return serverData;
}
function saveData(data) {
  serverData = data;
  try { fs.writeFileSync(dbPath, JSON.stringify(data), 'utf8'); } catch (e) {}
}

// 1. Ambil Data Terfilter (Khusus Obrolan milik User tersebut agar Client lain tidak bisa intip!)
app.post('/api/data', (req, res) => {
  const { username } = req.body;
  const db = loadData();
  
  if (!username) return res.status(400).json({ success: false });

  // Filter chat: Hanya ambil grup publik ATAU chat privat di mana username ini adalah anggota
  const myChats = db.chats.filter(c => {
    if (c.isGroup && c.participants.includes("ALL")) return true;
    return c.participants && c.participants.includes(username);
  });

  res.json({
    users: db.users,
    chats: myChats,
    activeCalls: db.activeCalls
  });
});

// 2. Autentikasi Login & Register
app.post('/api/auth', (req, res) => {
  const { type, name, username, password } = req.body;
  const db = loadData();

  if (type === 'login') {
    const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
    if (user) return res.json({ success: true, user });
    return res.status(401).json({ success: false, message: "Username atau kata sandi salah!" });
  } 
  
  if (type === 'register') {
    if (db.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
      return res.status(400).json({ success: false, message: "Username tersebut sudah terdaftar!" });
    }
    const colors = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];
    const newUser = { name, username, password, role: "user", color: colors[Math.floor(Math.random() * colors.length)], about: "Ada di TitusCode", avatar: null };
    db.users.push(newUser);
    saveData(db);
    return res.json({ success: true, user: newUser });
  }
});

// 3. Buat Obrolan Privat (1-on-1 Terisolasi) atau Grup Baru
app.post('/api/chat/create', (req, res) => {
  const { name, targetUsername, isGroup, creator } = req.body;
  const db = loadData();

  if (!isGroup) {
    // Cek apakah chat privat antara dua orang ini sudah ada
    const existing = db.chats.find(c => !c.isGroup && c.participants.includes(creator) && c.participants.includes(targetUsername));
    if (existing) return res.json({ success: true, chat: existing });

    const targetUser = db.users.find(u => u.username === targetUsername);
    const newChat = {
      id: 'priv-' + Date.now(),
      name: targetUser ? targetUser.name : targetUsername,
      bsuid: targetUsername,
      isGroup: false,
      participants: [creator, targetUsername], // HANYA MEREKA BERDUA YANG BISA LIHAT
      color: targetUser ? targetUser.color : "#3b82f6",
      creator: creator,
      messages: []
    };
    db.chats.unshift(newChat);
    saveData(db);
    return res.json({ success: true, chat: newChat });
  } else {
    // Buat Grup
    const newGroup = {
      id: 'group-' + Date.now(),
      name: name,
      bsuid: "Komunitas Publik",
      isGroup: true,
      participants: ["ALL"],
      color: "#10b981",
      creator: creator,
      messages: [{ id: Date.now(), senderName: "Sistem", senderUsername: "@system", text: `Grup "${name}" telah dibuat oleh ${creator}`, time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) }]
    };
    db.chats.unshift(newGroup);
    saveData(db);
    return res.json({ success: true, chat: newGroup });
  }
});

// 4. Kirim Pesan
app.post('/api/messages', (req, res) => {
  const { chatId, senderName, senderUsername, text, fileUrl, fileType, fileName } = req.body;
  const db = loadData();
  const chat = db.chats.find(c => c.id === chatId);

  if (chat) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newMsg = { id: Date.now(), senderName, senderUsername, text, fileUrl, fileType, fileName, time };
    chat.messages.push(newMsg);
    saveData(db);
    return res.json({ success: true, message: newMsg });
  }
  res.status(404).json({ success: false });
});

// 5. LOGIKA PANGGILAN (Start, Join, Leave Call Session)
app.post('/api/call/action', (req, res) => {
  const { action, chatId, type, username } = req.body;
  const db = loadData();

  if (action === 'start') {
    db.activeCalls[chatId] = { type: type, initiator: username, participants: [username] };
  } else if (action === 'join') {
    if (db.activeCalls[chatId] && !db.activeCalls[chatId].participants.includes(username)) {
      db.activeCalls[chatId].participants.push(username);
    }
  } else if (action === 'leave') {
    if (db.activeCalls[chatId]) {
      db.activeCalls[chatId].participants = db.activeCalls[chatId].participants.filter(u => u !== username);
      if (db.activeCalls[chatId].participants.length === 0) {
        delete db.activeCalls[chatId]; // Hapus sesi jika semua orang keluar
      }
    }
  }
  saveData(db);
  res.json({ success: true, activeCalls: db.activeCalls });
});

// 6. Update Profil (Bio, Nama, Foto Avatar)
app.post('/api/profile/update', (req, res) => {
  const { username, name, about, color, avatar } = req.body;
  const db = loadData();
  const u = db.users.find(x => x.username === username);
  if (u) {
    if (name) u.name = name;
    if (about) u.about = about;
    if (color) u.color = color;
    if (avatar !== undefined) u.avatar = avatar;
    saveData(db);
    return res.json({ success: true, user: u });
  }
  res.status(404).json({ success: false });
});

// 7. Upload File ke Base64 Data URL
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false });
  const fileUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
  res.json({ success: true, fileUrl, fileName: req.file.originalname, fileType: req.file.mimetype });
});

// 8. Reset Server
app.post('/api/admin/reset', (req, res) => {
  const { username } = req.body;
  const db = loadData();
  const u = db.users.find(x => x.username === username);
  if (u && u.role === 'admin') {
    db.chats = [db.chats[0]]; // Sisakan grup general
    db.activeCalls = {};
    saveData(db);
    return res.json({ success: true, message: "Server berhasil di-reset bersih oleh Admin!" });
  }
  res.status(403).json({ success: false });
});

module.exports = app;
