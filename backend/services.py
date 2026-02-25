from __future__ import annotations

import os
import tempfile
import time
from typing import Any, Callable, Dict, List, Optional

from consistency_checker import check_consistency
from novel_generator.architecture import Novel_architecture_generate
from novel_generator.blueprint import Chapter_blueprint_generate
from novel_generator.chapter import build_chapter_prompt, generate_chapter_draft
from novel_generator.finalization import enrich_chapter_text, finalize_chapter
from novel_generator.knowledge import import_knowledge_file
from novel_generator.vectorstore_manager import (
    delete_vectorstore_by_chapter,
    get_vectorstore_summary as get_vs_summary,
)
from novel_generator.vectorstore_utils import clear_vector_store
from utils import read_file, save_string_to_txt

from backend.file_keys import resolve_chapter_path
from embedding_adapters import create_embedding_adapter


DEFAULT_TEMPERATURE = 0.7
DEFAULT_MAX_TOKENS = 2048
DEFAULT_TIMEOUT = 900
DEFAULT_RETRIEVAL_K = 2


def _resolve_retrieval_k(payload: Dict[str, Any], embedding_config: Dict[str, Any]) -> int:
    retrieval_k = payload.get("retrieval_k")
    if retrieval_k is None:
        retrieval_k = embedding_config.get("retrieval_k", DEFAULT_RETRIEVAL_K)
    return int(retrieval_k)


def _common_llm_kwargs(
    llm_config: Dict[str, Any],
    *,
    default_max_tokens: int = DEFAULT_MAX_TOKENS,
) -> Dict[str, Any]:
    return {
        "api_key": llm_config["api_key"],
        "base_url": llm_config["base_url"],
        "model_name": llm_config["model_name"],
        "temperature": llm_config.get("temperature", DEFAULT_TEMPERATURE),
        "interface_format": llm_config["interface_format"],
        "max_tokens": llm_config.get("max_tokens", default_max_tokens),
        "timeout": llm_config.get("timeout", DEFAULT_TIMEOUT),
    }


def _common_embedding_kwargs(embedding_config: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "embedding_api_key": embedding_config["api_key"],
        "embedding_url": embedding_config["base_url"],
        "embedding_interface_format": embedding_config["interface_format"],
        "embedding_model_name": embedding_config["model_name"],
    }


def _chapter_generation_kwargs(
    project_root: str,
    payload: Dict[str, Any],
    llm_config: Dict[str, Any],
    embedding_config: Dict[str, Any],
) -> Dict[str, Any]:
    return {
        **_common_llm_kwargs(llm_config),
        **_common_embedding_kwargs(embedding_config),
        "filepath": project_root,
        "novel_number": payload["novel_number"],
        "word_number": payload["word_number"],
        "user_guidance": payload.get("user_guidance", ""),
        "characters_involved": payload.get("characters_involved", ""),
        "key_items": payload.get("key_items", ""),
        "scene_location": payload.get("scene_location", ""),
        "time_constraint": payload.get("time_constraint", ""),
        "embedding_retrieval_k": _resolve_retrieval_k(payload, embedding_config),
    }


def _finalize_kwargs(
    project_root: str,
    novel_number: int,
    word_number: int,
    llm_config: Dict[str, Any],
    embedding_config: Dict[str, Any],
    log,
    *,
    skip_vectorstore: bool = False,
) -> Dict[str, Any]:
    return {
        **_common_llm_kwargs(llm_config),
        **_common_embedding_kwargs(embedding_config),
        "filepath": project_root,
        "novel_number": novel_number,
        "word_number": word_number,
        "skip_vectorstore": skip_vectorstore,
        "progress_callback": log,
        "llm_max_retries": int(llm_config.get("finalize_max_retries", 3)),
        "parallel_workers": int(llm_config.get("finalize_parallel_workers", 3)),
    }


def _enrich_kwargs(chapter_text: str, word_number: int, llm_config: Dict[str, Any]) -> Dict[str, Any]:
    return {
        **_common_llm_kwargs(llm_config),
        "chapter_text": chapter_text,
        "word_number": word_number,
    }


def generate_architecture(
    project_root: str,
    payload: Dict[str, Any],
    llm_config: Dict[str, Any],
    log,
) -> Dict[str, Any]:
    log("Generating architecture...")
    Novel_architecture_generate(
        interface_format=llm_config["interface_format"],
        api_key=llm_config["api_key"],
        base_url=llm_config["base_url"],
        llm_model=llm_config["model_name"],
        topic=payload["topic"],
        genre=payload["genre"],
        number_of_chapters=payload["number_of_chapters"],
        word_number=payload["word_number"],
        filepath=project_root,
        user_guidance=payload.get("user_guidance", ""),
        temperature=llm_config.get("temperature", DEFAULT_TEMPERATURE),
        max_tokens=llm_config.get("max_tokens", DEFAULT_MAX_TOKENS),
        timeout=llm_config.get("timeout", DEFAULT_TIMEOUT),
    )
    log("Architecture completed.")
    return {"output_files": ["architecture", "character_state"]}


