# AI_NovelGenerator 逻辑重构设计文档（基于代码审计）

## 0. 范围与目标
- 目标：从现有桌面 UI 中剥离纯小说生成核心逻辑，形成可复用的后端核心层，为 Web 服务化重构提供基础。
- 范围：以当前代码真实实现为依据，明确数据流、状态与依赖，提出可落地的核心逻辑架构设计与迁移步骤。
- 非目标：不改动 UI 实现；不替换提示词内容；不引入新的外部服务。

## 1. 当前核心逻辑梳理（以代码为准）

### 1.1 核心模块与职责
- `novel_generator/architecture.py`：小说总体架构生成与断点续传。
- `novel_generator/blueprint.py`：章节蓝图生成（支持分块与续写）。
- `novel_generator/chapter.py`：章节提示词构建、章节草稿生成、摘要与知识检索。
- `novel_generator/finalization.py`：章节定稿、摘要与角色状态更新、向量库更新。
- `novel_generator/knowledge.py`：知识库文本导入向量库。
- `novel_generator/vectorstore_utils.py`：向量库初始化、加载、检索、清空、切分。
- `chapter_directory_parser.py`：章节蓝图解析与章节信息提取。
- `prompt_definitions.py`：全部提示词模板。
- `llm_adapters.py` / `embedding_adapters.py`：LLM/Embedding 适配器与工厂。
- `consistency_checker.py`：一致性检查（LLM 审校）。
- `utils.py`：文件读写与 JSON 保存。

### 1.2 关键状态与文件约定
当前“项目状态”完全依赖文件系统（`filepath` 为根目录）：

| 路径 | 生成/更新者 | 读取者 | 说明 |
| --- | --- | --- | --- |
| `Novel_architecture.txt` | `Novel_architecture_generate` | `Chapter_blueprint_generate`, `build_chapter_prompt` | 小说设定/核心种子/角色动力学/世界观/三幕式架构 |
| `partial_architecture.json` | `Novel_architecture_generate` | 同上 | 架构生成断点续传 |
| `Novel_directory.txt` | `Chapter_blueprint_generate` | `build_chapter_prompt` | 章节蓝图（每章定位/作用/悬念/伏笔/转折/简述） |
| `chapters/chapter_N.txt` | `generate_chapter_draft`, `finalize_chapter` | `build_chapter_prompt`, `finalize_chapter` | 章节正文 |
| `global_summary.txt` | `finalize_chapter` | `build_chapter_prompt` | 全局摘要 |
| `character_state.txt` | `Novel_architecture_generate`, `finalize_chapter` | `build_chapter_prompt`, `check_consistency` | 角色状态表 |
| `vectorstore/` | `update_vector_store`, `import_knowledge_file` | `get_relevant_context_from_vector_store` | Chroma 向量库 |
| `角色库/` | UI 侧角色库 | UI 侧 | 角色资料（非核心必需） |
| `plot_arcs.txt` | 仅 UI 读取 | UI 侧 | 代码中未生成，仅展示 |

注意：`plot_arcs.txt` 在 UI 中可查看，但核心逻辑未生成或更新，`check_consistency` 也仅接收参数，UI 传空字符串。

### 1.3 核心流程（实际实现）

#### 1.3.1 架构生成（`Novel_architecture_generate`）
1. 读取 `partial_architecture.json`，作为断点数据。
2. 依次生成并持久化：
   - `core_seed_prompt`（核心种子）
   - `character_dynamics_prompt`（角色动力学）
   - `create_character_state_prompt`（初始角色状态，写入 `character_state.txt`）
   - `world_building_prompt`（世界观）
   - `plot_architecture_prompt`（三幕式情节）
3. 合并为 `Novel_architecture.txt`。
4. 删除 `partial_architecture.json`。

#### 1.3.2 章节蓝图生成（`Chapter_blueprint_generate`）
1. 读取 `Novel_architecture.txt`。
2. 计算分块大小：
   - `tokens_per_chapter = 200`
   - `chunk_size = (floor(max_tokens/200/10)*10) - 10`，并限制在 `[1, number_of_chapters]`。
3. 若 `Novel_directory.txt` 已存在，解析已完成章节号，从下一章继续生成。
4. 生成方式：
   - 单次生成：`chapter_blueprint_prompt`
   - 分块生成：`chunked_chapter_blueprint_prompt`（仅保留最近 100 章目录做上下文）
5. 写入 `Novel_directory.txt`。

#### 1.3.3 章节提示词构建（`build_chapter_prompt`）
1. 读取 `Novel_architecture.txt`、`Novel_directory.txt`、`global_summary.txt`、`character_state.txt`。
2. 解析当前章与下一章信息（`get_chapter_info_from_blueprint`）。
3. 第一章：直接使用 `first_chapter_draft_prompt`。
4. 非第一章：
   - 读取前 3 章文本（`get_last_n_chapters_text`）。
   - 生成“当前章节摘要”（`summarize_recent_chapters_prompt`）。
   - 获取前一章结尾 800 字。
   - 生成检索关键词（`knowledge_search_prompt`），解析 `·` 分隔关键词（最多 5 组）。
   - 向量库检索（`get_relevant_context_from_vector_store`），按关键词分组检索并合并。
   - 应用历史内容规则（`apply_content_rules`）。
   - 知识过滤与重组（`knowledge_filter_prompt`）。
