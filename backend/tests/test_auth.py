import pytest
from app.auth import verify_password, hash_password, create_access_token, decode_access_token
from jose import jwt
from datetime import timedelta


class TestPasswordHashing:
    
    def test_password_is_hashed_with_bcrypt(self):
        password = "testpassword123"
        hashed = hash_password(password)
        assert hashed != password
        assert hashed.startswith("$2b$")
    
    def test_password_verification_correct(self):
        password = "testpassword123"
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True
    
    def test_password_verification_incorrect(self):
        password = "testpassword123"
        wrong_password = "wrongpassword"
        hashed = hash_password(password)
        assert verify_password(wrong_password, hashed) is False


class TestJWTToken:
    
    def test_create_access_token(self):
        data = {"sub": "test@example.com"}
        token = create_access_token(data)
        assert isinstance(token, str)
        assert len(token) > 0
    
    def test_decode_valid_token(self):
        data = {"sub": "test@example.com"}
        token = create_access_token(data)
        decoded = decode_access_token(token)
        assert decoded is not None
        assert decoded["sub"] == "test@example.com"
    
    def test_decode_invalid_token(self):
        invalid_token = "invalid.token.here"
        decoded = decode_access_token(invalid_token)
        assert decoded is None
    
    def test_decode_expired_token(self):
        data = {"sub": "test@example.com"}
        token = create_access_token(data, expires_delta=timedelta(seconds=-1))
        decoded = decode_access_token(token)
        assert decoded is None


class TestLoginFlow:
    
    def test_login_success_returns_token(self, client, admin_user):
        response = client.post(
            "/api/auth/login",
            json={"email": "admin@test.com", "password": "admin123"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
    
    def test_login_invalid_email(self, client):
        response = client.post(
            "/api/auth/login",
            json={"email": "nonexistent@test.com", "password": "password123"}
        )
        assert response.status_code == 401
    
    def test_login_invalid_password(self, client, admin_user):
        response = client.post(
            "/api/auth/login",
            json={"email": "admin@test.com", "password": "wrongpassword"}
        )
        assert response.status_code == 401
    
    def test_login_returns_user_info(self, client, admin_user):
        response = client.post(
            "/api/auth/login",
            json={"email": "admin@test.com", "password": "admin123"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "admin"
        assert "name" in data or "email" in data


class TestAuthorization:
    
    def test_get_current_user_from_valid_token(self, client, admin_token):
        response = client.get(
            "/api/users/me",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "admin@test.com"
