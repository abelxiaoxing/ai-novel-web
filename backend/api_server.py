from __future__ import annotations

import asyncio
import json
import os
from typing import Any, Dict, Optional

from fastapi import Body, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from backend.config_store import ConfigStore
from backend.file_keys import BASE_FILE_KEYS, resolve_chapter_path, resolve_file_path
from backend.project_state import load_project_state, save_project_state
from backend.project_store import ProjectStore
from backend.services import (
    batch_generate,
    build_prompt,
    clear_vectorstore,
    delete_vectorstore_chapter,
    enrich,
    generate_architecture,
    generate_blueprint,
    generate_draft,
    get_vectorstore_summary,
    import_knowledge,
    run_consistency_check,
    save_upload_to_temp,
    finalize,
)
from backend.task_runtime import TaskManager
from embedding_adapters import create_embedding_adapter
from llm_adapters import create_llm_adapter
from utils import read_file, save_string_to_txt


class ProjectCreateRequest(BaseModel):
    name: Optional[str] = Field(default=None)
    topic: Optional[str] = Field(default=None)
    genre: Optional[str] = Field(default=None)
    num_chapters: Optional[int] = Field(default=None)
    word_number: Optional[int] = Field(default=None)
    root_path: Optional[str] = Field(default=None)


class UpdateFileRequest(BaseModel):
    content: str = ""


class RenameChapterRequest(BaseModel):
    new_number: int


class TaskResponse(BaseModel):
    task_id: str


class ArchitectureRequest(BaseModel):
    topic: str
    genre: str
    number_of_chapters: int
    word_number: int
    user_guidance: Optional[str] = ""
    llm_config_name: Optional[str] = None


class BlueprintRequest(BaseModel):
    number_of_chapters: int
    user_guidance: Optional[str] = ""
    llm_config_name: Optional[str] = None


class BuildPromptRequest(BaseModel):
    novel_number: int
    word_number: int
    characters_involved: Optional[str] = ""
    key_items: Optional[str] = ""
    scene_location: Optional[str] = ""
    time_constraint: Optional[str] = ""
    user_guidance: Optional[str] = ""
    llm_config_name: Optional[str] = None
    embedding_config_name: Optional[str] = None
    retrieval_k: Optional[int] = None


class DraftRequest(BuildPromptRequest):
    custom_prompt_text: Optional[str] = None


class FinalizeRequest(BaseModel):
    novel_number: int
    word_number: int
    llm_config_name: Optional[str] = None
    embedding_config_name: Optional[str] = None


class EnrichRequest(BaseModel):
    chapter_text: str
    word_number: int
    llm_config_name: Optional[str] = None


class BatchRequest(BaseModel):
    start_chapter: int
    end_chapter: int
    word_number: int
    min_word: Optional[int] = 0
    auto_enrich: Optional[bool] = False
    resume_existing: Optional[bool] = True
    delay_seconds: Optional[float] = 0
    characters_involved: Optional[str] = ""
    key_items: Optional[str] = ""
    scene_location: Optional[str] = ""
    time_constraint: Optional[str] = ""
    user_guidance: Optional[str] = ""
    llm_config_name: Optional[str] = None
    embedding_config_name: Optional[str] = None
    retrieval_k: Optional[int] = None


class ConsistencyRequest(BaseModel):
    novel_setting: Optional[str] = ""
    character_state: Optional[str] = ""
    global_summary: Optional[str] = ""
    chapter_text: Optional[str] = ""
    plot_arcs: Optional[str] = ""
    llm_config_name: Optional[str] = None


class ConfigTestRequest(BaseModel):
    entry: Dict[str, Any] = Field(default_factory=dict)
    prompt: Optional[str] = None


