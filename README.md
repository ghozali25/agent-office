# Agent Office — Kantor Virtual 3D

Prototipe standalone kantor virtual 3D: enam agen AI tampil sebagai karakter kartun 3D di kantor isometrik. Kirim tugas, dan agen yang ditugaskan berjalan ke mejanya, duduk mengetik dengan bilah progres sampai selesai, lalu santai lagi. Setiap tugas yang masuk disambut bunyi **"cling"** dan toast notifikasi di layar.

![Screenshot Agent Office](screenshot.png)

## Fitur prototipe

- Kantor 3D (Three.js) bergaya dollhouse: deretan meja agen + monitor menyala, meja koordinator bermonitor ganda, ruang rapat berkaca, lounge dengan sofa dan TV
- 6 agen dengan nama, peran, dan label status melayang: Raka (Koordinator), Sinta (Riset & Data), Bima (Engineering), Dewi, Fajar, Nadia
- Formulir kirim tugas (judul + pilihan agen, atau otomatis ke agen yang bebas), tombol Tugas Acak, dan mode Demo Otomatis
- Bunyi "cling" (WebAudio) + toast setiap tugas masuk; ketuk layar sekali untuk mengaktifkan suara
- Tombol Panggil Rapat: semua agen berkumpul di ruang rapat, tugas terjeda lalu dilanjutkan
- Preset kamera (Isometrik / Atas / R. Rapat / Lounge) plus orbit dan zoom bebas
- Panel antrean tugas, roster tim yang bisa diklik untuk menyorot agen, dan log aktivitas

## Menjalankan

Cukup buka `index.html` di browser modern (Chrome/Edge/Firefox/Safari) — seluruh aplikasi berada dalam satu berkas HTML, tanpa proses build dan tanpa server. Koneksi internet diperlukan saat pertama kali memuat pustaka Three.js dari CDN.

## Status

Prototipe: data masih simulasi di sisi klien (belum terhubung ke Hermes Agent atau sistem agen lain). Pengembangan berikutnya direncanakan berjalan melalui pull request di repo ini.
