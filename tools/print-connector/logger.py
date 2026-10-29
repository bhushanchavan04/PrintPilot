"""
MyPrint Local Print Connector
Colored logger setup
"""

import logging
import sys
from datetime import datetime

try:
    from colorama import Fore, Style, init
    init(autoreset=True)
    HAS_COLOR = True
except ImportError:
    HAS_COLOR = False


class ColorFormatter(logging.Formatter):
    COLORS = {
        logging.DEBUG:   "\033[36m",   # Cyan
        logging.INFO:    "\033[32m",   # Green
        logging.WARNING: "\033[33m",   # Yellow
        logging.ERROR:   "\033[31m",   # Red
        logging.CRITICAL:"\033[35m",   # Magenta
    }
    RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelno, self.RESET) if HAS_COLOR else ""
        reset = self.RESET if HAS_COLOR else ""
        time_str = datetime.now().strftime("%H:%M:%S")
        level = record.levelname[:4]
        return f"{color}[{time_str}] [{level}] {record.getMessage()}{reset}"


def setup_logger(log_level: str = "INFO") -> logging.Logger:
    """Set up and return the application logger."""
    logger = logging.getLogger("myprint")
    logger.setLevel(getattr(logging, log_level, logging.INFO))

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(ColorFormatter())
        logger.addHandler(handler)

    return logger


class JobLogger:
    """Structured logger for print job lifecycle events."""

    def __init__(self, logger: logging.Logger):
        self._log = logger

    def received(self, job_id: str, order_number: str) -> None:
        self._log.info(f"📥 Job received | job={job_id[:8]} | order={order_number}")

    def downloading(self, job_id: str, file_name: str) -> None:
        self._log.info(f"⬇  Downloading  | job={job_id[:8]} | file={file_name}")

    def printing(self, job_id: str, printer: str) -> None:
        self._log.info(f"🖨  Printing     | job={job_id[:8]} | printer={printer}")

    def submitted(self, job_id: str) -> None:
        self._log.info(f"✅ Submitted     | job={job_id[:8]} | Sent to OS queue (physical output not verified)")

    def completed(self, job_id: str) -> None:
        self._log.info(f"✔  Done          | job={job_id[:8]}")

    def failed(self, job_id: str, error: str) -> None:
        self._log.error(f"❌ Failed        | job={job_id[:8]} | error={error}")

    def skipped(self, job_id: str, reason: str) -> None:
        self._log.warning(f"⚠  Skipped       | job={job_id[:8]} | reason={reason}")

