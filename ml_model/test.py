"""
=============================================================
  FACE RECOGNITION - TESTING / EVALUATION SCRIPT
  Model   : InsightFace Buffalo_L (Pretrained ArcFace)
  Metrics : Accuracy, Precision, Recall, F1,
            FAR, FRR, Confusion Matrix
=============================================================

Cara pakai:
    1. Jalankan train.py dulu
    2. python test.py
=============================================================
"""

import json
import os

import cv2
import numpy as np
from insightface.app import FaceAnalysis

# ── Config ────────────────────────────────────────────────
EMBEDDINGS_FILE  = "embeddings.json"
TEST_SPLIT_FILE  = "test_split.json"
MODEL_NAME       = "buffalo_l"
THRESHOLD        = 0.4     # InsightFace cosine similarity threshold
MATCH_MARGIN     = 0.05    # Selisih minimum skor #1 vs #2
# ─────────────────────────────────────────────────────────


def get_app():
    app = FaceAnalysis(name=MODEL_NAME, providers=["CPUExecutionProvider"])
    app.prepare(ctx_id=0, det_size=(640, 640))
    return app


def extract_embedding(app, img_path: str) -> list | None:
    img = cv2.imread(img_path)
    if img is None:
        return None
    try:
        faces = app.get(img)
        if not faces:
            return None
        return max(faces, key=lambda f: f.det_score).embedding.tolist()
    except Exception as e:
        print(f"   ⚠ {img_path}: {e}")
        return None


def cosine_similarity(a, b) -> float:
    a = np.array(a, dtype=np.float64)
    b = np.array(b, dtype=np.float64)
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    return float(np.dot(a, b) / denom) if denom > 0 else 0.0


def predict(face_emb: list, embeddings: dict) -> tuple:
    """Returns (predicted_label | None, best_score, second_score)"""
    best_label   = None
    best_score   = -1.0
    second_score = -1.0

    for name, data in embeddings.items():
        score = cosine_similarity(face_emb, data["embedding"])
        if score > best_score:
            second_score = best_score
            best_score   = score
            best_label   = name
        elif score > second_score:
            second_score = score

    second_score = max(second_score, 0.0)

    if best_label and best_score >= THRESHOLD and (best_score - second_score) >= MATCH_MARGIN:
        return best_label, best_score, second_score
    return None, best_score, second_score


def compute_metrics(y_true: list, y_pred: list, labels: list) -> dict:
    n = len(labels)
    label_to_idx = {l: i for i, l in enumerate(labels)}
    cm = np.zeros((n, n + 1), dtype=int)  # +1 kolom unknown

    for true, pred in zip(y_true, y_pred):
        ti = label_to_idx.get(true, -1)
        if ti == -1:
            continue
        pi = label_to_idx.get(pred, n) if pred else n
        cm[ti][pi] += 1

    precisions, recalls, f1s = [], [], []
    for i in range(n):
        tp = cm[i][i]
        fp = cm[:, i].sum() - tp
        fn = cm[i, :].sum() - tp
        p  = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        r  = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = 2 * p * r / (p + r) if (p + r) > 0 else 0.0
        precisions.append(p)
        recalls.append(r)
        f1s.append(f1)

    correct  = sum(1 for t, p in zip(y_true, y_pred) if t == p)
    accuracy = correct / len(y_true) if y_true else 0.0

    # FAR & FRR
    total_impostor = sum(1 for t, p in zip(y_true, y_pred) if t != p and p is not None)
    total_genuine  = len(y_true)
    far = total_impostor / total_genuine if total_genuine > 0 else 0.0
    frr = sum(1 for p in y_pred if p is None) / total_genuine if total_genuine > 0 else 0.0

    return {
        "accuracy"        : accuracy,
        "macro_precision" : float(np.mean(precisions)),
        "macro_recall"    : float(np.mean(recalls)),
        "macro_f1"        : float(np.mean(f1s)),
        "far"             : far,
        "frr"             : frr,
        "per_class"       : {
            labels[i]: {"precision": precisions[i], "recall": recalls[i], "f1": f1s[i]}
            for i in range(n)
        },
        "confusion_matrix": cm.tolist(),
        "cm_labels"       : labels + ["unknown"],
    }