def generate_blueprint(
    project_root: str,
    payload: Dict[str, Any],
    llm_config: Dict[str, Any],
    log,
) -> Dict[str, Any]:
    log("Generating blueprint...")
    Chapter_blueprint_generate(
        interface_format=llm_config["interface_format"],
        api_key=llm_config["api_key"],
        base_url=llm_config["base_url"],
        llm_model=llm_config["model_name"],
        filepath=project_root,
        number_of_chapters=payload["number_of_chapters"],
        user_guidance=payload.get("user_guidance", ""),
        temperature=llm_config.get("temperature", DEFAULT_TEMPERATURE),
        max_tokens=llm_config.get("max_tokens", 4096),
        timeout=llm_config.get("timeout", DEFAULT_TIMEOUT),
    )
    log("Blueprint completed.")
    return {"output_files": ["directory"]}


def build_prompt(
    project_root: str,
    payload: Dict[str, Any],
    llm_config: Dict[str, Any],
    embedding_config: Dict[str, Any],
    log,
) -> Dict[str, Any]:
    log("Building chapter prompt...")
    prompt_text = build_chapter_prompt(
        **_chapter_generation_kwargs(project_root, payload, llm_config, embedding_config)
    )
    log("Prompt ready.")
    return {"result": {"prompt_text": prompt_text}}


def generate_draft(
    project_root: str,
    payload: Dict[str, Any],
    llm_config: Dict[str, Any],
    embedding_config: Dict[str, Any],
    log,
) -> Dict[str, Any]:
    log(f"Generating draft for chapter {payload['novel_number']}...")
    chapter_text = generate_chapter_draft(
        **_chapter_generation_kwargs(project_root, payload, llm_config, embedding_config),
        custom_prompt_text=payload.get("custom_prompt_text"),
    )
    log("Draft completed.")
    return {
        "result": {"chapter_text": chapter_text},
        "output_files": [f"chapter:{payload['novel_number']}"],
    }


def finalize(
    project_root: str,
    payload: Dict[str, Any],
    llm_config: Dict[str, Any],
    embedding_config: Dict[str, Any],
    log,
) -> Dict[str, Any]:
    log(f"Finalizing chapter {payload['novel_number']}...")
    report = finalize_chapter(
        **_finalize_kwargs(
            project_root,
            payload["novel_number"],
            payload["word_number"],
            llm_config,
            embedding_config,
            log,
            skip_vectorstore=bool(payload.get("skip_vectorstore", False)),
        )
    )
    log("Finalization completed.")
    summary = read_file(os.path.join(project_root, "global_summary.txt"))
    character_state = read_file(os.path.join(project_root, "character_state.txt"))
    output_files = ["summary", "character_state"]
    vectorstore = report.get("vectorstore", {}) if isinstance(report, dict) else {}
    if vectorstore.get("updated"):
        output_files.append("vectorstore")
    return {
        "result": {
            "global_summary": summary,
            "character_state": character_state,
            "finalize_report": report,
        },
        "output_files": output_files,
    }


def enrich(
    payload: Dict[str, Any],
    llm_config: Dict[str, Any],
    log,
) -> Dict[str, Any]:
    log("Enriching chapter text...")
    enriched = enrich_chapter_text(
        **_enrich_kwargs(payload["chapter_text"], payload["word_number"], llm_config)
    )
    log("Enrich completed.")
    return {"result": {"chapter_text": enriched}}


