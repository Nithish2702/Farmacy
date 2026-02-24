from colorlog import ColoredFormatter
import logging

from app.core.config import settings

handler = logging.StreamHandler()
formatter = ColoredFormatter(
    "%(log_color)s%(asctime)s - %(name)s - %(levelname)s - %(filename)s - %(message)s",
    log_colors={
        "DEBUG": "cyan",
        "INFO": "green",
        "WARNING": "yellow",
        "ERROR": "red",
        "CRITICAL": "bold_red"
    }
)
handler.setFormatter(formatter)



logger = logging.getLogger("Farmacy")
log_level = logging.DEBUG if settings.ENV == "dev" else logging.INFO
logger.setLevel(log_level)
logger.setLevel(logging.INFO)
logger.addHandler(handler)
logger.propagate = False