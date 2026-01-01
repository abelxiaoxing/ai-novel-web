from __future__ import annotations

import os

FILE_KEY_MAP = {
    "architecture": "Novel_architecture.txt",
    "architecture_partial": "partial_architecture.json",
    "directory": "Novel_directory.txt",
    "summary": "global_summary.txt",
    "character_state": "character_state.txt",
    "plot_arcs": "plot_arcs.txt",
}

BASE_FILE_KEYS = [
    "architecture",
    "directory",
    "summary",
    "character_state",
    "plot_arcs",
]


def resolve_file_path(project_root: str, file_key: str) -> str:
    if file_key not in FILE_KEY_MAP:
        raise KeyError(f"Unknown file_key: {file_key}")
    return os.path.join(project_root, FILE_KEY_MAP[file_key])


def resolve_chapter_path(project_root: str, chapter_number: int) -> str:
    return os.path.join(project_root, "chapters", f"chapter_{chapter_number}.txt")