5. 组装 `next_chapter_draft_prompt` 并返回提示词。

#### 1.3.4 章节草稿生成（`generate_chapter_draft`）
1. 使用 `build_chapter_prompt` 生成提示词（或使用 `custom_prompt_text`）。
2. 调用 LLM 生成正文。
3. 保存到 `chapters/chapter_N.txt`。

#### 1.3.5 章节定稿（`finalize_chapter`）
1. 读取章节文本、`global_summary.txt`、`character_state.txt`。
2. 生成并更新：
   - `summary_prompt` → `global_summary.txt`
   - `update_character_state_prompt` → `character_state.txt`
3. 按句子切分（NLTK）并更新向量库（`update_vector_store`）。

#### 1.3.6 知识库导入（`import_knowledge_file`）
1. NLTK 分段（500 字符上限）。
2. 初始化或追加向量库。

#### 1.3.7 一致性检查（`check_consistency`）
基于 `CONSISTENCY_PROMPT`，对设定、角色状态、摘要与章节做检查，当前 UI 传入 `plot_arcs=""`。

### 1.4 现有 UI 与核心逻辑耦合点
1. UI 直接传 `filepath` 并依赖文件路径约定，核心逻辑无法直接切换存储介质。
2. UI 在生成草稿前对提示词进行“角色库注入”和人工编辑，这属于表现层逻辑，应该留在 UI 或上层应用。
3. `config_manager.py` 与 UI 配置选择强绑定，不适合在核心层保留。
4. `plot_arcs.txt` 仅 UI 读取，核心逻辑未产出，功能未闭环。

## 2. 目标：可复用的“纯核心逻辑层”架构

### 2.1 分层建议（端口与适配器）
建议拆分为三层：

1. **Domain / Core（纯逻辑）**
   - 提供小说生成管线、章节摘要与知识过滤逻辑。
   - 不包含文件路径、UI、线程、弹窗等。
2. **Application / Service（用例编排）**
   - 负责参数校验、流程编排、状态读取/写入。
3. **Infrastructure（适配器）**
   - LLM/Embedding 适配器
   - 文件系统存储（当前实现）
   - 向量库（Chroma）

### 2.2 目标包结构（建议）
```
core/
  domain/
    models.py                # 数据模型：Project, ChapterInfo, DraftRequest...
  services/
    architecture_service.py  # 架构生成
    blueprint_service.py     # 章节蓝图
    chapter_service.py       # 提示词构建 + 草稿生成
    finalization_service.py  # 定稿
    knowledge_service.py     # 知识导入
    consistency_service.py   # 一致性检查
  prompts/
    prompt_definitions.py
  ports/
    llm_client.py
    embedding_client.py
    storage.py
    vector_store.py
  utils/
    text.py
    blueprint_parser.py
infra/
  llm_adapters.py
  embedding_adapters.py
  file_storage.py
  chroma_vector_store.py
```

### 2.3 核心服务接口（建议）
以下接口保留现有行为，但去除 UI 依赖：

- `ArchitectureService.generate(request) -> ArchitectureResult`
  - 输入：主题、类型、章节数、字数、用户指导、LLM 配置、项目 ID
  - 输出：`Novel_architecture.txt` 内容 + `character_state.txt` 内容
- `BlueprintService.generate(request) -> BlueprintResult`
  - 输入：章节数、用户指导、LLM 配置、项目 ID
  - 输出：`Novel_directory.txt` 内容
- `ChapterService.build_prompt(request) -> PromptResult`
  - 输入：章节号、字数、人物/道具/场景/时间约束、LLM/Embedding 配置、项目 ID
  - 输出：完整提示词（供 UI 编辑）
- `ChapterService.generate_draft(request) -> DraftResult`
  - 输入：同上 + 可选自定义提示词
  - 输出：章节草稿文本
- `FinalizationService.finalize(request) -> FinalizationResult`
  - 输入：章节号、LLM/Embedding 配置、项目 ID
  - 输出：更新后的摘要/角色状态 + 向量库更新状态
- `KnowledgeService.import_text(request) -> ImportResult`
  - 输入：文本或文件内容、Embedding 配置、项目 ID
  - 输出：写入向量库的统计
- `ConsistencyService.check(request) -> ConsistencyResult`
  - 输入：章节文本/摘要/角色状态/设定
  - 输出：审校结果文本

### 2.4 关键数据模型（建议）
```
ProjectContext:
  project_id: str
  storage_root: str  # file 方案下使用

ChapterInfo:
  chapter_number: int
  chapter_title: str
  chapter_role: str
  chapter_purpose: str
  suspense_level: str
  foreshadowing: str
  plot_twist_level: str
  chapter_summary: str

DraftRequest:
  project_id: str
  novel_number: int
  word_number: int
  characters_involved: str
  key_items: str
  scene_location: str
  time_constraint: str
  user_guidance: str
  llm_config: LlmConfig
  embedding_config: EmbeddingConfig
  custom_prompt_text: Optional[str]
```

