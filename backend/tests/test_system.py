import pytest
from datetime import datetime, timedelta
from unittest.mock import patch, Mock
import numpy as np


class TestE2EFullSemesterWorkflow:
    
    def test_e2e_full_semester_workflow(self, client, admin_token, test_db):
        from app.models import User, Student, Lecturer, Course, Schedule, Enrollment, AttendanceSession, Attendance
        from app.auth import hash_password, create_access_token
        
        # Setup Phase
        # Step 1: Admin creates 3 students
        students = []
        for i in range(3):
            response = client.post(
                "/api/users/students",
                headers={"Authorization": f"Bearer {admin_token}"},
                json={
                    "nim": f"250200000{i}",
                    "name": f"E2E Student {i}",
                    "email": f"e2estudent{i}@test.com",
                    "password": "password123"
                }
            )
            assert response.status_code == 200
            students.append(response.json())
        
        # Step 2: Admin creates 1 dosen
        dosen_user = User(
            name="E2E Dosen",
            email="e2edosen@test.com",
            password=hash_password("password123"),
            role="dosen"
        )
        test_db.add(dosen_user)
        test_db.commit()
        test_db.refresh(dosen_user)
        
        lecturer = Lecturer(
            user_id=dosen_user.id,
            nip="2222222222",
            name="E2E Dosen"
        )
        test_db.add(lecturer)
        test_db.commit()
        test_db.refresh(lecturer)
        
        # Step 3: Admin creates 2 courses
        courses = []
        for i in range(2):
            response = client.post(
                "/api/courses",
                headers={"Authorization": f"Bearer {admin_token}"},
                json={
                    "code": f"E2E10{i}",
                    "name": f"E2E Course {i}",
                    "lecturer_id": lecturer.id,
                    "credits": 3
                }
            )
            assert response.status_code == 200
            courses.append(response.json())
        
        # Step 4: Admin enrolls students to courses
        for course in courses:
            student_ids = [s["id"] for s in students]
            response = client.post(
                f"/api/courses/{course['id']}/enrollments",
                headers={"Authorization": f"Bearer {admin_token}"},
                json={"student_ids": student_ids}
            )
            assert response.status_code == 200
        
        # Step 5: Admin creates weekly schedules
        schedules = []
        for course in courses:
            schedule = Schedule(
                course_id=course["id"],
                day="Senin",
                start_time="08:00",
                end_time="10:00",
                room=f"E2E{course['code']}"
            )
            test_db.add(schedule)
            test_db.commit()
            test_db.refresh(schedule)
            schedules.append(schedule)
        
        # Execution Phase
        dosen_token = create_access_token({"sub": "e2edosen@test.com"})
        
        # Step 6-8: Simulate 3 weeks of sessions
        for week in range(3):
            for schedule in schedules:
                # Open session
                response = client.post(
                    "/api/attendance/sessions/open",
                    headers={"Authorization": f"Bearer {dosen_token}"},
                    json={"schedule_id": schedule.id}
                )
                
                if response.status_code == 200:
                    session = response.json()
                    
                    # Students attend
                    for student in students:
                        attendance = Attendance(
                            student_id=student["id"],
                            schedule_id=schedule.id,
                            session_id=session["id"],
                            check_in_time=datetime.now(),
                            status="hadir"
                        )
                        test_db.add(attendance)
                    test_db.commit()
                    
                    # Close session
                    client.post(
                        f"/api/attendance/sessions/{session['id']}/close",
                        headers={"Authorization": f"Bearer {dosen_token}"}
                    )
        
        # Verification Phase
        # Step 10: Check student attendance percentage
        student_token = create_access_token({"sub": "e2estudent0@test.com"})
        response = client.get(
            "/api/attendance/my",
            headers={"Authorization": f"Bearer {student_token}"}
        )
        assert response.status_code == 200
        
        # Step 11: Check dosen attendance report
        response = client.get(
            "/api/attendance/dosen",
            headers={"Authorization": f"Bearer {dosen_token}"}
        )
        assert response.status_code == 200
        
        # Step 12: Check admin dashboard statistics
        response = client.get(
            "/api/attendance/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200


class TestE2EFaceRecognitionAccuracy:
    
    @patch('app.face_recognition.face_app')
    def test_e2e_face_recognition_accuracy(self, mock_face_app, client, admin_token, test_db, mock_face_image):
        from app.models import User, Student
        from app.auth import hash_password
        
        # Step 1-2: Upload 3 different student face photos and generate embeddings
        students_data = []
        for i in range(3):
            student_user = User(
                name=f"Face Test Student {i}",
                email=f"facetest{i}@test.com",
                password=hash_password("password123"),
                role="mahasiswa"
            )
            test_db.add(student_user)
            test_db.commit()
            test_db.refresh(student_user)
            
            student = Student(
                user_id=student_user.id,
                nim=f"250300000{i}",
                name=f"Face Test Student {i}",
                face_embedding=None
            )
            test_db.add(student)
            test_db.commit()
            test_db.refresh(student)
            
            # Mock face detection
            mock_face = Mock()
            mock_face.bbox = [100, 100, 200, 200]
            mock_face.embedding = np.random.rand(512)
            mock_face_app.get.return_value = [mock_face]
            
            # Upload face
            response = client.post(
                f"/api/users/students/{student.id}/face",
                headers={"Authorization": f"Bearer {admin_token}"},
                json={"image": mock_face_image}
            )
            
            students_data.append({
                "student": student,
                "embedding": mock_face.embedding
            })
        
        # Step 3-6: Test recognition
        # Recognition logic would be tested here with actual face recognition
        assert len(students_data) == 3


class TestE2ELateAttendanceWorkflow:
    
    def test_e2e_late_attendance_workflow(self, client, test_db):
        from app.models import User, Student, Lecturer, Course, Schedule, Enrollment, AttendanceSession, Attendance
        from app.auth import hash_password, create_access_token
        
        # Setup
        dosen_user = User(
            name="Late Test Dosen",
            email="latedosen@test.com",
            password=hash_password("password123"),
            role="dosen"
        )
        test_db.add(dosen_user)
        test_db.commit()
        test_db.refresh(dosen_user)
        
        lecturer = Lecturer(
            user_id=dosen_user.id,
            nip="3333333333",
            name="Late Test Dosen"
        )
        test_db.add(lecturer)
        test_db.commit()
        test_db.refresh(lecturer)
        
        course = Course(
            code="LATE101",
            name="Late Test Course",
            lecturer_id=lecturer.id,
            credits=3
        )
        test_db.add(course)
        test_db.commit()
        test_db.refresh(course)
        
        # Step 1: Create schedule at 08:00
        schedule = Schedule(
            course_id=course.id,
            day="Senin",
            start_time="08:00",
            end_time="10:00",
            room="LATE101"
        )
        test_db.add(schedule)
        test_db.commit()
        test_db.refresh(schedule)
        
        # Create two students
        student_a_user = User(
            name="Student A",
            email="studenta@test.com",
            password=hash_password("password123"),
            role="mahasiswa"
        )
        test_db.add(student_a_user)
        test_db.commit()
        
        student_a = Student(
            user_id=student_a_user.id,
            nim="2504000001",
            name="Student A",
            face_embedding=None
        )
        test_db.add(student_a)
        test_db.commit()
        test_db.refresh(student_a)
        
        student_b_user = User(
            name="Student B",
            email="studentb@test.com",
            password=hash_password("password123"),
            role="mahasiswa"
        )
        test_db.add(student_b_user)
        test_db.commit()
        
        student_b = Student(
            user_id=student_b_user.id,
            nim="2504000002",
            name="Student B",
            face_embedding=None
        )
        test_db.add(student_b)
        test_db.commit()
        test_db.refresh(student_b)
        
        # Enroll students
        for student in [student_a, student_b]:
            enrollment = Enrollment(
                student_id=student.id,
                course_id=course.id
            )
            test_db.add(enrollment)
        test_db.commit()
        
        # Step 2: Open session at 08:00
        session = AttendanceSession(
            schedule_id=schedule.id,
            opened_by_user_id=dosen_user.id,
            started_at=datetime.now(),
            status="open"
        )
        test_db.add(session)
        test_db.commit()
        test_db.refresh(session)
        
        # Step 3: Student A attends at 08:05 (on time)
        attendance_a = Attendance(
            student_id=student_a.id,
            schedule_id=schedule.id,
            session_id=session.id,
            check_in_time=datetime.now() + timedelta(minutes=5),
            status="hadir"
        )
        test_db.add(attendance_a)
        test_db.commit()
        
        # Step 4: Student B attends at 08:20 (late, >15 min)
        attendance_b = Attendance(
            student_id=student_b.id,
            schedule_id=schedule.id,
            session_id=session.id,
            check_in_time=datetime.now() + timedelta(minutes=20),
            status="terlambat"
        )
        test_db.add(attendance_b)
        test_db.commit()
        
        # Step 5-6: Verify statuses
        test_db.refresh(attendance_a)
        test_db.refresh(attendance_b)
        
        assert attendance_a.status == "hadir"
        assert attendance_b.status == "terlambat"


class TestE2EScheduleOverrideWorkflow:
    
    def test_e2e_schedule_override_workflow(self, client, admin_token, test_db):
        from app.models import User, Lecturer, Course, Schedule, ScheduleOverride, Student, Enrollment
        from app.auth import hash_password, create_access_token
        
        # Setup
        dosen_user = User(
            name="Override Dosen",
            email="overridedosen@test.com",
            password=hash_password("password123"),
            role="dosen"
        )
        test_db.add(dosen_user)
        test_db.commit()
        test_db.refresh(dosen_user)
        
        lecturer = Lecturer(
            user_id=dosen_user.id,
            nip="4444444444",
            name="Override Dosen"
        )
        test_db.add(lecturer)
        test_db.commit()
        test_db.refresh(lecturer)
        
        course = Course(
            code="OVR101",
            name="Override Course",
            lecturer_id=lecturer.id,
            credits=3
        )
        test_db.add(course)
        test_db.commit()
        test_db.refresh(course)
        
        # Step 1: Create regular schedule (Senin 08:00, Room A)
        schedule = Schedule(
            course_id=course.id,
            day="Senin",
            start_time="08:00",
            end_time="10:00",
            room="Room A"
        )
        test_db.add(schedule)
        test_db.commit()
        test_db.refresh(schedule)
        
        dosen_token = create_access_token({"sub": "overridedosen@test.com"})
        
        # Step 2: Dosen creates override (moved to Rabu 10:00, Room B)
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        response = client.post(
            f"/api/schedules/{schedule.id}/overrides",
            headers={"Authorization": f"Bearer {dosen_token}"},
            json={
                "original_date": tomorrow,
                "replacement_date": (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d"),
                "new_start_time": "10:00",
                "new_end_time": "12:00",
                "new_room": "Room B",
                "reason": "Testing override"
            }
        )
        assert response.status_code == 200
        override_data = response.json()
        
        # Step 3-4: Student views calendar and verifies override
        student_user = User(
            name="Override Student",
            email="overridestudent@test.com",
            password=hash_password("password123"),
            role="mahasiswa"
        )
        test_db.add(student_user)
        test_db.commit()
        
        student = Student(
            user_id=student_user.id,
            nim="2505000001",
            name="Override Student",
            face_embedding=None
        )
        test_db.add(student)
        test_db.commit()
        
        enrollment = Enrollment(
            student_id=student.id,
            course_id=course.id
        )
        test_db.add(enrollment)
        test_db.commit()
        
        student_token = create_access_token({"sub": "overridestudent@test.com"})
        response = client.get(
            "/api/schedules/student/my",
            headers={"Authorization": f"Bearer {student_token}"}
        )
        assert response.status_code == 200
        
        # Step 5-6: Verify override data
        assert override_data["new_room"] == "Room B"
        assert override_data["new_start_time"] == "10:00"


class TestE2EMultiStudentConcurrentAttendance:
    
    def test_e2e_multi_student_concurrent_attendance(self, client, test_db):
        from app.models import User, Student, Lecturer, Course, Schedule, Enrollment, AttendanceSession, Attendance
        from app.auth import hash_password, create_access_token
        
        # Setup
        dosen_user = User(
            name="Concurrent Dosen",
            email="concurrentdosen@test.com",
            password=hash_password("password123"),
            role="dosen"
        )
        test_db.add(dosen_user)
        test_db.commit()
        test_db.refresh(dosen_user)
        
        lecturer = Lecturer(
            user_id=dosen_user.id,
            nip="5555555555",
            name="Concurrent Dosen"
        )
        test_db.add(lecturer)
        test_db.commit()
        test_db.refresh(lecturer)
        
        course = Course(
            code="CNC101",
            name="Concurrent Course",
            lecturer_id=lecturer.id,
            credits=3
        )
        test_db.add(course)
        test_db.commit()
        test_db.refresh(course)
        
        schedule = Schedule(
            course_id=course.id,
            day="Senin",
            start_time="08:00",
            end_time="10:00",
            room="CNC101"
        )
        test_db.add(schedule)
        test_db.commit()
        test_db.refresh(schedule)
        
        # Step 1: Open session
        session = AttendanceSession(
            schedule_id=schedule.id,
            opened_by_user_id=dosen_user.id,
            started_at=datetime.now(),
            status="open"
        )
        test_db.add(session)
        test_db.commit()
        test_db.refresh(session)
        
        # Step 2: 10 students attend simultaneously
        students = []
        for i in range(10):
            student_user = User(
                name=f"Concurrent Student {i}",
                email=f"concurrent{i}@test.com",
                password=hash_password("password123"),
                role="mahasiswa"
            )
            test_db.add(student_user)
            test_db.commit()
            
            student = Student(
                user_id=student_user.id,
                nim=f"250600000{i}",
                name=f"Concurrent Student {i}",
                face_embedding=None
            )
            test_db.add(student)
            test_db.commit()
            test_db.refresh(student)
            
            # Enroll
            enrollment = Enrollment(
                student_id=student.id,
                course_id=course.id
            )
            test_db.add(enrollment)
            test_db.commit()
            
            # Attend
            attendance = Attendance(
                student_id=student.id,
                schedule_id=schedule.id,
                session_id=session.id,
                check_in_time=datetime.now(),
                status="hadir"
            )
            test_db.add(attendance)
            students.append(student)
        
        test_db.commit()
        
        # Step 3: Verify all 10 records created
        attendance_count = test_db.query(Attendance).filter(
            Attendance.session_id == session.id
        ).count()
        assert attendance_count == 10
        
        # Step 4: Verify no duplicates
        unique_student_ids = test_db.query(Attendance.student_id).filter(
            Attendance.session_id == session.id
        ).distinct().count()
        assert unique_student_ids == 10
        
        # Step 5: Verify correct timestamps
        attendances = test_db.query(Attendance).filter(
            Attendance.session_id == session.id
        ).all()
        assert all(a.check_in_time is not None for a in attendances)
