"""Application configuration."""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    app_name: str = "Smart Task Planner"
    debug: bool = True

    # Database
    database_url: str = "sqlite:///./task_planner.db"

    # Gemini API
    gemini_api_key: str = ""
    llm_model: str = "gemini-2.5-flash"

    # API Settings
    api_prefix: str = "/api"

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()