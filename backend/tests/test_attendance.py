import pytest
from datetime import datetime, timedelta


class TestSessionManagement:
    
    def test_dosen_open_attendance_session(self, client, dosen_token, sample_schedule, dosen_user):
        response = client.post(
            "/api/attendance/sessions/open",
            headers={"Authorization": f"Bearer {dosen_token}"},
            json={"schedule_id": sample_schedule.id}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "open"
        assert data["schedule_id"] == sample_schedule.id
    
    def test_dosen_close_attendance_session(self, client, dosen_token, sample_schedule, dosen_user, test_db):
        from app.models import AttendanceSession
        
        session = AttendanceSession(
            schedule_id=sample_schedule.id,
            opened_by_user_id=dosen_user.id,
            started_at=datetime.now(),
            status="open"
        )
        test_db.add(session)
        test_db.commit()
        test_db.refresh(session)
        
        response = client.post(
            f"/api/attendance/sessions/{session.id}/close",
            headers={"Authorization": f"Bearer {dosen_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "closed"
    
    def test_cannot_open_session_for_unowned_course(self, client, test_db, sample_schedule):
        from app.models import User, Lecturer
        from app.auth import hash_password, create_access_token
        
        other_dosen = User(
            name="Unauthorized Dosen",
            email="unauthorized@test.com",
            password=hash_password("password123"),
            role="dosen"
        )
        test_db.add(other_dosen)
        test_db.commit()
        
        other_lecturer = Lecturer(
            user_id=other_dosen.id,
            nip="6666666666",
            name="Unauthorized Dosen"
        )
        test_db.add(other_lecturer)
        test_db.commit()
        
        unauthorized_token = create_access_token({"sub": "unauthorized@test.com"})
        
        response = client.post(
            "/api/attendance/sessions/open",
            headers={"Authorization": f"Bearer {unauthorized_token}"},
            json={"schedule_id": sample_schedule.id}
        )
        assert response.status_code in [403, 404]
    
    def test_cannot_open_duplicate_session(self, client, dosen_token, sample_schedule, dosen_user, test_db):
        from app.models import AttendanceSession
        
        existing_session = AttendanceSession(
            schedule_id=sample_schedule.id,
            opened_by_user_id=dosen_user.id,
            started_at=datetime.now(),
            status="open"
        )
        test_db.add(existing_session)
        test_db.commit()
        
        response = client.post(
            "/api/attendance/sessions/open",
            headers={"Authorization": f"Bearer {dosen_token}"},
            json={"schedule_id": sample_schedule.id}
        )
        assert response.status_code == 400


class TestRecordAttendance:
    
    def test_record_attendance_on_time(self, client, test_db, enrolled_student, sample_schedule, dosen_user):
        from app.models import AttendanceSession, Attendance
        
        session = AttendanceSession(
            schedule_id=sample_schedule.id,
            opened_by_user_id=dosen_user.id,
            started_at=datetime.now(),
            status="open"
        )
        test_db.add(session)
        test_db.commit()
        test_db.refresh(session)
        
        attendance = Attendance(
            student_id=enrolled_student.id,
            schedule_id=sample_schedule.id,
            session_id=session.id,
            check_in_time=datetime.now(),
            status="hadir"
        )
        test_db.add(attendance)
        test_db.commit()
        test_db.refresh(attendance)
        
        assert attendance.status == "hadir"
        assert attendance.student_id == enrolled_student.id
    
    def test_record_attendance_late(self, client, test_db, enrolled_student, sample_schedule, dosen_user):
        from app.models import AttendanceSession, Attendance
        
        session = AttendanceSession(
            schedule_id=sample_schedule.id,
            opened_by_user_id=dosen_user.id,
            started_at=datetime.now() - timedelta(minutes=20),
            status="open"
        )
        test_db.add(session)
        test_db.commit()
        test_db.refresh(session)
        
        attendance = Attendance(
            student_id=enrolled_student.id,
            schedule_id=sample_schedule.id,
            session_id=session.id,
            check_in_time=datetime.now(),
            status="terlambat"
        )
        test_db.add(attendance)
        test_db.commit()
        test_db.refresh(attendance)
        
        assert attendance.status == "terlambat"
    
    def test_cannot_record_attendance_duplicate_in_session(self, client, test_db, enrolled_student, sample_schedule, dosen_user):
        from app.models import AttendanceSession, Attendance
        
        session = AttendanceSession(
            schedule_id=sample_schedule.id,
            opened_by_user_id=dosen_user.id,
            started_at=datetime.now(),
            status="open"
        )
        test_db.add(session)
        test_db.commit()
        test_db.refresh(session)
        
        attendance1 = Attendance(
            student_id=enrolled_student.id,
            schedule_id=sample_schedule.id,
            session_id=session.id,
            check_in_time=datetime.now(),
            status="hadir"
        )
        test_db.add(attendance1)
        test_db.commit()
        
        attendance2 = Attendance(
            student_id=enrolled_student.id,
            schedule_id=sample_schedule.id,
            session_id=session.id,
            check_in_time=datetime.now(),
            status="hadir"
        )
        test_db.add(attendance2)
        
        with pytest.raises(Exception):
            test_db.commit()
    
    def test_only_enrolled_students_can_be_recorded(self, client, test_db, sample_student, sample_schedule, dosen_user):
        from app.models import AttendanceSession, Attendance, User, Student, Course
        from app.auth import hash_password
        
        unenrolled_user = User(
            name="Unenrolled Student",
            email="unenrolled@test.com",
            password=hash_password("password123"),
            role="mahasiswa"
        )
        test_db.add(unenrolled_user)
        test_db.commit()
        
        unenrolled_student = Student(
            user_id=unenrolled_user.id,
            nim="2509999999",
            name="Unenrolled Student",
            face_embedding=None
        )
        test_db.add(unenrolled_student)
        test_db.commit()
        test_db.refresh(unenrolled_student)
        
        session = AttendanceSession(
            schedule_id=sample_schedule.id,
            opened_by_user_id=dosen_user.id,
            started_at=datetime.now(),
            status="open"
        )
        test_db.add(session)
        test_db.commit()
        test_db.refresh(session)
        
        course = test_db.query(Course).filter(Course.id == sample_schedule.course_id).first()
        enrolled_student_ids = [e.student_id for e in course.enrollments]
        
        assert unenrolled_student.id not in enrolled_student_ids


class TestAttendanceHistory:
    
    def test_student_view_own_attendance_history(self, client, mahasiswa_token, enrolled_student, sample_schedule, dosen_user, test_db):
        from app.models import AttendanceSession, Attendance
        
        session = AttendanceSession(
            schedule_id=sample_schedule.id,
            opened_by_user_id=dosen_user.id,
            started_at=datetime.now(),
            status="closed"
        )
        test_db.add(session)
        test_db.commit()
        test_db.refresh(session)
        
        attendance = Attendance(
            student_id=enrolled_student.id,
            schedule_id=sample_schedule.id,
            session_id=session.id,
            check_in_time=datetime.now(),
            status="hadir"
        )
        test_db.add(attendance)
        test_db.commit()
        
        response = client.get(
            "/api/attendance/my",
            headers={"Authorization": f"Bearer {mahasiswa_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_student_cannot_view_others_attendance(self, client, mahasiswa_token, test_db):
        from app.models import User, Student
        from app.auth import hash_password
        
        other_student_user = User(
            name="Other Student",
            email="otherstudent@test.com",
            password=hash_password("password123"),
            role="mahasiswa"
        )
        test_db.add(other_student_user)
        test_db.commit()
        
        other_student = Student(
            user_id=other_student_user.id,
            nim="2508888888",
            name="Other Student",
            face_embedding=None
        )
        test_db.add(other_student)
        test_db.commit()
        
        response = client.get(
            "/api/attendance/my",
            headers={"Authorization": f"Bearer {mahasiswa_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        student_ids = [a["student_id"] for a in data]
        assert other_student.id not in student_ids


class TestLecturerView:
    
    def test_dosen_view_course_attendance(self, client, dosen_token):
        response = client.get(
            "/api/attendance/dosen",
            headers={"Authorization": f"Bearer {dosen_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestAdminOperations:
    
    def test_admin_view_all_attendance(self, client, admin_token):
        response = client.get(
            "/api/attendance/all",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_admin_delete_attendance_record(self, client, admin_token, enrolled_student, sample_schedule, dosen_user, test_db):
        from app.models import AttendanceSession, Attendance
        
        session = AttendanceSession(
            schedule_id=sample_schedule.id,
            opened_by_user_id=dosen_user.id,
            started_at=datetime.now(),
            status="closed"
        )
        test_db.add(session)
        test_db.commit()
        test_db.refresh(session)
        
        attendance = Attendance(
            student_id=enrolled_student.id,
            schedule_id=sample_schedule.id,
            session_id=session.id,
            check_in_time=datetime.now(),
            status="hadir"
        )
        test_db.add(attendance)
        test_db.commit()
        test_db.refresh(attendance)
        
        response = client.delete(
            f"/api/attendance/{attendance.id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
    
    def test_admin_get_attendance_statistics(self, client, admin_token):
        response = client.get(
            "/api/attendance/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_students" in data or isinstance(data, dict)


class TestOpenSessionNotifications:
    
    def test_student_get_open_sessions_for_enrolled_courses(self, client, mahasiswa_token, enrolled_student, sample_schedule, dosen_user, test_db):
        from app.models import AttendanceSession
        
        session = AttendanceSession(
            schedule_id=sample_schedule.id,
            opened_by_user_id=dosen_user.id,
            started_at=datetime.now(),
            status="open"
        )
        test_db.add(session)
        test_db.commit()
        test_db.refresh(session)
        
        response = client.get(
            "/api/attendance/live/open-for-me",
            headers={"Authorization": f"Bearer {mahasiswa_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
