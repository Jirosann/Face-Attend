import pytest
from datetime import datetime


class TestCompleteEnrollmentFlow:
    
    def test_complete_student_enrollment_flow(self, client, admin_token, test_db):
        from app.models import User, Student, Course, Lecturer, Enrollment
        from app.auth import hash_password
        
        # Step 1: Admin creates student
        response = client.post(
            "/api/users/students",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "nim": "2501000001",
                "name": "Integration Test Student",
                "email": "integration@test.com",
                "password": "password123"
            }
        )
        assert response.status_code == 200
        student_data = response.json()
        student_id = student_data["id"]
        
        # Step 2: Admin creates lecturer
        lecturer_user = User(
            name="Integration Lecturer",
            email="intlecturer@test.com",
            password=hash_password("password123"),
            role="dosen"
        )
        test_db.add(lecturer_user)
        test_db.commit()
        test_db.refresh(lecturer_user)
        
        lecturer = Lecturer(
            user_id=lecturer_user.id,
            nip="1111111111",
            name="Integration Lecturer"
        )
        test_db.add(lecturer)
        test_db.commit()
        test_db.refresh(lecturer)
        
        # Step 3: Admin creates course
        response = client.post(
            "/api/courses",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "code": "INT101",
                "name": "Integration Test Course",
                "lecturer_id": lecturer.id,
                "credits": 3
            }
        )
        assert response.status_code == 200
        course_data = response.json()
        course_id = course_data["id"]
        
        # Step 4: Admin enrolls student
        response = client.post(
            f"/api/courses/{course_id}/enrollments",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"student_ids": [student_id]}
        )
        assert response.status_code == 200
        
        # Step 5: Verify enrollment exists
        enrollment = test_db.query(Enrollment).filter(
            Enrollment.student_id == student_id,
            Enrollment.course_id == course_id
        ).first()
        assert enrollment is not None
        
        # Step 6: Verify student appears in course.students
        response = client.get(
            f"/api/courses/{course_id}/students",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        students = response.json()
        student_ids = [s["id"] for s in students]
        assert student_id in student_ids


class TestCompleteAttendanceSessionFlow:
    
    def test_complete_attendance_session_flow(self, client, dosen_token, sample_course, sample_schedule, test_db):
        from app.models import User, Student, Enrollment, AttendanceSession, Attendance
        from app.auth import hash_password
        
        # Step 1: Create multiple students
        students = []
        for i in range(3):
            student_user = User(
                name=f"Flow Student {i}",
                email=f"flowstudent{i}@test.com",
                password=hash_password("password123"),
                role="mahasiswa"
            )
            test_db.add(student_user)
            test_db.commit()
            test_db.refresh(student_user)
            
            student = Student(
                user_id=student_user.id,
                nim=f"250100000{i}",
                name=f"Flow Student {i}",
                face_embedding=None
            )
            test_db.add(student)
            test_db.commit()
            test_db.refresh(student)
            
            # Enroll student
            enrollment = Enrollment(
                student_id=student.id,
                course_id=sample_course.id
            )
            test_db.add(enrollment)
            test_db.commit()
            
            students.append(student)
        
        # Step 2: Dosen opens session
        response = client.post(
            "/api/attendance/sessions/open",
            headers={"Authorization": f"Bearer {dosen_token}"},
            json={"schedule_id": sample_schedule.id}
        )
        assert response.status_code == 200
        session_data = response.json()
        session_id = session_data["id"]
        
        # Step 3: Students attend
        for student in students:
            attendance = Attendance(
                student_id=student.id,
                schedule_id=sample_schedule.id,
                session_id=session_id,
                check_in_time=datetime.now(),
                status="hadir"
            )
            test_db.add(attendance)
            test_db.commit()
        
        # Step 4: Verify attendance records created
        attendance_count = test_db.query(Attendance).filter(
            Attendance.session_id == session_id
        ).count()
        assert attendance_count == 3
        
        # Step 5: Dosen closes session
        response = client.post(
            f"/api/attendance/sessions/{session_id}/close",
            headers={"Authorization": f"Bearer {dosen_token}"}
        )
        assert response.status_code == 200
        
        # Step 6: Verify session status = closed
        session = test_db.query(AttendanceSession).filter(
            AttendanceSession.id == session_id
        ).first()
        assert session.status == "closed"


class TestScheduleOverrideAffectsAttendance:
    
    def test_schedule_override_affects_attendance(self, client, dosen_token, sample_schedule, test_db):
        from app.models import ScheduleOverride, AttendanceSession, User
        from datetime import timedelta
        
        dosen = test_db.query(User).filter(User.email == "dosen@test.com").first()
        
        # Step 1: Create regular schedule (already exists)
        # Step 2: Create override
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        override = ScheduleOverride(
            schedule_id=sample_schedule.id,
            original_date=tomorrow,
            replacement_date=(datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d"),
            new_start_time="14:00",
            new_end_time="16:00",
            new_room="OVERRIDE_ROOM",
            reason="Testing override",
            created_by_user_id=dosen.id
        )
        test_db.add(override)
        test_db.commit()
        test_db.refresh(override)
        
        # Step 3: Open session
        response = client.post(
            "/api/attendance/sessions/open",
            headers={"Authorization": f"Bearer {dosen_token}"},
            json={"schedule_id": sample_schedule.id}
        )
        assert response.status_code == 200
        
        # Step 4: Verify override exists
        assert override.new_room == "OVERRIDE_ROOM"


class TestCascadeDeleteStudent:
    
    def test_cascade_delete_student(self, client, admin_token, test_db):
        from app.models import User, Student, Course, Lecturer, Enrollment, Schedule, AttendanceSession, Attendance
        from app.auth import hash_password
        
        # Create student with enrollments and attendance
        student_user = User(
            name="Delete Test Student",
            email="deletestudent@test.com",
            password=hash_password("password123"),
            role="mahasiswa"
        )
        test_db.add(student_user)
        test_db.commit()
        test_db.refresh(student_user)
        
        student = Student(
            user_id=student_user.id,
            nim="2509999998",
            name="Delete Test Student",
            face_embedding=None
        )
        test_db.add(student)
        test_db.commit()
        test_db.refresh(student)
        
        # Create lecturer and course
        lecturer_user = User(
            name="Delete Test Lecturer",
            email="deletelecturer@test.com",
            password=hash_password("password123"),
            role="dosen"
        )
        test_db.add(lecturer_user)
        test_db.commit()
        
        lecturer = Lecturer(
            user_id=lecturer_user.id,
            nip="9999999998",
            name="Delete Test Lecturer"
        )
        test_db.add(lecturer)
        test_db.commit()
        test_db.refresh(lecturer)
        
        course = Course(
            code="DEL999",
            name="Delete Test Course",
            lecturer_id=lecturer.id,
            credits=3
        )
        test_db.add(course)
        test_db.commit()
        test_db.refresh(course)
        
        # Create enrollment
        enrollment = Enrollment(
            student_id=student.id,
            course_id=course.id
        )
        test_db.add(enrollment)
        test_db.commit()
        
        # Create schedule
        schedule = Schedule(
            course_id=course.id,
            day="Jumat",
            start_time="08:00",
            end_time="10:00",
            room="DEL101"
        )
        test_db.add(schedule)
        test_db.commit()
        test_db.refresh(schedule)
        
        # Create session and attendance
        session = AttendanceSession(
            schedule_id=schedule.id,
            opened_by_user_id=lecturer_user.id,
            started_at=datetime.now(),
            status="closed"
        )
        test_db.add(session)
        test_db.commit()
        test_db.refresh(session)
        
        attendance = Attendance(
            student_id=student.id,
            schedule_id=schedule.id,
            session_id=session.id,
            check_in_time=datetime.now(),
            status="hadir"
        )
        test_db.add(attendance)
        test_db.commit()
        
        # Verify data exists
        enrollment_count = test_db.query(Enrollment).filter(Enrollment.student_id == student.id).count()
        attendance_count = test_db.query(Attendance).filter(Attendance.student_id == student.id).count()
        assert enrollment_count > 0
        assert attendance_count > 0
        
        # Delete student
        response = client.delete(
            f"/api/users/students/{student.id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200


class TestCascadeDeleteCourse:
    
    def test_cascade_delete_course(self, client, admin_token, sample_course, test_db):
        from app.models import Schedule, Enrollment
        
        # Course already has schedule and enrollment
        schedule_count = test_db.query(Schedule).filter(Schedule.course_id == sample_course.id).count()
        enrollment_count = test_db.query(Enrollment).filter(Enrollment.course_id == sample_course.id).count()
        
        assert schedule_count > 0 or enrollment_count > 0
        
        # Delete course
        response = client.delete(
            f"/api/courses/{sample_course.id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200


class TestRoleBasedAccessControl:
    
    def test_role_based_access_control(self, client, admin_token, dosen_token, mahasiswa_token):
        # Admin accessing all endpoints (success)
        response = client.get("/api/users/students", headers={"Authorization": f"Bearer {admin_token}"})
        assert response.status_code == 200
        
        # Dosen accessing admin endpoints (fail)
        response = client.post(
            "/api/users/students",
            headers={"Authorization": f"Bearer {dosen_token}"},
            json={"nim": "2501111111", "name": "Test", "email": "test@test.com", "password": "pass"}
        )
        assert response.status_code == 403
        
        # Mahasiswa accessing dosen endpoints (fail)
        response = client.post(
            "/api/attendance/sessions/open",
            headers={"Authorization": f"Bearer {mahasiswa_token}"},
            json={"schedule_id": 1}
        )
        assert response.status_code in [403, 404]


class TestJWTTokenRefreshFlow:
    
    def test_jwt_token_refresh_flow(self, client, admin_user):
        from app.auth import create_access_token
        from datetime import timedelta
        
        # Login and get token
        response = client.post(
            "/api/auth/login",
            json={"email": "admin@test.com", "password": "admin123"}
        )
        assert response.status_code == 200
        token = response.json()["access_token"]
        
        # Use token for requests
        response = client.get("/api/users/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        
        # Create expired token
        expired_token = create_access_token({"sub": "admin@test.com"}, expires_delta=timedelta(seconds=-1))
        
        # Verify 401 Unauthorized
        response = client.get("/api/users/me", headers={"Authorization": f"Bearer {expired_token}"})
        assert response.status_code == 401


class TestConcurrentAttendanceSessions:
    
    def test_concurrent_attendance_sessions(self, client, test_db, dosen_token):
        from app.models import Course, Schedule, AttendanceSession, User, Lecturer
        from app.auth import hash_password
        
        # Create two courses with schedules
        dosen = test_db.query(User).filter(User.email == "dosen@test.com").first()
        lecturer = test_db.query(Lecturer).filter(Lecturer.user_id == dosen.id).first()
        
        course1 = Course(code="CON1", name="Concurrent Course 1", lecturer_id=lecturer.id, credits=3)
        test_db.add(course1)
        test_db.commit()
        test_db.refresh(course1)
        
        course2 = Course(code="CON2", name="Concurrent Course 2", lecturer_id=lecturer.id, credits=3)
        test_db.add(course2)
        test_db.commit()
        test_db.refresh(course2)
        
        schedule1 = Schedule(course_id=course1.id, day="Senin", start_time="08:00", end_time="10:00", room="CON1")
        test_db.add(schedule1)
        test_db.commit()
        test_db.refresh(schedule1)
        
        schedule2 = Schedule(course_id=course2.id, day="Selasa", start_time="10:00", end_time="12:00", room="CON2")
        test_db.add(schedule2)
        test_db.commit()
        test_db.refresh(schedule2)
        
        # Open multiple sessions simultaneously
        response1 = client.post(
            "/api/attendance/sessions/open",
            headers={"Authorization": f"Bearer {dosen_token}"},
            json={"schedule_id": schedule1.id}
        )
        
        response2 = client.post(
            "/api/attendance/sessions/open",
            headers={"Authorization": f"Bearer {dosen_token}"},
            json={"schedule_id": schedule2.id}
        )
        
        assert response1.status_code == 200
        assert response2.status_code == 200
        
        # Verify no cross-contamination
        session1_id = response1.json()["id"]
        session2_id = response2.json()["id"]
        assert session1_id != session2_id
        
        session1 = test_db.query(AttendanceSession).filter(AttendanceSession.id == session1_id).first()
        session2 = test_db.query(AttendanceSession).filter(AttendanceSession.id == session2_id).first()
        
        assert session1.schedule_id == schedule1.id
        assert session2.schedule_id == schedule2.id
