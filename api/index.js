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
const upload = multer({ storage: storage, limits: { fileSize: 15 * 1024 * 1024 } });

const dbPath = path.join('/tmp', 'tituscode_global_v4.json');

let serverData = {
  users: [
    { name: "Administrator Server", username: "@admin", password: "admin123", role: "admin", color: "#f59e0b", about: "Melayani sistem TitusCode Global", avatar: null }
  ],
  chats: []
};

function loadData() {
  try {
    if (fs.existsSync(dbPath)) {
      serverData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    }
  } catch (err) {}
  return serverData;
}

function saveData(data) {
  serverData = data;
  try { fs.writeFileSync(dbPath, JSON.stringify(data), 'utf8'); } catch (err) {}
}

// 1. Ambil Data
app.get('/api/data', (req, res) => res.json(loadData()));

// 2. Auth Login & Register
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
      return res.status(400).json({ success: false, message: "Username sudah digunakan!" });
    }
    const colors = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const newUser = { name, username, password, role: "user", color: randomColor, about: "Ada di TitusCode Global", avatar: null };
    
    db.users.push(newUser);
    saveData(db);
    return res.json({ success: true, user: newUser });
  }
});

// 3. Update Profil Layaknya WhatsApp (Nama, Info/About, Warna/Foto)
app.post('/api/profile/update', (req, res) => {
  const { username, name, about, color, avatar } = req.body;
  const db = loadData();
  const userIndex = db.users.findIndex(u => u.username === username);

  if (userIndex !== -1) {
    db.users[userIndex].name = name || db.users[userIndex].name;
    db.users[userIndex].about = about || db.users[userIndex].about;
    db.users[userIndex].color = color || db.users[userIndex].color;
    if (avatar !== undefined) db.users[userIndex].avatar = avatar;
    
    saveData(db);
    return res.json({ success: true, user: db.users[userIndex] });
  }
  res.status(404).json({ success: false, message: "Pengguna tidak ditemukan." });
});

// 4. Buat Obrolan / Komunitas
app.post('/api/chat/create', (req, res) => {
  const { name, bsuid, isGroup, creator } = req.body;
  const db = loadData();
  const newChat = {
    id: 'chat-' + Date.now(),
    name, bsuid, isGroup,
    color: isGroup ? "#10b981" : "#3b82f6",
    creator, messages: []
  };
  db.chats.unshift(newChat);
  saveData(db);
  res.json({ success: true, chat: newChat });
});

// 5. Kirim Pesan
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

// 6. Upload File & Foto (Konversi ke Base64 Data URL)
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false });
  const base64Data = req.file.buffer.toString('base64');
  const fileUrl = `data:${req.file.mimetype};base64,${base64Data}`;
  res.json({ success: true, fileUrl, fileName: req.file.originalname, fileType: req.file.mimetype });
});

// 7. Reset Server (Khusus Admin)
app.post('/api/admin/reset', (req, res) => {
  const { username } = req.body;
  const db = loadData();
  const user = db.users.find(u => u.username === username);
  if (user && user.role === 'admin') {
    db.chats = [];
    saveData(db);
    return res.json({ success: true, message: "Seluruh obrolan server berhasil dibersihkan!" });
  }
  res.status(403).json({ success: false });
});

module.exports = app;
