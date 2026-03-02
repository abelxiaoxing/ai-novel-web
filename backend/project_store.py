from __future__ import annotations

import json
import os
import re
import shutil
import threading
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional


def _utc_now() -> str:
    return datetime.utcnow().isoformat() + "Z"


CHAPTER_FILENAME_PATTERN = re.compile(r"^chapter_(\d+)\.txt$")
PROJECT_STATE_FILE = "project_state.json"
VECTORSTORE_DIR = "vectorstore"
VECTORSTORE_COLLECTION_NAME = "novel_collection"


class ProjectStore:
    def __init__(self, data_root: Optional[str] = None) -> None:
        default_root = os.path.expanduser("~/.config/.ai_novel_web/projects")
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
        stripped = {key: value for key, value in record.items() if key != "root_path"}
        stripped.update(self._collect_project_stats(record.get("root_path")))
        return stripped

    def _collect_project_stats(self, project_root: Optional[str]) -> Dict[str, int]:
        chapter_files = self._list_chapter_files(project_root)
        chapter_numbers = [chapter for chapter, _ in chapter_files]
        return {
            "chapter_count": len(chapter_files),
            "completed_chapters": self._count_completed_chapters(project_root, chapter_numbers),
            "written_words": self._count_written_words(chapter_files),
        }

    def _list_chapter_files(self, project_root: Optional[str]) -> List[tuple[int, str]]:
        if not project_root:
            return []
        chapters_dir = os.path.join(project_root, "chapters")
        if not os.path.isdir(chapters_dir):
            return []
        try:
            filenames = os.listdir(chapters_dir)
        except OSError:
            return []
        chapter_files: List[tuple[int, str]] = []
        for filename in filenames:
            match = CHAPTER_FILENAME_PATTERN.match(filename)
            if not match:
                continue
            path = os.path.join(chapters_dir, filename)
            try:
                is_file = os.path.isfile(path)
            except OSError:
                continue
            if not is_file:
                continue
            chapter_files.append((int(match.group(1)), path))
        chapter_files.sort(key=lambda item: item[0])
        return chapter_files

    def _count_completed_chapters(self, project_root: Optional[str], chapter_numbers: List[int]) -> int:
        if not project_root or not chapter_numbers:
            return 0
        existing_chapters = set(chapter_numbers)
        finalized_from_state, non_finalized_from_state = self._load_workflow_completion_data(
            project_root,
            existing_chapters,
        )
        completed_chapters: set[int] = set(finalized_from_state)
        vectorstore_completed = self._load_vectorstore_completed_chapters(project_root, existing_chapters)
        if non_finalized_from_state:
            vectorstore_completed.difference_update(non_finalized_from_state)
        completed_chapters.update(vectorstore_completed)
        return len(completed_chapters)

    def _load_workflow_completion_data(
        self,
        project_root: str,
        existing_chapters: set[int],
    ) -> tuple[set[int], set[int]]:
        state_path = os.path.join(project_root, PROJECT_STATE_FILE)
        if not os.path.exists(state_path):
            return set(), set()
        try:
            with open(state_path, "r", encoding="utf-8") as handle:
                project_state = json.load(handle)
        except Exception:
            return set(), set()
        if not isinstance(project_state, dict):
            return set(), set()
        workflow = project_state.get("workflow")
        if not isinstance(workflow, dict):
            return set(), set()

        finalized_chapters: set[int] = set()
        non_finalized_chapters: set[int] = set()

        chapter_statuses = workflow.get("chapterStatuses")
        has_chapter_statuses = isinstance(chapter_statuses, dict)
        if has_chapter_statuses:
            for raw_chapter, raw_state in chapter_statuses.items():
                try:
                    chapter_number = int(raw_chapter)
                except (TypeError, ValueError):
                    continue
                if chapter_number not in existing_chapters:
                    continue

                status = ""
                if isinstance(raw_state, dict):
                    raw_status = raw_state.get("status")
                    if isinstance(raw_status, str):
                        status = raw_status
                elif isinstance(raw_state, str):
                    status = raw_state
                status = status.strip()

                if status == "finalized":
                    finalized_chapters.add(chapter_number)
                    non_finalized_chapters.discard(chapter_number)
                elif status:
                    non_finalized_chapters.add(chapter_number)

        legacy_finalized = workflow.get("finalizedChapters")
        if not has_chapter_statuses and isinstance(legacy_finalized, list):
            for raw_chapter in legacy_finalized:
                try:
                    chapter_number = int(raw_chapter)
                except (TypeError, ValueError):
                    continue
                if chapter_number in existing_chapters:
                    finalized_chapters.add(chapter_number)
                    non_finalized_chapters.discard(chapter_number)

        return finalized_chapters, non_finalized_chapters

    def _load_vectorstore_completed_chapters(
        self,
        project_root: str,
        existing_chapters: set[int],
    ) -> set[int]:
        store_path = os.path.join(project_root, VECTORSTORE_DIR)
        if not os.path.isdir(store_path):
            return set()

        sqlite_chapters = self._load_vectorstore_completed_chapters_from_sqlite(
            store_path,
            existing_chapters,
        )
        if sqlite_chapters is not None:
            return sqlite_chapters

        chromadb_chapters = self._load_vectorstore_completed_chapters_from_chromadb(
            store_path,
            existing_chapters,
        )
        return chromadb_chapters

    def _load_vectorstore_completed_chapters_from_sqlite(
        self,
        store_path: str,
        existing_chapters: set[int],
    ) -> Optional[set[int]]:
        db_path = os.path.join(store_path, "chroma.sqlite3")
        if not os.path.isfile(db_path):
            return None

        try:
            import sqlite3
        except Exception:
            return None

        try:
            with sqlite3.connect(f"file:{db_path}?mode=ro", uri=True) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name='embedding_metadata'"
                )
                if cursor.fetchone() is None:
                    return None

                cursor.execute("PRAGMA table_info(embedding_metadata)")
                columns = {str(row[1]) for row in cursor.fetchall() if len(row) > 1}
                if "key" not in columns:
                    return None

                raw_values: List[Any] = []
                if "int_value" in columns:
                    cursor.execute(
                        "SELECT DISTINCT int_value FROM embedding_metadata "
                        "WHERE key='chapter' AND int_value IS NOT NULL"
                    )
                    raw_values.extend(row[0] for row in cursor.fetchall() if row)
                if "string_value" in columns:
                    cursor.execute(
                        "SELECT DISTINCT string_value FROM embedding_metadata "
                        "WHERE key='chapter' AND string_value IS NOT NULL"
                    )
                    raw_values.extend(row[0] for row in cursor.fetchall() if row)
                if "int_value" not in columns and "string_value" not in columns:
                    return None
        except Exception:
            return None

        completed_chapters: set[int] = set()
        for raw_value in raw_values:
            try:
                chapter_number = int(raw_value)
            except (TypeError, ValueError):
                continue
            if chapter_number in existing_chapters:
                completed_chapters.add(chapter_number)
        return completed_chapters

    def _load_vectorstore_completed_chapters_from_chromadb(
        self,
        store_path: str,
        existing_chapters: set[int],
    ) -> set[int]:
        try:
            from chromadb import PersistentClient
            from chromadb.config import Settings
        except Exception:
            return set()

        try:
            client = PersistentClient(
                path=store_path,
                settings=Settings(anonymized_telemetry=False),
            )
            collection = client.get_collection(name=VECTORSTORE_COLLECTION_NAME)
            result = collection.get(include=["metadatas"])
        except Exception:
            return set()

        if not isinstance(result, dict):
            return set()
        metadatas = result.get("metadatas")
        if not isinstance(metadatas, list):
            return set()

        completed_chapters: set[int] = set()
        for metadata in metadatas:
            if not isinstance(metadata, dict):
                continue
            try:
                chapter_number = int(metadata.get("chapter"))
            except (TypeError, ValueError):
                continue
            if chapter_number in existing_chapters:
                completed_chapters.add(chapter_number)
        return completed_chapters

    def _count_written_words(self, chapter_files: List[tuple[int, str]]) -> int:
        total_words = 0
        for _, path in chapter_files:
            try:
                with open(path, "r", encoding="utf-8") as handle:
                    while True:
                        chunk = handle.read(8192)
                        if not chunk:
                            break
                        total_words += sum(1 for char in chunk if not char.isspace())
            except Exception:
                continue
        return total_words

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
