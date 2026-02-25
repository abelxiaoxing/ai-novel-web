from __future__ import annotations

import html
import io
import os
import re
import uuid
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, List

from chapter_directory_parser import parse_chapter_blueprint
from utils import read_file


_CHAPTER_FILENAME_PATTERN = re.compile(r"^chapter_(\d+)\.txt$")


@dataclass(frozen=True)
class ExportChapter:
    """导出用章节数据。"""

    number: int
    title: str
    text: str


def sanitize_export_stem(project_name: str) -> str:
    """将项目名转为适合文件名的安全前缀。"""
    cleaned = re.sub(r"[\\/:*?\"<>|]+", "_", (project_name or "").strip())
    cleaned = cleaned.strip(" .")
    return cleaned or "novel"


def _chapter_heading(chapter_number: int, chapter_title: str) -> str:
    title = chapter_title.strip()
    if not title or title == f"第{chapter_number}章":
        return f"第{chapter_number}章"
    return f"第{chapter_number}章 {title}"


def _list_chapter_numbers(project_root: str) -> List[int]:
    chapters_dir = os.path.join(project_root, "chapters")
    if not os.path.isdir(chapters_dir):
        return []

    chapter_numbers: List[int] = []
    for filename in os.listdir(chapters_dir):
        match = _CHAPTER_FILENAME_PATTERN.match(filename)
        if match:
            chapter_numbers.append(int(match.group(1)))
    chapter_numbers.sort()
    return chapter_numbers


def _load_chapter_titles(project_root: str) -> Dict[int, str]:
    directory_path = os.path.join(project_root, "Novel_directory.txt")
    directory_text = read_file(directory_path).strip()
    if not directory_text:
        return {}

    chapter_titles: Dict[int, str] = {}
    for item in parse_chapter_blueprint(directory_text):
        chapter_number = int(item.get("chapter_number") or 0)
        chapter_title = str(item.get("chapter_title") or "").strip()
        if chapter_number > 0 and chapter_title:
            chapter_titles[chapter_number] = chapter_title

    if chapter_titles:
        return chapter_titles

    # 回退策略：仅按“第X章 - 标题”提取。
    fallback_pattern = re.compile(r"^第\s*(\d+)\s*章\s*-\s*\[?(.*?)\]?\s*$", re.MULTILINE)
    for match in fallback_pattern.finditer(directory_text):
        chapter_number = int(match.group(1))
        chapter_title = match.group(2).strip()
        if chapter_title:
            chapter_titles[chapter_number] = chapter_title
    return chapter_titles


def collect_export_chapters(project_root: str) -> List[ExportChapter]:
    """读取并整理可导出的章节（自动跳过空章节）。"""
    chapter_titles = _load_chapter_titles(project_root)
    chapters: List[ExportChapter] = []

    for chapter_number in _list_chapter_numbers(project_root):
        chapter_path = os.path.join(project_root, "chapters", f"chapter_{chapter_number}.txt")
        chapter_text = read_file(chapter_path).strip()
        if not chapter_text:
            continue
        chapters.append(
            ExportChapter(
                number=chapter_number,
                title=chapter_titles.get(chapter_number, ""),
                text=chapter_text,
            )
        )

    if not chapters:
        raise ValueError("未找到可导出的章节内容，请先生成章节文本。")
    return chapters


def build_project_txt(project_root: str, project_name: str) -> str:
    """构建项目 TXT 导出内容。"""
    chapters = collect_export_chapters(project_root)
    exported_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    lines: List[str] = [
        f"《{project_name}》",
        f"导出时间：{exported_at}",
        "",
    ]

    for chapter in chapters:
        lines.extend(
            [
                _chapter_heading(chapter.number, chapter.title),
                "",
                chapter.text,
                "",
            ]
        )

    return "\n".join(lines).strip() + "\n"


def _render_paragraphs_as_html(text: str) -> str:
    paragraphs = [segment.strip() for segment in re.split(r"\n\s*\n", text) if segment.strip()]
    if not paragraphs:
        return "<p></p>"

    html_parts: List[str] = []
    for paragraph in paragraphs:
        escaped = html.escape(paragraph).replace("\n", "<br/>")
        html_parts.append(f"<p>{escaped}</p>")
    return "\n".join(html_parts)


def _wrap_xhtml(title: str, body_html: str) -> str:
    escaped_title = html.escape(title)
    return (
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
        "<html xmlns=\"http://www.w3.org/1999/xhtml\">\n"
        "<head>\n"
        f"  <title>{escaped_title}</title>\n"
        "  <meta http-equiv=\"Content-Type\" content=\"text/html; charset=UTF-8\" />\n"
        "  <style>body{font-family:serif;line-height:1.8;padding:1.2em;}h1{font-size:1.4em;margin-bottom:1em;}p{text-indent:2em;margin:0 0 0.9em 0;}</style>\n"
        "</head>\n"
        "<body>\n"
        f"{body_html}\n"
        "</body>\n"
        "</html>"
    )


