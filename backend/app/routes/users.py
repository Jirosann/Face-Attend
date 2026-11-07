import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session, joinedload

from ..auth import get_current_user, hash_password, require_admin, verify_password
from ..database import get_db
from ..face_recognition import extract_embedding_from_image, embedding_to_str
from ..models import Attendance, AttendanceSession, Course, Enrollment, Lecturer, Schedule, ScheduleOverride, Student, User

router = APIRouter()

_AVATAR_DIR = Path(__file__).resolve().parent.parent.parent / "static" / "avatars"
_AVATAR_DIR.mkdir(parents=True, exist_ok=True)
_ALLOWED_IMG = {"image/jpeg", "image/png", "image/webp"}
_EXT = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


# ── PROFIL (semua role) ───────────────────────────────────

@router.get("/me")
def get_me(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    avatar_url = None
    if current_user.avatar_path:
        avatar_url = f"/static/avatars/{current_user.avatar_path}"
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role,
        "avatar_url": avatar_url,
        "student": (
            {"id": student.id, "nim": student.nim, "name": student.name} if student else None
        ),
    }


@router.put("/me")
def update_me(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if "name" in data and data["name"]:
        current_user.name = str(data["name"]).strip()

    new_pw = data.get("new_password")
    if new_pw:
        current = data.get("current_password") or ""
        if not verify_password(current, current_user.password):
            raise HTTPException(status_code=400, detail="Kata sandi saat ini salah")
        if len(str(new_pw)) < 6:
            raise HTTPException(status_code=400, detail="Kata sandi baru minimal 6 karakter")
        current_user.password = hash_password(new_pw)

    db.commit()
    return {"message": "Profil diperbarui", "name": current_user.name}


@router.post("/me/avatar")
def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if file.content_type not in _ALLOWED_IMG:
        raise HTTPException(status_code=400, detail="Gunakan JPG, PNG, atau WebP")

    ext = _EXT.get(file.content_type, ".jpg")
    fname = f"{current_user.id}_{uuid.uuid4().hex}{ext}"
    dest = _AVATAR_DIR / fname

    if current_user.avatar_path:
        old = _AVATAR_DIR / current_user.avatar_path
        if old.is_file():
            try:
                old.unlink()
            except OSError:
                pass

    with dest.open("wb") as buf:
        shutil.copyfileobj(file.file, buf)

    current_user.avatar_path = fname
    db.commit()
    return {"message": "Foto profil diperbarui", "avatar_url": f"/static/avatars/{fname}"}


@router.put("/{user_id}/password")
def admin_reset_password(
    user_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    new_pw = data.get("new_password")
    if not new_pw or len(str(new_pw)) < 6:
        raise HTTPException(status_code=400, detail="new_password wajib, minimal 6 karakter")
    user.password = hash_password(new_pw)
    db.commit()
    return {"message": "Kata sandi user telah diatur ulang"}

# ── STUDENTS 

@router.get("/students")
def get_students(db: Session = Depends(get_db), current_user=Depends(require_admin)):
    # OPTIMIZED: Eager load user data to prevent N+1 queries
    students = db.query(Student)\
        .options(joinedload(Student.user))\
        .all()
    
    return [{
        "id": s.id,
        "nim": s.nim,
        "name": s.name,
        "email": s.user.email if s.user else None,
        "photo_path": s.photo_path,
        "has_embedding": bool(s.face_embedding),
    } for s in students]

@router.post("/students")
def create_student(data: dict, db: Session = Depends(get_db), current_user=Depends(require_admin)):
    # Buat user dulu
    existing = db.query(User).filter(User.email == data["email"]).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    
    user = User(
        name=data["name"],
        email=data["email"],
        password=hash_password(data["password"]),
        role="mahasiswa"
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Buat student
    student = Student(
        user_id=user.id,
        nim=data["nim"],
        name=data["name"],
    )
    db.add(student)
    db.commit()
    db.refresh(student)
    return {"message": "Mahasiswa berhasil ditambahkan", "id": student.id}


@router.post("/students/{student_id}/face")
def upload_student_face(
    student_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    """Upload foto wajah mahasiswa → extract embedding → simpan ke DB."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Mahasiswa tidak ditemukan")

    if file.content_type not in _ALLOWED_IMG:
        raise HTTPException(status_code=400, detail="Gunakan JPG, PNG, atau WebP")

    # Baca bytes foto
    image_bytes = file.file.read()

    # Extract embedding via InsightFace
    embedding = extract_embedding_from_image(image_bytes)
    if embedding is None:
        raise HTTPException(
            status_code=422,
            detail="Wajah tidak terdeteksi di foto ini. Gunakan foto yang jelas dengan wajah menghadap kamera."
        )

    # Simpan foto ke disk
    ext = _EXT.get(file.content_type, ".jpg")
    fname = f"student_{student_id}_{uuid.uuid4().hex}{ext}"
    dest = _AVATAR_DIR / fname
    with dest.open("wb") as buf:
        buf.write(image_bytes)

    # Hapus foto lama jika ada
    if student.photo_path:
        old = _AVATAR_DIR / Path(student.photo_path).name
        if old.is_file():
            try:
                old.unlink()
            except OSError:
                pass

    # Simpan path foto + embedding ke DB
    student.photo_path = f"/static/avatars/{fname}"
    student.face_embedding = embedding_to_str(embedding)
    db.commit()

    return {
        "message": "Foto wajah berhasil diupload dan embedding tersimpan",
        "photo_url": student.photo_path,
        "has_embedding": True,
    }

@router.put("/students/{student_id}")
def update_student(student_id: int, data: dict, db: Session = Depends(get_db), current_user=Depends(require_admin)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Mahasiswa tidak ditemukan")
    student.name = data.get("name", student.name)
    student.nim = data.get("nim", student.nim)
    db.commit()
    return {"message": "Mahasiswa berhasil diupdate"}

@router.delete("/students/{student_id}")
def delete_student(student_id: int, db: Session = Depends(get_db), current_user=Depends(require_admin)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Mahasiswa tidak ditemukan")

    # Delete related records first to avoid FK constraint errors
    db.query(Attendance).filter(Attendance.student_id == student_id).delete()
    db.query(Enrollment).filter(Enrollment.student_id == student_id).delete()

    user_id = student.user_id
    db.delete(student)
    db.flush()

    # Delete the linked user account
    if user_id:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            db.delete(user)

    db.commit()
    return {"message": "Mahasiswa berhasil dihapus"}

# ── LECTURERS 

@router.get("/lecturers")
def get_lecturers(db: Session = Depends(get_db), current_user=Depends(require_admin)):
    lecturers = db.query(Lecturer).all()
    return [{
        "id": l.id,
        "nip": l.nip,
        "name": l.name,
        "email": l.user.email if l.user else None,
    } for l in lecturers]

@router.post("/lecturers")
def create_lecturer(data: dict, db: Session = Depends(get_db), current_user=Depends(require_admin)):
    existing = db.query(User).filter(User.email == data["email"]).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")

    user = User(
        name=data["name"],
        email=data["email"],
        password=hash_password(data["password"]),
        role="dosen"
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    lecturer = Lecturer(
        user_id=user.id,
        nip=data["nip"],
        name=data["name"],
    )
    db.add(lecturer)
    db.commit()
    db.refresh(lecturer)
    return {"message": "Dosen berhasil ditambahkan", "id": lecturer.id}

@router.delete("/lecturers/{lecturer_id}")
def delete_lecturer(lecturer_id: int, db: Session = Depends(get_db), current_user=Depends(require_admin)):
    lecturer = db.query(Lecturer).filter(Lecturer.id == lecturer_id).first()
    if not lecturer:
        raise HTTPException(status_code=404, detail="Dosen tidak ditemukan")

    # Unlink courses so they don't cascade-delete
    db.query(Course).filter(Course.lecturer_id == lecturer_id).update({"lecturer_id": None})

    user_id = lecturer.user_id
    db.delete(lecturer)
    db.flush()

    # Delete the linked user account
    if user_id:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            db.delete(user)

    db.commit()
    return {"message": "Dosen berhasil dihapus"}

# ── ALL USERS 

@router.get("/all")
def get_all_users(db: Session = Depends(get_db), current_user=Depends(require_admin)):
    users = db.query(User).all()
    return [{"id": u.id, "name": u.name, "email": u.email, "role": u.role} for u in users]

@router.put("/role/{user_id}")
def update_role(user_id: int, data: dict, db: Session = Depends(get_db), current_user=Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    role = data["role"]
    user.role = role

    # Keep role/profile relation in sync so feature queries work.
    if role == "dosen":
        lecturer = db.query(Lecturer).filter(Lecturer.user_id == user.id).first()
        if not lecturer:
            auto_nip = f"AUTO{user.id:06d}"
            if db.query(Lecturer).filter(Lecturer.nip == auto_nip).first():
                auto_nip = f"AUTO{user.id:06d}{user.id}"
            db.add(Lecturer(user_id=user.id, nip=auto_nip, name=user.name))
    db.commit()
    return {"message": "Role berhasil diupdate"}