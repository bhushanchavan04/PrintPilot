"""
MyPrint Local Print Connector
Entry point
"""

import sys
import signal
import logging

from config import load_config
from logger import setup_logger
from connector import PrintConnector


def main():
    # Handle --setup flag
    if "--setup" in sys.argv:
        from setup import run_setup
        run_setup()
        return

    # Load config
    config = load_config()

    # Set up logging
    logger = setup_logger(config.log_level)

    if not config.shop_email or not config.shop_password:
        logger.error("Shop credentials not configured. Run: python main.py --setup")
        sys.exit(1)

    # Create connector
    connector = PrintConnector(config)

    # Handle Ctrl+C gracefully
    def handle_shutdown(signum, frame):
        logger.info("\n⏹ Shutdown requested — stopping connector…")
        connector.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)

    # Authenticate
    logger.info("Connecting to MyPrint backend…")
    if not connector.authenticate():
        logger.error("Authentication failed. Check your credentials in .env")
        logger.error("Run 'python main.py --setup' to reconfigure")
        sys.exit(1)

    # Register printers
    connector.register_printers()

    # Clean up old job history entries
    connector.job_manager.cleanup_old_entries(days=7)

    # Start main polling loop
    connector.run_polling_loop()


if __name__ == "__main__":
    main()

