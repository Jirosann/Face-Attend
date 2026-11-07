from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Attendance, AttendanceSession, Schedule, Course, Lecturer, Student, Enrollment, ScheduleOverride
from ..auth import require_admin, require_dosen, get_current_user
import datetime

router = APIRouter()

DAY_TO_WEEKDAY = {
    "Senin": 0,
    "Selasa": 1,
    "Rabu": 2,
    "Kamis": 3,
    "Jumat": 4,
}

def next_regular_date(day_name: str):
    today = datetime.date.today()
    weekday = DAY_TO_WEEKDAY.get(day_name)
    if weekday is None:
        return today
    delta = (weekday - today.weekday()) % 7
    return today + datetime.timedelta(days=delta)

def serialize_override(override: ScheduleOverride):
    return {
        "id": override.id,
        "original_date": str(override.original_date),
        "replacement_date": str(override.replacement_date),
        "new_start_time": str(override.new_start_time),
        "new_end_time": str(override.new_end_time),
        "new_room": override.new_room,
        "reason": override.reason,
        "created_at": override.created_at,
        "updated_at": override.updated_at,
    }

def serialize_schedule(schedule: Schedule):
    upcoming_regular_date = next_regular_date(schedule.day)
    future_overrides = sorted(
        [o for o in schedule.overrides if o.replacement_date >= datetime.date.today()],
        key=lambda item: item.replacement_date
    )
    return {
        "id": schedule.id,
        "course_id": schedule.course_id,
        "course_name": schedule.course.name if schedule.course else None,
        "course_code": schedule.course.code if schedule.course else None,
        "lecturer_name": schedule.course.lecturer.name if schedule.course and schedule.course.lecturer else None,
        "day": schedule.day,
        "start_time": str(schedule.start_time),
        "end_time": str(schedule.end_time),
        "room": schedule.room,
        "label": f"{schedule.course.name if schedule.course else 'Tanpa MK'} - {schedule.day} {schedule.start_time}-{schedule.end_time} ({schedule.room})",
        "upcoming_regular_date": str(upcoming_regular_date),
        "overrides": [serialize_override(o) for o in future_overrides],
    }

def ensure_schedule_access(db: Session, schedule: Schedule, current_user):
    if current_user.role == "admin":
        return
    lecturer = db.query(Lecturer).filter(Lecturer.user_id == current_user.id).first()
    if not lecturer:
        raise HTTPException(status_code=404, detail="Data dosen tidak ditemukan")
    if not schedule.course or schedule.course.lecturer_id != lecturer.id:
        raise HTTPException(status_code=403, detail="Anda tidak berhak mengubah jadwal ini")

@router.get("")
def get_schedules(db: Session = Depends(get_db), current_user=Depends(require_admin)):
    schedules = db.query(Schedule).all()
    return [serialize_schedule(s) for s in schedules]

