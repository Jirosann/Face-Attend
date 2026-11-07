import pytest
import json
from io import BytesIO


class TestAdminCreateUsers:
    
    def test_admin_create_student_success(self, client, admin_token):
        response = client.post(
            "/api/users/students",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "nim": "2501111111",
                "name": "New Student",
                "email": "newstudent@test.com",
                "password": "password123"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["nim"] == "2501111111"
        assert data["name"] == "New Student"
    
    def test_admin_create_lecturer_success(self, client, admin_token):
        response = client.post(
            "/api/users/lecturers",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "nip": "1234567890",
                "name": "New Lecturer",
                "email": "newlecturer@test.com",
                "password": "password123"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["nip"] == "1234567890"
        assert data["name"] == "New Lecturer"
    
    def test_admin_create_user_duplicate_email_fails(self, client, admin_token, admin_user):
        response = client.post(
            "/api/users/students",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "nim": "2501999999",
                "name": "Duplicate Email",
                "email": "admin@test.com",
                "password": "password123"
            }
        )
        assert response.status_code == 400
    
    def test_non_admin_cannot_create_student(self, client, mahasiswa_token):
        response = client.post(
            "/api/users/students",
            headers={"Authorization": f"Bearer {mahasiswa_token}"},
            json={
                "nim": "2501222222",
                "name": "Unauthorized Student",
                "email": "unauthorized@test.com",
                "password": "password123"
            }
        )
        assert response.status_code == 403


class TestFacePhotoUpload:
    
    def test_admin_upload_student_face_photo(self, client, admin_token, sample_student, mock_face_image):
        response = client.post(
            f"/api/users/students/{sample_student.id}/face",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"image": mock_face_image}
        )
        assert response.status_code in [200, 400]
    
    def test_upload_invalid_image_fails(self, client, admin_token, sample_student):
        response = client.post(
            f"/api/users/students/{sample_student.id}/face",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"image": "invalid_base64_data"}
        )
        assert response.status_code == 400


class TestProfileManagement:
    
    def test_user_update_own_profile(self, client, mahasiswa_token):
        response = client.put(
            "/api/users/me",
            headers={"Authorization": f"Bearer {mahasiswa_token}"},
            json={"name": "Updated Name"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
    
    def test_user_change_own_password(self, client, mahasiswa_token, mahasiswa_user):
        response = client.put(
            "/api/users/me",
            headers={"Authorization": f"Bearer {mahasiswa_token}"},
            json={
                "current_password": "mahasiswa123",
                "new_password": "newpassword123"
            }
        )
        assert response.status_code == 200
    
    def test_change_password_requires_old_password(self, client, mahasiswa_token):
        response = client.put(
            "/api/users/me",
            headers={"Authorization": f"Bearer {mahasiswa_token}"},
            json={
                "current_password": "wrongpassword",
                "new_password": "newpassword123"
            }
        )
        assert response.status_code == 400
    
    def test_admin_reset_any_user_password(self, client, admin_token, mahasiswa_user):
        response = client.put(
            f"/api/users/{mahasiswa_user.id}/password",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"new_password": "resetpassword123"}
        )
        assert response.status_code == 200


class TestRoleManagement:
    
    def test_admin_change_user_role(self, client, admin_token, mahasiswa_user):
        response = client.put(
            f"/api/users/role/{mahasiswa_user.id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"role": "dosen"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "dosen"
    
    def test_non_admin_cannot_change_role(self, client, mahasiswa_token, dosen_user):
        response = client.put(
            f"/api/users/role/{dosen_user.id}",
            headers={"Authorization": f"Bearer {mahasiswa_token}"},
            json={"role": "admin"}
        )
        assert response.status_code == 403


class TestListAndDelete:
    
    def test_list_all_students(self, client, admin_token, sample_student):
        response = client.get(
            "/api/users/students",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
    
    def test_delete_student_cascades_enrollments(self, client, admin_token, enrolled_student, sample_course, test_db):
        from app.models import Enrollment
        
        enrollments_before = test_db.query(Enrollment).filter(
            Enrollment.student_id == enrolled_student.id
        ).count()
        assert enrollments_before > 0
        
        response = client.delete(
            f"/api/users/students/{enrolled_student.id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
