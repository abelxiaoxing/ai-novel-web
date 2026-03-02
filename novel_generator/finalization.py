#novel_generator/finalization.py
# -*- coding: utf-8 -*-
"""
定稿章节和扩写章节（finalize_chapter、enrich_chapter_text）
"""
import logging
import os
import threading
import time
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from typing import Any, Callable, Dict, Optional

from embedding_adapters import create_embedding_adapter
from llm_adapters import create_llm_adapter
from novel_generator.common import (
    invoke_with_cleaning,
    invoke_with_cleaning_streaming,
    is_cancelled_exception,
    raise_if_cancelled as raise_cancelled,
)
from novel_generator.vectorstore_utils import update_vector_store
from prompt_definitions import summary_prompt, update_character_state_prompt
from utils import clear_file_content, read_file, save_string_to_txt

logging.basicConfig(
    filename='app.log',      # 日志文件名
    filemode='a',            # 追加模式（'w' 会覆盖）
    level=logging.INFO,      # 记录 INFO 及以上级别的日志
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)


def _emit_progress(progress_callback: Optional[Callable[[str], None]], message: str) -> None:
    logging.info(message)
    if not progress_callback:
        return
    try:
        progress_callback(message)
    except Exception:
        logging.debug("Progress callback failed.", exc_info=True)


def _run_timed_step(step_name: str, worker: Callable[[], Any]) -> Dict[str, Any]:
    started = time.perf_counter()
    try:
        value = worker()
        return {
            "ok": True,
            "cancelled": False,
            "value": value,
            "error": "",
            "seconds": round(time.perf_counter() - started, 3),
            "step": step_name,
        }
    except Exception as exc:
        logging.warning("%s failed: %s", step_name, exc)
        return {
            "ok": False,
            "cancelled": is_cancelled_exception(exc),
            "value": None,
            "error": str(exc),
            "seconds": round(time.perf_counter() - started, 3),
            "step": step_name,
        }


