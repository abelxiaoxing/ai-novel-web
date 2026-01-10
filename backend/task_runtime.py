from __future__ import annotations

import threading
import traceback
import uuid
from typing import Any, Callable, Dict, List, Optional


class TaskManager:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._tasks: Dict[str, Dict[str, Any]] = {}
        self._logs: Dict[str, List[str]] = {}
        self._cancelled: Dict[str, bool] = {}

    def create_task(self, task_type: str, runner: Callable[[Callable[[str], None]], Dict[str, Any]]) -> str:
        task_id = uuid.uuid4().hex
        with self._lock:
            self._tasks[task_id] = {
                "id": task_id,
                "type": task_type,
                "status": "pending",
                "result": None,
                "error": None,
                "output_files": [],
            }
            self._logs[task_id] = []
            self._cancelled[task_id] = False

        thread = threading.Thread(target=self._run_task, args=(task_id, runner), daemon=True)
        thread.start()
        return task_id

    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            task = self._tasks.get(task_id)
            return dict(task) if task else None

    def get_logs(self, task_id: str) -> List[str]:
        with self._lock:
            return list(self._logs.get(task_id, []))

    def log(self, task_id: str, message: str) -> None:
        with self._lock:
            if task_id in self._logs:
                self._logs[task_id].append(message)

    def cancel_task(self, task_id: str) -> bool:
        with self._lock:
            task = self._tasks.get(task_id)
            if not task:
                return False
            if task.get("status") in ("success", "failed"):
                return False
            self._cancelled[task_id] = True
            return True

    def is_cancelled(self, task_id: str) -> bool:
        with self._lock:
            return self._cancelled.get(task_id, False)

    def _run_task(self, task_id: str, runner: Callable[[Callable[[str], None]], Dict[str, Any]]) -> None:
        self._update(task_id, status="running")
        try:
            if self.is_cancelled(task_id):
                raise RuntimeError("任务已取消")
            payload = runner(lambda msg: self.log(task_id, msg))
            result = payload.get("result") if isinstance(payload, dict) else None
            output_files = payload.get("output_files", []) if isinstance(payload, dict) else []
            self._update(task_id, status="success", result=result, output_files=output_files)
        except Exception as exc:
            self.log(task_id, "Task failed.")
            self.log(task_id, traceback.format_exc())
            self._update(task_id, status="failed", error=str(exc))

    def _update(
        self,
        task_id: str,
        status: Optional[str] = None,
        result: Any = None,
        error: Optional[str] = None,
        output_files: Optional[List[str]] = None,
    ) -> None:
        with self._lock:
            task = self._tasks.get(task_id)
            if not task:
                return
            if status:
                task["status"] = status
            if result is not None:
                task["result"] = result
            if error is not None:
                task["error"] = error
            if output_files is not None:
                task["output_files"] = output_files
            if status in ("success", "failed"):
                self._cancelled.pop(task_id, None)
