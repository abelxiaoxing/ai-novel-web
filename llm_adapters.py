# llm_adapters.py
# -*- coding: utf-8 -*-
import logging
import re
from typing import Any, Optional

from langchain_openai import ChatOpenAI
from openai import OpenAI


def check_base_url(url: str) -> str:
    url = str(url or "").strip()
    if not url:
        return url
    if url.endswith("#"):
        return url[:-1]
    if "/v1" not in url and not re.search(r"/v\d+$", url):
        return url.rstrip("/") + "/v1"
    return url


def _normalize_stream_text(content: Any) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
                continue
            text = ""
            if isinstance(item, dict):
                text = str(item.get("text", "") or "")
            else:
                text = str(getattr(item, "text", "") or "")
            if text:
                parts.append(text)
        return "".join(parts)
    return str(content)


def _extract_openai_chunk_text(chunk: Any) -> str:
    choices = getattr(chunk, "choices", None) or []
    if not choices:
        return ""
    delta = getattr(choices[0], "delta", None)
    if delta is None and isinstance(choices[0], dict):
        delta = choices[0].get("delta")
    if delta is None:
        return ""
    content = getattr(delta, "content", None)
    if content is None and isinstance(delta, dict):
        content = delta.get("content")
    return _normalize_stream_text(content)


def _stream_openai_chat_completions(
    client: OpenAI,
    *,
    model_name: str,
    messages: list[dict[str, str]],
    max_tokens: int,
    temperature: float,
    timeout: Optional[int],
):
    stream = client.chat.completions.create(
        model=model_name,
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
        timeout=timeout,
        stream=True,
    )
    try:
        for chunk in stream:
            text = _extract_openai_chunk_text(chunk)
            if text:
                yield text
    finally:
        close_fn = getattr(stream, "close", None)
        if callable(close_fn):
            close_fn()


class BaseLLMAdapter:
    def invoke(self, prompt: str) -> str:
        raise NotImplementedError("Subclasses must implement .invoke(prompt) method.")

    def stream(self, prompt: str):
        logging.warning(
            "%s 未实现原生流式，回退到阻塞 invoke（取消中断能力较弱）。",
            self.__class__.__name__,
        )
        result = self.invoke(prompt)
        yield result


class OpenAIAdapter(BaseLLMAdapter):
    def __init__(
        self,
        api_key: str,
        base_url: str,
        model_name: str,
        max_tokens: int,
        temperature: float = 0.7,
        timeout: Optional[int] = 600,
    ):
        self.base_url = check_base_url(base_url)
        self.api_key = api_key
        self.model_name = model_name
        self.max_tokens = max_tokens
        self.temperature = temperature
        self.timeout = timeout

        self._client = ChatOpenAI(
            model=self.model_name,
            api_key=self.api_key,
            base_url=self.base_url,
            max_tokens=self.max_tokens,
            temperature=self.temperature,
            timeout=self.timeout,
        )
        self._stream_client = OpenAI(
            base_url=self.base_url,
            api_key=self.api_key,
            timeout=self.timeout,
        )

    def invoke(self, prompt: str) -> str:
        response = self._client.invoke(prompt)
        content = getattr(response, "content", None) if response else None
        if not content:
            raise RuntimeError("OpenAIAdapter 未返回有效内容。")
        return content

    def stream(self, prompt: str):
        has_yielded = False
        try:
            for chunk in _stream_openai_chat_completions(
                self._stream_client,
                model_name=self.model_name,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=self.max_tokens,
                temperature=self.temperature,
                timeout=self.timeout,
            ):
                has_yielded = True
                yield chunk
        except Exception as e:
            if has_yielded:
                logging.warning("OpenAI 流式调用中断，取消回退以避免文本重复：%s", e)
                raise
            logging.warning("OpenAI 流式调用失败，回退 invoke：%s", e)
            yield self.invoke(prompt)


def create_llm_adapter(
    interface_format: str,
    base_url: str,
    model_name: str,
    api_key: str,
    temperature: float,
    max_tokens: int,
    timeout: int,
) -> BaseLLMAdapter:
    # 保留 interface_format 入参以兼容现有调用，当前统一走 OpenAI 兼容协议。
    _ = interface_format
    return OpenAIAdapter(api_key, base_url, model_name, max_tokens, temperature, timeout)
