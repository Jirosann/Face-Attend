from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from ..database import get_db
from ..models import Attendance, AttendanceSession, Course, Enrollment, Lecturer, Schedule, Student
from ..auth import require_admin, require_dosen

router = APIRouter()

@router.get("")
def get_courses(db: Session = Depends(get_db), current_user=Depends(require_admin)):
    # OPTIMIZED: Eager load lecturer and enrollments to prevent N+1 queries
    courses = db.query(Course)\
        .options(
            joinedload(Course.lecturer),
            joinedload(Course.enrollments)
        )\
        .all()
    
    return [{"id": c.id, "code": c.code, "name": c.name,
             "lecturer_name": c.lecturer.name if c.lecturer else None,
             "credits": c.credits,
             "student_count": len(c.enrollments)} for c in courses]

@router.post("")
def create_course(data: dict, db: Session = Depends(get_db), current_user=Depends(require_admin)):
    course = Course(
        code=data["code"],
        name=data["name"],
        lecturer_id=data["lecturer_id"],
        credits=data["credits"]
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return {"message": "Mata kuliah berhasil ditambahkan", "id": course.id}

@router.delete("/{course_id}")
def delete_course(course_id: int, db: Session = Depends(get_db), current_user=Depends(require_admin)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Mata kuliah tidak ditemukan")

    # Cascade: delete attendance records, sessions, enrollments, schedules
    schedule_ids = [s.id for s in db.query(Schedule).filter(Schedule.course_id == course_id).all()]
    if schedule_ids:
        db.query(Attendance).filter(Attendance.schedule_id.in_(schedule_ids)).delete(synchronize_session=False)
        db.query(AttendanceSession).filter(AttendanceSession.schedule_id.in_(schedule_ids)).delete(synchronize_session=False)
        db.query(Schedule).filter(Schedule.course_id == course_id).delete(synchronize_session=False)

    db.query(Enrollment).filter(Enrollment.course_id == course_id).delete(synchronize_session=False)
    db.delete(course)
    db.commit()
    return {"message": "Mata kuliah berhasil dihapus"}

@router.get("/my")
def get_my_courses(db: Session = Depends(get_db), current_user=Depends(require_dosen)):
    if current_user.role == "admin":
        courses = db.query(Course).all()
    else:
        lecturer = db.query(Lecturer).filter(Lecturer.user_id == current_user.id).first()
        if not lecturer:
            raise HTTPException(status_code=404, detail="Data dosen tidak ditemukan")
        courses = db.query(Course).filter(Course.lecturer_id == lecturer.id).all()

    return [{
        "id": c.id,
        "code": c.code,
        "name": c.name,
        "credits": c.credits,
        "lecturer_name": c.lecturer.name if c.lecturer else None,
        "student_count": len(c.enrollments),
    } for c in courses]

@router.get("/{course_id}/students")
def get_course_students(course_id: int, db: Session = Depends(get_db), current_user=Depends(require_admin)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Mata kuliah tidak ditemukan")

    # OPTIMIZED: Eager load student and user to prevent N+1 queries
    enrollments = db.query(Enrollment)\
        .options(
            joinedload(Enrollment.student).joinedload(Student.user)
        )\
        .filter(Enrollment.course_id == course_id)\
        .all()
    
    return [{
        "student_id": e.student.id,
        "nim": e.student.nim,
        "name": e.student.name,
        "email": e.student.user.email if e.student and e.student.user else None,
    } for e in enrollments if e.student]

@router.post("/{course_id}/enrollments")
def enroll_students(course_id: int, data: dict, db: Session = Depends(get_db), current_user=Depends(require_admin)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Mata kuliah tidak ditemukan")

    student_ids = data.get("student_ids") or []
    if not student_ids:
        raise HTTPException(status_code=400, detail="student_ids wajib diisi")

    added = 0
    for student_id in student_ids:
        student = db.query(Student).filter(Student.id == student_id).first()
        if not student:
            continue
        existing = db.query(Enrollment).filter(
            Enrollment.course_id == course_id,
            Enrollment.student_id == student_id
        ).first()
        if existing:
            continue
        db.add(Enrollment(course_id=course_id, student_id=student_id))
        added += 1

    db.commit()
    return {"message": "Mahasiswa berhasil diassign", "added": added}

@router.delete("/{course_id}/enrollments/{student_id}")
def remove_enrollment(course_id: int, student_id: int, db: Session = Depends(get_db), current_user=Depends(require_admin)):
    enrollment = db.query(Enrollment).filter(
        Enrollment.course_id == course_id,
        Enrollment.student_id == student_id
    ).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment tidak ditemukan")
    db.delete(enrollment)
    db.commit()
    return {"message": "Mahasiswa berhasil dikeluarkan dari mata kuliah"}