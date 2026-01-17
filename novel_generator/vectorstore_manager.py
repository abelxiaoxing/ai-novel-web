# -*- coding: utf-8 -*-
"""
向量库管理模块（获取摘要、按章节删除等）
"""
import logging
from typing import Any, Dict, List
from novel_generator.vectorstore_utils import load_vector_store


logger = logging.getLogger(__name__)


def get_vectorstore_summary(embedding_adapter, filepath: str) -> Dict[str, Any]:
    """
    获取向量库摘要，按来源分组统计。

    Args:
        embedding_adapter: Embedding 适配器
        filepath: 项目根目录

    Returns:
        字典格式的摘要数据：
        {
            "total_count": int,      # 总文档数
            "groups": [              # 分组列表
                {"type": "chapter", "chapter": 1, "count": 50},
                {"type": "chapter", "chapter": 2, "count": 45},
                {"type": "knowledge", "count": 55}
            ]
        }
        如果向量库不存在或为空，返回 {"total_count": 0, "groups": []}
    """
    store = load_vector_store(embedding_adapter, filepath)
    if not store:
        logger.info("Vector store not found or failed to load.")
        return {"total_count": 0, "groups": []}

    try:
        # 使用 Chroma 底层 API 获取所有文档
        collection = store._collection
        result = collection.get()

        if not result or not result.get("ids"):
            return {"total_count": 0, "groups": []}

        # 统计分组
        chapter_groups: Dict[int, int] = {}  # {章节号: 数量}
        knowledge_count = 0

        metadatas = result.get("metadatas", [])
        for metadata in metadatas:
            if metadata and "chapter" in metadata:
                chapter_num = metadata["chapter"]
                chapter_groups[chapter_num] = chapter_groups.get(chapter_num, 0) + 1
            else:
                knowledge_count += 1

        # 构建分组列表
        groups = []
        for chapter_num in sorted(chapter_groups.keys()):
            groups.append({
                "type": "chapter",
                "chapter": chapter_num,
                "count": chapter_groups[chapter_num]
            })

        if knowledge_count > 0:
            groups.append({
                "type": "knowledge",
                "count": knowledge_count
            })

        return {
            "total_count": len(result["ids"]),
            "groups": groups
        }

    except Exception as e:
        logger.warning(f"Failed to get vectorstore summary: {e}")
        return {"total_count": 0, "groups": []}


def delete_vectorstore_by_chapter(embedding_adapter, filepath: str, chapter_number: int) -> int:
    """
    删除指定章节的所有向量文档。

    Args:
        embedding_adapter: Embedding 适配器
        filepath: 项目根目录
        chapter_number: 要删除的章节号

    Returns:
        删除的文档数量。如果向量库不存在或删除失败，返回 0。
    """
    store = load_vector_store(embedding_adapter, filepath)
    if not store:
        logger.info("Vector store not found or failed to load.")
        return 0

    try:
        collection = store._collection
        # 查找该章节的所有文档
        existing = collection.get(where={"chapter": chapter_number})

        if existing and existing.get("ids"):
            ids_to_delete = existing["ids"]
            collection.delete(ids=ids_to_delete)
            logger.info(f"Deleted {len(ids_to_delete)} documents for chapter {chapter_number}.")
            return len(ids_to_delete)
        else:
            logger.info(f"No documents found for chapter {chapter_number}.")
            return 0

    except Exception as e:
        logger.warning(f"Failed to delete chapter {chapter_number} from vectorstore: {e}")
        return 0
