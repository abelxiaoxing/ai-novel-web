from __future__ import annotations

import json
import os
import shutil
import threading
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional


def _utc_now() -> str:
    return datetime.utcnow().isoformat() + "Z"


class ProjectStore:
    def __init__(self, data_root: Optional[str] = None) -> None:
        default_root = os.path.expanduser("~/.config/.ai_novel_generator/projects")
        self._data_root = data_root or os.environ.get("AINOVEL_DATA_ROOT", default_root)
        os.makedirs(self._data_root, exist_ok=True)
        self._metadata_file = os.path.join(self._data_root, "projects.json")
        self._lock = threading.Lock()

    def list_projects(self) -> List[Dict[str, Any]]:
        state = self._load_state()
        return [self._strip_project(project) for project in state.get("projects", [])]

    def get_project(self, project_id: str) -> Optional[Dict[str, Any]]:
        state = self._load_state()
        for project in state.get("projects", []):
            if project.get("id") == project_id:
                return self._strip_project(project)
        return None

    def get_project_root(self, project_id: str) -> Optional[str]:
        state = self._load_state()
        for project in state.get("projects", []):
            if project.get("id") == project_id:
                return project.get("root_path")
        return None

    def create_project(
        self,
        name: str,
        topic: Optional[str] = None,
        genre: Optional[str] = None,
        num_chapters: Optional[int] = None,
        word_number: Optional[int] = None,
        root_path: Optional[str] = None,
    ) -> Dict[str, Any]:
        project_id = uuid.uuid4().hex
        project_root = root_path or os.path.join(self._data_root, project_id)
        os.makedirs(project_root, exist_ok=True)

        now = _utc_now()
        record = {
            "id": project_id,
            "name": name,
            "topic": topic,
            "genre": genre,
            "num_chapters": num_chapters,
            "word_number": word_number,
            "root_path": project_root,
            "created_at": now,
            "updated_at": now,
        }

        with self._lock:
            state = self._load_state()
            projects = state.get("projects", [])
            projects.append(record)
            state["projects"] = projects
            self._save_state(state)

        return self._strip_project(record)

    def delete_project(self, project_id: str) -> Optional[str]:
        target: Optional[Dict[str, Any]] = None
        with self._lock:
            state = self._load_state()
            projects = state.get("projects", [])
            remaining: List[Dict[str, Any]] = []
            for project in projects:
                if project.get("id") == project_id:
                    target = project
                else:
                    remaining.append(project)
            if not target:
                return None
            state["projects"] = remaining
            self._save_state(state)

        root_path = target.get("root_path")
        if root_path and os.path.isdir(root_path):
            shutil.rmtree(root_path)
        return root_path

    def _strip_project(self, record: Dict[str, Any]) -> Dict[str, Any]:
        return {key: value for key, value in record.items() if key != "root_path"}

    def _load_state(self) -> Dict[str, Any]:
        if not os.path.exists(self._metadata_file):
            return {"projects": []}
        try:
            with open(self._metadata_file, "r", encoding="utf-8") as handle:
                return json.load(handle)
        except Exception:
            return {"projects": []}

    def _save_state(self, state: Dict[str, Any]) -> None:
        with open(self._metadata_file, "w", encoding="utf-8") as handle:
            json.dump(state, handle, ensure_ascii=False, indent=2)
