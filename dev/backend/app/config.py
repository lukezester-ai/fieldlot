from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
	model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

	database_url: str = "sqlite:///./fieldlot.db"
	jwt_secret: str = "fieldlot-dev-secret-change-in-production"
	jwt_algorithm: str = "HS256"
	jwt_expire_minutes: int = 60 * 24 * 7
	cors_origins: str = "http://localhost:5174,http://127.0.0.1:5174"
	upload_dir: str = "./uploads"
	max_upload_mb: int = 25

	@property
	def cors_origin_list(self) -> list[str]:
		return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
