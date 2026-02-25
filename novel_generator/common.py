#novel_generator/common.py
# -*- coding: utf-8 -*-
"""
通用重试、清洗、日志工具
"""
import logging
import os
import re
import time
import traceback
from json import JSONDecodeError
logging.basicConfig(
    filename='app.log',      # 日志文件名
    filemode='a',            # 追加模式（'w' 会覆盖）
    level=logging.INFO,      # 记录 INFO 及以上级别的日志
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
def call_with_retry(func, max_retries=3, sleep_time=2, fallback_return=None, **kwargs):
    """
    通用的重试机制封装。
    :param func: 要执行的函数
    :param max_retries: 最大重试次数
    :param sleep_time: 重试前的等待秒数
    :param fallback_return: 如果多次重试仍失败时的返回值
    :param kwargs: 传给func的命名参数
    :return: func的结果，若失败则返回 fallback_return
    """
    for attempt in range(1, max_retries + 1):
        try:
            return func(**kwargs)
        except Exception as e:
            logging.warning(f"[call_with_retry] Attempt {attempt} failed with error: {e}")
            traceback.print_exc()
            if attempt < max_retries:
                time.sleep(sleep_time)
            else:
                logging.error("Max retries reached, returning fallback_return.")
                return fallback_return

def remove_think_tags(text: str) -> str:
    """移除 <think>...</think> 包裹的内容"""
    return re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL)

def debug_log(prompt: str, response_content: str):
    logging.info(
        f"\n[#########################################  Prompt  #########################################]\n{prompt}\n"
    )
    logging.info(
        f"\n[######################################### Response #########################################]\n{response_content}\n"
    )

def _is_retryable_error(error: Exception) -> bool:
    if isinstance(error, JSONDecodeError):
        return True

    message = str(error).lower()
    non_retry_signals = [
        "invalid api key",
        "incorrect api key",
        "unauthorized",
        "authentication",
        "permission",
        "forbidden",
        "not found",
        "bad request",
        "model not found",
        "404",
        "403",
        "401",
        "400",
    ]
    if any(signal in message for signal in non_retry_signals):
        return False

    retry_signals = [
        "jsondecodeerror",
        "expecting value",
        "empty",
        "no response",
        "no content",
        "未返回",
        "内容为空",
        "timeout",
        "timed out",
        "rate limit",
        "429",
        "502",
        "503",
        "504",
        "gateway",
        "connection",
        "temporarily",
        "server error",
        "internal server",
    ]
    return any(signal in message for signal in retry_signals) or not message


def _retry_backoff_seconds(attempt: int, base: float = 2.0, max_sleep: float = 30.0) -> float:
    return min(max_sleep, base * (2 ** (attempt - 1)))


def _debug_llm_io_enabled() -> bool:
    value = os.environ.get("AINOVEL_DEBUG_LLM_IO", "").strip().lower()
    return value in {"1", "true", "yes", "on"}


def _debug_print_block(title: str, content: str) -> None:
    if not _debug_llm_io_enabled():
        return
    print("\n" + "=" * 50)
    print(title)
    print("-" * 50)
    print(content)
    print("=" * 50 + "\n")


def invoke_with_cleaning(llm_adapter, prompt: str, max_retries: int = 7) -> str:
    """调用 LLM 并清理返回结果"""
    _debug_print_block("发送到 LLM 的提示词:", prompt)
    
    result = ""
    retry_count = 0
    logging.info("LLM 调用开始，prompt长度=%s，max_retries=%s", len(prompt), max_retries)

    while retry_count < max_retries:
        try:
            result = llm_adapter.invoke(prompt)
            _debug_print_block("LLM 返回的内容:", result)

            # 清理结果中的特殊格式标记
            result = result.replace("```", "").strip()
            if result:
                return result

            retry_count += 1
            if retry_count < max_retries:
                sleep_seconds = _retry_backoff_seconds(retry_count)
                logging.warning(
                    "Empty LLM response, retrying (%s/%s) after %.1fs.",
                    retry_count,
                    max_retries,
                    sleep_seconds,
                )
                time.sleep(sleep_seconds)
        except Exception as e:
            retry_count += 1
            logging.warning("LLM invoke failed (%s/%s): %s", retry_count, max_retries, e)
            if retry_count >= max_retries or not _is_retryable_error(e):
                raise
            sleep_seconds = _retry_backoff_seconds(retry_count)
            time.sleep(sleep_seconds)

    return result
