"""Centralized configuration via pydantic-settings."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file="../.env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Supabase
    supabase_url: str
    supabase_secret_key: str

    # Oanda
    oanda_api_url: str = "https://api-fxpractice.oanda.com"
    oanda_account_id: str
    oanda_api_token: str

    # LLM
    openai_api_key: str = ""
    anthropic_api_key: str = ""

    # External data
    tavily_api_key: str = ""
    newsapi_key: str = ""

    # Engine
    tick_interval_seconds: float = 5.0
    log_level: str = "INFO"


settings = Settings()  # type: ignore[call-arg]
