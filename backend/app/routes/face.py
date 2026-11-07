"""
Face Recognition Route
======================
POST /api/face/recognize
  - Terima 1 foto (base64) + session_id
  - Jalankan InsightFace recognition
  - Catat absensi jika cocok
  - Return hasil ke frontend
"""

import base64
import datetime
import json

import cv2
import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_dosen
from ..database import get_db
from ..face_recognition import recognize_against_students
from ..models import Attendance, AttendanceSession, Enrollment, Student

router = APIRouter()


def _decode_image(image_data: str) -> np.ndarray | None:
    """Decode base64 data URL ke numpy BGR array."""
    try:
        if "," in image_data:
            image_data = image_data.split(",")[1]
        image_bytes = base64.b64decode(image_data)
        np_arr = np.frombuffer(image_bytes, np.uint8)
        return cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    except Exception:
        return None


def _is_already_recorded(db: Session, student_id: int, schedule_id, session_id: int) -> bool:
    return db.query(Attendance).filter(
        Attendance.student_id == student_id,
        Attendance.schedule_id == schedule_id,
        Attendance.session_id == session_id,
    ).first() is not None


@router.post("/recognize")
async def recognize_face(
    data: dict,
    db: Session = Depends(get_db),
    current_user=Depends(require_dosen),
):
    """
    Endpoint utama absensi.
    Body: { "image": "<base64 data URL>", "session_id": <int> }
    """
    image_data = data.get("image")
    session_id = data.get("session_id")

    if not image_data or not session_id:
        raise HTTPException(status_code=400, detail="image dan session_id wajib diisi")

    # ── Validasi sesi ─────────────────────────────────────
    session = db.query(AttendanceSession).filter(
        AttendanceSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sesi tidak ditemukan")
    if session.status != "open":
        raise HTTPException(status_code=400, detail="Sesi sudah ditutup")

    schedule = session.schedule
    if not schedule or not schedule.course:
        raise HTTPException(status_code=400, detail="Jadwal tidak memiliki mata kuliah")

    course_id = schedule.course_id

    # ── Load mahasiswa enrolled di MK ini ─────────────────
    enrolled_students = (
        db.query(Student)
        .join(Enrollment, Enrollment.student_id == Student.id)
        .filter(Enrollment.course_id == course_id)
        .distinct()
        .all()
    )

    if not enrolled_students:
        return {
            "recognized": False,
            "reason": "no_enrollment",
            "message": "Tidak ada mahasiswa terdaftar di mata kuliah ini",
        }

    students_with_emb = [s for s in enrolled_students if s.face_embedding]
    if not students_with_emb:
        return {
            "recognized": False,
            "reason": "no_face_model",
            "message": "Belum ada data wajah untuk mahasiswa di kelas ini. Minta admin upload foto.",
        }

    # ── Decode gambar ─────────────────────────────────────
    frame = _decode_image(image_data)
    if frame is None:
        raise HTTPException(status_code=400, detail="Gagal decode gambar")

    # ── Jalankan recognition di threadpool ────────────────
    student_id, score = await run_in_threadpool(
        recognize_against_students, frame, students_with_emb
    )

    if not student_id:
        return {
            "recognized": False,
            "name": None,
            "nim": None,
            "score": round(score, 4),
            "message": "Wajah tidak dikenali. Pastikan pencahayaan cukup dan wajah terlihat jelas.",
        }

    # ── Ambil data student ────────────────────────────────
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        return {"recognized": False, "message": "Data mahasiswa tidak ditemukan"}

    # ── Cek enrollment ────────────────────────────────────
    enrolled_ok = db.query(Enrollment).filter(
        Enrollment.student_id == student.id,
        Enrollment.course_id == course_id,
    ).first()
    if not enrolled_ok:
        return {
            "recognized": True,
            "rejected": True,
            "reason": "not_enrolled",
            "name": student.name,
            "nim": student.nim,
            "message": "Mahasiswa tidak terdaftar di mata kuliah ini",
        }

    # ── Cek sesi masih open (re-check with row lock) ────────
    # FOR UPDATE lock mencegah session di-close saat kita insert attendance
    locked_session = db.execute(
        text("SELECT id, status FROM attendance_sessions WHERE id = :sid FOR UPDATE"),
        {"sid": session_id}
    ).fetchone()
    if not locked_session or locked_session.status != "open":
        raise HTTPException(status_code=400, detail="Sesi sudah ditutup")

    schedule_id = schedule.id

    # ── Tentukan status hadir / terlambat ─────────────────
    now = datetime.datetime.now()
    status = "hadir"
    if schedule.start_time:
        late_threshold = datetime.datetime.combine(
            datetime.date.today(), schedule.start_time
        ) + datetime.timedelta(minutes=15)
        if now > late_threshold:
            status = "terlambat"

    # ── Simpan absensi (dengan IntegrityError handling) ───
    attendance = Attendance(
        student_id=student.id,
        schedule_id=schedule_id,
        session_id=session_id,
        check_in_time=now,
        status=status,
    )
    try:
        db.add(attendance)
        db.commit()
    except IntegrityError:
        db.rollback()
        return {
            "recognized": True,
            "already_absent": True,
            "name": student.name,
            "nim": student.nim,
            "status": "sudah_absen",
            "score": round(score, 4),
        }

    return {
        "recognized": True,
        "already_absent": False,
        "name": student.name,
        "nim": student.nim,
        "status": status,
        "score": round(score, 4),
    }
