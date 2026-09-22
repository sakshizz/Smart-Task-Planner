"""API tests for Smart Task Planner."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.main import app
from backend.database import Base, get_db
from backend.models import Goal, Task, TaskStatus, Priority


# Test database setup
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///./test_task_planner.db"
engine = create_engine(SQLALCHEMY_TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    """Override database dependency for testing."""
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_database():
    """Create and tear down test database."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


class TestHealthEndpoints:
    """Test health check endpoints."""
    
    def test_root(self):
        """Test root endpoint."""
        response = client.get("/")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"
    
    def test_health_check(self):
        """Test health check endpoint."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "database" in data


class TestGoalEndpoints:
    """Test goal-related endpoints."""
    
    def test_create_goal(self):
        """Test creating a new goal."""
        response = client.post(
            "/api/goals",
            json={
                "goal": "Build a simple web application",
                "context": "Using Python and FastAPI",
                "deadline_days": 14
            }
        )
        assert response.status_code == 201
        data = response.json()
        
        assert "goal_id" in data
        assert data["goal_text"] == "Build a simple web application"
        assert "tasks" in data
        assert len(data["tasks"]) > 0
        assert "reasoning" in data
    
    def test_create_goal_without_deadline(self):
        """Test creating a goal without deadline."""
        response = client.post(
            "/api/goals",
            json={"goal": "Learn a new programming language"}
        )
        assert response.status_code == 201
        assert response.json()["deadline"] is None
    
    def test_create_goal_invalid(self):
        """Test creating a goal with invalid data."""
        response = client.post(
            "/api/goals",
            json={"goal": "Hi"}  # Too short
        )
        assert response.status_code == 422  # Validation error
    
    def test_list_goals(self):
        """Test listing all goals."""
        # Create a goal first
        client.post("/api/goals", json={"goal": "Test goal for listing"})
        
        response = client.get("/api/goals")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
    
    def test_get_goal(self):
        """Test getting a specific goal."""
        # Create a goal
        create_response = client.post(
            "/api/goals",
            json={"goal": "Test goal for retrieval"}
        )
        goal_id = create_response.json()["goal_id"]
        
        response = client.get(f"/api/goals/{goal_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == goal_id
        assert "tasks" in data
    
    def test_get_goal_not_found(self):
        """Test getting a non-existent goal."""
        response = client.get("/api/goals/99999")
        assert response.status_code == 404
    
    def test_delete_goal(self):
        """Test deleting a goal."""
        # Create a goal
        create_response = client.post(
            "/api/goals",
            json={"goal": "Goal to be deleted"}
        )
        goal_id = create_response.json()["goal_id"]
        
        # Delete it
        response = client.delete(f"/api/goals/{goal_id}")
        assert response.status_code == 204
        
        # Verify it's deleted
        get_response = client.get(f"/api/goals/{goal_id}")
        assert get_response.status_code == 404
    
    def test_get_goal_stats(self):
        """Test getting goal statistics."""
        # Create a goal
        create_response = client.post(
            "/api/goals",
            json={"goal": "Goal for stats testing"}
        )
        goal_id = create_response.json()["goal_id"]
        
        response = client.get(f"/api/goals/{goal_id}/stats")
        assert response.status_code == 200
        data = response.json()
        
        assert "total_tasks" in data
        assert "completed_tasks" in data
        assert "completion_percentage" in data


class TestTaskEndpoints:
    """Test task-related endpoints."""
    
    def test_update_task_status(self):
        """Test updating a task's status."""
        # Create a goal with tasks
        create_response = client.post(
            "/api/goals",
            json={"goal": "Goal with tasks to update"}
        )
        task_id = create_response.json()["tasks"][0]["id"]
        
        response = client.patch(
            f"/api/tasks/{task_id}",
            json={"status": "in_progress"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == "in_progress"
    
    def test_complete_task(self):
        """Test marking a task as completed."""
        # Create a goal
        create_response = client.post(
            "/api/goals",
            json={"goal": "Goal with task to complete"}
        )
        task_id = create_response.json()["tasks"][0]["id"]
        
        response = client.post(f"/api/tasks/{task_id}/complete")
        assert response.status_code == 200
        assert response.json()["status"] == "completed"
    
    def test_start_task(self):
        """Test marking a task as in progress."""
        # Create a goal
        create_response = client.post(
            "/api/goals",
            json={"goal": "Goal with task to start"}
        )
        task_id = create_response.json()["tasks"][0]["id"]
        
        response = client.post(f"/api/tasks/{task_id}/start")
        assert response.status_code == 200
        assert response.json()["status"] == "in_progress"
    
    def test_update_task_not_found(self):
        """Test updating a non-existent task."""
        response = client.patch(
            "/api/tasks/99999",
            json={"status": "completed"}
        )
        assert response.status_code == 404


class TestLLMIntegration:
    """Test LLM-generated content."""
    
    def test_generated_tasks_have_required_fields(self):
        """Test that generated tasks have all required fields."""
        response = client.post(
            "/api/goals",
            json={
                "goal": "Create a mobile app",
                "deadline_days": 30
            }
        )
        
        assert response.status_code == 201
        tasks = response.json()["tasks"]
        
        for task in tasks:
            assert "id" in task
            assert "title" in task
            assert "description" in task
            assert "priority" in task
            assert "status" in task
            assert "estimated_hours" in task
            assert "deadline" in task
    
    def test_task_dependencies_are_valid(self):
        """Test that task dependencies reference valid tasks."""
        response = client.post(
            "/api/goals",
            json={"goal": "Build a complex system"}
        )
        
        tasks = response.json()["tasks"]
        task_ids = [t["id"] for t in tasks]
        
        for task in tasks:
            for dep_id in task["dependencies"]:
                # Dependencies should reference earlier tasks
                assert dep_id in task_ids


if __name__ == "__main__":
    pytest.main([__file__, "-v"])