### 2.5 存储与向量库抽象（建议）
将文件读写与向量库操作下沉为端口接口：

```
StoragePort:
  read_text(path) -> str
  write_text(path, content) -> None
  exists(path) -> bool
  list_paths(prefix) -> list[str]

VectorStorePort:
  load(project_id) -> VectorStore
  init(project_id, texts) -> VectorStore
  add_texts(project_id, texts) -> None
  search(project_id, query, k) -> list[str]
  clear(project_id) -> None
```

当前实现以 `FileStorage + ChromaVectorStore` 适配即可；未来可替换为数据库/S3。

### 2.6 全栈重构蓝图（前后端一体）
目标是“前端只调用 API，后端负责编排与存储，核心逻辑保持纯净”。建议引入后端应用层与任务执行层：

- **前端（Web UI）**：仅通过 API 读写文件与触发生成，不直接访问文件系统或向量库。
- **后端应用层（API + 用例编排）**：承接请求参数校验、任务调度、日志汇聚、文件/角色库/配置的访问。
- **核心层（Domain/Core）**：提供可复用的生成逻辑与提示词构建，保持无 UI/路径依赖。
- **基础设施层（Infra）**：实现端口（文件存储、向量库、LLM/Embedding 适配）。

```
Web UI -> Backend API -> App Services/Tasks -> Core Services -> Ports -> Infra
```

推荐目录（示例）：
```
backend/
  api/                # 路由与请求/响应模型
  app_services/       # 用例编排与参数校验
  task_runtime/       # 任务执行、状态存储、日志流
  dto/                # 共享数据模型（与前端对齐）
core/
  ...
infra/
  ...
```

统一任务模型建议（与前端对齐）：
- `TaskRecord`: id, type, status(pending|running|success|failed), started_at, finished_at, result?, error?
- `TaskEvent`: task_id, level, message, ts

统一文件访问建议（避免路径泄漏）：
- 使用 `file_key`（如 `architecture`, `directory`, `chapter:12`, `summary`, `character_state`）映射到真实路径。

## 3. 面向 Web 服务化与前后端一体的核心改造点

1. **Project ID 替代 `filepath`**
   - 由 `project_id` 映射到存储根目录或对象存储路径。
2. **LLM/Embedding 配置与调用解耦**
   - 通过 `LlmConfig` / `EmbeddingConfig` 传递到服务层。
3. **异步任务支持**
   - 架构/蓝图/草稿/定稿均适合异步任务队列（耗时且可追踪进度）。
4. **幂等与断点续传**
   - 架构生成依赖 `partial_architecture.json`，保留该机制或改为 DB 状态。
   - 蓝图续写依赖 `Novel_directory.txt`，保留追加策略即可。
5. **可观测性**
   - `invoke_with_cleaning` 当前直接打印提示词，建议通过 logger 控制开关。
6. **API 合同统一**
   - 前端只接触 `file_key`、`task_id` 与 DTO，不暴露真实路径。
7. **任务与日志标准化**
   - 统一任务状态与日志事件结构，SSE/WS 只做流式传输。

## 4. 迁移/重构步骤（前后端一体）
1. **封装端口与核心服务**
   - 把 `read_file`/`save_string_to_txt`/`clear_file_content` 收敛到 `StoragePort`，并完成 core services 包装。
2. **引入后端应用层与任务执行**
   - 新增 API 路由、任务运行时、统一任务/日志模型。
3. **建立统一 API 合同**
   - 以 `file_key` 与 DTO 对齐前端，避免路径泄漏与 UI 逻辑混入核心层。
4. **Web 前端改造对接**
   - 前端仅调用 API，提示词编辑与角色库注入保持在前端层。
5. **补齐缺口与清理旧耦合**
   - 按需补全 `plot_arcs` 或显式标记未实现，清理 UI 侧对本地路径与 config 的硬依赖。

## 5. 风险与注意事项
- NLTK `sent_tokenize` 依赖 `punkt` 数据包，当前代码中下载被注释，部署时需确保环境已安装。
- 向量库更新未做并发控制；Web 端并发写入可能造成数据一致性问题。
- `compute_chunk_size` 使用 200 tokens 估算，与注释 “100 tokens” 不一致，需确认真实策略。
- `invoke_with_cleaning` 默认打印 prompt/response，Web 端需注意隐私与日志量。
- 前端不得直接持久化 API Key，配置应由后端管理并做脱敏展示。

## 6. 结论
当前核心逻辑已经具备清晰的生成管线，但与 UI 和文件系统强耦合。通过抽象存储、适配器、服务层与数据模型，可在不改变业务逻辑的前提下实现 Web 服务化基础，并为后续多用户、多项目扩展打好结构基础。
