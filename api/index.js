const express = require('express');
const multer  = require('multer');
const fs      = require('fs');
const path    = require('path');
const cors    = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Gunakan Memory Storage agar TIDAK ERROR di sistem Serverless Vercel (Read-Only FS)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // Batas file 10MB per upload
});

// Sistem Storage Khusus Vercel menggunakan /tmp/ untuk runtime persistence + In-Memory Cache
const dbPath = path.join('/tmp', 'tituscode_db.json');

let serverData = {
  users: [
    { name: "Administrator Server", username: "@admin", password: "admin123", role: "admin", color: "#f39c12" }
  ],
  chats: [] // 100% BERSIH tanpa riwayat chat saat pertama dibuka
};

// Load data dari /tmp jika node serverless hangat (warm)
function loadData() {
  try {
    if (fs.existsSync(dbPath)) {
      const raw = fs.readFileSync(dbPath, 'utf8');
      serverData = JSON.parse(raw);
    }
  } catch (err) {
    console.error("Vercel FS Load Error, fallback to memory:", err.message);
  }
  return serverData;
}

function saveData(data) {
  serverData = data;
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data), 'utf8');
  } catch (err) {
    console.error("Vercel FS Save Error, memory updated:", err.message);
  }
}

// === ENDPOINTS API SERVERLESS ===

// 1. Ambil Seluruh Data Obrolan & File
app.get('/api/data', (req, res) => {
  res.json(loadData());
});

// 2. Login & Daftar Akun Publik
app.post('/api/auth', (req, res) => {
  const { type, name, username, password } = req.body;
  const db = loadData();

  if (type === 'login') {
    const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
    if (user) {
      return res.json({ success: true, user });
    }
    return res.status(401).json({ success: false, message: "Username atau kata sandi salah!" });
  } 
  
  if (type === 'register') {
    if (db.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
      return res.status(400).json({ success: false, message: "Username tersebut sudah digunakan orang lain!" });
    }
    const colors = ["#0088ff", "#00d28a", "#9b59b6", "#e67e22", "#e74c3c", "#00b4d8", "#34495e"];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const newUser = { name, username, password, role: "user", color: randomColor };
    
    db.users.push(newUser);
    saveData(db);
    return res.json({ success: true, user: newUser });
  }
});

// 3. Buat Ruang Obrolan atau Komunitas Baru
app.post('/api/chat/create', (req, res) => {
  const { name, bsuid, isGroup, creator } = req.body;
  const db = loadData();

  const newChat = {
    id: 'chat-' + Date.now(),
    name: name,
    bsuid: bsuid,
    isGroup: isGroup,
    color: isGroup ? "#00d28a" : "#0088ff",
    creator: creator,
    messages: []
  };

  db.chats.unshift(newChat);
  saveData(db);
  res.json({ success: true, chat: newChat });
});

// 4. Kirim Pesan Teks
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
  res.status(404).json({ success: false, message: "Ruang obrolan tidak ditemukan." });
});

// 5. Upload File (Dikonversi ke Base64 Data URL agar permanen di Vercel)
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "Tidak ada file yang dipilih." });
  }
  
  // Konversi buffer ke Base64 string agar bisa disimpan langsung tanpa error direktori fisik
  const base64Data = req.file.buffer.toString('base64');
  const fileUrl = `data:${req.file.mimetype};base64,${base64Data}`;

  res.json({
    success: true,
    fileUrl: fileUrl,
    fileName: req.file.originalname,
    fileType: req.file.mimetype
  });
});

// 6. Reset Server (Khusus Admin @admin)
app.post('/api/admin/reset', (req, res) => {
  const { username } = req.body;
  const db = loadData();
  const user = db.users.find(u => u.username === username);

  if (user && user.role === 'admin') {
    db.chats = []; // Kosongkan seluruh obrolan
    saveData(db);
    return res.json({ success: true, message: "Seluruh riwayat obrolan dan file di server berhasil di-reset bersih!" });
  }
  res.status(403).json({ success: false, message: "Akses Ditolak! Hanya akun @admin yang berhak mereset server." });
});

// Ekspor untuk engine Vercel Serverless
module.exports = app;
