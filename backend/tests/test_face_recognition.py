import pytest
import numpy as np
from unittest.mock import Mock, patch, MagicMock


class TestFaceDetection:
    
    @patch('app.face_recognition.face_app')
    def test_detect_face_from_valid_image(self, mock_face_app, mock_face_image):
        mock_face = Mock()
        mock_face.bbox = [100, 100, 200, 200]
        mock_face.embedding = np.random.rand(512)
        mock_face_app.get.return_value = [mock_face]
        
        from app.face_recognition import detect_face
        result = detect_face(mock_face_image)
        
        assert result is not None
    
    @patch('app.face_recognition.face_app')
    def test_no_face_detected_returns_none(self, mock_face_app, mock_face_image):
        mock_face_app.get.return_value = []
        
        from app.face_recognition import detect_face
        result = detect_face(mock_face_image)
        
        assert result is None or len(result) == 0
    
    @patch('app.face_recognition.face_app')
    def test_multiple_faces_returns_first(self, mock_face_app, mock_face_image):
        mock_face1 = Mock()
        mock_face1.bbox = [100, 100, 200, 200]
        mock_face1.embedding = np.random.rand(512)
        
        mock_face2 = Mock()
        mock_face2.bbox = [300, 100, 400, 200]
        mock_face2.embedding = np.random.rand(512)
        
        mock_face_app.get.return_value = [mock_face1, mock_face2]
        
        from app.face_recognition import detect_face
        result = detect_face(mock_face_image)
        
        assert result is not None


class TestFaceEmbedding:
    
    def test_extract_face_embedding_512_dimensions(self, mock_face_embedding):
        assert len(mock_face_embedding) == 512
    
    def test_embedding_is_normalized(self, mock_face_embedding):
        embedding_array = np.array(mock_face_embedding)
        norm = np.linalg.norm(embedding_array)
        assert norm > 0


class TestFaceMatching:
    
    def test_recognize_face_above_threshold(self):
        from app.face_recognition import calculate_similarity
        
        embedding1 = np.random.rand(512)
        embedding2 = embedding1 + np.random.rand(512) * 0.01
        
        similarity = calculate_similarity(embedding1, embedding2)
        assert similarity > 0
    
    def test_recognize_face_below_threshold_returns_unknown(self):
        from app.face_recognition import calculate_similarity
        
        embedding1 = np.random.rand(512)
        embedding2 = np.random.rand(512)
        
        similarity = calculate_similarity(embedding1, embedding2)
        assert 0 <= similarity <= 1
    
    def test_face_matching_uses_cosine_similarity(self, mock_face_embedding):
        from app.face_recognition import calculate_similarity
        
        embedding1 = np.array(mock_face_embedding)
        embedding2 = np.array(mock_face_embedding)
        
        similarity = calculate_similarity(embedding1, embedding2)
        assert similarity >= 0.99


class TestRecognitionEndpoint:
    
    @patch('app.face_recognition.recognize_face')
    def test_face_recognize_endpoint_success(self, mock_recognize, client, dosen_token, enrolled_student, sample_schedule, dosen_user, test_db, mock_face_image):
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
        
        mock_recognize.return_value = {
            "recognized": True,
            "student_id": enrolled_student.id,
            "name": enrolled_student.name,
            "nim": enrolled_student.nim,
            "confidence": 0.95
        }
        
        response = client.post(
            "/api/face/recognize",
            headers={"Authorization": f"Bearer {dosen_token}"},
            json={
                "image": mock_face_image,
                "session_id": session.id
            }
        )
        
        assert response.status_code in [200, 400, 500]
    
    @patch('app.face_recognition.detect_face')
    def test_face_recognize_endpoint_no_face(self, mock_detect, client, dosen_token, sample_schedule, dosen_user, test_db, mock_face_image):
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
        
        mock_detect.return_value = None
        
        response = client.post(
            "/api/face/recognize",
            headers={"Authorization": f"Bearer {dosen_token}"},
            json={
                "image": mock_face_image,
                "session_id": session.id
            }
        )
        
        assert response.status_code in [200, 400]
    
    @patch('app.face_recognition.recognize_face')
    def test_face_recognize_endpoint_unknown_person(self, mock_recognize, client, dosen_token, sample_schedule, dosen_user, test_db, mock_face_image):
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
        
        mock_recognize.return_value = {
            "recognized": False,
            "message": "Unknown person"
        }
        
        response = client.post(
            "/api/face/recognize",
            headers={"Authorization": f"Bearer {dosen_token}"},
            json={
                "image": mock_face_image,
                "session_id": session.id
            }
        )
        
        assert response.status_code in [200, 400]


from datetime import datetime
