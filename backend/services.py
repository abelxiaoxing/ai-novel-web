from __future__ import annotations

import os
import tempfile
import time
from typing import Any, Callable, Dict, List, Optional

from consistency_checker import check_consistency
from novel_generator.architecture import Novel_architecture_generate
from novel_generator.blueprint import Chapter_blueprint_generate
from novel_generator.chapter import build_chapter_prompt, generate_chapter_draft, generate_chapter_draft_stream
from novel_generator.finalization import enrich_chapter_text, finalize_chapter
from novel_generator.knowledge import import_knowledge_file
from novel_generator.vectorstore_utils import clear_vector_store
from utils import read_file, save_string_to_txt

from backend.file_keys import resolve_chapter_path


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
        temperature=llm_config.get("temperature", 0.7),
        max_tokens=llm_config.get("max_tokens", 2048),
        timeout=llm_config.get("timeout", 900),
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
        temperature=llm_config.get("temperature", 0.7),
        max_tokens=llm_config.get("max_tokens", 4096),
        timeout=llm_config.get("timeout", 900),
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
    retrieval_k = payload.get("retrieval_k")
    if retrieval_k is None:
        retrieval_k = embedding_config.get("retrieval_k", 2)
    prompt_text = build_chapter_prompt(
        api_key=llm_config["api_key"],
        base_url=llm_config["base_url"],
        model_name=llm_config["model_name"],
        filepath=project_root,
        novel_number=payload["novel_number"],
        word_number=payload["word_number"],
        temperature=llm_config.get("temperature", 0.7),
        user_guidance=payload.get("user_guidance", ""),
        characters_involved=payload.get("characters_involved", ""),
        key_items=payload.get("key_items", ""),
        scene_location=payload.get("scene_location", ""),
        time_constraint=payload.get("time_constraint", ""),
        embedding_api_key=embedding_config["api_key"],
        embedding_url=embedding_config["base_url"],
        embedding_interface_format=embedding_config["interface_format"],
        embedding_model_name=embedding_config["model_name"],
        embedding_retrieval_k=retrieval_k,
        interface_format=llm_config["interface_format"],
        max_tokens=llm_config.get("max_tokens", 2048),
        timeout=llm_config.get("timeout", 900),
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
    retrieval_k = payload.get("retrieval_k")
    if retrieval_k is None:
        retrieval_k = embedding_config.get("retrieval_k", 2)
    chapter_text = generate_chapter_draft(
        api_key=llm_config["api_key"],
        base_url=llm_config["base_url"],
        model_name=llm_config["model_name"],
        filepath=project_root,
        novel_number=payload["novel_number"],
        word_number=payload["word_number"],
        temperature=llm_config.get("temperature", 0.7),
        user_guidance=payload.get("user_guidance", ""),
        characters_involved=payload.get("characters_involved", ""),
        key_items=payload.get("key_items", ""),
        scene_location=payload.get("scene_location", ""),
        time_constraint=payload.get("time_constraint", ""),
        embedding_api_key=embedding_config["api_key"],
        embedding_url=embedding_config["base_url"],
        embedding_interface_format=embedding_config["interface_format"],
        embedding_model_name=embedding_config["model_name"],
        embedding_retrieval_k=retrieval_k,
        interface_format=llm_config["interface_format"],
        max_tokens=llm_config.get("max_tokens", 2048),
        timeout=llm_config.get("timeout", 900),
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
    finalize_chapter(
        novel_number=payload["novel_number"],
        word_number=payload["word_number"],
        api_key=llm_config["api_key"],
        base_url=llm_config["base_url"],
        model_name=llm_config["model_name"],
        temperature=llm_config.get("temperature", 0.7),
        filepath=project_root,
        embedding_api_key=embedding_config["api_key"],
        embedding_url=embedding_config["base_url"],
        embedding_interface_format=embedding_config["interface_format"],
        embedding_model_name=embedding_config["model_name"],
        interface_format=llm_config["interface_format"],
        max_tokens=llm_config.get("max_tokens", 2048),
        timeout=llm_config.get("timeout", 900),
    )
    log("Finalization completed.")
    summary = read_file(os.path.join(project_root, "global_summary.txt"))
    character_state = read_file(os.path.join(project_root, "character_state.txt"))
    return {
        "result": {"global_summary": summary, "character_state": character_state},
        "output_files": ["summary", "character_state"],
    }


def enrich(
    payload: Dict[str, Any],
    llm_config: Dict[str, Any],
    log,
) -> Dict[str, Any]:
    log("Enriching chapter text...")
    enriched = enrich_chapter_text(
        chapter_text=payload["chapter_text"],
        word_number=payload["word_number"],
        api_key=llm_config["api_key"],
        base_url=llm_config["base_url"],
        model_name=llm_config["model_name"],
        temperature=llm_config.get("temperature", 0.7),
        interface_format=llm_config["interface_format"],
        max_tokens=llm_config.get("max_tokens", 2048),
        timeout=llm_config.get("timeout", 900),
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
    results: List[Dict[str, Any]] = []

    for chapter_number in range(start_chapter, end_chapter + 1):
        if should_cancel and should_cancel():
            log("Batch cancelled.")
            raise RuntimeError("任务已取消")
        log(f"Drafting chapter {chapter_number}...")
        retrieval_k = payload.get("retrieval_k")
        if retrieval_k is None:
            retrieval_k = embedding_config.get("retrieval_k", 2)
        chapter_path = resolve_chapter_path(project_root, chapter_number)
        chapter_text = ""
        did_generate = False
        if resume_existing:
            existing_text = read_file(chapter_path)
            if existing_text.strip():
                log(f"Chapter {chapter_number} already exists, skipping generation.")
                chapter_text = existing_text

        if not chapter_text:
            chapter_payload = {
                "novel_number": chapter_number,
                "word_number": word_number,
                "characters_involved": payload.get("characters_involved", ""),
                "key_items": payload.get("key_items", ""),
                "scene_location": payload.get("scene_location", ""),
                "time_constraint": payload.get("time_constraint", ""),
                "user_guidance": payload.get("user_guidance", ""),
                "retrieval_k": retrieval_k,
            }
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
                chapter_text=chapter_text,
                word_number=word_number,
                api_key=llm_config["api_key"],
                base_url=llm_config["base_url"],
                model_name=llm_config["model_name"],
                temperature=llm_config.get("temperature", 0.7),
                interface_format=llm_config["interface_format"],
                max_tokens=llm_config.get("max_tokens", 2048),
                timeout=llm_config.get("timeout", 900),
            )
            os.makedirs(os.path.dirname(chapter_path), exist_ok=True)
            save_string_to_txt(enriched, chapter_path)
            chapter_text = enriched
            did_generate = True

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
        max_tokens=llm_config.get("max_tokens", 2048),
        timeout=llm_config.get("timeout", 900),
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
