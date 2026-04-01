from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "AisleIQ Backend"
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "aisleiq_db"

    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