@router.post("")
def create_schedule(data: dict, db: Session = Depends(get_db), current_user=Depends(require_admin)):
    schedule = Schedule(
        course_id=data["course_id"],
        day=data["day"],
        start_time=data["start_time"],
        end_time=data["end_time"],
        room=data["room"]
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return {"message": "Jadwal berhasil ditambahkan", "id": schedule.id}

@router.delete("/{schedule_id}")
def delete_schedule(schedule_id: int, db: Session = Depends(get_db), current_user=Depends(require_admin)):
    schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Jadwal tidak ditemukan")

    # Cascade: delete attendance records, sessions, overrides before deleting schedule
    db.query(Attendance).filter(Attendance.schedule_id == schedule_id).delete(synchronize_session=False)
    db.query(AttendanceSession).filter(AttendanceSession.schedule_id == schedule_id).delete(synchronize_session=False)
    db.query(ScheduleOverride).filter(ScheduleOverride.schedule_id == schedule_id).delete(synchronize_session=False)
    db.delete(schedule)
    db.commit()
    return {"message": "Jadwal berhasil dihapus"}

@router.get("/my")
def get_my_schedules(db: Session = Depends(get_db), current_user=Depends(require_dosen)):
    query = db.query(Schedule)
    if current_user.role != "admin":
        lecturer = db.query(Lecturer).filter(Lecturer.user_id == current_user.id).first()
        if not lecturer:
            raise HTTPException(status_code=404, detail="Data dosen tidak ditemukan")
        query = query.join(Course, Schedule.course_id == Course.id).filter(Course.lecturer_id == lecturer.id)

    schedules = query.all()
    return [serialize_schedule(s) for s in schedules]

@router.get("/student/my")
def get_student_schedules(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Data mahasiswa tidak ditemukan")

    enrollments = db.query(Enrollment).filter(Enrollment.student_id == student.id).all()
    course_ids = [e.course_id for e in enrollments]
    if not course_ids:
        return []

    schedules = db.query(Schedule).filter(Schedule.course_id.in_(course_ids)).all()
    return [serialize_schedule(s) for s in schedules]

@router.get("/overrides/my")
def get_my_overrides(db: Session = Depends(get_db), current_user=Depends(require_dosen)):
    schedules = get_my_schedules(db, current_user)
    overrides = []
    for schedule in schedules:
        for override in schedule["overrides"]:
            overrides.append({
                "schedule_id": schedule["id"],
                "course_name": schedule["course_name"],
                "regular_label": schedule["label"],
                **override,
            })
    return sorted(overrides, key=lambda item: item["replacement_date"])

@router.post("/{schedule_id}/overrides")
def create_schedule_override(schedule_id: int, data: dict, db: Session = Depends(get_db), current_user=Depends(require_dosen)):
    schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Jadwal tidak ditemukan")
    ensure_schedule_access(db, schedule, current_user)

    original_date = datetime.date.fromisoformat(data["original_date"])
    replacement_date = datetime.date.fromisoformat(data["replacement_date"])
    existing = db.query(ScheduleOverride).filter(
        ScheduleOverride.schedule_id == schedule_id,
        ScheduleOverride.original_date == original_date
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Kelas pengganti untuk tanggal ini sudah ada")

    override = ScheduleOverride(
        schedule_id=schedule_id,
        original_date=original_date,
        replacement_date=replacement_date,
        new_start_time=data["new_start_time"],
        new_end_time=data["new_end_time"],
        new_room=data.get("new_room") or schedule.room,
        reason=data.get("reason"),
        created_by_user_id=current_user.id,
    )
    db.add(override)
    db.commit()
    db.refresh(override)
    return {"message": "Kelas pengganti berhasil dibuat", "id": override.id}

@router.put("/overrides/{override_id}")
def update_schedule_override(override_id: int, data: dict, db: Session = Depends(get_db), current_user=Depends(require_dosen)):
    override = db.query(ScheduleOverride).filter(ScheduleOverride.id == override_id).first()
    if not override:
        raise HTTPException(status_code=404, detail="Kelas pengganti tidak ditemukan")
    ensure_schedule_access(db, override.schedule, current_user)

    if "original_date" in data:
        override.original_date = datetime.date.fromisoformat(data["original_date"])
    if "replacement_date" in data:
        override.replacement_date = datetime.date.fromisoformat(data["replacement_date"])
    if "new_start_time" in data:
        override.new_start_time = data["new_start_time"]
    if "new_end_time" in data:
        override.new_end_time = data["new_end_time"]
    if "new_room" in data:
        override.new_room = data["new_room"]
    if "reason" in data:
        override.reason = data["reason"]

    db.commit()
    return {"message": "Kelas pengganti berhasil diupdate"}

@router.delete("/overrides/{override_id}")
def delete_schedule_override(override_id: int, db: Session = Depends(get_db), current_user=Depends(require_dosen)):
    override = db.query(ScheduleOverride).filter(ScheduleOverride.id == override_id).first()
    if not override:
        raise HTTPException(status_code=404, detail="Kelas pengganti tidak ditemukan")
    ensure_schedule_access(db, override.schedule, current_user)
    db.delete(override)
    db.commit()
    return {"message": "Kelas pengganti berhasil dihapus"}