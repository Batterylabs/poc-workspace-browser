"""
File browsing routes.
  GET /api/files          — full directory tree
  GET /api/file/{path}    — raw file content
  GET /api/file-info/{path} — file metadata
  POST /api/download      — download file(s) as zip
"""
import os
import mimetypes
import io
import zipfile
from pathlib import Path
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse

from backend.config import workspace_state, BROWSERIGNORE_PATH
from backend.services.ignore import load_ignore_patterns, is_ignored

router = APIRouter()

# ── Ignore patterns (loaded once at import, reloaded on each request) ─────────

def _get_patterns():
    return load_ignore_patterns(BROWSERIGNORE_PATH)


def _build_tree(
    root: Path,
    rel: Path,
    patterns: List[str],
    max_depth: int = 8,
    depth: int = 0,
) -> Optional[Dict[str, Any]]:
    if depth > max_depth:
        return None

    abs_path = root / rel
    rel_str = str(rel).replace("\\", "/")

    if rel_str != "." and is_ignored(rel_str, patterns):
        return None

    if abs_path.is_dir():
        children = []
        try:
            entries = sorted(abs_path.iterdir(), key=lambda p: (p.is_file(), p.name.lower()))
        except PermissionError:
            entries = []

        for entry in entries:
            child_rel = rel / entry.name
            child_node = _build_tree(root, child_rel, patterns, max_depth, depth + 1)
            if child_node is not None:
                children.append(child_node)

        if rel_str == ".":
            return {"name": "/", "path": "", "type": "directory", "children": children}
        return {
            "name": abs_path.name,
            "path": rel_str,
            "type": "directory",
            "children": children,
        }
    elif abs_path.is_file():
        ext = abs_path.suffix.lower()
        size = abs_path.stat().st_size
        return {
            "name": abs_path.name,
            "path": rel_str,
            "type": "file",
            "ext": ext,
            "size": size,
        }
    return None


@router.get("/api/files")
async def list_files():
    """Return full workspace file tree respecting .browserignore."""
    patterns = _get_patterns()
    tree = _build_tree(workspace_state.root, Path("."), patterns)
    return tree


TEXT_EXTENSIONS = {
    ".md", ".txt", ".py", ".js", ".ts", ".jsx", ".tsx", ".svelte",
    ".json", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".sh", ".bash",
    ".zsh", ".fish", ".html", ".htm", ".css", ".scss", ".less",
    ".xml", ".csv", ".log", ".env", ".gitignore", ".sql", ".rs",
    ".go", ".java", ".kt", ".swift", ".c", ".cpp", ".h", ".hpp",
    ".rb", ".php", ".r", ".m", ".ipynb", ".dockerfile", ".Makefile",
    ".mk", ".tf", ".hcl", ".proto", ".graphql", ".vue",
}

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".bmp"}

BINARY_THRESHOLD = 8192  # bytes to sniff


def _detect_type(path: Path) -> str:
    ext = path.suffix.lower()
    if ext in TEXT_EXTENSIONS:
        return "text"
    if ext in IMAGE_EXTENSIONS:
        return "image"
    # Try to sniff
    try:
        chunk = path.read_bytes()[:BINARY_THRESHOLD]
        if b"\x00" in chunk:
            return "binary"
        chunk.decode("utf-8")
        return "text"
    except Exception:
        return "binary"


