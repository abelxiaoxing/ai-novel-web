# AI 二次开发指南（基于当前代码实况）

## 一句话概览
本项目是“项目制小说生成器”：前端管理项目与章节，后端以任务方式驱动生成流程，核心引擎在 `novel_generator/` 里完成架构、蓝图、章节、向量检索与定稿。

## 运行中的真实结构（非理想化）
### 三层分工
- Web UI：`webui/`（Vue 3 + Pinia），入口页为项目选择与工作台。
- 后端 API：`backend/api_server.py`（FastAPI + 任务线程）。
- 核心引擎：`novel_generator/`（提示词驱动 + 向量检索 + 定稿）。

### 数据落地位置
- **项目数据根目录**：`~/.config/.ai_novel_generator/projects`（可用 `AINOVEL_DATA_ROOT` 覆盖）。
- **项目元数据**：`~/.config/.ai_novel_generator/projects/projects.json`（由 `ProjectStore` 管理）。
- **单项目结构（project_root 下）**：
  - `Novel_architecture.txt`（架构）
  - `Novel_directory.txt`（蓝图）
  - `global_summary.txt`（全局摘要）
  - `character_state.txt`（角色状态）
  - `plot_arcs.txt`（剧情要点/未解决冲突，需人工维护）
  - `chapters/chapter_{N}.txt`
  - `vectorstore/`（Chroma 向量库）
  - `project_state.json`（前端状态存档）
  - `partial_architecture.json`（架构分步失败时的断点文件）

## 核心流程（代码真实调用链）
### 1) 架构生成
- API：`/api/projects/{id}/generate/architecture`
- 入口：`backend/services.generate_architecture`
- 引擎：`novel_generator/architecture.py::Novel_architecture_generate`
- 特点：分步生成 + 断点续跑（`partial_architecture.json`），同时生成初始 `character_state.txt`。

### 2) 蓝图生成
- API：`/api/projects/{id}/generate/blueprint`
- 入口：`backend/services.generate_blueprint`
- 引擎：`novel_generator/blueprint.py::Chapter_blueprint_generate`
- 特点：支持分块生成 + 断点续跑（基于已有 `Novel_directory.txt`）。
- 蓝图格式由 `chapter_directory_parser.py` 解析（要求“第X章 - 标题 + 若干字段”）。

### 3) 章节草稿（实际会自动定稿）
- API：`/api/projects/{id}/generate/draft`
- 入口：`backend/services.generate_draft`
- 引擎：`novel_generator/chapter.py::generate_chapter_draft`
- **注意**：生成草稿后会自动调用 `finalize_chapter` 更新摘要与角色状态，并写入向量库。

### 4) 单独定稿
- API：`/api/projects/{id}/generate/finalize`
- 用途：手动修改章节后刷新 `global_summary.txt`、`character_state.txt` 并更新向量库。

### 5) 批量生成
- API：`/api/projects/{id}/generate/batch`
- 入口：`backend/services.batch_generate`
- 特点：支持续写已有章节、自动扩写、批量定稿、可取消。

### 6) 一致性检查
- API：`/api/projects/{id}/consistency-check`
- 引擎：`consistency_checker.py::check_consistency`
- 额外参考：`plot_arcs.txt`（需手工补充）。

### 7) 知识库
- 导入：`/api/projects/{id}/knowledge/import`
- 清空：`/api/projects/{id}/vectorstore/clear`
- 底层：`novel_generator/vectorstore_utils.py`（Chroma + embeddings）

## 任务系统（与 UI 联动）
- 所有生成入口都是异步任务：`backend/task_runtime.py::TaskManager`（线程）。
- 任务状态：`/api/tasks/{task_id}`，日志流：`/api/tasks/{task_id}/stream`（SSE）。
- 任务状态仅在内存中，服务重启会丢失。

## 配置与模型适配（真实可用项）
### 配置文件
- 默认 `config.json`，可用 `AINOVEL_CONFIG_FILE` 指定。
- 若不存在会自动创建默认模板（见 `config_manager.py`）。
- 选择策略：`choose_configs` 根据用途映射到对应 LLM 配置：
  - `architecture_llm`、`chapter_outline_llm`、`prompt_draft_llm`、`final_chapter_llm`、`consistency_review_llm`。

### LLM 适配（interface_format 支持）
- `OpenAI`、`DeepSeek`、`Azure OpenAI`、`Azure AI`、`Ollama`、`ML Studio`、`Gemini`、
  `阿里云百炼`、`火山引擎`、`硅基流动`、`Grok`。
- `llm_adapters.check_base_url` 会自动补 `/v1`（除非 base_url 以 `#` 结尾）。

### Embedding 适配（interface_format 支持）
- `OpenAI`、`Azure OpenAI`、`Ollama`、`ML Studio`、`Gemini`、`SiliconFlow`。

## 前端真实页面与交互
- 页面路由：`/`（项目选择）、`/projects/:id`（工作台）、`/settings`（配置）。
- 工作台流程由 `webui/src/stores/workflow.ts` 管理：
  - 约束：第 N 章生成需第 N-1 章已定稿。
  - 章节状态：`not-started` / `draft-pending` / `finalized`。
- API 封装：`webui/src/api/*`，与后端路径保持一致。
- **注意**：前端存在 `generate/draft/stream` URL 生成，但后端并未实现该接口（仅有任务日志流）。

## 文件键值映射（后端 API 使用）
- `backend/file_keys.py` 中定义：
  - `architecture` → `Novel_architecture.txt`
  - `architecture_partial` → `partial_architecture.json`
  - `directory` → `Novel_directory.txt`
  - `summary` → `global_summary.txt`
  - `character_state` → `character_state.txt`
  - `plot_arcs` → `plot_arcs.txt`

## 扩展建议（最小改动路径）
### 新 API
1. `backend/api_server.py` 增路由与模型。
2. `backend/services.py` 编排。
3. 前端 `webui/src/api/` 与相关 Store 接入。

### 新生成能力
1. 在 `novel_generator/` 增模块。
2. 在 `backend/services.py` 统一入口与日志。
3. 如需 UI，补按钮与状态逻辑。

### Prompt 调整
- 统一在 `prompt_definitions.py`，避免散落到业务层。

## 测试与验证
- 无 Python 自动化测试，依赖手动流程。
- 前端有 Vitest：`npm --prefix webui test`。
- 手动回归推荐顺序：
  1) 新建项目 → 架构 → 蓝图 → 章节 → 定稿  
  2) 导入知识库 → 章节生成 → 检索是否生效  
  3) 修改章节 → 手动定稿 → 摘要与角色状态是否更新  

## 常见“过时/容易误解点”
- 草稿生成接口已自动定稿，不等同于“仅草稿”。
- 前端存在草稿流式生成 URL，但后端未实现对应接口。
- 向量库路径在项目根目录下，不在仓库内。

## 关键环境变量
- `AINOVEL_DATA_ROOT`：项目数据根目录
- `AINOVEL_CONFIG_FILE`：配置文件路径
- `AINOVEL_API_PORT`：API 端口（默认 8000）