app = FastAPI(title="AI Novel Web API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

project_store = ProjectStore()
config_store = ConfigStore()
task_manager = TaskManager()


def _get_project_root(project_id: str) -> str:
    project_root = project_store.get_project_root(project_id)
    if not project_root:
        raise HTTPException(status_code=404, detail="Project not found.")
    return project_root


def _resolve_llm_config(purpose: str, name_override: Optional[str]) -> Dict[str, Any]:
    _, llm_config = config_store.resolve_llm_config(purpose, name_override)
    return llm_config


def _resolve_embedding_config(name_override: Optional[str]) -> Dict[str, Any]:
    _, embedding_config = config_store.resolve_embedding_config(name_override)
    return embedding_config


@app.get("/api/projects")
def list_projects() -> Dict[str, Any]:
    return {"projects": project_store.list_projects()}


@app.post("/api/projects")
def create_project(payload: ProjectCreateRequest) -> Dict[str, Any]:
    name = (payload.name or "Untitled").strip() or "Untitled"
    project = project_store.create_project(
        name=name,
        topic=payload.topic,
        genre=payload.genre,
        num_chapters=payload.num_chapters,
        word_number=payload.word_number,
        root_path=payload.root_path,
    )
    return project


@app.get("/api/projects/{project_id}")
def get_project(project_id: str) -> Dict[str, Any]:
    project = project_store.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    return project


@app.delete("/api/projects/{project_id}")
def delete_project(project_id: str) -> Dict[str, Any]:
    try:
        deleted = project_store.delete_project(project_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to delete project.") from exc
    if not deleted:
        raise HTTPException(status_code=404, detail="Project not found.")
    return {"ok": True}


@app.get("/api/projects/{project_id}/files")
def list_project_files(project_id: str) -> Dict[str, Any]:
    _get_project_root(project_id)
    return {"files": BASE_FILE_KEYS}


@app.get("/api/projects/{project_id}/files/{file_key}")
def get_project_file(project_id: str, file_key: str) -> Dict[str, Any]:
    project_root = _get_project_root(project_id)
    try:
        path = resolve_file_path(project_root, file_key)
    except KeyError:
        raise HTTPException(status_code=404, detail="Unknown file key.")
    return {"content": read_file(path)}


@app.put("/api/projects/{project_id}/files/{file_key}")
def update_project_file(project_id: str, file_key: str, payload: UpdateFileRequest) -> Dict[str, Any]:
    project_root = _get_project_root(project_id)
    try:
        path = resolve_file_path(project_root, file_key)
    except KeyError:
        raise HTTPException(status_code=404, detail="Unknown file key.")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    save_string_to_txt(payload.content, path)
    return {"ok": True}


@app.get("/api/projects/{project_id}/chapters")
def list_chapters(project_id: str) -> Dict[str, Any]:
    project_root = _get_project_root(project_id)
    chapters_dir = os.path.join(project_root, "chapters")
    chapters: list[int] = []
    if os.path.isdir(chapters_dir):
        for filename in os.listdir(chapters_dir):
            if filename.startswith("chapter_") and filename.endswith(".txt"):
                number = filename[len("chapter_") : -len(".txt")]
                if number.isdigit():
                    chapters.append(int(number))
    chapters.sort()
    return {"chapters": chapters}


@app.get("/api/projects/{project_id}/chapters/{chapter_number}")
def get_chapter(project_id: str, chapter_number: int) -> Dict[str, Any]:
    project_root = _get_project_root(project_id)
    path = resolve_chapter_path(project_root, chapter_number)
    return {"content": read_file(path)}


@app.put("/api/projects/{project_id}/chapters/{chapter_number}")
def update_chapter(project_id: str, chapter_number: int, payload: UpdateFileRequest) -> Dict[str, Any]:
    project_root = _get_project_root(project_id)
    path = resolve_chapter_path(project_root, chapter_number)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    save_string_to_txt(payload.content, path)
    return {"ok": True}


@app.delete("/api/projects/{project_id}/chapters/{chapter_number}")
def delete_chapter(project_id: str, chapter_number: int) -> Dict[str, Any]:
    project_root = _get_project_root(project_id)
    path = resolve_chapter_path(project_root, chapter_number)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Chapter not found.")
    os.remove(path)
    return {"ok": True}


@app.post("/api/projects/{project_id}/chapters/{chapter_number}/rename")
def rename_chapter(
    project_id: str, chapter_number: int, payload: RenameChapterRequest
) -> Dict[str, Any]:
    project_root = _get_project_root(project_id)
    current_path = resolve_chapter_path(project_root, chapter_number)
    if not os.path.exists(current_path):
        raise HTTPException(status_code=404, detail="Chapter not found.")
    new_number = payload.new_number
    if new_number <= 0:
        raise HTTPException(status_code=400, detail="Invalid chapter number.")
    new_path = resolve_chapter_path(project_root, new_number)
    if os.path.exists(new_path):
        raise HTTPException(status_code=400, detail="Target chapter already exists.")
    os.makedirs(os.path.dirname(new_path), exist_ok=True)
    os.rename(current_path, new_path)
    return {"ok": True}


@app.get("/api/projects/{project_id}/state")
def get_project_state(project_id: str) -> Dict[str, Any]:
    project_root = _get_project_root(project_id)
    return load_project_state(project_root)


@app.put("/api/projects/{project_id}/state")
def update_project_state(project_id: str, payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    project_root = _get_project_root(project_id)
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="State payload must be an object.")
    state = load_project_state(project_root)
    state.update(payload)
    save_project_state(project_root, state)
    return {"ok": True}


@app.get("/api/tasks/{task_id}")
def get_task_status(task_id: str) -> Dict[str, Any]:
    task = task_manager.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    return {
        "status": task["status"],
        "result": task.get("result"),
        "error": task.get("error"),
        "output_files": task.get("output_files", []),
    }


@app.post("/api/tasks/{task_id}/cancel")
def cancel_task(task_id: str) -> Dict[str, Any]:
    task = task_manager.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    if not task_manager.cancel_task(task_id):
        raise HTTPException(status_code=400, detail="Task already completed.")
    return {"ok": True}


@app.get("/api/tasks/{task_id}/stream")
async def stream_task(task_id: str):
    if not task_manager.get_task(task_id):
        raise HTTPException(status_code=404, detail="Task not found.")

    async def event_generator():
        last_index = 0
        while True:
            task = task_manager.get_task(task_id)
            if not task:
                break
            logs = task_manager.get_logs(task_id)
            while last_index < len(logs):
                data = json.dumps({"message": logs[last_index]})
                yield f"data: {data}\n\n"
                last_index += 1
            if task["status"] in ("success", "failed") and last_index >= len(logs):
                break
            await asyncio.sleep(0.5)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"},
    )


@app.post("/api/projects/{project_id}/generate/architecture", response_model=TaskResponse)
def api_generate_architecture(project_id: str, payload: ArchitectureRequest) -> TaskResponse:
    project_root = _get_project_root(project_id)
    llm_config = _resolve_llm_config("architecture", payload.llm_config_name)
    task_id = task_manager.create_task(
        "architecture",
        lambda log: generate_architecture(project_root, payload.model_dump(), llm_config, log),
    )
    return TaskResponse(task_id=task_id)


@app.post("/api/projects/{project_id}/generate/blueprint", response_model=TaskResponse)
def api_generate_blueprint(project_id: str, payload: BlueprintRequest) -> TaskResponse:
    project_root = _get_project_root(project_id)
    llm_config = _resolve_llm_config("blueprint", payload.llm_config_name)
    task_id = task_manager.create_task(
        "blueprint",
        lambda log: generate_blueprint(project_root, payload.model_dump(), llm_config, log),
    )
    return TaskResponse(task_id=task_id)


@app.post("/api/projects/{project_id}/generate/build-prompt", response_model=TaskResponse)
def api_build_prompt(project_id: str, payload: BuildPromptRequest) -> TaskResponse:
    project_root = _get_project_root(project_id)
    llm_config = _resolve_llm_config("build_prompt", payload.llm_config_name)
    embedding_config = _resolve_embedding_config(payload.embedding_config_name)
    task_id = task_manager.create_task(
        "build_prompt",
        lambda log: build_prompt(
            project_root,
            payload.model_dump(),
            llm_config,
            embedding_config,
            log,
        ),
    )
    return TaskResponse(task_id=task_id)


@app.post("/api/projects/{project_id}/generate/draft", response_model=TaskResponse)
def api_generate_draft(project_id: str, payload: DraftRequest) -> TaskResponse:
    project_root = _get_project_root(project_id)
    llm_config = _resolve_llm_config("draft", payload.llm_config_name)
    embedding_config = _resolve_embedding_config(payload.embedding_config_name)
    task_id = task_manager.create_task(
        "draft",
        lambda log: generate_draft(
            project_root,
            payload.model_dump(),
            llm_config,
            embedding_config,
            log,
        ),
    )
    return TaskResponse(task_id=task_id)


@app.post("/api/projects/{project_id}/generate/enrich", response_model=TaskResponse)
def api_enrich_chapter(project_id: str, payload: EnrichRequest) -> TaskResponse:
    _get_project_root(project_id)
    llm_config = _resolve_llm_config("enrich", payload.llm_config_name)
    task_id = task_manager.create_task(
        "enrich",
        lambda log: enrich(payload.model_dump(), llm_config, log),
    )
    return TaskResponse(task_id=task_id)


@app.post("/api/projects/{project_id}/generate/finalize", response_model=TaskResponse)
def api_finalize(project_id: str, payload: FinalizeRequest) -> TaskResponse:
    project_root = _get_project_root(project_id)
    llm_config = _resolve_llm_config("finalize", payload.llm_config_name)
    embedding_config = _resolve_embedding_config(payload.embedding_config_name)
    task_id = task_manager.create_task(
        "finalize",
        lambda log: finalize(
            project_root,
            payload.model_dump(),
            llm_config,
            embedding_config,
            log,
        ),
    )
    return TaskResponse(task_id=task_id)


@app.post("/api/projects/{project_id}/generate/batch", response_model=TaskResponse)
def api_batch(project_id: str, payload: BatchRequest) -> TaskResponse:
    project_root = _get_project_root(project_id)
    llm_config = _resolve_llm_config("batch", payload.llm_config_name)
    embedding_config = _resolve_embedding_config(payload.embedding_config_name)
    task_id_holder = [""]

    def runner(log):
        return batch_generate(
            project_root,
            payload.model_dump(),
            llm_config,
            embedding_config,
            log,
            lambda: task_manager.is_cancelled(task_id_holder[0]),
        )

    task_id = task_manager.create_task("batch", runner)
    task_id_holder[0] = task_id
    return TaskResponse(task_id=task_id)


@app.post("/api/projects/{project_id}/consistency-check", response_model=TaskResponse)
def api_consistency(project_id: str, payload: ConsistencyRequest) -> TaskResponse:
    _get_project_root(project_id)
    llm_config = _resolve_llm_config("consistency", payload.llm_config_name)
    task_id = task_manager.create_task(
        "consistency",
        lambda log: run_consistency_check(payload.model_dump(), llm_config, log),
    )
    return TaskResponse(task_id=task_id)


@app.post("/api/projects/{project_id}/knowledge/import", response_model=TaskResponse)
async def api_import_knowledge(
    project_id: str,
    file: UploadFile = File(...),
    embedding_config_name: Optional[str] = Form(default=None),
) -> TaskResponse:
    project_root = _get_project_root(project_id)
    embedding_config = _resolve_embedding_config(embedding_config_name)
    contents = await file.read()
    temp_path = save_upload_to_temp(contents, suffix=os.path.splitext(file.filename or "")[1])

    def runner(log):
        try:
            return import_knowledge(project_root, temp_path, embedding_config, log)
        finally:
            try:
                os.remove(temp_path)
            except OSError:
                pass

    task_id = task_manager.create_task("knowledge_import", runner)
    return TaskResponse(task_id=task_id)


@app.post("/api/projects/{project_id}/vectorstore/clear", response_model=TaskResponse)
def api_clear_vectorstore(project_id: str) -> TaskResponse:
    project_root = _get_project_root(project_id)
    task_id = task_manager.create_task(
        "vectorstore_clear",
        lambda log: clear_vectorstore(project_root, log),
    )
    return TaskResponse(task_id=task_id)


@app.get("/api/projects/{project_id}/vectorstore")
def api_get_vectorstore_summary(
    project_id: str,
    embedding_config_name: Optional[str] = None
) -> Dict[str, Any]:
    """获取向量库摘要，按来源分组统计"""
    project_root = _get_project_root(project_id)
    embedding_config = _resolve_embedding_config(embedding_config_name)
    return get_vectorstore_summary(project_root, embedding_config, lambda msg: None)["result"]


@app.delete("/api/projects/{project_id}/vectorstore/chapters/{chapter_number}", response_model=TaskResponse)
def api_delete_vectorstore_chapter(
    project_id: str,
    chapter_number: int,
    embedding_config_name: Optional[str] = None
) -> TaskResponse:
    """删除指定章节的所有向量文档"""
    project_root = _get_project_root(project_id)
    embedding_config = _resolve_embedding_config(embedding_config_name)
    task_id = task_manager.create_task(
        "vectorstore_delete_chapter",
        lambda log: delete_vectorstore_chapter(project_root, chapter_number, embedding_config, log),
    )
    return TaskResponse(task_id=task_id)


@app.get("/api/config/llm")
def get_llm_configs() -> Dict[str, Any]:
    return {"configs": config_store.get_llm_configs()}


@app.post("/api/config/llm")
def create_llm_config(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    config = config_store.load_raw()
    name = payload.get("name")
    if not name:
        raise HTTPException(status_code=400, detail="Config name is required.")
    if isinstance(payload.get("entry"), dict):
        entry = payload["entry"]
    else:
        entry = {k: v for k, v in payload.items() if k != "name"}
    config.setdefault("llm_configs", {})[name] = entry
    config_store.save(config)
    return {"ok": True}


@app.put("/api/config/llm/{name}")
def update_llm_config(name: str, payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    config = config_store.load_raw()
    config.setdefault("llm_configs", {})[name] = payload
    config_store.save(config)
    return {"ok": True}


@app.delete("/api/config/llm/{name}")
def delete_llm_config(name: str) -> Dict[str, Any]:
    config = config_store.load_raw()
    configs = config.setdefault("llm_configs", {})
    if name in configs:
        del configs[name]
        config_store.save(config)
    return {"ok": True}


@app.post("/api/config/test/llm")
def test_llm_config(payload: ConfigTestRequest) -> Dict[str, Any]:
    entry = payload.entry or {}
    if isinstance(entry, dict) and "entry" in entry and isinstance(entry["entry"], dict):
        entry = entry["entry"]
    interface_format = entry.get("interface_format")
    model_name = entry.get("model_name")
    if not interface_format or not model_name:
        return {"ok": False, "message": "缺少 interface_format 或 model_name。"}
    try:
        adapter = create_llm_adapter(
            interface_format=interface_format,
            base_url=str(entry.get("base_url", "")),
            model_name=str(model_name),
            api_key=str(entry.get("api_key", "")),
            temperature=float(entry.get("temperature", 0.2)),
            max_tokens=min(int(entry.get("max_tokens", 128)), 512),
            timeout=int(entry.get("timeout", 30)),
        )
        prompt = payload.prompt or "请回复：OK"
        reply = adapter.invoke(prompt)
        if not reply:
            return {"ok": False, "message": "调用成功但未返回内容，请检查配置或模型权限。"}
        return {"ok": True, "message": "测试成功。", "sample": reply[:200]}
    except Exception as exc:
        return {"ok": False, "message": f"测试失败：{exc}"}


@app.get("/api/config/embedding")
def get_embedding_configs() -> Dict[str, Any]:
    return {"configs": config_store.get_embedding_configs()}


@app.post("/api/config/embedding")
def create_embedding_config(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    config = config_store.load_raw()
    name = payload.get("name")
    if not name:
        raise HTTPException(status_code=400, detail="Config name is required.")
    if isinstance(payload.get("entry"), dict):
        entry = payload["entry"]
    else:
        entry = {k: v for k, v in payload.items() if k != "name"}
    config.setdefault("embedding_configs", {})[name] = entry
    config_store.save(config)
    return {"ok": True}


@app.put("/api/config/embedding/{name}")
def update_embedding_config(name: str, payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    config = config_store.load_raw()
    config.setdefault("embedding_configs", {})[name] = payload
    config_store.save(config)
    return {"ok": True}


@app.delete("/api/config/embedding/{name}")
def delete_embedding_config(name: str) -> Dict[str, Any]:
    config = config_store.load_raw()
    configs = config.setdefault("embedding_configs", {})
    if name in configs:
        del configs[name]
        config_store.save(config)
    return {"ok": True}


@app.post("/api/config/test/embedding")
def test_embedding_config(payload: ConfigTestRequest) -> Dict[str, Any]:
    entry = payload.entry or {}
    if isinstance(entry, dict) and "entry" in entry and isinstance(entry["entry"], dict):
        entry = entry["entry"]
    interface_format = entry.get("interface_format")
    model_name = entry.get("model_name")
    if not interface_format or not model_name:
        return {"ok": False, "message": "缺少 interface_format 或 model_name。"}
    try:
        adapter = create_embedding_adapter(
            interface_format=interface_format,
            api_key=str(entry.get("api_key", "")),
            base_url=str(entry.get("base_url", "")),
            model_name=str(model_name),
        )
        vector = adapter.embed_query("测试向量")
        if not vector:
            return {"ok": False, "message": "调用成功但未获得向量，请检查配置或模型权限。"}
        return {"ok": True, "message": f"测试成功，向量维度 {len(vector)}。"}
    except Exception as exc:
        return {"ok": False, "message": f"测试失败：{exc}"}


@app.get("/api/config/choose")
def get_choose_configs() -> Dict[str, Any]:
    return {"choose_configs": config_store.get_choose_configs()}


@app.put("/api/config/choose")
def update_choose_configs(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    config = config_store.load_raw()
    if "choose_configs" in payload:
        config["choose_configs"] = payload["choose_configs"]
    else:
        config["choose_configs"] = payload
    config_store.save(config)
    return {"ok": True}


@app.get("/api/config/proxy")
def get_proxy_config() -> Dict[str, Any]:
    return config_store.load_raw().get("proxy_setting", {})


@app.put("/api/config/proxy")
def update_proxy_config(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    config = config_store.load_raw()
    config["proxy_setting"] = payload
    config_store.save(config)
    return {"ok": True}


@app.get("/api/config/webdav")
def get_webdav_config() -> Dict[str, Any]:
    return config_store.load_raw().get("webdav_config", {})


@app.put("/api/config/webdav")
def update_webdav_config(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    config = config_store.load_raw()
    config["webdav_config"] = payload
    config_store.save(config)
    return {"ok": True}


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("AINOVEL_API_PORT", "8000"))
    uvicorn.run("backend.api_server:app", host="0.0.0.0", port=port, reload=False)
