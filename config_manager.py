# config_manager.py
# -*- coding: utf-8 -*-
import copy
import json
import os
import threading
from typing import Any, Dict, Optional

from embedding_adapters import create_embedding_adapter
from llm_adapters import create_llm_adapter


_FALLBACK_CONFIG: Dict[str, Any] = {
    "last_interface_format": "OpenAI",
    "last_embedding_interface_format": "OpenAI",
    "llm_configs": {
        "DeepSeek V3": {
            "api_key": "",
            "base_url": "https://api.deepseek.com/v1",
            "model_name": "deepseek-chat",
            "temperature": 0.7,
            "max_tokens": 8192,
            "timeout": 900,
            "interface_format": "OpenAI",
        },
        "GPT 5": {
            "api_key": "",
            "base_url": "https://api.openai.com/v1",
            "model_name": "gpt-5",
            "temperature": 0.7,
            "max_tokens": 32768,
            "timeout": 900,
            "interface_format": "OpenAI",
        },
        "Gemini 2.5 Pro": {
            "api_key": "",
            "base_url": "https://generativelanguage.googleapis.com/v1beta/openai",
            "model_name": "gemini-2.5-pro",
            "temperature": 0.7,
            "max_tokens": 32768,
            "timeout": 900,
            "interface_format": "OpenAI",
        },
    },
    "embedding_configs": {
        "OpenAI": {
            "api_key": "",
            "base_url": "https://api.openai.com/v1",
            "model_name": "text-embedding-ada-002",
            "retrieval_k": 4,
            "interface_format": "OpenAI",
        }
    },
    "other_params": {
        "topic": "",
        "genre": "",
        "num_chapters": 0,
        "word_number": 0,
        "filepath": "",
        "chapter_num": "120",
        "user_guidance": "",
        "characters_involved": "",
        "key_items": "",
        "scene_location": "",
        "time_constraint": "",
    },
    "choose_configs": {
        "prompt_draft_llm": "DeepSeek V3",
        "chapter_outline_llm": "DeepSeek V3",
        "architecture_llm": "Gemini 2.5 Pro",
        "finalize_llm": "GPT 5",
        "consistency_llm": "DeepSeek V3",
    },
    "proxy_setting": {
        "proxy_url": "127.0.0.1",
        "proxy_port": "",
        "enabled": False,
    },
    "webdav_config": {
        "webdav_url": "",
        "webdav_username": "",
        "webdav_password": "",
    },
}


def load_config(config_file: str, *, apply_env: bool = True) -> dict:
    """从指定的 config_file 加载配置，若不存在则创建一个默认配置文件。"""

    base_config = _load_template_config()

    # PenBo 修改代码，增加配置文件不存在则创建一个默认配置文件
    if not os.path.exists(config_file):
        legacy_path = os.path.join(os.path.dirname(__file__), "config.json")
        legacy_config = _load_json_file(legacy_path)
        if legacy_config:
            create_config(config_file, legacy_config)
        else:
            create_config(config_file, base_config)

    user_config = _load_json_file(config_file)
    merged = _deep_merge(base_config, user_config)
    return _apply_env_overrides(merged) if apply_env else merged


def create_config(config_file: str, base_config: Optional[Dict[str, Any]] = None) -> dict:
    """创建一个默认配置文件。"""
    config = copy.deepcopy(base_config or _FALLBACK_CONFIG)
    save_config(config, config_file)
    return config


def _load_json_file(path: str) -> Dict[str, Any]:
    try:
        with open(path, "r", encoding="utf-8") as handle:
            data = json.load(handle)
            return data if isinstance(data, dict) else {}
    except FileNotFoundError:
        return {}
    except Exception:
        return {}


def _load_template_config() -> Dict[str, Any]:
    template_path = os.path.join(os.path.dirname(__file__), "config.example.json")
    data = _load_json_file(template_path)
    if data:
        return data
    return copy.deepcopy(_FALLBACK_CONFIG)


def _deep_merge(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    merged: Dict[str, Any] = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def _apply_env_overrides(config: Dict[str, Any]) -> Dict[str, Any]:
    overrides_raw = os.environ.get("AINOVEL_CONFIG_OVERRIDES")
    if overrides_raw:
        try:
            overrides = json.loads(overrides_raw)
            if isinstance(overrides, dict):
                config = _deep_merge(config, overrides)
        except json.JSONDecodeError:
            pass

    llm_api_key = os.environ.get("AINOVEL_LLM_API_KEY") or os.environ.get("OPENAI_API_KEY")
    if llm_api_key:
        _apply_api_key_override(config.get("llm_configs", {}), llm_api_key)

    embedding_api_key = os.environ.get("AINOVEL_EMBEDDING_API_KEY") or os.environ.get("OPENAI_API_KEY")
    if embedding_api_key:
        _apply_api_key_override(config.get("embedding_configs", {}), embedding_api_key)

    return config


def _apply_api_key_override(configs: Any, api_key: str) -> None:
    if not isinstance(configs, dict):
        return
    for entry in configs.values():
        if isinstance(entry, dict) and isinstance(entry.get("entry"), dict):
            target = entry["entry"]
        else:
            target = entry
        if isinstance(target, dict) and not target.get("api_key"):
            target["api_key"] = api_key



def save_config(config_data: dict, config_file: str) -> bool:
    """将 config_data 保存到 config_file 中，返回 True/False 表示是否成功。"""
    try:
        dir_path = os.path.dirname(config_file)
        if dir_path:
            os.makedirs(dir_path, exist_ok=True)
        with open(config_file, "w", encoding="utf-8") as f:
            json.dump(config_data, f, ensure_ascii=False, indent=4)
        return True
    except:
        return False

def test_llm_config(interface_format, api_key, base_url, model_name, temperature, max_tokens, timeout, log_func, handle_exception_func):
    """测试当前的LLM配置是否可用"""
    def task():
        try:
            log_func("开始测试LLM配置...")
            llm_adapter = create_llm_adapter(
                interface_format=interface_format,
                base_url=base_url,
                model_name=model_name,
                api_key=api_key,
                temperature=temperature,
                max_tokens=max_tokens,
                timeout=timeout
            )

            test_prompt = "Please reply 'OK'"
            response = llm_adapter.invoke(test_prompt)
            if response:
                log_func("✅ LLM配置测试成功！")
                log_func(f"测试回复: {response}")
            else:
                log_func("❌ LLM配置测试失败：未获取到响应")
        except Exception as e:
            log_func(f"❌ LLM配置测试出错: {str(e)}")
            handle_exception_func("测试LLM配置时出错")

    threading.Thread(target=task, daemon=True).start()

def test_embedding_config(api_key, base_url, interface_format, model_name, log_func, handle_exception_func):
    """测试当前的Embedding配置是否可用"""
    def task():
        try:
            log_func("开始测试Embedding配置...")
            embedding_adapter = create_embedding_adapter(
                interface_format=interface_format,
                api_key=api_key,
                base_url=base_url,
                model_name=model_name
            )

            test_text = "测试文本"
            embeddings = embedding_adapter.embed_query(test_text)
            if embeddings and len(embeddings) > 0:
                log_func("✅ Embedding配置测试成功！")
                log_func(f"生成的向量维度: {len(embeddings)}")
            else:
                log_func("❌ Embedding配置测试失败：未获取到向量")
        except Exception as e:
            log_func(f"❌ Embedding配置测试出错: {str(e)}")
            handle_exception_func("测试Embedding配置时出错")

    threading.Thread(target=task, daemon=True).start()
