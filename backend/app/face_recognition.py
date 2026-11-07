"""
Face Recognition Engine — InsightFace Buffalo_S (Optimized)
============================================================
- Pretrained model, tidak perlu training ulang
- 1 foto per mahasiswa cukup untuk registrasi
- Embedding disimpan di DB (kolom face_embedding), bukan file JSON
- Cosine similarity untuk matching
- Optimized: buffalo_s model (5-10x faster than buffalo_l)
"""

import json
import os
import threading

import cv2
import numpy as np
from dotenv import load_dotenv

load_dotenv()

THRESHOLD = float(os.getenv("FACE_MATCH_THRESHOLD", "0.4"))
MATCH_MARGIN = float(os.getenv("FACE_MATCH_MARGIN", "0.05"))

# ── InsightFace app (lazy load, thread-safe) ──────────────
_app = None
_app_lock = threading.Lock()


def get_insight_app():
    """Lazy-load InsightFace dengan double-check locking agar thread-safe."""
    global _app
    if _app is None:
        with _app_lock:
            if _app is None:  # double-check setelah acquire lock
                from insightface.app import FaceAnalysis
                # OPTIMIZED: buffalo_s model (5-10x faster, 99.4% accuracy)
                _app = FaceAnalysis(name="buffalo_s", providers=["CPUExecutionProvider"])
                # OPTIMIZED: balanced det_size for speed + stability
                _app.prepare(ctx_id=0, det_size=(416, 416))
    return _app


# ── Embedding extraction ──────────────────────────────────

def extract_embedding_from_image(image_input) -> list[float] | None:
    """
    Ekstrak embedding wajah dari gambar.

    Args:
        image_input: numpy array (BGR) atau bytes atau path string

    Returns:
        list[float] embedding 512-dim, atau None jika tidak ada wajah
    """
    app = get_insight_app()

    # Konversi input ke numpy BGR array
    if isinstance(image_input, (bytes, bytearray)):
        np_arr = np.frombuffer(image_input, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    elif isinstance(image_input, str):
        img = cv2.imread(image_input)
    elif isinstance(image_input, np.ndarray):
        img = image_input
    else:
        return None

    if img is None:
        return None

    # OPTIMIZED: Resize large images to reduce processing time
    h, w = img.shape[:2]
    max_width = 800  # Good balance between speed and quality
    if w > max_width:
        ratio = max_width / w
        new_w = max_width
        new_h = int(h * ratio)
        img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)

    try:
        faces = app.get(img)
        if not faces:
            return None
        # Ambil wajah dengan detection score tertinggi
        best_face = max(faces, key=lambda f: f.det_score)
        return best_face.embedding.tolist()
    except Exception as e:
        print(f"[InsightFace] extract_embedding error: {e}")
        return None


def embedding_to_str(embedding: list[float]) -> str:
    """Serialize embedding ke JSON string untuk disimpan di DB."""
    return json.dumps(embedding)


def str_to_embedding(s: str) -> list[float] | None:
    """Deserialize embedding dari JSON string DB."""
    if not s:
        return None
    try:
        return json.loads(s)
    except Exception:
        return None


# ── Cosine similarity ─────────────────────────────────────

def cosine_similarity(a, b) -> float:
    a = np.array(a, dtype=np.float64)
    b = np.array(b, dtype=np.float64)
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)


# ── Recognition against enrolled candidates ──────────────

def recognize_against_students(
    image_input,
    students: list,  # list of Student ORM objects with face_embedding
) -> tuple[int | None, float]:
    """
    Kenali wajah dari gambar, bandingkan hanya dengan mahasiswa terdaftar.

    Args:
        image_input: numpy array BGR / bytes / path
        students: list Student ORM objects (harus punya .id dan .face_embedding)

    Returns:
        (student_id | None, best_score)
    """
    # Filter mahasiswa yang punya embedding
    candidates = []
    for s in students:
        emb = str_to_embedding(s.face_embedding)
        if emb:
            candidates.append((s.id, emb))

    if not candidates:
        return None, 0.0

    # Extract embedding dari foto yang masuk
    face_emb = extract_embedding_from_image(image_input)
    if face_emb is None:
        return None, 0.0

    # Hitung similarity vs semua kandidat
    scores = [(sid, cosine_similarity(face_emb, emb)) for sid, emb in candidates]
    scores.sort(key=lambda x: x[1], reverse=True)

    best_sid, best_sc = scores[0]
    second_sc = scores[1][1] if len(scores) > 1 else 0.0

    thr = float(os.getenv("FACE_MATCH_THRESHOLD", "0.4"))
    margin = float(os.getenv("FACE_MATCH_MARGIN", "0.05"))

    if best_sc >= thr and (best_sc - second_sc) >= margin:
        return best_sid, float(best_sc)

    return None, float(best_sc)
