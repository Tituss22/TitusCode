const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '50mb' }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  maxHttpBufferSize: 5e8
});

// ================= DATABASE SQLITE SETUP =================
const db = new sqlite3.Database('./tituschat_v25.db', (err) => {
  if (err) console.error('Gagal membuka database:', err.message);
  else console.log('✅ Terhubung ke Database Server SQLite Permanen.');
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, name TEXT, password TEXT, color TEXT, about TEXT, isAdmin INTEGER DEFAULT 0, frame TEXT, badge TEXT, glow TEXT, bubble TEXT, photo TEXT, isOnline INTEGER DEFAULT 0, lastIp TEXT, lastOnline TEXT, lat TEXT, lng TEXT, location TEXT, banned INTEGER DEFAULT 0)`);
  db.run(`CREATE TABLE IF NOT EXISTS groups (id TEXT PRIMARY KEY, name TEXT, desc TEXT, color TEXT, members TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, sender TEXT, fromName TEXT, target TEXT, isGroup INTEGER, text TEXT, fileUrl TEXT, fileName TEXT, fileType TEXT, time TEXT, timestamp INTEGER, isLocation INTEGER DEFAULT 0, lat TEXT, lng TEXT, mediaPayload TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS statuses (id INTEGER PRIMARY KEY, user TEXT, type TEXT, content TEXT, caption TEXT, time TEXT, timestamp INTEGER)`);
  db.run(`CREATE TABLE IF NOT EXISTS call_logs (id INTEGER PRIMARY KEY, user TEXT, partner TEXT, type TEXT, status TEXT, time TEXT, timestamp INTEGER)`);

  db.get("SELECT username FROM users WHERE username = '@titus'", (err, row) => {
    if (!row) {
      db.run(`INSERT INTO users VALUES ('@titus', 'Titus Anggara (Admin)', 'SukaBintang01', '#00a884', 'Arsitek TitusChat Pro V25 Ultra', 1, 'frame-gold', 'sultan', 'glow-gold', 'bubble-gold', null, 0, '127.0.0.1', 'Belum pernah', 'Unknown', 'Unknown', 'Server Core', 0)`);
      db.run(`INSERT INTO users VALUES ('@titusbot', '🤖 TitusBot AI (Command Center)', 'SukaBintang01', '#10b981', 'Ketik !help untuk daftar command Watch Party', 1, 'frame-matrix', 'bot', 'glow-emerald', 'bubble-bot', null, 1, 'Cloud Serverless', 'Sekarang (Aktif)', 'Unknown', 'Unknown', 'Server Core', 0)`);
      db.run(`INSERT INTO groups VALUES ('@grup_bot', '🤖 TitusBot Command Center', 'Ketik !help, !pv, !pm, atau !join @user di sini!', '#10b981', '["@titus", "@titusbot"]')`);
      db.run(`INSERT INTO groups VALUES ('@grup_sultan', '👑 Ruang Eksekutif Sultan', 'Komunitas Sultan & Sepuh Mabar V25 FINAL', '#f59e0b', '["@titus"]')`);
      db.run(`INSERT INTO groups VALUES ('@grup_mabar', '🎮 Mabar MLBB / PUBG Squad', 'Nongkrong Cowo Cewe santai & Mabar anti lag', '#06b6d4', '["@titus"]')`);
      db.run(`INSERT INTO groups VALUES ('@grup_kawaii', '🌸 Pastel Kawaii Aesthetic', 'Tempat cerita & nongkrong cewe cewe imut', '#ec4899', '["@titus"]')`);
      console.log('✅ Akun Admin @titus & @titusbot beserta Grup Default berhasil dibuat.');
    }
  });
});

const activeGroupCalls = {};
const activeSockets = {};

// ================= SOCKET.IO REAL-TIME ENGINE =================
io.on('connection', (socket) => {
  let loggedUser = null;

  socket.on('auth_login', ({ username, password }, callback) => {
    db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, user) => {
      if (err || !user) return callback({ success: false, message: 'ID Pengguna atau Kata Sandi salah!' });
      if (user.banned) return callback({ success: false, message: 'Akun Anda telah DIBLOKIR oleh Admin Studio!' });
      loggedUser = user.username; activeSockets[loggedUser] = socket.id;
      const clientIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
      db.run("UPDATE users SET isOnline = 1, lastIp = ?, lastOnline = 'Sekarang (Aktif)' WHERE username = ?", [clientIp, loggedUser]);
      socket.join(loggedUser);
      sendGlobalSync(socket, () => {
        io.emit('user_status_change', { username: loggedUser, isOnline: 1, lastOnline: 'Sekarang (Aktif)' });
        callback({ success: true, user });
      });
    });
  });

  socket.on('auth_register', ({ name, username, password, color }, callback) => {
    db.get("SELECT username FROM users WHERE username = ?", [username], (err, row) => {
      if (row) return callback({ success: false, message: 'ID Pengguna (@username) sudah terdaftar!' });
      const clientIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
      const newUser = [username, name, password, color, 'Aktif di TitusChat Pro', 0, 'normal', 'none', 'none', 'default', null, 1, clientIp, 'Sekarang (Aktif)', 'Unknown', 'Unknown', 'Unknown', 0];
      db.run(`INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, newUser, (err) => {
        if (err) return callback({ success: false, message: 'Gagal membuat akun di server.' });
        db.all("SELECT id, members FROM groups", [], (err, groups) => {
          groups.forEach(g => {
            const members = JSON.parse(g.members);
            if (!members.includes(username)) {
              members.push(username);
              db.run("UPDATE groups SET members = ? WHERE id = ?", [JSON.stringify(members), g.id]);
            }
          });
          loggedUser = username; activeSockets[loggedUser] = socket.id; socket.join(loggedUser);
          db.get("SELECT * FROM users WHERE username = ?", [username], (err, createdUser) => {
            sendGlobalSync(socket, () => {
              io.emit('user_registered', createdUser);
              callback({ success: true, user: createdUser });
            });
          });
        });
      });
    });
  });

  function sendGlobalSync(targetSocket, cb) {
    const now = Date.now();
    db.run("DELETE FROM statuses WHERE ? - timestamp > 86400000", [now], () => {
      db.all("SELECT username, name, color, about, isAdmin, frame, badge, glow, bubble, photo, isOnline, lastOnline, lat, lng, location, banned FROM users", [], (err, users) => {
        db.all("SELECT * FROM groups", [], (err, groups) => {
          const parsedGroups = groups.map(g => ({ ...g, members: JSON.parse(g.members) }));
          db.all("SELECT * FROM messages ORDER BY timestamp ASC", [], (err, messages) => {
            const parsedMsgs = messages.map(m => ({ ...m, isGroup: Boolean(m.isGroup), isLocation: Boolean(m.isLocation), mediaPayload: m.mediaPayload ? JSON.parse(m.mediaPayload) : null }));
            db.all("SELECT * FROM statuses ORDER BY timestamp ASC", [], (err, statuses) => {
              db.all("SELECT * FROM call_logs ORDER BY timestamp DESC LIMIT 100", [], (err, calls) => {
                targetSocket.emit('sync_all_data', { users, groups: parsedGroups, messages: parsedMsgs, statuses, calls, activeGroupCalls });
                if (cb) cb();
              });
            });
          });
        });
      });
    });
  }

  socket.on('request_manual_sync', () => { sendGlobalSync(socket); });

  socket.on('send_message', (msg) => {
    const timestamp = Date.now();
    const mediaPayloadStr = msg.mediaPayload ? JSON.stringify(msg.mediaPayload) : null;
    db.run(`INSERT INTO messages VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
      msg.id, msg.from, msg.fromName, msg.to, msg.isGroup ? 1 : 0,
      msg.text, msg.fileUrl || null, msg.fileName || null, msg.fileType || null,
      msg.time, timestamp, msg.isLocation ? 1 : 0, msg.lat || null, msg.lng || null, mediaPayloadStr
    ], () => {
      if (msg.isGroup) { io.emit('new_message', msg); } 
      else {
        socket.emit('new_message', msg);
        if (activeSockets[msg.to]) io.to(activeSockets[msg.to]).emit('new_message', msg);
      }
      if (msg.to === '@grup_bot' && msg.text.startsWith('!')) handleBotCommands(msg.from, msg.text, msg.to);
    });
  });

  function handleBotCommands(sender, text, groupId) {
    const args = text.trim().split(" "); const cmd = args[0].toLowerCase(); const param = args.slice(1).join(" ");
    let replyText = ""; let mediaPayload = null;
    if (cmd === "!help") replyText = `🤖 [DAFTAR COMMAND TITUSBOT AI SERVER]:\n\n🎬 *Watch Party & Music:*\n• !pv <url> -> Putar video\n• !pm <url> -> Putar musik\n• !join @user -> Nonton bareng sinkron\n• !stop -> Hentikan media\n\n🎲 *Fun & Utilitas:*\n• !ping -> Cek ping server\n• !time -> Waktu server WIB\n• !roll -> Dadu acak\n• !flip -> Lempar koin\n• !quote -> Kata bijak sepuh\n• !calc <angka> -> Kalkulator\n• !serverstats -> Status Database Server`;
    else if (cmd === "!ping") replyText = `🏓 Pong! Server Central Cloud: 2ms (100% Anti Lag & Anti Blokir All Operator)`;
    else if (cmd === "!time") replyText = `🕒 Waktu Server Central: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`;
    else if (cmd === "!roll") replyText = `🎲 @${sender.replace('@','')} melempar dadu: *${Math.floor(Math.random() * 100) + 1}* / 100!`;
    else if (cmd === "!flip") replyText = `🪙 @${sender.replace('@','')} melempar koin: *${Math.random() > 0.5 ? "🪙 ANGKA" : "🪙 GAMBAR"}*!`;
    else if (cmd === "!quote") {
      const quotes = ["\"Jago main ML/PUBG itu bonus, tapi sopan saat mabar adalah kewajiban sepuh sejati.\"", "\"Koneksi boleh beda operator, tapi di TitusChat V25 server kita satu.\"", "\"Sultan sejati bukan dari skinnya, tapi dari seberapa sering dia traktir teman mabarnya.\""];
      replyText = `💡 *Kata Bijak Sepuh:* \n\n${quotes[Math.floor(Math.random() * quotes.length)]}`;
    } else if (cmd === "!calc") { try { replyText = `🧮 Hasil Kalkulasi (${param}): *${Function(`'use strict'; return (${param.replace(/[^0-9+\-*/().]/g, '')})`)()}*`; } catch(e) { replyText = `⚠️ Format kalkulasi salah!`; } }
    else if (cmd === "!serverstats") {
      db.get("SELECT count(*) as u FROM users", (e, r1) => {
        db.get("SELECT count(*) as m FROM messages", (e, r2) => {
          replyText = `📊 *Status Server Central TitusChat V25 Ultra:*\n• Total Akun Terdaftar: ${r1.u}\n• Total Obrolan: ${r2.m}\n• Jalur Transmisi: WSS Port 443 (Bypass XL/Tsel/Tri/IndiHome)\n• Sinkronisasi: 100% Server Database`;
          sendBotResponse(replyText, null);
        });
      });
      return;
    } else if (cmd === "!pv" || cmd === "!pm") {
      if (!param) replyText = `⚠️ Masukkan link video/audio YouTube/Direct!`;
      else {
        const isVideo = cmd === "!pv"; let embedUrl = param; let ytId = null;
        const match = param.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|\&v=)([^#\&\?]*).*/);
        if (match && match[2].length === 11) { ytId = match[2]; embedUrl = `https://www.youtube.com/embed/${ytId}?autoplay=1`; }
        replyText = `🎬 *[TITUS WATCH PARTY SERVER]*: @${sender.replace('@','')} memutar ${isVideo ? 'Video' : 'Musik'}!\n\n💡 Ketik *!join ${sender}* untuk menonton sinkron!`;
        mediaPayload = { type: isVideo ? 'video' : 'music', url: embedUrl, owner: sender, ytId: ytId };
      }
    } else replyText = `❓ Command *${cmd}* tidak dikenali. Ketik *!help*.`;
    if (replyText) sendBotResponse(replyText, mediaPayload);
  }

  function sendBotResponse(text, mediaPayload) {
    const botMsg = { id: 'bot_' + Date.now(), from: '@titusbot', fromName: '🤖 TitusBot AI', to: '@grup_bot', isGroup: 1, text, time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}), timestamp: Date.now(), isLocation: 0, lat: null, lng: null, mediaPayload: mediaPayload ? JSON.stringify(mediaPayload) : null };
    db.run(`INSERT INTO messages VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [botMsg.id, botMsg.from, botMsg.fromName, botMsg.to, 1, botMsg.text, null, null, null, botMsg.time, botMsg.timestamp, 0, null, null, botMsg.mediaPayload], () => {
      io.emit('new_message', { ...botMsg, isGroup: true, mediaPayload });
    });
  }

  socket.on('update_profile', (userData) => {
    db.run(`UPDATE users SET name=?, about=?, frame=?, badge=?, glow=?, bubble=?, filter=?, photo=?, lat=?, lng=?, location=? WHERE username=?`, [userData.name, userData.about, userData.frame, userData.badge, userData.glow, userData.bubble, userData.filter, userData.photo, userData.lat, userData.lng, userData.location, userData.username], () => {
      io.emit('user_profile_updated', userData);
    });
  });

  socket.on('post_status', (statusData) => {
    const timestamp = Date.now();
    db.run(`INSERT INTO statuses (user, type, content, caption, time, timestamp) VALUES (?,?,?,?,?,?)`, [statusData.user, statusData.type, statusData.content, statusData.caption, statusData.time, timestamp], function() {
      io.emit('new_status', { id: this.lastID, ...statusData, timestamp });
    });
  });

  socket.on('create_group', (grp) => {
    db.run(`INSERT INTO groups VALUES (?,?,?,?,?)`, [grp.id, grp.name, grp.desc, grp.color, JSON.stringify(grp.members)], () => {
      io.emit('group_created', grp);
    });
  });

  socket.on('webrtc_offer', ({ target, offer, caller, isVideo }) => { if (activeSockets[target]) io.to(activeSockets[target]).emit('webrtc_incoming_call', { caller, offer, isVideo, callerSocketId: socket.id }); });
  socket.on('webrtc_answer', ({ targetSocketId, answer }) => { io.to(targetSocketId).emit('webrtc_call_answered', { answer }); });
  socket.on('webrtc_ice_candidate', ({ targetSocketId, candidate }) => { if (targetSocketId) io.to(targetSocketId).emit('webrtc_ice_candidate', { candidate }); });
  socket.on('webrtc_end_call', ({ targetSocketId, partner }) => {
    if (targetSocketId) io.to(targetSocketId).emit('webrtc_call_ended');
    if (partner && activeSockets[partner]) io.to(activeSockets[partner]).emit('webrtc_call_ended');
  });

  socket.on('log_call', (callData) => {
    const timestamp = Date.now();
    db.run(`INSERT INTO call_logs (user, partner, type, status, time, timestamp) VALUES (?,?,?,?,?,?)`, [callData.user, callData.partner, callData.type, callData.status, callData.time, timestamp], function() {
      io.emit('new_call_log', { id: this.lastID, ...callData, timestamp });
    });
  });

  socket.on('group_call_toggle', ({ groupId, active, starter, count }) => {
    activeGroupCalls[groupId] = { active, starter, count };
    io.emit('group_call_updated', { groupId, callData: activeGroupCalls[groupId] });
  });

  socket.on('admin_action', ({ type, target, param, adminUser }) => {
    db.get("SELECT isAdmin FROM users WHERE username = ?", [adminUser], (err, row) => {
      if (!row || !row.isAdmin) return;
      if (type === 'broadcast') {
        const text = `📢 [BROADCAST RESMI ADMIN STUDIO]:\n\n${param}`;
        db.all("SELECT username FROM users WHERE username != '@titus'", [], (err, rows) => {
          rows.forEach(u => {
            const msgId = 'adm_' + Date.now() + Math.random().toString(36).substr(2, 4);
            const timeStr = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
            db.run(`INSERT INTO messages VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [msgId, '@titus', 'Titus Anggara (Admin)', u.username, 0, text, null, null, null, timeStr, Date.now(), 0, null, null, null]);
            if (activeSockets[u.username]) io.to(activeSockets[u.username]).emit('new_message', { id: msgId, from: '@titus', fromName: 'Titus Anggara (Admin)', to: u.username, isGroup: false, text, time: timeStr });
          });
        });
      } else if (type === 'set_badge') {
        db.run("UPDATE users SET badge = ? WHERE username = ?", [param, target], () => { io.emit('user_badge_updated', { username: target, badge: param }); });
      } else if (type === 'toggle_ban') {
        db.get("SELECT banned FROM users WHERE username = ?", [target], (err, u) => {
          const newBan = u.banned ? 0 : 1;
          db.run("UPDATE users SET banned = ? WHERE username = ?", [newBan, target], () => {
            io.emit('user_ban_updated', { username: target, banned: newBan });
            if (newBan && activeSockets[target]) io.to(activeSockets[target]).emit('force_logout', 'Akun Anda telah DIBLOKIR oleh Admin Studio!');
          });
        });
      } else if (type === 'delete_user') {
        db.run("DELETE FROM users WHERE username = ?", [target], () => {
          db.run("DELETE FROM messages WHERE sender = ? OR target = ?", [target, target], () => {
            io.emit('user_deleted', { username: target });
            if (activeSockets[target]) io.to(activeSockets[target]).emit('force_logout', 'Akun Anda telah DIHAPUS PERMANEN dari server!');
          });
        });
      } else if (type === 'clear_all_messages') {
        db.run("DELETE FROM messages", () => { io.emit('all_messages_cleared'); });
      }
    });
  });

  socket.on('disconnect', () => {
    if (loggedUser) {
      const timeStr = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) + " WIB";
      db.run("UPDATE users SET isOnline = 0, lastOnline = ? WHERE username = ?", [timeStr, loggedUser]);
      delete activeSockets[loggedUser];
      io.emit('user_status_change', { username: loggedUser, isOnline: 0, lastOnline: timeStr });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 TITUSCHAT PRO V25 ULTRA SERVER READY!`);
  console.log(`📡 Berjalan pada Port: ${PORT}`);
  console.log(`==================================================`);
});
