"""
Telegram notification service using the OpenClaw local API.
"""
import httpx
import logging
from backend.config import OPENCLAW_API, TELEGRAM_CHAT_ID

logger = logging.getLogger(__name__)


async def send_telegram(message: str) -> bool:
    """
    Send a Telegram message via the OpenClaw local API.
    Returns True on success, False on failure.
    """
    payload = {
        "target": TELEGRAM_CHAT_ID,
        "message": message,
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(OPENCLAW_API, json=payload)
            if resp.status_code < 300:
                logger.info(f"Telegram notification sent: {message[:80]}")
                return True
            else:
                logger.warning(f"Telegram API error {resp.status_code}: {resp.text}")
                return False
    except Exception as exc:
        logger.warning(f"Telegram notification failed: {exc}")
        return False


async def notify_new_comment(file_path: str, selected_text: str, comment: str, author: str):
    """Notify when a new root-level comment is created."""
    preview = f'> "{selected_text[:100]}"\n\n' if selected_text else ""
    msg = (
        f"📝 New comment in `{file_path}`\n\n"
        f"{preview}"
        f"{author.capitalize()}: \"{comment[:200]}\""
    )
    await send_telegram(msg)


async def notify_all_resolved(file_path: str):
    """Notify Shankar when all comments in a file are resolved."""
    msg = (
        f"✅ All comments in `{file_path}` have been addressed."
    )
    await send_telegram(msg)


async def notify_reply(file_path: str, comment: str, author: str):
    """Notify when a reply is added to a thread."""
    msg = (
        f"💬 Reply in `{file_path}`\n\n"
        f"{author.capitalize()}: \"{comment[:200]}\""
    )
    await send_telegram(msg)
