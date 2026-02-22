"""
.browserignore parser — like .gitignore but for the workspace browser.
"""
from pathlib import Path
from typing import List
import fnmatch


def load_ignore_patterns(ignore_path: Path) -> List[str]:
    """Load patterns from .browserignore file."""
    if not ignore_path.exists():
        return []
    lines = ignore_path.read_text().splitlines()
    patterns = []
    for line in lines:
        line = line.strip()
        if line and not line.startswith("#"):
            patterns.append(line)
    return patterns


def is_ignored(rel_path: str, patterns: List[str]) -> bool:
    """
    Check whether a relative path should be hidden.
    Matches against each path component and the full path.
    """
    # Normalize
    rel_path = rel_path.lstrip("/")
    parts = rel_path.replace("\\", "/").split("/")

    for pattern in patterns:
        pat = pattern.rstrip("/")
        # Match against the full relative path
        if fnmatch.fnmatch(rel_path, pat):
            return True
        # Match against the full relative path with slash
        if fnmatch.fnmatch(rel_path, pat + "/*"):
            return True
        # Match against each component
        for part in parts:
            if fnmatch.fnmatch(part, pat):
                return True
        # Match against directory prefix
        for i in range(len(parts)):
            prefix = "/".join(parts[: i + 1])
            if fnmatch.fnmatch(prefix, pat):
                return True

    return False
