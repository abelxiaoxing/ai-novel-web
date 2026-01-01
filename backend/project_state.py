from __future__ import annotations

import json
import os
from typing import Any, Dict

PROJECT_STATE_FILE = "project_state.json"


def load_project_state(project_root: str) -> Dict[str, Any]:
    path = os.path.join(project_root, PROJECT_STATE_FILE)
    if not os.path.exists(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8") as handle:
            data = json.load(handle)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def save_project_state(project_root: str, state: Dict[str, Any]) -> None:
    path = os.path.join(project_root, PROJECT_STATE_FILE)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(state, handle, ensure_ascii=False, indent=2)
