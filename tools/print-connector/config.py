"""
MyPrint Local Print Connector
Configuration loader
"""

import os
import json
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

STATE_FILE = Path("connector_state.json")


@dataclass
class Config:
    backend_url: str
    shop_email: str
    shop_password: str
    shop_id: str
    connector_id: str
    poll_interval: int
    max_retry_attempts: int
    log_level: str
    temp_dir: str


def load_config() -> Config:
    """Load configuration from .env file and state file."""
    connector_id = load_connector_id() or str(uuid.uuid4())
    save_connector_id(connector_id)

    return Config(
        backend_url=os.getenv("BACKEND_URL", "http://localhost:3000").rstrip("/"),
        shop_email=os.getenv("SHOP_EMAIL", ""),
        shop_password=os.getenv("SHOP_PASSWORD", ""),
        shop_id=os.getenv("SHOP_ID", ""),
        connector_id=connector_id,
        poll_interval=int(os.getenv("POLL_INTERVAL_SECONDS", "5")),
        max_retry_attempts=int(os.getenv("MAX_RETRY_ATTEMPTS", "3")),
        log_level=os.getenv("LOG_LEVEL", "INFO").upper(),
        temp_dir=os.getenv("TEMP_DIR", "./temp_docs"),
    )


def save_connector_id(connector_id: str) -> None:
    """Persist connector ID to state file."""
    try:
        state = {}
        if STATE_FILE.exists():
            state = json.loads(STATE_FILE.read_text())
        state["connector_id"] = connector_id
        STATE_FILE.write_text(json.dumps(state, indent=2))
    except Exception:
        pass


def load_connector_id() -> str | None:
    """Load persisted connector ID from state file."""
    try:
        if STATE_FILE.exists():
            state = json.loads(STATE_FILE.read_text())
            return state.get("connector_id")
    except Exception:
        pass
    return None

