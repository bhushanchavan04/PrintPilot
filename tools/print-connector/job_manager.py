"""
MyPrint Local Print Connector
Job deduplication manager — prevents accidental duplicate printing
"""

import json
import os
from datetime import datetime, timedelta
from pathlib import Path


class JobManager:
    """
    Tracks processed print jobs to prevent duplicate submissions.
    State is persisted to a local JSON file across restarts.

    IMPORTANT: A job recorded as SUBMITTED means it was sent to the OS print
    queue. This does NOT guarantee physical printing. Always verify physical
    output independently.
    """

    def __init__(self, history_file: str = "job_history.json"):
        self._file = Path(history_file)
        self._jobs: dict = self._load()

    # ── Public API ────────────────────────────────────────────────────────────

    def is_already_processed(self, job_id: str) -> bool:
        """Return True if this job was already submitted to the print queue."""
        entry = self._jobs.get(job_id)
        if not entry:
            return False
        return entry.get("status") in ("SUBMITTED", "COMPLETED")

    def mark_submitted(self, job_id: str, idempotency_key: str) -> None:
        """Record that a job was submitted to the OS print queue."""
        self._jobs[job_id] = {
            "job_id": job_id,
            "idempotency_key": idempotency_key,
            "status": "SUBMITTED",
            "submitted_at": datetime.now().isoformat(),
            "note": "Sent to OS print queue. Physical output not verified.",
        }
        self._save()

    def mark_completed(self, job_id: str) -> None:
        """Mark a job as completed (operator confirmed physical output)."""
        if job_id in self._jobs:
            self._jobs[job_id]["status"] = "COMPLETED"
            self._jobs[job_id]["completed_at"] = datetime.now().isoformat()
            self._save()

    def mark_failed(self, job_id: str, error: str) -> None:
        """Mark a job as failed so it can be retried."""
        self._jobs[job_id] = {
            "job_id": job_id,
            "status": "FAILED",
            "failed_at": datetime.now().isoformat(),
            "error": error,
        }
        self._save()

    def cleanup_old_entries(self, days: int = 7) -> None:
        """Remove entries older than N days to keep the file small."""
        cutoff = datetime.now() - timedelta(days=days)
        to_delete = []
        for job_id, entry in self._jobs.items():
            ts_str = entry.get("submitted_at") or entry.get("failed_at") or ""
            if ts_str:
                try:
                    ts = datetime.fromisoformat(ts_str)
                    if ts < cutoff:
                        to_delete.append(job_id)
                except ValueError:
                    pass
        for job_id in to_delete:
            del self._jobs[job_id]
        if to_delete:
            self._save()

    # ── Private ───────────────────────────────────────────────────────────────

    def _load(self) -> dict:
        try:
            if self._file.exists():
                return json.loads(self._file.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
        return {}

    def _save(self) -> None:
        try:
            self._file.write_text(
                json.dumps(self._jobs, indent=2, ensure_ascii=False),
                encoding="utf-8",
            )
        except OSError as e:
            print(f"[JobManager] Warning: could not save job history: {e}")

