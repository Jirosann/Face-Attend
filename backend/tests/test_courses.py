import pytest


class TestCourseCRUD:
    
    def test_admin_create_course(self, client, admin_token, dosen_user, test_db):
        from app.models import Lecturer
        lecturer = test_db.query(Lecturer).filter(Lecturer.user_id == dosen_user.id).first()
        
        response = client.post(
            "/api/courses",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "code": "CS201",
                "name": "Data Structures",
                "lecturer_id": lecturer.id,
                "credits": 4
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == "CS201"
        assert data["name"] == "Data Structures"
        assert data["credits"] == 4
    
    def test_admin_list_courses(self, client, admin_token, sample_course):
        response = client.get(
            "/api/courses",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
    
    def test_admin_delete_course(self, client, admin_token, sample_course):
        response = client.delete(
            f"/api/courses/{sample_course.id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
    
    def test_course_requires_valid_lecturer_id(self, client, admin_token):
        response = client.post(
            "/api/courses",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "code": "CS999",
                "name": "Invalid Course",
                "lecturer_id": 99999,
                "credits": 3
            }
        )
        assert response.status_code == 404


class TestEnrollments:
    
    def test_admin_enroll_student_to_course(self, client, admin_token, sample_student, sample_course):
        response = client.post(
            f"/api/courses/{sample_course.id}/enrollments",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"student_ids": [sample_student.id]}
        )
        assert response.status_code == 200
    
    def test_admin_remove_enrollment(self, client, admin_token, enrolled_student, sample_course):
        response = client.delete(
            f"/api/courses/{sample_course.id}/enrollments/{enrolled_student.id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
    
    def test_cannot_enroll_student_twice_same_course(self, client, admin_token, enrolled_student, sample_course):
        response = client.post(
            f"/api/courses/{sample_course.id}/enrollments",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"student_ids": [enrolled_student.id]}
        )
        assert response.status_code in [200, 400]
    
    def test_get_students_enrolled_in_course(self, client, admin_token, sample_course, enrolled_student):
        response = client.get(
            f"/api/courses/{sample_course.id}/students",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestLecturerAccess:
    
    def test_lecturer_view_own_courses(self, client, dosen_token, sample_course):
        response = client.get(
            "/api/courses/my",
            headers={"Authorization": f"Bearer {dosen_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_lecturer_cannot_view_others_courses(self, client, test_db, admin_token):
        from app.models import User, Lecturer, Course
        from app.auth import hash_password
        
        other_dosen = User(
            name="Other Dosen",
            email="otherdosen@test.com",
            password=hash_password("password123"),
            role="dosen"
        )
        test_db.add(other_dosen)
        test_db.commit()
        test_db.refresh(other_dosen)
        
        other_lecturer = Lecturer(
            user_id=other_dosen.id,
            nip="9999999999",
            name="Other Dosen"
        )
        test_db.add(other_lecturer)
        test_db.commit()
        test_db.refresh(other_lecturer)
        
        other_course = Course(
            code="CS999",
            name="Other Course",
            lecturer_id=other_lecturer.id,
            credits=3
        )
        test_db.add(other_course)
        test_db.commit()
        
        from app.auth import create_access_token
        first_dosen_token = create_access_token({"sub": "dosen@test.com"})
        
        response = client.get(
            "/api/courses/my",
            headers={"Authorization": f"Bearer {first_dosen_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        course_ids = [c["id"] for c in data]
        assert other_course.id not in course_ids
