const express = require('express');
const multer  = require('multer');
const fs      = require('fs');
const path    = require('path');
const cors    = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Buat folder publik & upload jika belum ada
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)){ fs.mkdirSync(uploadDir, { recursive: true }); }

// Konfigurasi Multer untuk penyimpanan file fisik di server
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, ''));
  }
});
const upload = multer({ storage: storage });

// Database Server Permanen (JSON File Engine)
const dbFile = path.join(__dirname, 'database.json');
const defaultData = {
  users: [
    { name: "Administrator Server", username: "@admin", password: "admin123", role: "admin", color: "#f39c12" }
  ],
  chats: [] // 100% BERSIH Tanpa Chat Default
};

// Inisialisasi Database
if (!fs.existsSync(dbFile)) {
  fs.writeFileSync(dbFile, JSON.stringify(defaultData, null, 2));
}

function readDB() {
  return JSON.parse(fs.readFileSync(dbFile, 'utf8'));
}
function writeDB(data) {
  fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
}

// === ENDPOINTS API ===

// 1. Ambil Seluruh Data Server
app.get('/api/data', (req, res) => {
  res.json(readDB());
});

// 2. Login & Register Akun
app.post('/api/auth', (req, res) => {
  const { type, name, username, password } = req.body;
  const db = readDB();

  if (type === 'login') {
    const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
    if (user) {
      res.json({ success: true, user });
    } else {
      res.status(401).json({ success: false, message: "Username atau kata sandi salah!" });
    }
  } else if (type === 'register') {
    if (db.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
      return res.status(400).json({ success: false, message: "Username sudah digunakan!" });
    }
    const colors = ["#1abc9c", "#2ecc71", "#3498db", "#9b59b6", "#e67e22", "#e74c3c", "#00b4d8"];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const newUser = { name, username, password, role: "user", color: randomColor };
    
    db.users.push(newUser);
    writeDB(db);
    res.json({ success: true, user: newUser });
  }
});

// 3. Buat Obrolan atau Grup Baru
app.post('/api/chat/create', (req, res) => {
  const { name, bsuid, isGroup, creator } = req.body;
  const db = readDB();

  const newChat = {
    id: 'chat-' + Date.now(),
    name: name,
    bsuid: bsuid,
    isGroup: isGroup,
    color: isGroup ? "#00b4d8" : "#2ecc71",
    creator: creator,
    messages: []
  };

  db.chats.unshift(newChat);
  writeDB(db);
  res.json({ success: true, chat: newChat });
});

// 4. Kirim Pesan ke Server
app.post('/api/messages', (req, res) => {
  const { chatId, senderName, senderUsername, text, fileUrl, fileType, fileName } = req.body;
  const db = readDB();
  const chat = db.chats.find(c => c.id === chatId);

  if (chat) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newMsg = { id: Date.now(), senderName, senderUsername, text, fileUrl, fileType, fileName, time };
    chat.messages.push(newMsg);
    writeDB(db);
    res.json({ success: true, message: newMsg });
  } else {
    res.status(404).json({ success: false, message: "Obrolan tidak ditemukan di server." });
  }
});

// 5. Upload File Fisik (Benar-benar tersimpan di server & bisa didownload umum)
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: "Tidak ada file terunggah." });
  
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({
    success: true,
    fileUrl: fileUrl,
    fileName: req.file.originalname,
    fileType: req.file.mimetype
  });
});

// 6. Reset Server (Khusus Admin)
app.post('/api/admin/reset', (req, res) => {
  const { username } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.username === username);

  if (user && user.role === 'admin') {
    db.chats = []; // Kosongkan semua obrolan
    writeDB(db);
    res.json({ success: true, message: "Seluruh database obrolan server berhasil di-reset!" });
  } else {
    res.status(403).json({ success: false, message: "Akses Ditolak! Hanya Admin yang dapat mereset server." });
  }
});

app.listen(PORT, () => {
  console.log(`[TitusCode Server] Berjalan secara aktif di port ${PORT}`);
});
