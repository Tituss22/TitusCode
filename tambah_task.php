<?php

session_start();
require_once "koneksi.php";

/* =========================================================
   CEK LOGIN
========================================================= */
if (
    !isset($_SESSION["role"]) ||
    !in_array($_SESSION["role"], ["user", "admin"])
) {
    header("Location: index.php");
    exit;
}

$user_id = (int) $_SESSION["id"];
$nama = $_SESSION["nama"] ?? "User";
$error = "";

/* =========================================================
   SIMPAN PEKERJAAN
========================================================= */
if ($_SERVER["REQUEST_METHOD"] === "POST") {

    $title = trim($_POST["title"] ?? "");
    $description = trim($_POST["description"] ?? "");
    $deadline = $_POST["deadline"] ?? "";
    $priority = $_POST["priority"] ?? "medium";
    $status = $_POST["status"] ?? "pending";

    if (
        $title === "" ||
        $description === "" ||
        $deadline === ""
    ) {
        $error = "Semua data pekerjaan harus diisi.";
    } else {
        $stmt = $conn->prepare("
            INSERT INTO tasks
            (
                title,
                description,
                assigned_to,
                assigned_by,
                priority,
                status,
                deadline
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");

        $stmt->bind_param(
            "ssiisss",
            $title,
            $description,
            $user_id,
            $user_id,
            $priority,
            $status,
            $deadline
        );

        if ($stmt->execute()) {
            /* SETELAH BERHASIL: LANGSUNG KEMBALI KE DATA PEKERJAAN */
            header("Location: task.php");
            exit;
        } else {
            $error = "Gagal menyimpan pekerjaan.";
        }
    }
}
?>

<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tambah Kerjaan</title>

    <!-- CSS UTAMA -->
    <link rel="stylesheet" href="style.css">

    <style>
        /* RESET & FONT */
        * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
        body { background-color: #f8f9fa; margin: 0; padding: 0; }
        
        .app { display: flex; min-height: 100vh; }

        /* ================= SIDEBAR ================= */
        .sidebar {
            width: 260px;
            background-color: #1a73e8; /* Warna biru sesuai gambar */
            color: white;
            padding: 24px 0;
            display: flex;
            flex-direction: column;
        }
        .brand {
            display: flex;
            align-items: center;
            padding: 0 24px 32px;
            gap: 12px;
        }
        .brand-logo {
            background: white;
            color: #1a73e8;
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            font-size: 18px;
            border-radius: 6px;
        }
        .brand-text {
            font-weight: 700;
            font-size: 14px;
            line-height: 1.2;
            letter-spacing: 0.5px;
        }
        .menu {
            display: flex;
            align-items: center;
            padding: 12px 24px;
            color: rgba(255,255,255,0.9);
            text-decoration: none;
            font-size: 14px;
            font-weight: 500;
            margin: 4px 16px;
            border-radius: 8px;
            gap: 12px;
        }
        .menu.active {
            background-color: white;
            color: #1a73e8;
            font-weight: 700;
        }
        .spacer { flex-grow: 1; }

        /* ================= CONTENT ================= */
        .content {
            flex: 1;
            padding: 40px;
            background-color: #f8f9fa;
        }
        .topbar h1 {
            font-size: 24px;
            color: #202124;
            margin: 0 0 6px 0;
        }
        .topbar p {
            color: #5f6368;
            font-size: 13px;
            margin: 0 0 32px 0;
        }

        /* ================= FORM CARD ================= */
        .form-card {
            background: white;
            border: 1px solid #dadce0;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .form-header {
            padding: 24px 30px;
            border-bottom: 1px solid #f1f3f4;
        }
        .form-header h2 {
            font-size: 18px;
            color: #202124;
            margin: 0 0 4px 0;
        }
        .form-header p {
            color: #80868b;
            font-size: 13px;
            margin: 0;
        }
        .form-body {
            padding: 30px;
        }
        .form-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
        }
        .form-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .form-group.full {
            grid-column: 1 / -1;
        }
        .form-group label {
            font-size: 13px;
            font-weight: 600;
            color: #3c4043;
        }
        .form-group input,
        .form-group textarea,
        .form-group select {
            width: 100%;
            border: 1px solid #dadce0;
            border-radius: 6px;
            padding: 12px 14px;
            font-size: 14px;
            color: #3c4043;
            outline: none;
            background: white;
            transition: border-color 0.2s;
        }
        .form-group input::placeholder,
        .form-group textarea::placeholder {
            color: #9aa0a6;
        }
        .form-group input:focus,
        .form-group textarea:focus,
        .form-group select:focus {
            border-color: #1a73e8;
        }
        .form-group textarea {
            height: 120px;
            resize: vertical;
        }
        .form-footer {
            margin-top: 30px;
            padding-top: 24px;
            border-top: 1px solid #f1f3f4;
            display: flex;
            justify-content: flex-end;
            gap: 12px;
        }
        .btn-batal {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 40px;
            padding: 0 24px;
            border-radius: 6px;
            background: white;
            border: 1px solid #dadce0;
            color: #5f6368;
            text-decoration: none;
            font-weight: 600;
            font-size: 13px;
        }
        .btn-simpan {
            border: none;
            height: 40px;
            padding: 0 24px;
            border-radius: 6px;
            background: #1a73e8;
            color: white;
            font-weight: 600;
            font-size: 13px;
            cursor: pointer;
        }
        .error {
            background: #fce8e6;
            color: #d93025;
            padding: 12px 16px;
            border-radius: 6px;
            margin-bottom: 24px;
            font-size: 13px;
            border: 1px solid #fad2cf;
        }
        @media (max-width: 768px) {
            .app { flex-direction: column; }
            .sidebar { width: 100%; padding: 16px; flex-direction: row; flex-wrap: wrap; }
            .brand { padding: 0 16px 16px; width: 100%; }
            .form-grid { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>

<div class="app">

    <!-- =====================================================
         SIDEBAR
    ====================================================== -->
    <aside class="sidebar">
        <div class="brand">
            <div class="brand-logo">M</div>
            <div class="brand-text">
                MONITORING<br>
                KERJA
            </div>
        </div>
        <a href="dashboard_user.php" class="menu">
            <span>▣</span> Dashboard
        </a>
        <a href="task.php" class="menu active">
            <span>✓</span> TASK
        </a>
        
        <div class="spacer"></div>
        
        <a href="pengaturan.php" class="menu">
            <span>⚙</span> Pengaturan
        </a>
        <a href="logout.php" class="menu">
            <span>↪</span> Logout
        </a>
    </aside>

    <!-- =====================================================
         CONTENT
    ====================================================== -->
    <main class="content">

        <header class="topbar">
            <div>
                <h1>Tambah Kerjaan</h1>
                <p>Tambahkan pekerjaan baru yang ingin kamu pantau.</p>
            </div>
        </header>

        <!-- FORM CARD -->
        <div class="form-card">
            
            <div class="form-header">
                <h2>Tambah Data Pekerjaan</h2>
                <p>Isi informasi pekerjaan yang akan ditambahkan.</p>
            </div>

            <div class="form-body">
                
                <?php if ($error): ?>
                    <div class="error">
                        <?= htmlspecialchars($error) ?>
                    </div>
                <?php endif; ?>

                <form method="POST" action="">
                    <div class="form-grid">
                        
                        <!-- NAMA -->
                        <div class="form-group">
                            <label>Nama Pekerjaan</label>
                            <input type="text" name="title" placeholder="Contoh: Membuat laporan bulanan" required>
                        </div>

                        <!-- DEADLINE -->
                        <div class="form-group">
                            <label>Deadline</label>
                            <input type="date" name="deadline" required>
                        </div>

                        <!-- DESKRIPSI -->
                        <div class="form-group full">
                            <label>Deskripsi Pekerjaan</label>
                            <textarea name="description" placeholder="Jelaskan pekerjaan yang harus dilakukan..." required></textarea>
                        </div>

                        <!-- PRIORITAS -->
                        <div class="form-group">
                            <label>Prioritas</label>
                            <select name="priority">
                                <option value="low">Rendah</option>
                                <option value="medium" selected>Sedang</option>
                                <option value="high">Tinggi</option>
                            </select>
                        </div>

                        <!-- STATUS -->
                        <div class="form-group">
                            <label>Status</label>
                            <select name="status">
                                <option value="pending" selected>Belum Dikerjakan</option>
                                <option value="in_progress">Sedang Dikerjakan</option>
                                <option value="completed">Selesai</option>
                            </select>
                        </div>
                    </div>

                    <!-- BUTTON -->
                    <div class="form-footer">
                        <a href="task.php" class="btn-batal">Batal</a>
                        <button type="submit" class="btn-simpan">Simpan Pekerjaan</button>
                    </div>

                </form>
            </div>
        </div>
    </main>

</div>

</body>
</html>
