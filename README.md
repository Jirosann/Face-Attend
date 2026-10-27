# 🎓 FaceAttend

> Sistem absensi kelas otomatis berbasis **pengenalan wajah** untuk perguruan tinggi.
> Mahasiswa cukup menghadap kamera lalu sistem mencatat kehadiran secara real-time.

![Tech Stack](https://img.shields.io/badge/Frontend-React_19-61DAFB?logo=react)
![Tech Stack](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi)
![Tech Stack](https://img.shields.io/badge/Database-Supabase-3ECF8E?logo=supabase)
![Tech Stack](https://img.shields.io/badge/AI-InsightFace_ArcFace-FF6F00?logo=opencv)

---

## 📋 Daftar Isi

- [Demo & Screenshot](#-demo--screenshot)
- [Fitur Utama](#-fitur-utama)
- [Arsitektur](#-arsitektur)
- [Struktur Folder](#-struktur-folder)
- [Cara Menjalankan](#-cara-menjalankan)
- [Face Recognition Setup](#-face-recognition-setup)
- [API Reference](#-api-reference)
- [Dokumentasi](#-dokumentasi)
- [Troubleshooting](#-troubleshooting)

---

## ✨ Fitur Utama

| Fitur | Deskripsi |
|---|---|
| 🤖 **Face Recognition** | InsightFace Buffalo_L (ArcFace) — pengenalan wajah via webcam + smile detection |
| ⚡ **Smile Detection** | MediaPipe FaceMesh — senyum sebagai trigger capture, bukan WebSocket streaming |
| 🔐 **Role-based Access** | Admin, Dosen, Mahasiswa — masing-masing dengan akses berbeda |
| 📅 **Kalender Interaktif** | Mahasiswa lihat jadwal per bulan, termasuk kelas pengganti |
| 🔔 **Notifikasi Sesi** | Banner otomatis muncul jika ada sesi absensi aktif untuk MK yang diikuti |
| 📊 **Dashboard Analytics** | Statistik kehadiran per mata kuliah dengan progress bar |
| 🔄 **Jadwal Pengganti** | Dosen bisa reschedule kelas dengan tanggal/jam/ruangan baru |
| 👤 **Profil & Avatar** | Upload foto profil, ganti nama dan password |

---

## 🏗 Arsitektur

```
┌─────────────────────────────────────────────────────────┐
│                  React Frontend (Vite)                  │
│         Admin │ Dosen │ Mahasiswa │ Profile             │
└──────────────────────┬──────────────────────────────────┘
                       │  HTTP REST + WebSocket (JWT)
┌──────────────────────▼──────────────────────────────────┐
│               FastAPI Backend (Uvicorn)                 │
│   /api/auth  /api/users  /api/courses  /api/schedules   │
│   /api/attendance  /api/face/recognize (HTTP POST)      │
└──────────┬──────────────────────────┬───────────────────┘
           │                          │
    PostgreSQL                 InsightFace Buffalo_L
    (Supabase)                 (ArcFace, ONNX Runtime)
```

---

## 📁 Struktur Folder

```
face-attend/
├── frontend/               # React 19 + Vite
│   └── src/
│       ├── pages/          # Admin, Dosen, Mahasiswa, Auth, Profile
│       ├── components/     # Sidebar, TopNav, GlassCard, dll
│       ├── context/        # AuthContext, ThemeContext
│       └── utils/api.js    # Axios instance + interceptor
│
├── backend/                # FastAPI
│   ├── app/
│   │   ├── main.py         # Entry point, CORS, router, migrations
│   │   ├── models.py       # SQLAlchemy models
│   │   ├── auth.py         # JWT, bcrypt, dependencies
│   │   ├── database.py     # PostgreSQL connection
│   │   ├── face_recognition.py  # ArcFace inference
│   │   └── routes/         # auth, users, courses, schedules, attendance, face
│   ├── scripts/
│   │   └── ensure_admin.py # Buat/reset akun admin
│   └── requirements.txt
│
├── ml_model/               # Machine Learning
│   ├── dataset/            # Foto per orang (subfolder = nama)
│   ├── train.py            # Generate embeddings.json
│   ├── test.py             # Evaluasi akurasi model
│   └── FaceAttend_ML.ipynb # Notebook untuk Google Colab
│
└── docs/                   # Dokumentasi
    ├── PROJECT_MANAGEMENT.md
    ├── RISK_ANALYSIS_SECURITY.md
    ├── SDLC_METHODOLOGY.md
    └── TEST_REPORT.md
```

---

## 🚀 Cara Menjalankan

### Prasyarat
- Python 3.11+
- Node.js 18+
- Akun [Supabase](https://supabase.com) (gratis)

### 1. Clone & Setup

```bash
git clone https://github.com/Jirosann/Face-Attend.git
cd Face-Attend
```

### 2. Setup Backend

```bash
cd backend

# Buat virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Setup environment
cp .env.example .env
# Edit .env → isi DATABASE_URL dari Supabase
```

**Isi `backend/.env`:**
```env
DATABASE_URL=postgresql+psycopg2://postgres.xxxx:PASSWORD@aws-0-xx.pooler.supabase.com:6543/postgres
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
```

```bash
# Jalankan backend (tabel otomatis terbuat)
uvicorn app.main:app --reload --port 8000

# Buat akun admin pertama
python scripts/ensure_admin.py
# Email: admin@faceattend.com | Password: admin123
```

### 3. Setup Frontend

```bash
cd frontend
npm install
npm run dev
# Buka http://localhost:5173
```

### 4. Setup Face Recognition

```bash
cd ml_model

# Tambah foto ke dataset/
# dataset/NamaMahasiswa/foto1.jpg, foto2.jpg, ...

# Generate embeddings
python train.py

# Evaluasi akurasi (opsional)
python test.py
```

---

## 🤖 Face Recognition Setup

### Struktur Dataset
```
ml_model/dataset/
├── Ghani/
│   ├── foto1.jpg
│   ├── foto2.jpg
│   └── ... (minimal 20 foto)
└── Radit/
    └── ... (minimal 20 foto)
```

### Tips Foto yang Baik
- ✅ Berbagai sudut (depan, sedikit kiri/kanan)
- ✅ Berbagai pencahayaan (terang, redup)
- ✅ Ekspresi berbeda
- ✅ Minimal 20–30 foto per orang
- ❌ Hindari foto buram atau terlalu gelap

### Konfigurasi Threshold (`backend/.env`)
```env
FACE_MATCH_THRESHOLD=0.68   # Naikkan jika banyak false positive
FACE_MATCH_MARGIN=0.05      # Naikkan jika dua orang sering tertukar
```

> ⚠️ **Penting:** Nama folder di `dataset/` harus cocok dengan nama mahasiswa di database.

---

## 📡 API Reference

Base URL: `http://localhost:8000`  
Auth: `Authorization: Bearer <token>`

| Method | Endpoint | Akses | Deskripsi |
|---|---|---|---|
| POST | `/api/auth/login` | Public | Login → JWT token |
| GET | `/api/users/me` | Semua | Profil user login |
| PUT | `/api/users/me` | Semua | Update nama/password |
| GET | `/api/users/students` | Admin | List semua mahasiswa |
| GET | `/api/users/lecturers` | Admin | List semua dosen |
| GET | `/api/courses` | Admin | List mata kuliah |
| POST | `/api/courses/{id}/enrollments` | Admin | Enroll mahasiswa ke MK |
| GET | `/api/schedules` | Admin | List semua jadwal |
| GET | `/api/schedules/my` | Dosen | Jadwal milik dosen |
| GET | `/api/schedules/student/my` | Mahasiswa | Jadwal yang diikuti |
| POST | `/api/attendance/sessions/open` | Dosen | Buka sesi absensi |
| POST | `/api/attendance/sessions/{id}/close` | Dosen | Tutup sesi |
| GET | `/api/attendance/my` | Mahasiswa | Riwayat absensi |
| GET | `/api/attendance/live/open-for-me` | Mahasiswa | Cek sesi aktif |
| WS | `/api/face/ws?token=&session_id=` | Dosen | WebSocket scanning |

> 📖 Dokumentasi interaktif: `http://localhost:8000/docs`

## 🔧 Troubleshooting

| Gejala | Solusi |
|---|---|
| Tidak bisa login | Jalankan `python scripts/ensure_admin.py` untuk buat akun admin |
| Jadwal dosen kosong | Pastikan course sudah di-assign ke dosen tersebut |
| Wajah tidak dikenali | Cek nama folder dataset cocok dengan nama di DB; tambah lebih banyak foto |
| WebSocket error | Pastikan sesi masih `open` dan token valid |
| CORS error | Tambahkan origin frontend di `CORSMiddleware` di `main.py` |
| `bcrypt` error | Jalankan `pip install bcrypt==4.0.1` |

---


## 📄 Lisensi

MIT License — bebas digunakan untuk keperluan akademik.
