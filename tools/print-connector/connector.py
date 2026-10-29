"""
MyPrint Local Print Connector
Core connector class
"""

import os
import sys
import time
import platform
import requests
import logging
from pathlib import Path

from config import Config
from job_manager import JobManager
from logger import JobLogger

logger = logging.getLogger("myprint")


class PrintConnector:
    """
    Connects to the MyPrint backend, polls for print jobs,
    downloads documents, and submits them to the local printer.
    """

    def __init__(self, config: Config):
        self.config = config
        self.job_manager = JobManager()
        self.job_logger = JobLogger(logger)
        self.auth_cookie: str = ""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self._running = False

        # Ensure temp directory exists
        Path(config.temp_dir).mkdir(parents=True, exist_ok=True)

    # ── Authentication ────────────────────────────────────────────────────────

    def authenticate(self) -> bool:
        """Log in to the backend and store the session cookie."""
        try:
            resp = self.session.post(
                f"{self.config.backend_url}/api/auth/login",
                json={
                    "email": self.config.shop_email,
                    "password": self.config.shop_password,
                },
                timeout=10,
            )
            if resp.status_code == 200:
                # Cookie is set automatically on the session
                logger.info("✔ Authenticated with MyPrint backend")
                return True
            else:
                logger.error(f"Authentication failed: {resp.status_code} — {resp.text[:200]}")
                return False
        except requests.exceptions.ConnectionError:
            logger.error(f"Cannot connect to backend at {self.config.backend_url}")
            return False
        except Exception as e:
            logger.error(f"Authentication error: {e}")
            return False

    # ── Printer registration ──────────────────────────────────────────────────

    def register_printers(self) -> bool:
        """Discover local printers and register them with the backend."""
        try:
            from printer_utils import get_installed_printers
            printers = get_installed_printers()
        except Exception as e:
            logger.warning(f"Could not discover printers: {e}")
            printers = []

        if not printers:
            logger.warning("No printers found. The connector will still poll for jobs.")
        else:
            logger.info(f"Found {len(printers)} printer(s): {[p['name'] for p in printers]}")

        try:
            resp = self.session.post(
                f"{self.config.backend_url}/api/connector/register",
                json={
                    "connectorId": self.config.connector_id,
                    "connectorVersion": "1.0.0",
                    "os": sys.platform,
                    "hostname": platform.node(),
                    "printers": printers,
                },
                timeout=10,
            )
            if resp.status_code in (200, 201):
                logger.info("✔ Printers registered with backend")
                return True
            else:
                logger.warning(f"Printer registration failed (non-fatal): {resp.status_code}")
                return False
        except Exception as e:
            logger.warning(f"Printer registration error (non-fatal): {e}")
            return False

    # ── Job polling ───────────────────────────────────────────────────────────

    def poll_for_jobs(self) -> list[dict]:
        """Fetch pending print jobs from the backend."""
        try:
            resp = self.session.get(
                f"{self.config.backend_url}/api/connector/jobs",
                timeout=15,
            )
            if resp.status_code == 401:
                logger.info("Session expired — re-authenticating…")
                self.authenticate()
                return []
            if resp.status_code == 200:
                return resp.json().get("jobs", [])
            return []
        except requests.exceptions.ConnectionError:
            logger.warning("Backend unreachable — will retry")
            return []
        except Exception as e:
            logger.error(f"Poll error: {e}")
            return []

    # ── Job processing ────────────────────────────────────────────────────────

    def process_job(self, job: dict) -> None:
        """Download, print, and report status for a single job."""
        job_id = job["jobId"]
        order_number = job.get("orderNumber", "?")
        files = job.get("files", [])
        printer_name = job.get("printerName") or self._get_default_printer()

        self.job_logger.received(job_id, order_number)

        # Duplicate prevention
        if self.job_manager.is_already_processed(job_id):
            self.job_logger.skipped(job_id, "Already submitted — skipping to prevent duplicate print")
            return

        try:
            # Process each file in the job
            for file_info in files:
                file_name = file_info.get("originalName", "document.pdf")
                download_url = file_info.get("downloadUrl")
                print_settings = file_info.get("printSettings") or {}

                if not download_url:
                    raise ValueError(f"No download URL for file: {file_name}")

                self.job_logger.downloading(job_id, file_name)
                local_path = self.download_document(job_id, download_url, file_name)

                try:
                    self.job_logger.printing(job_id, printer_name or "default")
                    success = self._print_file(local_path, printer_name, print_settings)

                    if not success:
                        raise RuntimeError("Print submission to OS queue failed")

                    # Mark as submitted (NOT physically printed — just in OS queue)
                    self.job_manager.mark_submitted(job_id, job.get("idempotencyKey", job_id))
                    self.job_logger.submitted(job_id)
                    self.update_job_status(job_id, "SUBMITTED_TO_QUEUE")

                finally:
                    # Always delete temp file
                    self.cleanup_temp_file(local_path)

        except Exception as e:
            error_msg = str(e)
            self.job_logger.failed(job_id, error_msg)
            self.job_manager.mark_failed(job_id, error_msg)
            self.update_job_status(job_id, "FAILED", error=error_msg)

    def download_document(self, job_id: str, url: str, file_name: str) -> str:
        """
        Download a document from the signed URL to a temp file.
        Returns the local file path.
        """
        safe_name = "".join(c for c in file_name if c.isalnum() or c in "._-")[:64]
        local_path = os.path.join(self.config.temp_dir, f"{job_id[:8]}_{safe_name}")

        resp = requests.get(url, stream=True, timeout=60)
        resp.raise_for_status()

        with open(local_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)

        logger.debug(f"Downloaded to: {local_path} ({os.path.getsize(local_path)} bytes)")
        return local_path

    def _print_file(self, file_path: str, printer_name: str, settings: dict) -> bool:
        """Submit a file to the printer via the best available method."""
        try:
            from printer_utils import print_pdf_sumatra
            return print_pdf_sumatra(file_path, printer_name, settings)
        except ImportError:
            logger.error("printer_utils not available (non-Windows system?)")
            return False

    def cleanup_temp_file(self, file_path: str) -> None:
        """Securely delete a temporary document file."""
        try:
            from printer_utils import secure_delete
            secure_delete(file_path)
        except Exception as e:
            logger.warning(f"Could not clean up temp file {file_path}: {e}")

    def update_job_status(self, job_id: str, status: str, error: str = None) -> None:
        """Report job status back to the backend."""
        try:
            payload: dict = {"status": status}
            if error:
                payload["error"] = error

            resp = self.session.patch(
                f"{self.config.backend_url}/api/connector/jobs/{job_id}/status",
                json=payload,
                timeout=10,
            )
            if resp.status_code not in (200, 201):
                logger.warning(f"Status update failed for job {job_id}: {resp.status_code}")
        except Exception as e:
            logger.warning(f"Could not update job status: {e}")

    def _get_default_printer(self) -> str:
        """Get the OS default printer name."""
        try:
            from printer_utils import get_default_printer_name
            return get_default_printer_name()
        except Exception:
            return ""

    # ── Main loop ─────────────────────────────────────────────────────────────

    def run_polling_loop(self) -> None:
        """
        Main polling loop. Continuously checks for new jobs and processes them.
        Uses exponential backoff on connection failures.
        """
        self._running = True
        backoff = self.config.poll_interval
        max_backoff = 300  # 5 minutes

        logger.info(f"🚀 Connector started. Polling every {self.config.poll_interval}s")
        logger.info(f"   Backend: {self.config.backend_url}")

        while self._running:
            try:
                jobs = self.poll_for_jobs()

                if jobs:
                    logger.info(f"📋 {len(jobs)} job(s) received")
                    for job in jobs:
                        if not self._running:
                            break
                        try:
                            self.process_job(job)
                        except Exception as e:
                            logger.error(f"Unexpected error processing job: {e}")

                    backoff = self.config.poll_interval  # Reset on success
                else:
                    logger.debug("No pending jobs")

                time.sleep(self.config.poll_interval)

            except KeyboardInterrupt:
                logger.info("Shutting down…")
                self._running = False
                break
            except Exception as e:
                logger.error(f"Polling error: {e}")
                logger.info(f"Retrying in {backoff}s…")
                time.sleep(backoff)
                backoff = min(backoff * 2, max_backoff)

                # Re-authenticate on long backoffs
                if backoff > 30:
                    self.authenticate()

    def stop(self) -> None:
        self._running = False

