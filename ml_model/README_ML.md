# Face Recognition - Machine Learning Assignment

## Overview
Proyek ini mengimplementasikan **face recognition** untuk sistem absensi menggunakan
**Transfer Learning** dengan InsightFace Buffalo_L (ArcFace model pretrained).

Pendekatan: ekstrak embedding wajah dari model pretrained, lalu klasifikasi
menggunakan **Cosine Similarity + Threshold**.

---

## Struktur File
```
ml_model/
├── dataset/              # Foto per orang (subfolder = nama orang)
│   ├── NamaMahasiswa1/
│   │   ├── foto1.jpg
│   │   └── ...
│   └── NamaMahasiswa2/
│       └── ...
├── train.py              # Feature extraction & simpan embeddings
├── test.py               # Evaluasi model (Accuracy, F1, FAR, FRR, Confusion Matrix)
├── embeddings.json       # Output train.py — dipakai backend
├── test_split.json       # Output train.py — dibaca test.py
├── test_results.json     # Output test.py — hasil evaluasi lengkap
├── FaceAttend_ML.ipynb   # Notebook siap pakai di Google Colab
└── README_ML.md
```

---

## Cara Pakai

### 1. Siapkan dataset
Taruh foto di `dataset/<NamaOrang>/` minimal **20-30 foto per orang**.
Variasikan: sudut, pencahayaan, ekspresi.

### 2. Training
```bash
cd ml_model
python train.py
```
- Split otomatis: **80% train, 20% test**
- Output: `embeddings.json`, `test_split.json`

### 3. Testing / Evaluasi
```bash
python test.py
```
- Output: Accuracy, Precision, Recall, F1, FAR, FRR, Confusion Matrix
- Disimpan ke `test_results.json`

---

## Konfigurasi Threshold

Ubah nilai ini di bagian atas `test.py` (dan `backend/app/face_recognition.py` + `.env` untuk backend):

| Parameter | Default | Keterangan |
|---|---|---|
| `THRESHOLD` | `0.4` | Minimum cosine similarity untuk dianggap match. Naikkan jika banyak false positive. |
| `MATCH_MARGIN` | `0.05` | Selisih minimum skor #1 vs #2. Naikkan jika dua orang sering tertukar. |

### Panduan tuning:

**THRESHOLD** (InsightFace cosine similarity range: 0.0 – 1.0)
- `0.3` → Longgar, lebih banyak yang dikenali tapi rawan salah orang
- `0.4` → Default *(rekomendasi untuk InsightFace)*
- `0.5` → Ketat, lebih sedikit false positive tapi lebih banyak "unknown"
- `0.6` → Sangat ketat, hanya cocok jika dataset besar & variatif

**MATCH_MARGIN**
- `0.03` → Sangat longgar, cocok jika hanya ada 2-3 orang di kelas
- `0.05` → Default *(rekomendasi)*
- `0.08` → Ketat, cocok jika dataset besar dan foto variatif

### Contoh: dataset kecil (<15 foto/orang)
```python
THRESHOLD    = 0.35
MATCH_MARGIN = 0.03
```

### Contoh: dataset besar (>30 foto/orang)
```python
THRESHOLD    = 0.5
MATCH_MARGIN = 0.08
```

---

## Pengaruh Jumlah Foto terhadap Akurasi

| Jumlah foto/orang | Kualitas embedding | Ekspektasi akurasi |
|---|---|---|
| < 10 foto | Buruk — rata-rata tidak representatif | < 50% |
| 10–20 foto | Cukup | 50–80% |
| 20–30 foto | Baik | 80–95% |
| > 30 foto (variatif) | Sangat baik | > 95% |

> **Catatan:** Jika score rendah pada test, kemungkinan besar karena foto test
> kondisinya berbeda dari training set — ini menunjukkan bahwa **kualitas dan
> kuantitas data sangat mempengaruhi performa model**, bukan model-nya yang salah.

---

## Model yang Digunakan

| Komponen | Detail |
|---|---|
| **Library** | InsightFace |
| **Model** | Buffalo_L (ArcFace) |
| **Pretrained on** | MS1MV2 (~5.8 juta foto, 85k identitas) |
| **Embedding dim** | 512 |
| **Inference** | ONNX Runtime (CPU) |
| **Metode klasifikasi** | Cosine Similarity + Threshold |
| **Tipe learning** | Transfer Learning / Feature Extraction |

### Keunggulan InsightFace vs DeepFace:
- Lebih ringan (tidak butuh TensorFlow)
- Inference lebih cepat via ONNX Runtime
- Deteksi wajah built-in (RetinaFace)
- Satu foto cukup untuk registrasi (one-shot)

---

## Untuk Jupyter Notebook / Google Colab

Gunakan file `FaceAttend_ML.ipynb` yang sudah disediakan.

Install dependencies:
```python
!pip install insightface onnxruntime opencv-python numpy matplotlib seaborn
```

Upload folder `dataset/` ke Google Drive, lalu sesuaikan path di cell konfigurasi.

---

## Metrics yang Diukur

| Metric | Keterangan |
|---|---|
| **Accuracy** | Persentase prediksi benar dari total test |
| **Precision** | Dari yang diprediksi X, berapa yang benar X |
| **Recall** | Dari yang sebenarnya X, berapa yang berhasil dikenali |
| **F1-Score** | Harmonic mean dari Precision & Recall |
| **FAR** (False Acceptance Rate) | Persentase orang salah yang diterima |
| **FRR** (False Rejection Rate) | Persentase orang benar yang ditolak |

### Interpretasi:
- **FAR tinggi** → threshold terlalu rendah, naikkan `THRESHOLD`
- **FRR tinggi** → threshold terlalu tinggi, turunkan `THRESHOLD`
- **Keduanya tinggi** → dataset kurang variatif, tambah foto