def finalize_chapter(
    novel_number: int,
    word_number: int,
    api_key: str,
    base_url: str,
    model_name: str,
    temperature: float,
    filepath: str,
    embedding_api_key: str,
    embedding_url: str,
    embedding_interface_format: str,
    embedding_model_name: str,
    interface_format: str,
    max_tokens: int,
    timeout: int = 900,
    skip_vectorstore: bool = False,
    progress_callback: Optional[Callable[[str], None]] = None,
    llm_max_retries: int = 3,
    parallel_workers: int = 3,
    should_cancel: Optional[Callable[[], bool]] = None,
) -> Dict[str, Any]:
    """
    对指定章节做最终处理：更新前文摘要、更新角色状态、插入向量库等。
    默认无需再做扩写操作，若有需要可在外部调用 enrich_chapter_text 处理后再定稿。
    """
    total_started = time.perf_counter()
    _emit_progress(progress_callback, f"定稿开始：第 {novel_number} 章")
    stop_event = threading.Event()

    def raise_if_cancelled(stage: str) -> None:
        cancelled = stop_event.is_set() or (should_cancel and should_cancel())
        if cancelled:
            stop_event.set()
            _emit_progress(progress_callback, f"定稿已取消：{stage}")
            raise_cancelled(lambda: True)

    raise_if_cancelled("初始化阶段")

    chapters_dir = os.path.join(filepath, "chapters")
    chapter_file = os.path.join(chapters_dir, f"chapter_{novel_number}.txt")
    chapter_text = read_file(chapter_file).strip()
    if not chapter_text:
        _emit_progress(progress_callback, f"章节 {novel_number} 为空，跳过定稿。")
        return {
            "status": "skipped",
            "reason": "empty_chapter",
            "summary_updated": False,
            "character_state_updated": False,
            "vectorstore": {"updated": False, "reason": "empty_chapter", "segments": 0},
            "timings": {"total_seconds": round(time.perf_counter() - total_started, 3)},
        }

    global_summary_file = os.path.join(filepath, "global_summary.txt")
    old_global_summary = read_file(global_summary_file)
    character_state_file = os.path.join(filepath, "character_state.txt")
    old_character_state = read_file(character_state_file)

    prompt_summary = summary_prompt.format(
        chapter_text=chapter_text,
        global_summary=old_global_summary
    )
    prompt_char_state = update_character_state_prompt.format(
        chapter_text=chapter_text,
        old_state=old_character_state
    )

    def llm_should_cancel() -> bool:
        return stop_event.is_set() or bool(should_cancel and should_cancel())

    def invoke_summary() -> str:
        adapter = create_llm_adapter(
            interface_format=interface_format,
            base_url=base_url,
            model_name=model_name,
            api_key=api_key,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=timeout
        )
        return invoke_with_cleaning_streaming(
            adapter,
            prompt_summary,
            should_cancel=llm_should_cancel,
            max_retries=llm_max_retries,
        )

    def invoke_char_state() -> str:
        adapter = create_llm_adapter(
            interface_format=interface_format,
            base_url=base_url,
            model_name=model_name,
            api_key=api_key,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=timeout
        )
        return invoke_with_cleaning_streaming(
            adapter,
            prompt_char_state,
            should_cancel=llm_should_cancel,
            max_retries=llm_max_retries,
        )

    def invoke_vectorstore_update() -> Dict[str, Any]:
        return update_vector_store(
            embedding_adapter=create_embedding_adapter(
                embedding_interface_format,
                embedding_api_key,
                embedding_url,
                embedding_model_name
            ),
            new_chapter=chapter_text,
            filepath=filepath,
            chapter_number=novel_number
        )

    _emit_progress(
        progress_callback,
        (
            f"定稿计算阶段开始：摘要/角色状态并行更新（章节长度={len(chapter_text)}，"
            f"摘要长度={len(old_global_summary)}，角色状态长度={len(old_character_state)}）"
        ),
    )
    raise_if_cancelled("计算阶段开始前")

    workers = max(1, parallel_workers)
    pool = ThreadPoolExecutor(max_workers=workers)
    summary_future = pool.submit(_run_timed_step, "summary_update", invoke_summary)
    char_state_future = pool.submit(_run_timed_step, "character_state_update", invoke_char_state)
    pending = {
        summary_future: "summary_update",
        char_state_future: "character_state_update",
    }
    parallel_results: Dict[str, Dict[str, Any]] = {}
    cancelled_in_parallel = False
    try:
        while pending:
            if llm_should_cancel():
                cancelled_in_parallel = True
                break
            done, _ = wait(
                list(pending.keys()),
                timeout=0.2,
                return_when=FIRST_COMPLETED,
            )
            for future in done:
                step_name = pending.pop(future, "")
                if not step_name:
                    continue
                try:
                    parallel_results[step_name] = future.result()
                except Exception as exc:
                    parallel_results[step_name] = {
                        "ok": False,
                        "cancelled": is_cancelled_exception(exc),
                        "value": None,
                        "error": str(exc),
                        "seconds": 0.0,
                        "step": step_name,
                    }
    finally:
        if cancelled_in_parallel:
            stop_event.set()
            for future in list(pending.keys()):
                future.cancel()
            pool.shutdown(wait=False, cancel_futures=True)
        else:
            pool.shutdown(wait=True)

    if cancelled_in_parallel:
        _emit_progress(progress_callback, "取消已接收，正在中断模型调用。")
        raise_if_cancelled("并行计算阶段")

    summary_result = parallel_results.get("summary_update", {})
    char_state_result = parallel_results.get("character_state_update", {})

    if summary_result.get("cancelled") or char_state_result.get("cancelled"):
        stop_event.set()
        _emit_progress(progress_callback, "取消已接收，正在中断模型调用。")
        raise_if_cancelled("并行结果汇总阶段")

    # 并行阶段失败时，做一次串行兜底，优先保住定稿稳定性。
    if not summary_result["ok"]:
        _emit_progress(progress_callback, "前文摘要并行更新失败，尝试串行兜底一次。")
        raise_if_cancelled("前文摘要串行兜底前")
        first_try_seconds = float(summary_result.get("seconds", 0) or 0)
        fallback_result = _run_timed_step("summary_update_fallback", invoke_summary)
        fallback_result["seconds"] = round(first_try_seconds + float(fallback_result.get("seconds", 0) or 0), 3)
        summary_result = fallback_result
    if not char_state_result["ok"]:
        _emit_progress(progress_callback, "角色状态并行更新失败，尝试串行兜底一次。")
        raise_if_cancelled("角色状态串行兜底前")
        first_try_seconds = float(char_state_result.get("seconds", 0) or 0)
        fallback_result = _run_timed_step("character_state_update_fallback", invoke_char_state)
        fallback_result["seconds"] = round(first_try_seconds + float(fallback_result.get("seconds", 0) or 0), 3)
        char_state_result = fallback_result

    if summary_result.get("cancelled") or char_state_result.get("cancelled"):
        stop_event.set()
        _emit_progress(progress_callback, "取消已接收，正在中断模型调用。")
        raise_if_cancelled("串行兜底阶段")

    summary_text = old_global_summary
    summary_updated = False
    if summary_result["ok"]:
        candidate = str(summary_result["value"] or "").strip()
        if candidate:
            summary_text = candidate
            summary_updated = candidate != old_global_summary
        else:
            _emit_progress(progress_callback, "前文摘要更新返回空内容，保留旧摘要。")
    else:
        _emit_progress(progress_callback, f"前文摘要更新失败，保留旧摘要。原因：{summary_result['error']}")

    char_state_text = old_character_state
    char_state_updated = False
    if char_state_result["ok"]:
        candidate = str(char_state_result["value"] or "").strip()
        if candidate:
            char_state_text = candidate
            char_state_updated = candidate != old_character_state
        else:
            _emit_progress(progress_callback, "角色状态更新返回空内容，保留旧状态。")
    else:
        _emit_progress(progress_callback, f"角色状态更新失败，保留旧状态。原因：{char_state_result['error']}")

    raise_if_cancelled("计算阶段完成，写入前")
    clear_file_content(global_summary_file)
    save_string_to_txt(summary_text, global_summary_file)
    clear_file_content(character_state_file)
    save_string_to_txt(char_state_text, character_state_file)
    _emit_progress(progress_callback, "定稿写入阶段完成：摘要与角色状态已落盘。")

    if skip_vectorstore:
        vectorstore_result = {
            "ok": True,
            "value": {"updated": False, "reason": "skipped", "segments": 0},
            "error": "",
            "seconds": 0.0,
            "step": "vectorstore_update",
        }
    else:
        raise_if_cancelled("写入完成，向量库更新前")
        _emit_progress(progress_callback, "定稿向量阶段开始：更新向量库。")
        vectorstore_result = _run_timed_step("vectorstore_update", invoke_vectorstore_update)

    vectorstore_value = vectorstore_result.get("value") if vectorstore_result else None
    if isinstance(vectorstore_value, dict):
        vectorstore_payload = {
            "updated": bool(vectorstore_value.get("updated")),
            "reason": str(vectorstore_value.get("reason", "unknown")),
            "segments": int(vectorstore_value.get("segments", 0)),
        }
    else:
        vectorstore_payload = {
            "updated": bool(vectorstore_value),
            "reason": "updated" if vectorstore_value else "unknown",
            "segments": 0,
        }
    if not vectorstore_result["ok"]:
        vectorstore_payload["updated"] = False
        vectorstore_payload["reason"] = "error"
        _emit_progress(progress_callback, f"向量库更新失败，已跳过。原因：{vectorstore_result['error']}")
    elif vectorstore_payload["reason"] == "unchanged":
        _emit_progress(progress_callback, "向量库检测到章节内容未变化，跳过重建向量。")

    total_seconds = round(time.perf_counter() - total_started, 3)
    timings = {
        "summary_update_seconds": summary_result["seconds"],
        "character_state_update_seconds": char_state_result["seconds"],
        "vectorstore_update_seconds": vectorstore_result["seconds"],
        "total_seconds": total_seconds,
    }
    _emit_progress(
        progress_callback,
        (
            f"定稿完成：第 {novel_number} 章 "
            f"(summary={timings['summary_update_seconds']}s, "
            f"character={timings['character_state_update_seconds']}s, "
            f"vectorstore={timings['vectorstore_update_seconds']}s, total={total_seconds}s)"
        ),
    )

    return {
        "status": "ok",
        "summary_updated": summary_updated,
        "character_state_updated": char_state_updated,
        "vectorstore": vectorstore_payload,
        "timings": timings,
    }


def enrich_chapter_text(
    chapter_text: str,
    word_number: int,
    api_key: str,
    base_url: str,
    model_name: str,
    temperature: float,
    interface_format: str,
    max_tokens: int,
    timeout: int = 900
) -> str:
    """
    对章节文本进行扩写，使其更接近 word_number 字数，保持剧情连贯。
    """
    llm_adapter = create_llm_adapter(
        interface_format=interface_format,
        base_url=base_url,
        model_name=model_name,
        api_key=api_key,
        temperature=temperature,
        max_tokens=max_tokens,
        timeout=timeout
    )
    prompt = f"""以下章节文本较短，请在保持剧情连贯的前提下进行扩写，使其更充实，接近 {word_number} 字左右，仅给出最终文本，不要解释任何内容。：
原内容：
{chapter_text}
"""
    enriched_text = invoke_with_cleaning(llm_adapter, prompt)
    return enriched_text if enriched_text else chapter_text