def build_project_epub(project_root: str, project_name: str) -> bytes:
    """构建项目 EPUB（二进制）。"""
    chapters = collect_export_chapters(project_root)
    book_id = f"urn:uuid:{uuid.uuid4()}"
    modified = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    manifest_items: List[str] = ['<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>']
    spine_items: List[str] = []
    nav_points: List[str] = []
    chapter_entries: List[Dict[str, str]] = []

    for index, chapter in enumerate(chapters, start=1):
        chapter_label = _chapter_heading(chapter.number, chapter.title)
        chapter_id = f"chapter_{index}"
        chapter_href = f"text/chapter_{chapter.number}.xhtml"
        chapter_html = _wrap_xhtml(
            chapter_label,
            f"<h1>{html.escape(chapter_label)}</h1>\n{_render_paragraphs_as_html(chapter.text)}",
        )

        manifest_items.append(
            f'<item id="{chapter_id}" href="{chapter_href}" media-type="application/xhtml+xml"/>'
        )
        spine_items.append(f'<itemref idref="{chapter_id}"/>')
        nav_points.append(
            "\n".join(
                [
                    f'<navPoint id="navPoint-{index}" playOrder="{index}">',
                    f"  <navLabel><text>{html.escape(chapter_label)}</text></navLabel>",
                    f"  <content src=\"{chapter_href}\"/>",
                    "</navPoint>",
                ]
            )
        )
        chapter_entries.append({"href": chapter_href, "content": chapter_html})

    manifest_block = "\n    ".join(manifest_items)
    spine_block = "\n    ".join(spine_items)
    nav_block = "\n    ".join(nav_points)

    content_opf = (
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
        "<package xmlns=\"http://www.idpf.org/2007/opf\" unique-identifier=\"bookid\" version=\"2.0\">\n"
        "  <metadata xmlns:dc=\"http://purl.org/dc/elements/1.1/\">\n"
        f"    <dc:title>{html.escape(project_name)}</dc:title>\n"
        "    <dc:language>zh-CN</dc:language>\n"
        f"    <dc:identifier id=\"bookid\">{book_id}</dc:identifier>\n"
        "    <dc:creator>AI-Novel-Web</dc:creator>\n"
        f"    <dc:date>{modified}</dc:date>\n"
        "  </metadata>\n"
        "  <manifest>\n"
        f"    {manifest_block}\n"
        "  </manifest>\n"
        "  <spine toc=\"ncx\">\n"
        f"    {spine_block}\n"
        "  </spine>\n"
        "</package>"
    )

    toc_ncx = (
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
        "<ncx xmlns=\"http://www.daisy.org/z3986/2005/ncx/\" version=\"2005-1\">\n"
        "  <head>\n"
        f"    <meta name=\"dtb:uid\" content=\"{book_id}\"/>\n"
        "    <meta name=\"dtb:depth\" content=\"1\"/>\n"
        "    <meta name=\"dtb:totalPageCount\" content=\"0\"/>\n"
        "    <meta name=\"dtb:maxPageNumber\" content=\"0\"/>\n"
        "  </head>\n"
        f"  <docTitle><text>{html.escape(project_name)}</text></docTitle>\n"
        "  <navMap>\n"
        f"    {nav_block}\n"
        "  </navMap>\n"
        "</ncx>"
    )

    container_xml = (
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
        "<container version=\"1.0\" xmlns=\"urn:oasis:names:tc:opendocument:xmlns:container\">\n"
        "  <rootfiles>\n"
        "    <rootfile full-path=\"OEBPS/content.opf\" media-type=\"application/oebps-package+xml\"/>\n"
        "  </rootfiles>\n"
        "</container>"
    )

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("mimetype", "application/epub+zip", compress_type=zipfile.ZIP_STORED)
        archive.writestr("META-INF/container.xml", container_xml, compress_type=zipfile.ZIP_DEFLATED)
        archive.writestr("OEBPS/content.opf", content_opf, compress_type=zipfile.ZIP_DEFLATED)
        archive.writestr("OEBPS/toc.ncx", toc_ncx, compress_type=zipfile.ZIP_DEFLATED)
        for chapter in chapter_entries:
            archive.writestr(
                f"OEBPS/{chapter['href']}",
                chapter["content"],
                compress_type=zipfile.ZIP_DEFLATED,
            )

    return buffer.getvalue()
