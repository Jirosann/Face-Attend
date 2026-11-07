from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Time, Date, CheckConstraint
from sqlalchemy.orm import relationship
from .database import Base
import datetime


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255))
    email = Column(String(255), unique=True)
    password = Column(String(255))
    # Using String + CheckConstraint instead of Enum for PostgreSQL compatibility
    role = Column(String(20), default='mahasiswa')
    avatar_path = Column(String(512), nullable=True)
    __table_args__ = (
        CheckConstraint("role IN ('admin', 'dosen', 'mahasiswa')", name="ck_users_role"),
    )


class Student(Base):
    __tablename__ = "students"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    nim = Column(String(20), unique=True)
    name = Column(String(255))
    photo_path = Column(String(255), nullable=True)
    face_embedding = Column(Text, nullable=True)
    user = relationship("User")
    attendances = relationship("Attendance", back_populates="student")
    enrollments = relationship("Enrollment", back_populates="student")


class Lecturer(Base):
    __tablename__ = "lecturers"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    nip = Column(String(20), unique=True)
    name = Column(String(255))
    user = relationship("User")
    courses = relationship("Course", back_populates="lecturer")


class Course(Base):
    __tablename__ = "courses"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True)
    name = Column(String(255))
    lecturer_id = Column(Integer, ForeignKey("lecturers.id"))
    credits = Column(Integer)
    lecturer = relationship("Lecturer", back_populates="courses")
    schedules = relationship("Schedule", back_populates="course")
    enrollments = relationship("Enrollment", back_populates="course")


class Schedule(Base):
    __tablename__ = "schedules"
    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"))
    day = Column(String(10))
    start_time = Column(Time)
    end_time = Column(Time)
    room = Column(String(50))
    course = relationship("Course", back_populates="schedules")
    attendances = relationship("Attendance", back_populates="schedule")
    sessions = relationship("AttendanceSession", back_populates="schedule")
    overrides = relationship("ScheduleOverride", back_populates="schedule")
    __table_args__ = (
        CheckConstraint("day IN ('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat')", name="ck_schedules_day"),
    )


class Enrollment(Base):
    __tablename__ = "enrollments"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"))
    course_id = Column(Integer, ForeignKey("courses.id"))
    enrolled_at = Column(DateTime, default=datetime.datetime.now)
    student = relationship("Student", back_populates="enrollments")
    course = relationship("Course", back_populates="enrollments")


class ScheduleOverride(Base):
    __tablename__ = "schedule_overrides"
    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey("schedules.id"))
    original_date = Column(Date)
    replacement_date = Column(Date)
    new_start_time = Column(Time)
    new_end_time = Column(Time)
    new_room = Column(String(50), nullable=True)
    reason = Column(String(255), nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.datetime.now)
    updated_at = Column(DateTime, default=datetime.datetime.now, onupdate=datetime.datetime.now)
    schedule = relationship("Schedule", back_populates="overrides")
    created_by = relationship("User")


class AttendanceSession(Base):
    __tablename__ = "attendance_sessions"
    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey("schedules.id"))
    opened_by_user_id = Column(Integer, ForeignKey("users.id"))
    started_at = Column(DateTime, default=datetime.datetime.now)
    ended_at = Column(DateTime, nullable=True)
    status = Column(String(20), default='open')
    schedule = relationship("Schedule", back_populates="sessions")
    opened_by = relationship("User")
    attendances = relationship("Attendance", back_populates="session")
    __table_args__ = (
        CheckConstraint("status IN ('open', 'closed', 'cancelled')", name="ck_sessions_status"),
    )


class Attendance(Base):
    __tablename__ = "attendances"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"))
    schedule_id = Column(Integer, ForeignKey("schedules.id"), nullable=True)
    session_id = Column(Integer, ForeignKey("attendance_sessions.id"), nullable=True)
    check_in_time = Column(DateTime, default=datetime.datetime.now)
    status = Column(String(20), default='hadir')
    student = relationship("Student", back_populates="attendances")
    schedule = relationship("Schedule", back_populates="attendances")
    session = relationship("AttendanceSession", back_populates="attendances")
    __table_args__ = (
        CheckConstraint("status IN ('hadir', 'terlambat')", name="ck_attendances_status"),
    )
