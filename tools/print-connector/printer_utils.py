"""
MyPrint Local Print Connector
Windows printing utilities

IMPORTANT LIMITATIONS:
- Requires Windows with win32print installed (pywin32 package)
- Submitting a job to the OS print queue does NOT guarantee physical printing
- Physical output depends on: printer being online, paper loaded, no hardware errors
- Always verify physical output independently
"""

import os
import sys
import subprocess
import tempfile
import logging
from pathlib import Path

logger = logging.getLogger("myprint")

# ── Platform guard ────────────────────────────────────────────────────────────

if sys.platform != "win32":
    raise RuntimeError(
        "MyPrint Local Print Connector only supports Windows.\n"
        "Linux/Mac support via CUPS is planned for a future release."
    )

try:
    import win32print
    import win32api
    WIN32_AVAILABLE = True
except ImportError:
    WIN32_AVAILABLE = False
    logger.warning(
        "pywin32 not installed. Printer discovery and win32print will be unavailable. "
        "Run: pip install pywin32"
    )


# ── Printer discovery ─────────────────────────────────────────────────────────

def get_installed_printers() -> list[dict]:
    """
    Return a list of installed printers with their capabilities.
    Each dict contains: name, systemName, isDefault, supportsColor,
    supportsDuplex, paperSizes.
    """
    if not WIN32_AVAILABLE:
        return []

    printers = []
    default_printer = ""

    try:
        default_printer = win32print.GetDefaultPrinter()
    except Exception:
        pass

    try:
        printer_list = win32print.EnumPrinters(
            win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS,
            None, 2
        )
    except Exception as e:
        logger.error(f"Could not enumerate printers: {e}")
        return []

    for p_info in printer_list:
        name = p_info.get("pPrinterName", "")
        if not name:
            continue

        supports_color = False
        supports_duplex = False
        paper_sizes = ["A4"]

        try:
            handle = win32print.OpenPrinter(name)
            try:
                dev_caps = win32print.GetPrinter(handle, 2)
                # Color capability: dm_color field (1=mono, 2=color)
                color_val = getattr(dev_caps.get("pDevMode", None), "Color", 1)
                supports_color = (color_val == 2)
                # Duplex capability
                duplex_val = getattr(dev_caps.get("pDevMode", None), "Duplex", 1)
                supports_duplex = (duplex_val in (2, 3))
            finally:
                win32print.ClosePrinter(handle)
        except Exception:
            # Fall back to defaults if we can't query capabilities
            pass

        printers.append({
            "name": name,
            "systemName": name,
            "isDefault": name == default_printer,
            "supportsColor": supports_color,
            "supportsDuplex": supports_duplex,
            "paperSizes": paper_sizes,
        })

    return printers


def get_default_printer_name() -> str:
    """Return the system default printer name, or empty string."""
    if not WIN32_AVAILABLE:
        return ""
    try:
        return win32print.GetDefaultPrinter()
    except Exception:
        return ""


# ── Printer status ────────────────────────────────────────────────────────────

def get_printer_status(printer_name: str) -> dict:
    """
    Query printer status flags.
    Returns: { is_online: bool, is_paper_out: bool, has_error: bool, status_text: str }
    Status check is best-effort — not all printers report all states via win32.
    """
    if not WIN32_AVAILABLE or not printer_name:
        return {"is_online": True, "is_paper_out": False, "has_error": False, "status_text": "Unknown"}

    try:
        handle = win32print.OpenPrinter(printer_name)
        try:
            info = win32print.GetPrinter(handle, 2)
            status = info.get("Status", 0)
        finally:
            win32print.ClosePrinter(handle)

        # Status bit flags (Win32 PRINTER_STATUS_*)
        OFFLINE    = 0x00000080
        PAPER_OUT  = 0x00000010
        ERROR      = 0x00000002
        PRINTING   = 0x00000400

        is_offline   = bool(status & OFFLINE)
        is_paper_out = bool(status & PAPER_OUT)
        has_error    = bool(status & ERROR)
        is_printing  = bool(status & PRINTING)

        if status == 0:
            status_text = "Ready"
        elif is_offline:
            status_text = "Offline"
        elif is_paper_out:
            status_text = "Paper out"
        elif has_error:
            status_text = "Error"
        elif is_printing:
            status_text = "Printing"
        else:
            status_text = f"Status 0x{status:04x}"

        return {
            "is_online": not is_offline and not has_error,
            "is_paper_out": is_paper_out,
            "has_error": has_error,
            "status_text": status_text,
        }

    except Exception as e:
        logger.warning(f"Could not get printer status for '{printer_name}': {e}")
        return {"is_online": True, "is_paper_out": False, "has_error": False, "status_text": "Unknown"}