def evaluate():
    print("=" * 60)
    print("  FACE RECOGNITION — EVALUATION")
    print(f"  Model     : {MODEL_NAME} (InsightFace)")
    print(f"  Threshold : {THRESHOLD}")
    print(f"  Margin    : {MATCH_MARGIN}")
    print("=" * 60)

    if not os.path.exists(EMBEDDINGS_FILE):
        print(f"❌ {EMBEDDINGS_FILE} tidak ditemukan. Jalankan train.py dulu!")
        return
    if not os.path.exists(TEST_SPLIT_FILE):
        print(f"❌ {TEST_SPLIT_FILE} tidak ditemukan. Jalankan train.py dulu!")
        return

    with open(EMBEDDINGS_FILE, "r") as f:
        embeddings = json.load(f)
    with open(TEST_SPLIT_FILE, "r") as f:
        test_split = json.load(f)

    app = get_app()
    print(f"\n✅ Model loaded")
    print(f"📋 Kelas terdaftar : {list(embeddings.keys())}")
    print(f"📋 Kelas test      : {list(test_split.keys())}\n")

    labels      = list(embeddings.keys())
    y_true      = []
    y_pred      = []
    detail_rows = []

    for true_label, photo_paths in test_split.items():
        if not photo_paths:
            continue
        print(f"🔍 Testing: {true_label} ({len(photo_paths)} foto)")

        for path in photo_paths:
            emb = extract_embedding(app, path)
            if emb is None:
                print(f"   ⚠ Skip: {path}")
                continue

            pred_label, best_sc, second_sc = predict(emb, embeddings)
            icon = "✅" if pred_label == true_label else "❌"
            print(f"   {icon} {os.path.basename(path):<30} "
                  f"pred={pred_label or 'unknown':<15} "
                  f"score={best_sc:.4f}  margin={best_sc - second_sc:.4f}")

            y_true.append(true_label)
            y_pred.append(pred_label)
            detail_rows.append({
                "file"      : os.path.basename(path),
                "true"      : true_label,
                "predicted" : pred_label or "unknown",
                "correct"   : pred_label == true_label,
                "best_score": round(best_sc, 4),
                "margin"    : round(best_sc - second_sc, 4),
            })
        print()

    if not y_true:
        print("❌ Tidak ada data test yang berhasil diproses.")
        return

    metrics = compute_metrics(y_true, y_pred, labels)

    print("=" * 60)
    print("  HASIL EVALUASI")
    print("=" * 60)
    print(f"  Total sampel test : {len(y_true)}")
    print(f"  Benar diprediksi  : {sum(1 for t,p in zip(y_true,y_pred) if t==p)}")
    print(f"  Tidak dikenali    : {sum(1 for p in y_pred if p is None)}")
    print()
    print(f"  Accuracy          : {metrics['accuracy']*100:.2f}%")
    print(f"  Macro Precision   : {metrics['macro_precision']*100:.2f}%")
    print(f"  Macro Recall      : {metrics['macro_recall']*100:.2f}%")
    print(f"  Macro F1-Score    : {metrics['macro_f1']*100:.2f}%")
    print(f"  FAR (False Accept): {metrics['far']*100:.2f}%")
    print(f"  FRR (False Reject): {metrics['frr']*100:.2f}%")

    print(f"\n  {'Kelas':<20} {'Precision':>10} {'Recall':>10} {'F1':>10}")
    print(f"  {'-'*52}")
    for label, m in metrics["per_class"].items():
        print(f"  {label:<20} {m['precision']*100:>9.2f}% "
              f"{m['recall']*100:>9.2f}% {m['f1']*100:>9.2f}%")

    # Confusion matrix
    cm     = np.array(metrics["confusion_matrix"])
    cm_lbl = metrics["cm_labels"]
    print(f"\n  Confusion Matrix:")
    header_label = "Actual / Pred"
    header = f"  {header_label:<20}" + "".join(f"{l:>12}" for l in cm_lbl)
    print(header)
    print(f"  {'-' * (20 + 12 * len(cm_lbl))}")
    for i, row_label in enumerate(labels):
        row = f"  {row_label:<20}" + "".join(f"{cm[i][j]:>12}" for j in range(len(cm_lbl)))
        print(row)

    print("=" * 60)

    # Save results
    results = {
        "model"       : MODEL_NAME,
        "threshold"   : THRESHOLD,
        "match_margin": MATCH_MARGIN,
        "total_test"  : len(y_true),
        "metrics"     : {k: v.tolist() if isinstance(v, np.ndarray) else v
                         for k, v in metrics.items()},
        "detail"      : detail_rows,
    }
    with open("test_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, default=str)

    print(f"\n  📄 Detail disimpan: test_results.json")
    print()
    print("  CATATAN:")
    print("  - FAR tinggi = threshold terlalu rendah, naikkan THRESHOLD")
    print("  - FRR tinggi = threshold terlalu tinggi, turunkan THRESHOLD")
    print("  - Tambah foto training untuk meningkatkan akurasi")
    print("=" * 60)


if __name__ == "__main__":
    evaluate()
