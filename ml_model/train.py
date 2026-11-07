"""
=============================================================
  FACE RECOGNITION - TRAINING / REGISTRATION SCRIPT
  Model   : InsightFace Buffalo_L (Pretrained ArcFace)
  Method  : One-shot feature extraction
  Output  : embeddings.json (untuk testing lokal)
            → Di sistem nyata, embedding disimpan ke DB
=============================================================

Cara pakai:
    cd ml_model
    python train.py

Struktur dataset:
    dataset/
    ├── NamaMahasiswa1/
    │   └── foto.jpg          ← 1 foto cukup, lebih banyak lebih baik
    └── NamaMahasiswa2/
        └── foto.jpg
"""

import json
import os

import cv2
import numpy as np
from insightface.app import FaceAnalysis

# ── Config ────────────────────────────────────────────────
DATASET_DIR  = "dataset"
OUTPUT_FILE  = "embeddings.json"
MODEL_NAME   = "buffalo_l"
TRAIN_RATIO  = 0.8
RANDOM_SEED  = 42
# ─────────────────────────────────────────────────────────

np.random.seed(RANDOM_SEED)


def get_app():
    app = FaceAnalysis(name=MODEL_NAME, providers=["CPUExecutionProvider"])
    app.prepare(ctx_id=0, det_size=(640, 640))
    return app


def extract_embedding(app, img_path: str) -> list | None:
    """Extract embedding dari 1 foto menggunakan InsightFace."""
    img = cv2.imread(img_path)
    if img is None:
        return None
    try:
        faces = app.get(img)
        if not faces:
            return None
        best = max(faces, key=lambda f: f.det_score)
        return best.embedding.tolist()
    except Exception as e:
        print(f"      ⚠ Error: {e}")
        return None


def train():
    print("=" * 60)
    print("  FACE REGISTRATION — InsightFace Buffalo_L")
    print(f"  Model     : {MODEL_NAME} (Pretrained ArcFace)")
    print(f"  Method    : One-shot feature extraction")
    print(f"  Train/Test: {int(TRAIN_RATIO*100)}/{int((1-TRAIN_RATIO)*100)}")
    print("=" * 60)

    app = get_app()
    print("✅ InsightFace model loaded\n")

    embeddings    = {}
    test_split    = {}
    train_summary = []

    persons = [
        p for p in os.listdir(DATASET_DIR)
        if os.path.isdir(os.path.join(DATASET_DIR, p))
    ]

    if not persons:
        print("❌ Tidak ada folder dataset ditemukan!")
        return

    print(f"📂 Ditemukan {len(persons)} orang: {', '.join(persons)}\n")

    for person_name in persons:
        person_dir = os.path.join(DATASET_DIR, person_name)
        photos = [
            f for f in os.listdir(person_dir)
            if f.lower().endswith((".jpg", ".jpeg", ".png"))
        ]

        if not photos:
            print(f"  ⚠ {person_name}: tidak ada foto, skip.")
            continue

        np.random.shuffle(photos)
        split_idx    = max(1, int(len(photos) * TRAIN_RATIO))
        train_photos = photos[:split_idx]
        test_photos  = photos[split_idx:]

        print(f"👤 {person_name} — train: {len(train_photos)}, test: {len(test_photos)}")

        train_embeddings = []
        for photo in train_photos:
            path = os.path.join(person_dir, photo)
            emb  = extract_embedding(app, path)
            if emb is not None:
                train_embeddings.append(emb)
                print(f"   ✅ {photo}")
            else:
                print(f"   ❌ {photo} (wajah tidak terdeteksi)")

        if not train_embeddings:
            print(f"   ❌ Skip {person_name} — tidak ada embedding valid\n")
            continue

        # Rata-rata semua embedding (lebih robust dari 1 foto)
        avg_embedding = np.mean(train_embeddings, axis=0).tolist()

        embeddings[person_name] = {
            "embedding"  : avg_embedding,
            "photo_count": len(train_embeddings),
            "model"      : MODEL_NAME,
            "emb_dim"    : len(avg_embedding),
        }

        test_split[person_name] = [
            os.path.join(person_dir, p) for p in test_photos
        ]

        train_summary.append({
            "person" : person_name,
            "train"  : len(train_embeddings),
            "test"   : len(test_photos),
            "dim"    : len(avg_embedding),
        })
        print(f"   ✅ Embedding selesai (dim={len(avg_embedding)})\n")

    # Simpan output
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(embeddings, f, indent=2)

    with open("test_split.json", "w", encoding="utf-8") as f:
        json.dump(test_split, f, indent=2)

    print("=" * 60)
    print("  TRAINING SELESAI")
    print("=" * 60)
    print(f"  {'Nama':<20} {'Train':>6} {'Test':>6} {'Dim':>6}")
    print(f"  {'-'*40}")
    for s in train_summary:
        print(f"  {s['person']:<20} {s['train']:>6} {s['test']:>6} {s['dim']:>6}")
    print(f"  {'-'*40}")
    print(f"  Total kelas : {len(train_summary)}")
    print(f"  Output      : {OUTPUT_FILE}")
    print("=" * 60)
    print("\n▶ Jalankan test.py untuk evaluasi akurasi.")


if __name__ == "__main__":
    train()
