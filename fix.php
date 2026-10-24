<?php
session_start();

// Password hash untuk "SukaBintang01"
$password_hash = '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'; 
// (Catatan: Hash di atas adalah contoh bawaan; jika ingin menggunakan hash asli dari server Anda, pastikan sesuai dengan password_hash('SukaBintang01', PASSWORD_DEFAULT))

// Proses Logout jika ada parameter ?logout
if (isset($_GET['logout'])) {
    unset($_SESSION['auth_github']);
    header('Location: ' . $_SERVER['PHP_SELF']);
    exit;
}

// Proses Validasi Login POST
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['password'])) {
    if (password_verify($_POST['password'], $password_hash) || $_POST['password'] === 'SukaBintang01') {
        $_SESSION['auth_github'] = true;
        header('Location: ' . $_SERVER['PHP_SELF']);
        exit;
    } else {
        $error = "Password salah!";
    }
}

// Jika belum login, tampilkan halaman form login
if (!isset($_SESSION['auth_github']) || $_SESSION['auth_github'] !== true):
?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Login Protected</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-900 text-slate-100 flex items-center justify-center h-screen">
    <div class="bg-slate-800 p-8 rounded-lg shadow-md w-96 border border-slate-700">
        <h2 class="text-xl font-bold mb-4 text-emerald-400 text-center">Protected Access</h2>
        <?php if (isset($error)): ?>
            <p class="text-red-400 text-sm mb-4 text-center"><?= $error ?></p>
        <?php endif; ?>
        <form method="POST">
            <label class="block text-sm mb-2 text-slate-300">Masukkan Password:</label>
            <input type="password" name="password" required class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 mb-4 text-slate-100 focus:outline-none focus:border-emerald-500">
            <button type="submit" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded font-medium transition">Login</button>
        </form>
    </div>
</body>
</html>
<?php 
    exit;
endif;

// ==========================================
// KODE UTAMA SETELAH BERHASIL LOGIN
// ==========================================

// URL Raw file GitHub yang ingin dipanggil
$url = 'https://raw.githubusercontent.com/Tituss22/TitusCode/refs/heads/main/decode.php';

// Metode 1: Menggunakan file_get_contents
$content = @file_get_contents($url);

// Metode 2 (Alternatif): Menggunakan cURL jika file_get_contents diblokir
if ($content === false && function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    $content = curl_exec($ch);
    curl_close($ch);
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>GitHub Content Viewer</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-900 text-slate-100 p-6">
    <div class="max-w-4xl mx-auto">
        <div class="flex justify-between items-center mb-4">
            <h1 class="text-xl font-bold text-emerald-400">Hasil Pemanggilan GitHub</h1>
            <a href="?logout=true" class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition">Logout</a>
        </div>

        <div class="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <?php if ($content !== false): ?>
                <p class="text-sm text-emerald-400 mb-2">✓ Konten berhasil diambil dari URL:</p>
                <code class="text-xs text-slate-400 block mb-4 bg-slate-900 p-2 rounded"><?= htmlspecialchars($url) ?></code>
                
                <label class="block text-sm font-medium mb-2 text-slate-300">Isi Konten (Source Code):</label>
                <textarea rows="16" readonly class="w-full bg-slate-900 border border-slate-700 rounded p-3 text-sm font-mono text-slate-200 focus:outline-none resize-none"><?= htmlspecialchars($content) ?></textarea>
            <?php else: ?>
                <p class="text-red-400">Gagal mengambil konten dari URL tersebut.</p>
            <?php endif; ?>
        </div>
    </div>
</body>
</html>
