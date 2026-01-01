from __future__ import annotations

import os
from typing import Any, Dict, Optional, Tuple

from config_manager import load_config, save_config


class ConfigStore:
    def __init__(self, config_path: Optional[str] = None) -> None:
        default_path = os.environ.get("AINOVEL_CONFIG_FILE", "config.json")
        self._config_path = config_path or default_path

    def load(self) -> Dict[str, Any]:
        return load_config(self._config_path)

    def save(self, config: Dict[str, Any]) -> None:
        save_config(config, self._config_path)

    def get_llm_configs(self) -> Dict[str, Any]:
        configs = self.load().get("llm_configs", {})
        return self._normalize_configs(configs)

    def get_embedding_configs(self) -> Dict[str, Any]:
        configs = self.load().get("embedding_configs", {})
        return self._normalize_configs(configs)

    def get_choose_configs(self) -> Dict[str, str]:
        return self.load().get("choose_configs", {})

    def resolve_llm_config(self, purpose: str, name_override: Optional[str] = None) -> Tuple[str, Dict[str, Any]]:
        config = self.load()
        llm_configs = config.get("llm_configs", {})
        if not llm_configs:
            raise ValueError("No LLM configs available.")

        name = name_override or self._choose_llm_name(config.get("choose_configs", {}), purpose)
        if not name:
            name = next(iter(llm_configs.keys()))
        if name not in llm_configs:
            raise ValueError(f"LLM config '{name}' not found.")
        return name, self._normalize_entry(llm_configs[name])

    def resolve_embedding_config(self, name_override: Optional[str] = None) -> Tuple[str, Dict[str, Any]]:
        config = self.load()
        embedding_configs = config.get("embedding_configs", {})
        if not embedding_configs:
            raise ValueError("No embedding configs available.")
        name = name_override or next(iter(embedding_configs.keys()))
        if name not in embedding_configs:
            raise ValueError(f"Embedding config '{name}' not found.")
        return name, self._normalize_entry(embedding_configs[name])

    @staticmethod
    def _choose_llm_name(choose_configs: Dict[str, str], purpose: str) -> Optional[str]:
        mapping = {
            "architecture": "architecture_llm",
            "blueprint": "chapter_outline_llm",
            "build_prompt": "prompt_draft_llm",
            "draft": "prompt_draft_llm",
            "finalize": "final_chapter_llm",
            "consistency": "consistency_review_llm",
            "enrich": "final_chapter_llm",
            "batch": "prompt_draft_llm",
        }
        key = mapping.get(purpose)
        return choose_configs.get(key) if key else None

    @staticmethod
    def _normalize_entry(entry: Any) -> Any:
        if isinstance(entry, dict) and "entry" in entry and isinstance(entry["entry"], dict):
            return entry["entry"]
        return entry

    @classmethod
    def _normalize_configs(cls, configs: Dict[str, Any]) -> Dict[str, Any]:
        return {name: cls._normalize_entry(entry) for name, entry in configs.items()}
