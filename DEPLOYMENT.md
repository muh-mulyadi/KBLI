# Panduan Publikasi — Pencari KBLI (Edisi Web)

Aplikasi ini **100% statis**: semua mesin (fuzzy, TF-IDF, klasifikasi) berjalan di browser
pengunjung. Setelah `npm run build`, folder `dist/` berisi situs final yang tinggal diunggah.

```bash
npm install
npm run build     # menghasilkan folder dist/
```

> Catatan penting: deploy ke **root domain** (mis. `namasitus.netlify.app`).
> Jangan taruh di sub-folder (mis. GitHub Pages repo page `user.github.io/repo`)
> karena path aset dibangun untuk root.

---

## Opsi 1 — Netlify Drop (paling cepat, ±30 detik)

1. Jalankan `npm run build`.
2. Buka **https://app.netlify.com/drop**
3. Seret folder `dist/` ke halaman itu.
4. Selesai — langsung dapat URL publik `https://nama-acak.netlify.app`.
5. (Opsional) Daftar akun gratis untuk mengunci situs permanen, ganti nama subdomain, dan pasang custom domain.

## Opsi 2 — Vercel (via Git, auto-deploy tiap push)

1. Push proyek ke GitHub/GitLab.
2. Buka **https://vercel.com** → *Add New Project* → impor repo.
3. Vercel otomatis mendeteksi Vite:
   - Build command: `npm run build`
   - Output directory: `dist`
4. Klik Deploy → dapat URL `https://proyek.vercel.app`.
   Setiap push ke branch utama otomatis deploy ulang.

Alternatif lewat terminal (tanpa Git):

```bash
npx vercel          # ikuti wizard, jawab "dist" saat ditanya output
npx vercel --prod   # deploy ke produksi
```

## Opsi 3 — Cloudflare Pages (gratis, CDN global)

1. Buka **https://pages.cloudflare.com** → *Create a project* → hubungkan repo Git.
2. Framework preset: **Vite**, build command `npm run build`, output `dist`.
3. Deploy → URL `https://proyek.pages.dev`.

## Opsi 4 — Firebase Hosting

```bash
npm i -g firebase-tools
firebase login
firebase init hosting   # pilih dist/ sebagai public dir, SPA = Yes
npm run build
firebase deploy --only hosting
```

---

## Hal yang perlu diketahui

- **Data referensi tersimpan di browser pengunjung** (localStorage). Setiap pengunjung
  memulai dari data bawaan (CONTOH ±180 baris + KBLI_MASTER ±230 kode) dan penambahan
  referensi hanya tersimpan di perangkat mereka.
- Agar **semua pengguna memakai referensi yang sama**, siapkan berkas
  `KBLI_MASTER.csv` (kolom `KBLI,Judul,Deskripsi`) dan `CONTOH.csv`
  (kolom `kegiatan utama,kbli`) berisi KBLI 2020 lengkap, lalu arahkan pengguna
  mengimpornya lewat tab **Kelola Referensi → Impor KBLI_MASTER (CSV)**.
  Impor bersifat *upsert*: kode sama diganti, kode baru ditambahkan.
- **Unduh REFERENSI_KBLI.xlsx** di tab Kelola Referensi menghasilkan berkas dengan
  dua sheet (CONTOH & KBLI_MASTER) — format yang sama dengan versi Streamlit.

## Custom domain

Semua opsi di atas mendukung custom domain gratis (HTTPS otomatis):
Netlify → *Domain settings*, Vercel → *Domains*, Cloudflare → *Custom domains*.
