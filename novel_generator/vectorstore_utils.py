#novel_generator/vectorstore_utils.py
# -*- coding: utf-8 -*-
"""
向量库相关操作（初始化、更新、检索、清空、文本切分等）
"""
import os
import hashlib
import logging
import re
import traceback
import nltk
from langchain_chroma import Chroma
logging.basicConfig(
    filename='app.log',      # 日志文件名
    filemode='a',            # 追加模式（'w' 会覆盖）
    level=logging.INFO,      # 记录 INFO 及以上级别的日志
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

from chromadb.config import Settings
from langchain.docstore.document import Document
from .common import call_with_retry

def get_vectorstore_dir(filepath: str) -> str:
    """获取 vectorstore 路径"""
    return os.path.join(filepath, "vectorstore")

def clear_vector_store(filepath: str) -> bool:
    """清空 清空向量库"""
    import shutil
    store_dir = get_vectorstore_dir(filepath)
    if not os.path.exists(store_dir):
        logging.info("No vector store found to clear.")
        return False
    try:
        shutil.rmtree(store_dir)
        logging.info(f"Vector store directory '{store_dir}' removed.")
        return True
    except Exception as e:
        logging.error(f"无法删除向量库文件夹，请关闭程序后手动删除 {store_dir}。\n {str(e)}")
        traceback.print_exc()
        return False

def init_vector_store(embedding_adapter, texts, filepath: str):
    """
    在 filepath 下创建/加载一个 Chroma 向量库并插入 texts。
    如果Embedding失败，则返回 None，不中断任务。
    """
    docs = [Document(page_content=str(t)) for t in texts]
    return init_vector_store_from_docs(embedding_adapter, docs, filepath)


def init_vector_store_from_docs(embedding_adapter, documents, filepath: str):
    """
    在 filepath 下创建/加载一个 Chroma 向量库并插入 documents。
    如果Embedding失败，则返回 None，不中断任务。
    """
    from langchain.embeddings.base import Embeddings as LCEmbeddings

    store_dir = get_vectorstore_dir(filepath)
    os.makedirs(store_dir, exist_ok=True)

    try:
        class LCEmbeddingWrapper(LCEmbeddings):
            def embed_documents(self, texts):
                return call_with_retry(
                    func=embedding_adapter.embed_documents,
                    max_retries=2,
                    sleep_time=1,
                    fallback_return=[],
                    texts=texts
                )
            def embed_query(self, query: str):
                res = call_with_retry(
                    func=embedding_adapter.embed_query,
                    max_retries=2,
                    sleep_time=1,
                    fallback_return=[],
                    query=query
                )
                return res

        chroma_embedding = LCEmbeddingWrapper()
        vectorstore = Chroma.from_documents(
            documents,
            embedding=chroma_embedding,
            persist_directory=store_dir,
            client_settings=Settings(anonymized_telemetry=False),
            collection_name="novel_collection"
        )
        return vectorstore
    except Exception as e:
        logging.warning(f"Init vector store failed: {e}")
        traceback.print_exc()
        return None

def load_vector_store(embedding_adapter, filepath: str):
    """
    读取已存在的 Chroma 向量库。若不存在则返回 None。
    如果加载失败（embedding 或IO问题），则返回 None。
    """
    from langchain.embeddings.base import Embeddings as LCEmbeddings
    store_dir = get_vectorstore_dir(filepath)
    if not os.path.exists(store_dir):
        logging.info("Vector store not found. Will return None.")
        return None

    try:
        class LCEmbeddingWrapper(LCEmbeddings):
            def embed_documents(self, texts):
                return call_with_retry(
                    func=embedding_adapter.embed_documents,
                    max_retries=2,
                    sleep_time=1,
                    fallback_return=[],
                    texts=texts
                )
            def embed_query(self, query: str):
                res = call_with_retry(
                    func=embedding_adapter.embed_query,
                    max_retries=2,
                    sleep_time=1,
                    fallback_return=[],
                    query=query
                )
                return res

        chroma_embedding = LCEmbeddingWrapper()
        return Chroma(
            persist_directory=store_dir,
            embedding_function=chroma_embedding,
            client_settings=Settings(anonymized_telemetry=False),
            collection_name="novel_collection"
        )
    except Exception as e:
        logging.warning(f"Failed to load vector store: {e}")
        traceback.print_exc()
        return None

def split_by_length(text: str, max_length: int = 500):
    """按照 max_length 切分文本"""
    segments = []
    start_idx = 0
    while start_idx < len(text):
        end_idx = min(start_idx + max_length, len(text))
        segment = text[start_idx:end_idx]
        segments.append(segment.strip())
        start_idx = end_idx
    return segments

def split_text_for_vectorstore(chapter_text: str, max_length: int = 500, similarity_threshold: float = 0.7):
    """
    对新的章节文本进行分段后用于存入向量库。
    """
    if not chapter_text.strip():
        return []

    sentences = []
    try:
        sentences = nltk.sent_tokenize(chapter_text)
    except LookupError:
        logging.warning("NLTK punkt 不可用，使用轻量级分句回退策略。")
    except Exception as e:
        # punkt 资源损坏时可能抛出 BadZipFile（File is not a zip file）。
        logging.warning("NLTK 分句失败（%s），使用轻量级分句回退策略。", e)
    if not sentences:
        rough_sentences = re.split(r"(?<=[。！？.!?])\s+", chapter_text)
        sentences = [line.strip() for line in rough_sentences if line.strip()]
    if not sentences:
        sentences = split_by_length(chapter_text, max_length=max_length)
    if not sentences:
        return []
    
    # 直接按长度分段,不做相似度合并
    final_segments = []
    current_segment = []
    current_length = 0
    
    for sentence in sentences:
        sentence_length = len(sentence)
        if current_length + sentence_length > max_length:
            if current_segment:
                final_segments.append(" ".join(current_segment))
            current_segment = [sentence]
            current_length = sentence_length
        else:
            current_segment.append(sentence)
            current_length += sentence_length
    
    if current_segment:
        final_segments.append(" ".join(current_segment))
    
    return [segment for segment in final_segments if segment.strip()]


def _calculate_text_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def update_vector_store(embedding_adapter, new_chapter: str, filepath: str, chapter_number: int = None):
    """
    将最新章节文本插入到向量库中。
    若库不存在则初始化；若初始化/更新失败，则跳过。
    如果提供 chapter_number，会先删除该章节的旧文档再添加新文档（支持重新定稿）。
    """
    splitted_texts = split_text_for_vectorstore(new_chapter)
    if not splitted_texts:
        logging.warning("No valid text to insert into vector store. Skipping.")
        return {"updated": False, "reason": "empty_text", "segments": 0}

    chapter_hash = _calculate_text_hash(new_chapter)
    metadata = {"chapter_hash": chapter_hash}
    if chapter_number is not None:
        metadata["chapter"] = chapter_number

    store = load_vector_store(embedding_adapter, filepath)
    if not store:
        logging.info("Vector store does not exist or failed to load. Initializing a new one for new chapter...")
        docs = [Document(page_content=str(t), metadata=metadata) for t in splitted_texts]
        store = init_vector_store_from_docs(embedding_adapter, docs, filepath)
        if not store:
            logging.warning("Init vector store failed, skip embedding.")
            return {"updated": False, "reason": "init_failed", "segments": len(splitted_texts)}
        else:
            logging.info("New vector store created successfully.")
            return {"updated": True, "reason": "initialized", "segments": len(splitted_texts)}

    try:
        # 如果提供了章节号，先删除该章节的旧文档
        if chapter_number is not None:
            try:
                collection = store._collection
                existing = collection.get(where={"chapter": chapter_number}, include=["metadatas"])
                existing_ids = []
                if isinstance(existing, dict):
                    existing_ids = existing.get("ids") or []
                if existing_ids:
                    existing_metadatas = existing.get("metadatas") or []
                    existing_hashes = {
                        item.get("chapter_hash")
                        for item in existing_metadatas
                        if isinstance(item, dict) and item.get("chapter_hash")
                    }
                    # 章节内容未变化时跳过重嵌入，避免重复耗时。
                    if len(existing_hashes) == 1 and chapter_hash in existing_hashes:
                        logging.info(
                            "Chapter %s content unchanged, skip vectorstore re-embedding.",
                            chapter_number,
                        )
                        return {"updated": False, "reason": "unchanged", "segments": len(splitted_texts)}
                    collection.delete(ids=existing_ids)
                    logging.info(f"Deleted {len(existing_ids)} old documents for chapter {chapter_number}.")
            except Exception as e:
                logging.warning(f"Failed to delete old chapter documents: {e}")

        docs = [Document(page_content=str(t), metadata=metadata) for t in splitted_texts]
        store.add_documents(docs)
        logging.info("Vector store updated with the new chapter splitted segments.")
        return {"updated": True, "reason": "updated", "segments": len(splitted_texts)}
    except Exception as e:
        logging.warning(f"Failed to update vector store: {e}")
        traceback.print_exc()
        return {"updated": False, "reason": "update_failed", "segments": len(splitted_texts)}

def get_relevant_context_from_vector_store(embedding_adapter, query: str, filepath: str, k: int = 2) -> str:
    """
    从向量库中检索与 query 最相关的 k 条文本，拼接后返回。
    如果向量库加载/检索失败，则返回空字符串。
    最终只返回最多2000字符的检索片段。
    """
    store = load_vector_store(embedding_adapter, filepath)
    if not store:
        logging.info("No vector store found or load failed. Returning empty context.")
        return ""

    try:
        docs = store.similarity_search(query, k=k)
        if not docs:
            logging.info(f"No relevant documents found for query '{query}'. Returning empty context.")
            return ""
        combined = "\n".join([d.page_content for d in docs])
        if len(combined) > 2000:
            combined = combined[:2000]
        return combined
    except Exception as e:
        logging.warning(f"Similarity search failed: {e}")
        traceback.print_exc()
        return ""
