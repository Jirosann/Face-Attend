import pytest
from datetime import datetime, timedelta


class TestRegularSchedules:
    
    def test_admin_create_schedule(self, client, admin_token, sample_course):
        response = client.post(
            "/api/schedules",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "course_id": sample_course.id,
                "day": "Selasa",
                "start_time": "10:00",
                "end_time": "12:00",
                "room": "B202"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["day"] == "Selasa"
        assert data["room"] == "B202"
    
    def test_admin_list_schedules(self, client, admin_token, sample_schedule):
        response = client.get(
            "/api/schedules",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
    
    def test_admin_delete_schedule(self, client, admin_token, sample_schedule):
        response = client.delete(
            f"/api/schedules/{sample_schedule.id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
    
    def test_schedule_requires_valid_course(self, client, admin_token):
        response = client.post(
            "/api/schedules",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "course_id": 99999,
                "day": "Rabu",
                "start_time": "08:00",
                "end_time": "10:00",
                "room": "C303"
            }
        )
        assert response.status_code == 404


class TestScheduleOverrides:
    
    def test_dosen_create_schedule_override(self, client, dosen_token, sample_schedule):
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        response = client.post(
            f"/api/schedules/{sample_schedule.id}/overrides",
            headers={"Authorization": f"Bearer {dosen_token}"},
            json={
                "original_date": tomorrow,
                "replacement_date": (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d"),
                "new_start_time": "14:00",
                "new_end_time": "16:00",
                "new_room": "D404",
                "reason": "Lecture hall maintenance"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["new_room"] == "D404"
        assert data["reason"] == "Lecture hall maintenance"
    
    def test_dosen_update_schedule_override(self, client, dosen_token, sample_schedule, test_db):
        from app.models import ScheduleOverride
        
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        override = ScheduleOverride(
            schedule_id=sample_schedule.id,
            original_date=tomorrow,
            replacement_date=(datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d"),
            new_start_time="14:00",
            new_end_time="16:00",
            new_room="E505",
            reason="Original reason",
            created_by_user_id=test_db.query(User).filter(User.email == "dosen@test.com").first().id
        )
        test_db.add(override)
        test_db.commit()
        test_db.refresh(override)
        
        response = client.put(
            f"/api/schedules/overrides/{override.id}",
            headers={"Authorization": f"Bearer {dosen_token}"},
            json={
                "new_room": "F606",
                "reason": "Updated reason"
            }
        )
        assert response.status_code == 200
    
    def test_dosen_delete_schedule_override(self, client, dosen_token, sample_schedule, test_db):
        from app.models import ScheduleOverride, User
        
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        dosen = test_db.query(User).filter(User.email == "dosen@test.com").first()
        
        override = ScheduleOverride(
            schedule_id=sample_schedule.id,
            original_date=tomorrow,
            replacement_date=(datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d"),
            new_start_time="14:00",
            new_end_time="16:00",
            new_room="G707",
            reason="To be deleted",
            created_by_user_id=dosen.id
        )
        test_db.add(override)
        test_db.commit()
        test_db.refresh(override)
        
        response = client.delete(
            f"/api/schedules/overrides/{override.id}",
            headers={"Authorization": f"Bearer {dosen_token}"}
        )
        assert response.status_code == 200
    
    def test_dosen_can_only_modify_own_course_overrides(self, client, test_db, sample_schedule):
        from app.models import User, Lecturer, Course, Schedule, ScheduleOverride
        from app.auth import hash_password, create_access_token
        
        other_dosen = User(
            name="Another Dosen",
            email="anotherdosen@test.com",
            password=hash_password("password123"),
            role="dosen"
        )
        test_db.add(other_dosen)
        test_db.commit()
        test_db.refresh(other_dosen)
        
        other_lecturer = Lecturer(
            user_id=other_dosen.id,
            nip="8888888888",
            name="Another Dosen"
        )
        test_db.add(other_lecturer)
        test_db.commit()
        
        other_course = Course(
            code="CS888",
            name="Other Course",
            lecturer_id=other_lecturer.id,
            credits=3
        )
        test_db.add(other_course)
        test_db.commit()
        
        other_schedule = Schedule(
            course_id=other_course.id,
            day="Kamis",
            start_time="08:00",
            end_time="10:00",
            room="H808"
        )
        test_db.add(other_schedule)
        test_db.commit()
        test_db.refresh(other_schedule)
        
        override = ScheduleOverride(
            schedule_id=other_schedule.id,
            original_date=(datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"),
            replacement_date=(datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d"),
            new_start_time="14:00",
            new_end_time="16:00",
            new_room="I909",
            reason="Other dosen's override",
            created_by_user_id=other_dosen.id
        )
        test_db.add(override)
        test_db.commit()
        test_db.refresh(override)
        
        first_dosen_token = create_access_token({"sub": "dosen@test.com"})
        
        response = client.delete(
            f"/api/schedules/overrides/{override.id}",
            headers={"Authorization": f"Bearer {first_dosen_token}"}
        )
        assert response.status_code in [403, 404]


class TestStudentView:
    
    def test_student_view_enrolled_schedules(self, client, mahasiswa_token, enrolled_student):
        response = client.get(
            "/api/schedules/student/my",
            headers={"Authorization": f"Bearer {mahasiswa_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_student_cannot_view_unenrolled_schedules(self, client, mahasiswa_token, test_db):
        from app.models import User, Lecturer, Course, Schedule
        from app.auth import hash_password
        
        other_dosen = User(
            name="Other Dosen 2",
            email="otherdosen2@test.com",
            password=hash_password("password123"),
            role="dosen"
        )
        test_db.add(other_dosen)
        test_db.commit()
        
        other_lecturer = Lecturer(
            user_id=other_dosen.id,
            nip="7777777777",
            name="Other Dosen 2"
        )
        test_db.add(other_lecturer)
        test_db.commit()
        
        unenrolled_course = Course(
            code="CS777",
            name="Unenrolled Course",
            lecturer_id=other_lecturer.id,
            credits=3
        )
        test_db.add(unenrolled_course)
        test_db.commit()
        
        response = client.get(
            "/api/schedules/student/my",
            headers={"Authorization": f"Bearer {mahasiswa_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        schedule_course_ids = [s["course_id"] for s in data]
        assert unenrolled_course.id not in schedule_course_ids


class TestLecturerView:
    
    def test_lecturer_view_own_schedules(self, client, dosen_token, sample_schedule):
        response = client.get(
            "/api/schedules/my",
            headers={"Authorization": f"Bearer {dosen_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
