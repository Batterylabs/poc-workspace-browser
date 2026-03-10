"""
Annotation CRUD routes.
  GET    /api/annotations?file={path}      — list annotations for a file
  POST   /api/annotations                  — create annotation
  POST   /api/annotations/{id}/reply       — threaded reply
  POST   /api/annotations/{id}/resolve     — mark resolved
  DELETE /api/annotations/{id}             — delete
  GET    /api/annotations/unresolved       — all unresolved (for heartbeat)
"""
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from backend.db import get_db
from backend.services.notify import notify_new_comment, notify_all_resolved, notify_reply

router = APIRouter()


# ── Pydantic models ───────────────────────────────────────────────────────────

class AnnotationCreate(BaseModel):
    file_path: str
    anchor_type: str  # file | block | line | selection | image-region
    anchor_id: Optional[str] = None
    selected_text: Optional[str] = None
    comment: str
    author: str = "shankar"
    metadata: Optional[str] = None  # JSON string for image drawing data etc.


class ReplyCreate(BaseModel):
    comment: str
    author: str = "bruce"


class AnnotationOut(BaseModel):
    id: str
    file_path: str
    anchor_type: str
    anchor_id: Optional[str]
    selected_text: Optional[str]
    comment: str
    author: str
    parent_id: Optional[str]
    resolved: bool
    resolved_at: Optional[str]
    resolved_by: Optional[str]
    created_at: str
    metadata: Optional[str] = None
    replies: list = []


def _row_to_dict(row) -> dict:
    d = dict(row)
    d["resolved"] = bool(d.get("resolved", 0))
    d.setdefault("replies", [])
    return d


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/api/annotations")
async def list_annotations(file: str = Query(..., description="Relative file path")):
    """List all annotations for a file, with replies nested under their parents."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM annotations WHERE file_path = ? ORDER BY created_at ASC",
            (file,),
        )
        rows = await cursor.fetchall()
    finally:
        await db.close()

    all_anns = {row["id"]: _row_to_dict(row) for row in rows}

    # Nest replies under parents
    roots = []
    for ann in all_anns.values():
        pid = ann.get("parent_id")
        if pid and pid in all_anns:
            all_anns[pid]["replies"].append(ann)
        else:
            roots.append(ann)

    return roots


@router.post("/api/annotations", status_code=201)
async def create_annotation(body: AnnotationCreate):
    """Create a new root-level annotation and fire Telegram notification."""
    ann_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    db = await get_db()
    try:
        await db.execute(
            """INSERT INTO annotations
               (id, file_path, anchor_type, anchor_id, selected_text, comment, author, created_at, metadata)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (ann_id, body.file_path, body.anchor_type, body.anchor_id,
             body.selected_text, body.comment, body.author, now, body.metadata),
        )
        await db.commit()
    finally:
        await db.close()

    # Fire Telegram notification (non-blocking)
    try:
        await notify_new_comment(
            file_path=body.file_path,
            selected_text=body.selected_text or "",
            comment=body.comment,
            author=body.author,
        )
    except Exception:
        pass  # Don't fail the request if notification fails

    return {"id": ann_id, "created_at": now}


@router.post("/api/annotations/{ann_id}/reply", status_code=201)
async def reply_annotation(ann_id: str, body: ReplyCreate):
    """Add a threaded reply to an existing annotation."""
    db = await get_db()
    try:
        # Verify parent exists
        cur = await db.execute("SELECT * FROM annotations WHERE id = ?", (ann_id,))
        parent = await cur.fetchone()
        if not parent:
            raise HTTPException(status_code=404, detail="Annotation not found")

        reply_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        await db.execute(
            """INSERT INTO annotations
               (id, file_path, anchor_type, anchor_id, selected_text, comment, author, parent_id, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (reply_id, parent["file_path"], parent["anchor_type"], parent["anchor_id"],
             None, body.comment, body.author, ann_id, now),
        )
        await db.commit()
    finally:
        await db.close()

    # Notify
    try:
        await notify_reply(
            file_path=parent["file_path"],
            comment=body.comment,
            author=body.author,
        )
    except Exception:
        pass

    return {"id": reply_id, "created_at": now}


@router.post("/api/annotations/{ann_id}/resolve")
async def resolve_annotation(ann_id: str, author: str = "bruce"):
    """Mark an annotation as resolved. If all comments in file resolved → notify Shankar."""
    now = datetime.utcnow().isoformat()
    db = await get_db()
    try:
        cur = await db.execute("SELECT * FROM annotations WHERE id = ?", (ann_id,))
        ann = await cur.fetchone()
        if not ann:
            raise HTTPException(status_code=404, detail="Annotation not found")

        await db.execute(
            "UPDATE annotations SET resolved = 1, resolved_at = ?, resolved_by = ? WHERE id = ?",
            (now, author, ann_id),
        )
        await db.commit()

        file_path = ann["file_path"]
        # Check if all root-level annotations in this file are now resolved
        cur2 = await db.execute(
            "SELECT COUNT(*) as cnt FROM annotations WHERE file_path = ? AND parent_id IS NULL AND resolved = 0",
            (file_path,),
        )
        row = await cur2.fetchone()
        all_resolved = row["cnt"] == 0
    finally:
        await db.close()

    if all_resolved:
        try:
            await notify_all_resolved(file_path)
        except Exception:
            pass

    return {"resolved": True, "all_resolved": all_resolved}


@router.delete("/api/annotations/{ann_id}")
async def delete_annotation(ann_id: str):
    """Delete an annotation (and cascade to replies via FK)."""
    db = await get_db()
    try:
        cur = await db.execute("SELECT id FROM annotations WHERE id = ?", (ann_id,))
        if not await cur.fetchone():
            raise HTTPException(status_code=404, detail="Annotation not found")
        await db.execute("DELETE FROM annotations WHERE id = ?", (ann_id,))
        await db.commit()
    finally:
        await db.close()
    return {"deleted": True}


@router.get("/api/annotations/unresolved")
async def unresolved_annotations(older_than_minutes: int = Query(30)):
    """Return all unresolved root-level annotations older than N minutes (for heartbeat use)."""
    db = await get_db()
    try:
        cur = await db.execute(
            """SELECT * FROM annotations
               WHERE parent_id IS NULL AND resolved = 0
               AND (julianday('now') - julianday(created_at)) * 1440 > ?
               ORDER BY created_at ASC""",
            (older_than_minutes,),
        )
        rows = await cur.fetchall()
    finally:
        await db.close()

    return [_row_to_dict(r) for r in rows]


@router.get("/api/annotations/stats")
async def annotation_stats():
    """Return per-file annotation counts for the file tree indicators."""
    db = await get_db()
    try:
        cur = await db.execute(
            """SELECT file_path,
               SUM(CASE WHEN resolved = 0 AND parent_id IS NULL THEN 1 ELSE 0 END) AS open_count,
               SUM(CASE WHEN resolved = 1 AND parent_id IS NULL THEN 1 ELSE 0 END) AS resolved_count
               FROM annotations
               WHERE parent_id IS NULL
               GROUP BY file_path"""
        )
        rows = await cur.fetchall()
    finally:
        await db.close()

    return {row["file_path"]: {"open": row["open_count"], "resolved": row["resolved_count"]} for row in rows}
