// Data Statis untuk Login
const VALID_USERNAME = 'user1';
const VALID_PASSWORD = '12345';

// Data Obrolan Dummy
let contacts = [
    {
        id: 1,
        name: 'Dina',
        avatar: 'https://i.pravatar.cc/150?img=5',
        messages: [
            { id: 1, sender: 'them', text: 'Halo! Tugas webnya udah selesai belum?', time: '10:00' },
            { id: 2, sender: 'me', text: 'Udah nih, tinggal styling dikit.', time: '10:05' }
        ]
    },
    {
        id: 2,
        name: 'Grup Mabar',
        avatar: 'https://i.pravatar.cc/150?img=12',
        messages: [
            { id: 1, sender: 'them', text: 'Nanti malam login gas?', time: '09:30' }
        ]
    },
    {
        id: 3,
        name: 'Bengkel MX',
        avatar: 'https://i.pravatar.cc/150?img=14',
        messages: []
    }
];

let activeContactId = null;

// Elemen DOM
const loginPage = document.getElementById('login-page');
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const loginError = document.getElementById('login-error');
const contactListEl = document.getElementById('contact-list');
const messagesContainer = document.getElementById('messages-container');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');

// Elemen Header Obrolan
const activeChatImg = document.getElementById('active-chat-img');
const activeChatName = document.getElementById('active-chat-name');
const activeChatStatus = document.getElementById('active-chat-status');

// Elemen Responsif Mobile
const sidebar = document.getElementById('sidebar');
const chatArea = document.getElementById('chat-area');
const backBtn = document.getElementById('back-btn');

// --- INISIALISASI APLIKASI ---
function initApp() {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    
    if (isLoggedIn === 'true') {
        showApp();
    } else {
        showLogin();
    }
}

// --- LOGIKA AUTENTIKASI ---
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const userVal = document.getElementById('username').value;
    const passVal = document.getElementById('password').value;

    if (userVal === VALID_USERNAME && passVal === VALID_PASSWORD) {
        localStorage.setItem('isLoggedIn', 'true');
        loginError.classList.add('hidden');
        showApp();
    } else {
        loginError.classList.remove('hidden');
    }
});

logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('isLoggedIn');
    activeContactId = null; 
    showLogin();
});

function showLogin() {
    loginPage.classList.remove('hidden');
    appContainer.classList.add('hidden');
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}

function showApp() {
    loginPage.classList.add('hidden');
    appContainer.classList.remove('hidden');
    renderContacts();
}

// --- LOGIKA TAMPILAN ---
function renderContacts() {
    contactListEl.innerHTML = '';
    contacts.forEach(contact => {
        const lastMsg = contact.messages.length > 0 ? contact.messages[contact.messages.length - 1].text : 'Belum ada pesan';
        const lastTime = contact.messages.length > 0 ? contact.messages[contact.messages.length - 1].time : '';

        const contactDiv = document.createElement('div');
        contactDiv.className = `flex items-center gap-3 p-3 cursor-pointer border-b hover:bg-gray-100 transition ${activeContactId === contact.id ? 'bg-gray-200' : ''}`;
        
        contactDiv.innerHTML = `
            <img src="${contact.avatar}" class="w-12 h-12 rounded-full">
            <div class="flex-1 overflow-hidden">
                <div class="flex justify-between items-center">
                    <h4 class="font-semibold text-gray-800 text-sm">${contact.name}</h4>
                    <span class="text-xs text-gray-500">${lastTime}</span>
                </div>
                <p class="text-xs text-gray-500 truncate">${lastMsg}</p>
            </div>
        `;
        
        contactDiv.addEventListener('click', () => openChat(contact.id));
        contactListEl.appendChild(contactDiv);
    });
}

function openChat(id) {
    activeContactId = id;
    const contact = contacts.find(c => c.id === id);
    
    // Tampilkan Header Chat
    activeChatImg.src = contact.avatar;
    activeChatImg.classList.remove('hidden');
    activeChatName.textContent = contact.name;
    activeChatStatus.classList.remove('hidden');
    messageForm.classList.remove('hidden');
    messageForm.classList.add('flex');

    // Tampilan Mobile: Sembunyikan sidebar, tampilkan obrolan
    if (window.innerWidth < 768) {
        sidebar.classList.add('hidden');
        chatArea.classList.remove('hidden');
        chatArea.classList.add('flex');
    }

    renderContacts(); // Refresh daftar kontak (agar tersorot)
    renderMessages();
}

// Tombol Kembali (Khusus tampilan Mobile)
backBtn.addEventListener('click', () => {
    sidebar.classList.remove('hidden');
    chatArea.classList.add('hidden');
    chatArea.classList.remove('flex');
    activeContactId = null;
    renderContacts();
});

function renderMessages() {
    messagesContainer.innerHTML = '';
    const contact = contacts.find(c => c.id === activeContactId);

    if (contact.messages.length === 0) {
        messagesContainer.innerHTML = `<div class="text-center text-gray-500 mt-10">Mulai percakapan dengan ${contact.name}</div>`;
        return;
    }

    contact.messages.forEach(msg => {
        const isMe = msg.sender === 'me';
        const msgDiv = document.createElement('div');
        msgDiv.className = `max-w-[75%] rounded-lg p-2 mb-2 shadow-sm text-sm relative ${
            isMe ? 'bg-[#d9fdd3] self-end rounded-tr-none' : 'bg-white self-start rounded-tl-none'
        }`;
        
        msgDiv.innerHTML = `
            <span class="block pr-8">${msg.text}</span>
            <span class="text-[10px] text-gray-500 float-right mt-1 ml-4">${msg.time}</span>
        `;
        messagesContainer.appendChild(msgDiv);
    });

    // Auto-scroll ke bawah setiap pesan di-render
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// --- LOGIKA PENGIRIMAN PESAN & BOT ---
messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!activeContactId) return;

    const text = messageInput.value.trim();
    if (!text) return;

    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const contact = contacts.find(c => c.id === activeContactId);
    
    // Tambah pesan saya
    contact.messages.push({
        id: Date.now(),
        sender: 'me',
        text: text,
        time: currentTime
    });
    
    messageInput.value = '';
    renderMessages();
    renderContacts(); // Refresh agar pesan terakhir update di sidebar

    // Simulasi Auto-Reply
    activeChatStatus.textContent = 'Mengetik...';
    
    setTimeout(() => {
        const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        contact.messages.push({
            id: Date.now(),
            sender: 'them',
            text: 'Ini adalah pesan balasan otomatis sistem. Saya sedang tidak online sekarang.',
            time: replyTime
        });
        
        activeChatStatus.textContent = 'Online';
        
        // Render ulang jika pengguna masih berada di chat yang sama
        if (activeContactId === contact.id) {
            renderMessages();
        }
        renderContacts(); 
    }, 2500); // Jeda 2.5 detik
});

// Jalankan ketika halaman dimuat
initApp();