@router.get("/api/file/{file_path:path}")
async def get_file(file_path: str, request: Request):
    """Return file content. Text files return JSON with content; images stream."""
    patterns = _get_patterns()
    if is_ignored(file_path, patterns):
        raise HTTPException(status_code=403, detail="Path is restricted")

    abs_path = (workspace_state.root / file_path).resolve()
    # Security: ensure resolved path is under workspace root
    try:
        abs_path.relative_to(workspace_state.root.resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Path traversal denied")

    if not abs_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    if abs_path.is_dir():
        raise HTTPException(status_code=400, detail="Path is a directory")

    kind = _detect_type(abs_path)

    if kind == "image":
        return FileResponse(str(abs_path))

    if kind == "binary":
        return JSONResponse(
            {"type": "binary", "size": abs_path.stat().st_size, "name": abs_path.name}
        )

    # Text
    try:
        content = abs_path.read_text(encoding="utf-8", errors="replace")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return JSONResponse(
        {
            "type": "text",
            "path": file_path,
            "name": abs_path.name,
            "ext": abs_path.suffix.lower(),
            "size": abs_path.stat().st_size,
            "content": content,
        }
    )


@router.get("/api/file-info/{file_path:path}")
async def file_info(file_path: str):
    """Return file metadata without content."""
    patterns = _get_patterns()
    if is_ignored(file_path, patterns):
        raise HTTPException(status_code=403, detail="Path is restricted")

    abs_path = (workspace_state.root / file_path).resolve()
    try:
        abs_path.relative_to(workspace_state.root.resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Path traversal denied")

    if not abs_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    stat = abs_path.stat()
    return {
        "path": file_path,
        "name": abs_path.name,
        "ext": abs_path.suffix.lower(),
        "size": stat.st_size,
        "modified": stat.st_mtime,
        "type": _detect_type(abs_path),
    }


# ── Download endpoint ──────────────────────────────────────────────────────────

class DownloadRequest(BaseModel):
    paths: List[str]  # relative paths to download


def _add_to_zip(zf: zipfile.ZipFile, file_path: Path, arcname_base: str):
    """Recursively add file or folder to zip file."""
    if file_path.is_file():
        # Add single file with relative path
        zf.write(file_path, arcname=f"{arcname_base}/{file_path.name}")
    elif file_path.is_dir():
        # Add directory recursively, maintaining structure
        for item in file_path.rglob("*"):
            if item.is_file():
                rel_to_base = item.relative_to(file_path.parent)
                zf.write(item, arcname=str(rel_to_base))


@router.post("/api/download")
async def download_files(req: DownloadRequest):
    """Download one or more files/folders as zip (or direct file if single file)."""
    if not req.paths or len(req.paths) == 0:
        raise HTTPException(status_code=400, detail="No paths specified")

    patterns = _get_patterns()
    
    # Validate and resolve all paths
    abs_paths = []
    names = []
    for rel_path in req.paths:
        if is_ignored(rel_path, patterns):
            raise HTTPException(status_code=403, detail=f"Path is restricted: {rel_path}")
        
        abs_path = (workspace_state.root / rel_path).resolve()
        try:
            abs_path.relative_to(workspace_state.root.resolve())
        except ValueError:
            raise HTTPException(status_code=403, detail=f"Path traversal denied: {rel_path}")
        
        if not abs_path.exists():
            raise HTTPException(status_code=404, detail=f"Path not found: {rel_path}")
        
        abs_paths.append(abs_path)
        names.append(abs_path.name)

    # Single file: return directly
    if len(abs_paths) == 1 and abs_paths[0].is_file():
        return FileResponse(
            str(abs_paths[0]),
            filename=abs_paths[0].name,
            media_type="application/octet-stream"
        )

    # Multiple items or folder: create zip
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for abs_path in abs_paths:
            _add_to_zip(zf, abs_path, "")

    zip_buffer.seek(0)
    
    # Generate filename
    if len(abs_paths) == 1:
        zip_name = f"{abs_paths[0].name}.zip"
    else:
        zip_name = "download.zip"

    return StreamingResponse(
        iter([zip_buffer.getvalue()]),
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={zip_name}"}
    )

class RootUpdateRequest(BaseModel):
    path: str

@router.get("/api/root")
async def get_root():
    return {
        "root": str(workspace_state.root),
        "default_root": str(workspace_state.default_root),
    }

@router.post("/api/root")
async def set_root(req: RootUpdateRequest):
    new_path = Path(req.path).resolve()
    if not new_path.exists() or not new_path.is_dir():
        raise HTTPException(status_code=400, detail="Invalid directory path")
    workspace_state.set_root(str(new_path))
    return {"root": str(workspace_state.root)}
