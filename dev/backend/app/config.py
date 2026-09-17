from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


DEFAULT_JWT_SECRET = "fieldlot-dev-secret-change-in-production"


class Settings(BaseSettings):
	model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

	environment: str = "development"
	database_url: str = "sqlite:///./fieldlot.db"
	jwt_secret: str = DEFAULT_JWT_SECRET
	jwt_algorithm: str = "HS256"
	jwt_expire_minutes: int = 60 * 24 * 7
	cors_origins: str = "http://localhost:5174,http://127.0.0.1:5174"
	upload_dir: str = "./uploads"
	max_upload_mb: int = 25

	@property
	def cors_origin_list(self) -> list[str]:
		return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

	@model_validator(mode="after")
	def validate_production_secrets(self):
		if self.environment.lower() == "production" and self.jwt_secret == DEFAULT_JWT_SECRET:
			raise ValueError("JWT_SECRET must be configured for production")
		return self


settings = Settings()