def batch_generate(
    project_root: str,
    payload: Dict[str, Any],
    llm_config: Dict[str, Any],
    embedding_config: Dict[str, Any],
    log,
    should_cancel: Optional[Callable[[], bool]] = None,
) -> Dict[str, Any]:
    start_chapter = payload["start_chapter"]
    end_chapter = payload["end_chapter"]
    word_number = payload["word_number"]
    min_word = payload.get("min_word", 0)
    auto_enrich = payload.get("auto_enrich", False)
    resume_existing = payload.get("resume_existing", True)
    delay_seconds = payload.get("delay_seconds", 0) or 0
    chapter_defaults = {
        "word_number": word_number,
        "characters_involved": payload.get("characters_involved", ""),
        "key_items": payload.get("key_items", ""),
        "scene_location": payload.get("scene_location", ""),
        "time_constraint": payload.get("time_constraint", ""),
        "user_guidance": payload.get("user_guidance", ""),
        "retrieval_k": _resolve_retrieval_k(payload, embedding_config),
    }
    results: List[Dict[str, Any]] = []

    for chapter_number in range(start_chapter, end_chapter + 1):
        if should_cancel and should_cancel():
            log("Batch cancelled.")
            raise RuntimeError("任务已取消")
        log(f"Drafting chapter {chapter_number}...")

        chapter_path = resolve_chapter_path(project_root, chapter_number)
        chapter_text = ""
        did_generate = False
        if resume_existing:
            existing_text = read_file(chapter_path)
            if existing_text.strip():
                log(f"Chapter {chapter_number} already exists, skipping generation.")
                chapter_text = existing_text

        if not chapter_text:
            chapter_payload = {"novel_number": chapter_number, **chapter_defaults}
            chapter_text = generate_draft(
                project_root,
                chapter_payload,
                llm_config,
                embedding_config,
                log,
            )["result"]["chapter_text"]
            did_generate = True

        if auto_enrich and min_word and len(chapter_text) < min_word:
            log(f"Enriching chapter {chapter_number} for length...")
            enriched = enrich_chapter_text(
                **_enrich_kwargs(chapter_text, word_number, llm_config)
            )
            os.makedirs(os.path.dirname(chapter_path), exist_ok=True)
            save_string_to_txt(enriched, chapter_path)
            chapter_text = enriched
            did_generate = True

        if did_generate:
            log(f"Finalizing chapter {chapter_number}...")
            finalize_report = finalize_chapter(
                **_finalize_kwargs(
                    project_root,
                    chapter_number,
                    word_number,
                    llm_config,
                    embedding_config,
                    log,
                )
            )
            total_seconds = (
                finalize_report.get("timings", {}).get("total_seconds")
                if isinstance(finalize_report, dict)
                else None
            )
            if total_seconds is not None:
                log(f"Chapter {chapter_number} finalized in {total_seconds}s.")
            else:
                log(f"Chapter {chapter_number} finalized.")

        results.append({"chapter": chapter_number, "length": len(chapter_text)})
        log(f"[CHAPTER_DONE] {chapter_number}")
        if delay_seconds and did_generate and chapter_number < end_chapter:
            time.sleep(delay_seconds)

    log("Batch completed.")
    return {"result": {"chapters": results}}


def run_consistency_check(
    payload: Dict[str, Any],
    llm_config: Dict[str, Any],
    log,
) -> Dict[str, Any]:
    log("Running consistency check...")
    result_text = check_consistency(
        novel_setting=payload.get("novel_setting", ""),
        character_state=payload.get("character_state", ""),
        global_summary=payload.get("global_summary", ""),
        chapter_text=payload.get("chapter_text", ""),
        api_key=llm_config["api_key"],
        base_url=llm_config["base_url"],
        model_name=llm_config["model_name"],
        temperature=llm_config.get("temperature", 0.3),
        plot_arcs=payload.get("plot_arcs", ""),
        interface_format=llm_config["interface_format"],
        max_tokens=llm_config.get("max_tokens", DEFAULT_MAX_TOKENS),
        timeout=llm_config.get("timeout", DEFAULT_TIMEOUT),
    )
    log("Consistency check completed.")
    return {"result": {"result_text": result_text}}


def import_knowledge(
    project_root: str,
    temp_path: str,
    embedding_config: Dict[str, Any],
    log,
) -> Dict[str, Any]:
    log("Importing knowledge file...")
    import_knowledge_file(
        embedding_api_key=embedding_config["api_key"],
        embedding_url=embedding_config["base_url"],
        embedding_interface_format=embedding_config["interface_format"],
        embedding_model_name=embedding_config["model_name"],
        file_path=temp_path,
        filepath=project_root,
    )
    log("Knowledge import completed.")
    return {"output_files": ["vectorstore"]}


def clear_vectorstore(project_root: str, log) -> Dict[str, Any]:
    log("Clearing vector store...")
    clear_vector_store(project_root)
    log("Vector store cleared.")
    return {"output_files": ["vectorstore"]}


def save_upload_to_temp(upload_bytes: bytes, suffix: str = "") -> str:
    temp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    temp.write(upload_bytes)
    temp.flush()
    temp.close()
    return temp.name


def get_vectorstore_summary(
    project_root: str,
    embedding_config: Dict[str, Any],
    log,
) -> Dict[str, Any]:
    """获取向量库摘要，按来源分组统计"""
    log("Getting vectorstore summary...")
    embedding_adapter = create_embedding_adapter(
        embedding_config["interface_format"],
        embedding_config["api_key"],
        embedding_config["base_url"],
        embedding_config["model_name"],
    )
    summary = get_vs_summary(embedding_adapter, project_root)
    log(f"Vectorstore summary: {summary['total_count']} total documents.")
    return {"result": summary}


def delete_vectorstore_chapter(
    project_root: str,
    chapter_number: int,
    embedding_config: Dict[str, Any],
    log,
) -> Dict[str, Any]:
    """删除指定章节的所有向量文档"""
    log(f"Deleting chapter {chapter_number} from vectorstore...")
    embedding_adapter = create_embedding_adapter(
        embedding_config["interface_format"],
        embedding_config["api_key"],
        embedding_config["base_url"],
        embedding_config["model_name"],
    )
    deleted_count = delete_vectorstore_by_chapter(embedding_adapter, project_root, chapter_number)
    log(f"Deleted {deleted_count} documents for chapter {chapter_number}.")
    return {"result": {"deleted_count": deleted_count}}