# ── SumatraPDF detection ──────────────────────────────────────────────────────

SUMATRA_LOCATIONS = [
    r"C:\Program Files\SumatraPDF\SumatraPDF.exe",
    r"C:\Program Files (x86)\SumatraPDF\SumatraPDF.exe",
    r"C:\Users\{username}\AppData\Local\SumatraPDF\SumatraPDF.exe",
    "SumatraPDF.exe",  # if on PATH
]

def find_sumatra_pdf() -> str | None:
    """Find SumatraPDF.exe. Returns full path or None."""
    username = os.environ.get("USERNAME", "")
    for loc in SUMATRA_LOCATIONS:
        path = loc.replace("{username}", username)
        try:
            result = subprocess.run(
                [path, "-version"],
                capture_output=True, timeout=3
            )
            if result.returncode == 0 or b"SumatraPDF" in result.stdout:
                return path
        except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
            continue
    return None


# ── Printing ──────────────────────────────────────────────────────────────────

def print_pdf_sumatra(pdf_path: str, printer_name: str, settings: dict) -> bool:
    """
    Print a PDF silently using SumatraPDF command-line.

    Returns True if the command exited without error (meaning the job was
    submitted to the OS queue). Does NOT mean the document was physically printed.

    Falls back automatically if SumatraPDF is not installed.
    """
    sumatra = find_sumatra_pdf()
    if not sumatra:
        logger.info("SumatraPDF not found, falling back to ShellExecute")
        return print_pdf_win32(pdf_path, printer_name)

    # Build print settings string for SumatraPDF
    copies = settings.get("copies", 1)
    duplex = settings.get("sides", "SINGLE") == "DOUBLE"
    print_settings = f"copies={copies}"
    if duplex:
        print_settings += ",duplex"

    cmd = [
        sumatra,
        "-print-to", printer_name,
        "-print-settings", print_settings,
        "-silent",
        pdf_path,
    ]

    try:
        logger.debug(f"SumatraPDF command: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, timeout=60)
        if result.returncode != 0:
            logger.warning(f"SumatraPDF exited with code {result.returncode}: {result.stderr.decode(errors='replace')}")
            return False
        return True
    except subprocess.TimeoutExpired:
        logger.error("SumatraPDF timed out after 60s")
        return False
    except Exception as e:
        logger.error(f"SumatraPDF error: {e}")
        return False


def print_pdf_win32(pdf_path: str, printer_name: str) -> bool:
    """
    Print using win32api.ShellExecute (opens default PDF handler and prints).
    This is a fallback when SumatraPDF is not available.

    Returns True if the ShellExecute call succeeded.
    Does NOT mean the document was physically printed.
    """
    if not WIN32_AVAILABLE:
        logger.error("win32api not available. Cannot print.")
        return False

    try:
        win32api.ShellExecute(
            0,
            "print",
            pdf_path,
            f'/d:"{printer_name}"',
            ".",
            0
        )
        logger.info(f"ShellExecute print submitted to '{printer_name}'")
        return True
    except Exception as e:
        logger.error(f"ShellExecute print failed: {e}")
        return False


# ── Secure temp file cleanup ──────────────────────────────────────────────────

def secure_delete(file_path: str) -> None:
    """
    Securely delete a temporary document file.
    Overwrites with zeros before deletion to reduce recovery risk.
    """
    path = Path(file_path)
    if not path.exists():
        return
    try:
        # Overwrite with zeros
        file_size = path.stat().st_size
        with open(path, "wb") as f:
            f.write(b"\x00" * file_size)
        path.unlink()
        logger.debug(f"Securely deleted: {path.name}")
    except Exception as e:
        # Best-effort — try plain delete
        try:
            path.unlink(missing_ok=True)
        except Exception:
            pass
        logger.warning(f"Could not securely delete {path}: {e}")

