from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Attendance, Student, Schedule, AttendanceSession, Lecturer, Course, Enrollment
from ..auth import get_current_user, require_admin, require_dosen
import datetime

router = APIRouter()

@router.get("/all")
def get_all_attendance(db: Session = Depends(get_db), current_user=Depends(require_admin)):
    attendances = db.query(Attendance).all()
    return [
        {
            "id": a.id,
            "session_id": a.session_id,
            "student_name": a.student.name,
            "student_nim": a.student.nim,
            "course_name": a.schedule.course.name if a.schedule else None,
            "schedule": f"{a.schedule.day} {a.schedule.start_time}-{a.schedule.end_time}" if a.schedule else None,
            "check_in_time": a.check_in_time,
            "status": a.status,
        }
        for a in attendances
    ]

@router.get("/live/open-for-me")
def get_open_sessions_for_student(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Notifikasi mahasiswa: sesi absensi yang sedang terbuka untuk MK yang diikuti."""
    if current_user.role != "mahasiswa":
        raise HTTPException(status_code=403, detail="Hanya untuk mahasiswa")

    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Data mahasiswa tidak ditemukan")

    course_ids = [e.course_id for e in db.query(Enrollment).filter(Enrollment.student_id == student.id).all()]
    if not course_ids:
        return []

    schedule_ids = [
        s.id for s in db.query(Schedule).filter(Schedule.course_id.in_(course_ids)).all()
    ]
    if not schedule_ids:
        return []

    sessions = (
        db.query(AttendanceSession)
        .filter(
            AttendanceSession.schedule_id.in_(schedule_ids),
            AttendanceSession.status == "open",
        )
        .order_by(AttendanceSession.started_at.desc())
        .all()
    )

    out = []
    for sess in sessions:
        sch = sess.schedule
        course = sch.course if sch else None
        out.append(
            {
                "session_id": sess.id,
                "schedule_id": sess.schedule_id,
                "course_name": course.name if course else None,
                "course_code": course.code if course else None,
                "schedule_label": f"{sch.day} {sch.start_time}-{sch.end_time}" if sch else None,
                "room": sch.room if sch else None,
                "started_at": sess.started_at,
            }
        )
    return out


@router.get("/my")
def get_my_attendance(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Data mahasiswa tidak ditemukan")
    attendances = db.query(Attendance).filter(Attendance.student_id == student.id).all()
    return [
        {
            "id": a.id,
            "session_id": a.session_id,
            "course_name": a.schedule.course.name if a.schedule else None,
            "schedule": f"{a.schedule.day} {a.schedule.start_time}-{a.schedule.end_time}" if a.schedule else None,
            "check_in_time": a.check_in_time,
            "status": a.status,
        }
        for a in attendances
    ]

@router.get("/dosen")
def get_dosen_attendance(db: Session = Depends(get_db), current_user=Depends(require_dosen)):
    lecturer = db.query(Lecturer).filter(Lecturer.user_id == current_user.id).first()
    if current_user.role == "dosen" and not lecturer:
        raise HTTPException(status_code=404, detail="Data dosen tidak ditemukan")

    if current_user.role == "admin":
        courses = db.query(Course).all()
    else:
        courses = db.query(Course).filter(Course.lecturer_id == lecturer.id).all()

    course_ids = [c.id for c in courses]
    if not course_ids:
        return []
    schedules = db.query(Schedule).filter(Schedule.course_id.in_(course_ids)).all()
    schedule_ids = [s.id for s in schedules]
    if not schedule_ids:
        return []
    attendances = db.query(Attendance).filter(Attendance.schedule_id.in_(schedule_ids)).all()
    return [
        {
            "id": a.id,
            "session_id": a.session_id,
            "student_name": a.student.name,
            "student_nim": a.student.nim,
            "course_name": a.schedule.course.name if a.schedule else None,
            "schedule": f"{a.schedule.day} {a.schedule.start_time}-{a.schedule.end_time}" if a.schedule else None,
            "check_in_time": a.check_in_time,
            "status": a.status,
        }
        for a in attendances
    ]

@router.get("/stats")
def get_stats(db: Session = Depends(get_db), current_user=Depends(require_admin)):
    total_students = db.query(Student).count()
    total_lecturers = db.query(Lecturer).count()
    total_courses = db.query(Course).count()
    today = datetime.date.today()
    today_attendance = db.query(Attendance).filter(
        Attendance.check_in_time >= datetime.datetime.combine(today, datetime.time.min)
    ).count()
    return {
        "total_students": total_students,
        "total_lecturers": total_lecturers,
        "total_courses": total_courses,
        "today_attendance": today_attendance,
    }

@router.delete("/{attendance_id}")
def delete_attendance(
    attendance_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin)
):
    attendance = db.query(Attendance).filter(Attendance.id == attendance_id).first()
    if not attendance:
        raise HTTPException(status_code=404, detail="Data absensi tidak ditemukan")
    db.delete(attendance)
    db.commit()
    return {"message": "Data absensi berhasil dihapus"}

@router.get("/sessions")
def get_attendance_sessions(db: Session = Depends(get_db), current_user=Depends(require_dosen)):
    sessions_query = db.query(AttendanceSession).order_by(AttendanceSession.started_at.desc())

    if current_user.role != "admin":
        lecturer = db.query(Lecturer).filter(Lecturer.user_id == current_user.id).first()
        if not lecturer:
            raise HTTPException(status_code=404, detail="Data dosen tidak ditemukan")
        sessions_query = sessions_query.join(Schedule, AttendanceSession.schedule_id == Schedule.id).join(
            Course, Schedule.course_id == Course.id
        ).filter(Course.lecturer_id == lecturer.id)

    sessions = sessions_query.limit(50).all()
    return [
        {
            "id": s.id,
            "schedule_id": s.schedule_id,
            "course_name": s.schedule.course.name if s.schedule and s.schedule.course else None,
            "schedule_label": f"{s.schedule.day} {s.schedule.start_time}-{s.schedule.end_time}" if s.schedule else None,
            "room": s.schedule.room if s.schedule else None,
            "started_at": s.started_at,
            "ended_at": s.ended_at,
            "status": s.status,
            "opened_by_name": s.opened_by.name if s.opened_by else None,
            "attendance_count": len(s.attendances),
        }
        for s in sessions
    ]

@router.post("/sessions/open")
def open_attendance_session(data: dict, db: Session = Depends(get_db), current_user=Depends(require_dosen)):
    schedule_id = data.get("schedule_id")
    if not schedule_id:
        raise HTTPException(status_code=400, detail="schedule_id wajib diisi")

    schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Jadwal tidak ditemukan")

    if current_user.role != "admin":
        lecturer = db.query(Lecturer).filter(Lecturer.user_id == current_user.id).first()
        if not lecturer:
            raise HTTPException(status_code=404, detail="Data dosen tidak ditemukan")
        if not schedule.course or schedule.course.lecturer_id != lecturer.id:
            raise HTTPException(status_code=403, detail="Anda tidak berhak membuka sesi untuk jadwal ini")

    existing_open = db.query(AttendanceSession).filter(
        AttendanceSession.schedule_id == schedule.id,
        AttendanceSession.status == "open"
    ).with_for_update().first()
    if existing_open:
        return {"message": "Sesi sudah aktif", "session_id": existing_open.id}

    session = AttendanceSession(
        schedule_id=schedule.id,
        opened_by_user_id=current_user.id,
        started_at=datetime.datetime.now(),
        status="open",
    )
    try:
        db.add(session)
        db.commit()
        db.refresh(session)
    except IntegrityError:
        db.rollback()
        # Race condition: another request opened it first
        existing = db.query(AttendanceSession).filter(
            AttendanceSession.schedule_id == schedule.id,
            AttendanceSession.status == "open"
        ).first()
        if existing:
            return {"message": "Sesi sudah aktif", "session_id": existing.id}
        raise HTTPException(status_code=500, detail="Gagal membuka sesi")
    return {"message": "Sesi absensi dibuka", "session_id": session.id}

@router.post("/sessions/{session_id}/close")
def close_attendance_session(session_id: int, db: Session = Depends(get_db), current_user=Depends(require_dosen)):
    session = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sesi tidak ditemukan")

    if current_user.role != "admin":
        lecturer = db.query(Lecturer).filter(Lecturer.user_id == current_user.id).first()
        if not lecturer:
            raise HTTPException(status_code=404, detail="Data dosen tidak ditemukan")
        if not session.schedule or not session.schedule.course or session.schedule.course.lecturer_id != lecturer.id:
            raise HTTPException(status_code=403, detail="Anda tidak berhak menutup sesi ini")

    if session.status != "open":
        return {"message": "Sesi sudah ditutup", "session_id": session.id}

    session.status = "closed"
    session.ended_at = datetime.datetime.now()
    db.commit()
    return {"message": "Sesi absensi ditutup", "session_id": session.id}