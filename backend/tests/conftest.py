import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

# Kunci khusus test (bukan rahasia); nilai asli tetap dari backend/.env jika ada.
os.environ.setdefault("SECRET_KEY", "test-only-not-a-secret")

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
from faker import Faker

from app.main import app
from app.models import Base
from app.database import get_db
from app.auth import create_access_token, hash_password

fake = Faker()

SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def test_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(test_db):
    def override_get_db():
        try:
            yield test_db
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def admin_user(test_db):
    from app.models import User
    admin = User(
        name="Admin User",
        email="admin@test.com",
        password=hash_password("admin123"),
        role="admin"
    )
    test_db.add(admin)
    test_db.commit()
    test_db.refresh(admin)
    return admin


@pytest.fixture
def admin_token(admin_user):
    return create_access_token({"sub": admin_user.email})


@pytest.fixture
def dosen_user(test_db):
    from app.models import User, Lecturer
    dosen = User(
        name="Dosen Test",
        email="dosen@test.com",
        password=hash_password("dosen123"),
        role="dosen"
    )
    test_db.add(dosen)
    test_db.commit()
    test_db.refresh(dosen)
    
    lecturer = Lecturer(
        user_id=dosen.id,
        nip="1234567890",
        name="Dosen Test"
    )
    test_db.add(lecturer)
    test_db.commit()
    test_db.refresh(lecturer)
    
    return dosen


@pytest.fixture
def dosen_token(dosen_user):
    return create_access_token({"sub": dosen_user.email})


@pytest.fixture
def mahasiswa_user(test_db):
    from app.models import User, Student
    mahasiswa = User(
        name="Mahasiswa Test",
        email="mahasiswa@test.com",
        password=hash_password("mahasiswa123"),
        role="mahasiswa"
    )
    test_db.add(mahasiswa)
    test_db.commit()
    test_db.refresh(mahasiswa)
    
    student = Student(
        user_id=mahasiswa.id,
        nim="2501234567",
        name="Mahasiswa Test",
        face_embedding=None
    )
    test_db.add(student)
    test_db.commit()
    test_db.refresh(student)
    
    return mahasiswa


@pytest.fixture
def mahasiswa_token(mahasiswa_user):
    return create_access_token({"sub": mahasiswa_user.email})


@pytest.fixture
def sample_course(test_db, dosen_user):
    from app.models import Course, Lecturer
    lecturer = test_db.query(Lecturer).filter(Lecturer.user_id == dosen_user.id).first()
    course = Course(
        code="CS101",
        name="Introduction to Computer Science",
        lecturer_id=lecturer.id,
        credits=3
    )
    test_db.add(course)
    test_db.commit()
    test_db.refresh(course)
    return course


@pytest.fixture
def sample_schedule(test_db, sample_course):
    from app.models import Schedule
    from datetime import time
    schedule = Schedule(
        course_id=sample_course.id,
        day="Senin",
        start_time=time(8, 0),
        end_time=time(10, 0),
        room="A101"
    )
    test_db.add(schedule)
    test_db.commit()
    test_db.refresh(schedule)
    return schedule


@pytest.fixture
def sample_student(test_db, mahasiswa_user):
    from app.models import Student
    return test_db.query(Student).filter(Student.user_id == mahasiswa_user.id).first()


@pytest.fixture
def enrolled_student(test_db, sample_student, sample_course):
    from app.models import Enrollment
    enrollment = Enrollment(
        student_id=sample_student.id,
        course_id=sample_course.id
    )
    test_db.add(enrollment)
    test_db.commit()
    test_db.refresh(enrollment)
    return sample_student


@pytest.fixture
def mock_face_image():
    import base64
    mock_image_bytes = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\x0d\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
    return f"data:image/png;base64,{base64.b64encode(mock_image_bytes).decode()}"


@pytest.fixture
def mock_face_embedding():
    import numpy as np
    return np.random.rand(512).tolist()
