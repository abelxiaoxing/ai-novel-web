# AI Novel Generator Web Frontend PRD (Vue 3)

## 1. 背景与目标
### 1.1 背景
当前桌面版 UI 与生成核心逻辑耦合较深，且界面形态基于本地文件路径与桌面控件。根据 `docs/logic_refactoring_design_v2.md` 的分层建议，前端应迁移为 Web（Vue 3），与可复用的核心逻辑服务解耦。

### 1.2 目标
- 以 Web 形式重构前端，支持现有核心能力（架构/蓝图/草稿/定稿/知识库/一致性检查等）。
- UI 风格为深色系紫黑色，整体观感接近 VSCode 网页版。
- 前端与后端核心服务通过 API 解耦，支持未来服务化。

### 1.3 非目标
- 不改动提示词内容与核心算法逻辑。
- 不新增外部第三方服务（如远程文件系统、外部存储服务）作为硬依赖。
- 不在前端持久化用户 API Key（由后端或安全存储管理）。

### 1.4 前后端对齐原则
- 前端只通过 API 操作项目与文件，不直接访问文件系统或向量库。
- 关键文件使用 `file_key` 抽象访问，后端负责映射到真实路径。
- 所有耗时操作统一返回 `task_id`，通过任务接口获取结果与日志。
- 任务与日志结构与 `docs/logic_refactoring_design_v2.md` 保持一致。

## 2. 用户与使用场景
### 2.1 主要用户
- 小说写作者（个人创作、团队协作）。
- 内容编辑（需要审阅与修改生成内容）。

### 2.2 典型场景
- 初次创建项目并完成 Step1-4 流程。
- 迭代修改蓝图、章节、摘要与角色状态。
- 导入知识库资料并进行一致性检查。
- 批量生成多章草稿并统一定稿。

## 3. MVP 范围与后续
### 3.1 MVP 必备功能（包含原 P1）
- 项目管理：创建/打开/切换项目。
- 核心流程：
  - Step1 生成架构
  - Step2 生成目录（章节蓝图）
  - Step3 生成草稿（包含“可编辑提示词”与角色库注入）
  - Step4 定稿章节（支持低于目标字数自动扩写）
- 章节与关键文件编辑：
  - `Novel_architecture.txt`
  - `Novel_directory.txt`
  - `chapters/chapter_N.txt`
  - `global_summary.txt`
  - `character_state.txt`
- 一致性检查。
- 知识库导入与向量库清空。
- 角色库管理（角色创建/分类/导入/插入到提示词）。
- 章节列表与跳转（上一章/下一章/快速选择）。
- 批量生成章节（起止章、最低字数、自动扩写开关）。
- LLM/Embedding 配置管理（多配置、选择与保存、按流程选择）。
- 生成日志与任务状态展示（含失败提示）。

### 3.2 后续增强
- Plot Arcs 展示（当前后端未生成时显示占位或为空）。
- WebDAV 备份与恢复配置（若后端提供接口）。
- 高级代理设置（用于后端请求代理）。

## 4. 信息架构与页面结构
### 4.1 页面列表
- 登录/入口（如无鉴权则为项目选择页）。
- 项目工作台（主界面）。
- 设置中心（LLM/Embedding/代理/备份）。
- 角色库管理页（独立面板或侧边抽屉）。

### 4.2 工作台布局（VSCode 风格）
- 顶部：项目名称、状态指示、全局操作（保存/运行/设置）。
- 左侧 Activity Bar：工作区/文件/角色库/设置。
- 左侧 Sidebar：项目文件树（架构、蓝图、章节、摘要、角色状态、日志）。
- 中间 Editor Area：主文本编辑区（使用 Monaco Editor）。
- 右侧 Panel：参数与操作区（Step1-4、章节参数、可选功能）。
- 底部 Panel：日志与任务输出（支持过滤、导出）。

## 5. 核心功能说明
### 5.1 项目管理
- 创建项目：输入名称、类型、章节数、目标字数等基础信息。
- 打开项目：从列表中选择已有项目。
- 导出项目：打包下载（zip，可选）。

### 5.2 生成流程与编辑
- Step1 生成架构：生成 `Novel_architecture.txt` 与初始 `character_state.txt`。
- Step2 生成目录：生成 `Novel_directory.txt`。
- Step3 草稿生成：
  - 先构建“章节提示词”，弹出可编辑窗口。
  - 支持角色库内容注入（将角色资料插入提示词）。
  - 用户确认后生成草稿写入对应章节文件。
- Step4 定稿：
  - 基于当前章节内容更新摘要与角色状态。
  - 低于目标字数时支持“扩写后再定稿”。

### 5.3 章节管理
- 章节列表加载、上一章/下一章、跳转选择。
- 章节文本编辑与保存。

### 5.4 一致性检查
- 输入设定/摘要/角色状态/章节文本。
- 输出审校结果文本并可复制。

### 5.5 知识库管理
- 上传知识文本文件并导入向量库。
- 清空向量库并提示二次确认。

### 5.6 角色库管理
- 角色分类与管理（新增/编辑/删除/移动分类）。
- 角色文件导入（从文本或批量导入）。
- 在生成草稿时选择角色插入提示词。
- 支持从 `character_state` 或自定义文本进行角色解析并批量落库（LLM）。

### 5.7 文件与目录约定（前端 file_key）
前端通过 `file_key` 访问文件，后端映射到真实路径：
- `architecture` -> `{project_root}/Novel_architecture.txt`
- `architecture_partial` -> `{project_root}/partial_architecture.json`
- `directory` -> `{project_root}/Novel_directory.txt`
- `chapter:{n}` -> `{project_root}/chapters/chapter_{n}.txt`
- `summary` -> `{project_root}/global_summary.txt`
- `character_state` -> `{project_root}/character_state.txt`
- `vectorstore` -> `{project_root}/vectorstore/`
- `roles` -> `{project_root}/角色库/{分类}/{角色名}.txt`（包含“全部”分类目录）
- `plot_arcs` -> `{project_root}/plot_arcs.txt`（当前未生成，前端需容错）

### 5.8 章节蓝图格式要求（解析逻辑依赖）
- 格式基线：
  - `第X章 - 标题`
  - `本章定位：...`
  - `核心作用：...`
  - `悬念密度：...`
  - `伏笔操作：...`
  - `认知颠覆：...`
  - `本章简述：...`

### 5.9 提示词注入规则（与桌面逻辑一致）
- 生成草稿前先调用“构建章节提示词”。
- 若选择了角色库角色，前端将其内容替换提示词中的“核心人物”占位。
- 替换目标兼容以下格式：
  - `核心人物(可能未指定)：{characters_involved}`
  - `核心人物：{characters_involved}`
  - `核心人物(可能未指定):{characters_involved}`
  - `核心人物:{characters_involved}`

## 6. 交互流程（关键路径）
### 6.1 主流程
1) 创建项目并填写基础参数  
2) Step1 生成架构 → 编辑架构内容  
3) Step2 生成目录 → 调整章节蓝图  
4) Step3 生成草稿 → 编辑提示词 → 编辑章节  
5) Step4 定稿 → 更新摘要与角色状态  

### 6.2 批量生成
1) 选择起止章节与字数要求  
2) 批量生成草稿  
3) 可选：低于最低字数时自动扩写  

## 7. 视觉与交互规范
### 7.1 视觉基调
深色紫黑系、科技感、低饱和度，强调编辑效率与沉浸阅读。

### 7.2 色彩建议
- 背景主色：#0F0B16 / #171024
- 面板背景：#1C1530
- 强调色：#7E5BFF / #A78BFA
- 高亮/警告：#F59E0B / #EF4444
- 文本：#E5E1F5 / #B9B0D6

### 7.3 字体建议
- UI 字体：IBM Plex Sans / Source Sans 3
- 编辑器字体：JetBrains Mono / Fira Code

### 7.4 动效与交互
- 页面加载使用轻量 fade + slide。
- 生成任务状态使用分段进度条与日志滚动。
- 可编辑提示词使用弹窗或右侧抽屉。

## 8. 数据模型（前端视角）
### 8.1 Project
- id: string
- name: string
- genre: string
- num_chapters: number
- word_number: number
- created_at: string
- updated_at: string

### 8.2 ChapterInfo
- chapter_number: number
- chapter_title: string
- chapter_role: string
- chapter_purpose: string
- suspense_level: string
- foreshadowing: string
- plot_twist_level: string
- chapter_summary: string

### 8.3 DraftRequest（对应服务接口）
- project_id: string
- novel_number: number
- word_number: number
- characters_involved: string
- key_items: string
- scene_location: string
- time_constraint: string
- user_guidance: string
- llm_config_name: string
- embedding_config_name: string
- custom_prompt_text?: string

### 8.4 LLMConfig
- name: string
- api_key: string
- base_url: string
- model_name: string
- temperature: number
- max_tokens: number
- timeout: number
- interface_format: string

### 8.5 EmbeddingConfig
- name: string
- api_key: string
- base_url: string
- model_name: string
- retrieval_k: number
- interface_format: string

### 8.6 ChooseConfigs
- prompt_draft_llm: string
- chapter_outline_llm: string
- architecture_llm: string
- final_chapter_llm: string
- consistency_review_llm: string

### 8.7 ProxySetting / WebDAVConfig
- proxy_setting: { enabled: boolean, proxy_url: string, proxy_port: string }
- webdav_config: { webdav_url: string, webdav_username: string, webdav_password: string }

## 9. 前后端接口草案（REST + SSE）
> 基于现有代码参数设计。后端可做适配，但需覆盖相同行为与文件产出。
> 约定：所有耗时生成接口统一返回 `task_id`，前端通过任务接口获取结果；`build-prompt` 与 `consistency-check` 也走同一套任务机制以统一日志与错误处理。

### 9.0 通用约定
- 任务状态结构建议：`{ id, status, result?, error?, output_files? }`。
- `output_files` 使用 `file_key` 列表，前端不直接使用真实路径。
- SSE 日志事件建议：`{ level, message, ts }`。

### 9.1 项目与文件
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/{id}`
- `GET /api/projects/{id}/files`（列出 `file_key` 与元信息）
- `GET /api/projects/{id}/files/{file_key}`
- `PUT /api/projects/{id}/files/{file_key}`
- `GET /api/projects/{id}/chapters`
- `GET /api/projects/{id}/chapters/{n}`
- `PUT /api/projects/{id}/chapters/{n}`

### 9.2 生成任务
- 默认使用 `choose_configs` 中的配置；如 body 传入 `llm_config_name`/`embedding_config_name` 则以请求为准。
- 选择规则（未显式传参时）：
  - architecture → `choose_configs.architecture_llm`
  - blueprint → `choose_configs.chapter_outline_llm`
  - build-prompt/draft → `choose_configs.prompt_draft_llm`
  - finalize → `choose_configs.final_chapter_llm`
  - consistency-check → `choose_configs.consistency_review_llm`
- 任务结果建议返回 `output_files`（`file_key` 列表），便于前端刷新对应文件。
- `POST /api/projects/{id}/generate/architecture`
  - body: { topic, genre, number_of_chapters, word_number, user_guidance, llm_config_name? }
  - 行为: 生成 `Novel_architecture.txt` 与 `character_state.txt`，写入文件
- `POST /api/projects/{id}/generate/blueprint`
  - body: { number_of_chapters, user_guidance, llm_config_name? }
  - 行为: 生成/续写 `Novel_directory.txt`
- `POST /api/projects/{id}/generate/build-prompt`
  - body: { novel_number, word_number, characters_involved, key_items, scene_location, time_constraint, user_guidance, llm_config_name?, embedding_config_name?, retrieval_k? }
  - 返回: 通过任务结果获取 { prompt_text }
- `POST /api/projects/{id}/generate/draft`
  - body: { novel_number, word_number, characters_involved, key_items, scene_location, time_constraint, user_guidance, llm_config_name?, embedding_config_name?, retrieval_k?, custom_prompt_text? }
  - 返回: 通过任务结果获取 { chapter_text }
  - 说明: `retrieval_k` 未提供时使用 embedding 配置中的 `retrieval_k`
- `POST /api/projects/{id}/generate/enrich`
  - body: { chapter_text, word_number, llm_config_name? }
  - 返回: 通过任务结果获取 { chapter_text }
- `POST /api/projects/{id}/generate/finalize`
  - body: { novel_number, word_number, llm_config_name?, embedding_config_name? }
  - 返回: 通过任务结果获取 { global_summary, character_state }
- `POST /api/projects/{id}/generate/batch`
  - body: { start_chapter, end_chapter, word_number, min_word, auto_enrich, characters_involved, key_items, scene_location, time_constraint, user_guidance, llm_config_name?, embedding_config_name?, retrieval_k? }
  - 行为: 循环生成草稿并按需扩写
- `GET /api/tasks/{task_id}`（查询任务状态）
- `GET /api/tasks/{task_id}/stream`（SSE 日志流）
  - 任务状态建议结构：{ status: "pending|running|success|failed", result?: object, error?: string, output_files?: string[] }

### 9.3 其他能力
- `POST /api/projects/{id}/consistency-check`
  - body: { novel_setting, character_state, global_summary, chapter_text, plot_arcs?, llm_config_name? }
  - 返回: 通过任务结果获取 { result_text }
- `POST /api/projects/{id}/knowledge/import`
  - body: multipart form-data: { file, embedding_config_name? }
  - 行为: 切分文本并导入向量库
- `POST /api/projects/{id}/vectorstore/clear`
  - 行为: 删除 `vectorstore/`

### 9.4 角色库
- `GET /api/projects/{id}/roles/categories`
- `POST /api/projects/{id}/roles/categories`（新增分类）
- `PUT /api/projects/{id}/roles/categories/{name}`（重命名分类）
- `DELETE /api/projects/{id}/roles/categories/{name}?mode=all|move`（删除分类，move 表示迁移到“全部”）
- `GET /api/projects/{id}/roles?category=`
- `GET /api/projects/{id}/roles/{role_name}`
- `POST /api/projects/{id}/roles`（新增或导入，body: { name, content, category }）
- `PUT /api/projects/{id}/roles/{role_name}`（更新内容或移动分类）
- `DELETE /api/projects/{id}/roles/{role_name}`
- `POST /api/projects/{id}/roles/analyze`（基于文本解析角色，body: { content, llm_config_name? }）
- `POST /api/projects/{id}/roles/batch`（批量保存解析结果，body: { roles: [{ name, attributes, category? }] }）

### 9.5 配置管理
- `GET /api/config/llm`
- `POST /api/config/llm`
- `PUT /api/config/llm/{name}`
- `DELETE /api/config/llm/{name}`
- `GET /api/config/embedding`
- `POST /api/config/embedding`
- `PUT /api/config/embedding/{name}`
- `DELETE /api/config/embedding/{name}`
- `GET /api/config/choose`
- `PUT /api/config/choose`
- `GET /api/config/proxy`
- `PUT /api/config/proxy`
- `GET /api/config/webdav`
- `PUT /api/config/webdav`

## 10. 技术方案（前端）
### 10.1 技术栈
- Vue 3 + Vite
- TypeScript
- Pinia（全局状态）
- Vue Router
- Axios/Fetch
- Monaco Editor（文本编辑与 VSCode 体验）
- Tailwind CSS 或 CSS Modules（建议统一设计变量）

### 10.2 状态管理
- 全局：项目列表、当前项目、配置、任务队列、UI 主题。
- 局部：当前文件内容、编辑状态、日志流。

### 10.3 任务与日志
- 所有耗时操作（生成/审校/知识导入/角色解析）异步化，返回 task_id。
- 使用 SSE/WS 订阅日志。
- UI 允许取消任务（后端需支持）。

## 11. 非功能性要求
- 性能：章节文本编辑支持 50k+ 字符不卡顿。
- 兼容性：Chrome/Edge 最新版本；移动端支持基础浏览与编辑。
- 安全性：API Key 不存浏览器本地存储；敏感信息脱敏显示。
- 可用性：核心流程可在 3 步内完成；重要操作有二次确认。

## 12. 验收标准（MVP）
- 完成 Step1-4 全流程并生成对应文件。
- 可编辑并保存 `Novel_architecture.txt`、`Novel_directory.txt`、`chapter_N.txt`、`global_summary.txt`、`character_state.txt`。
- 支持草稿生成前可编辑提示词。
- 支持一致性检查、知识库导入、向量库清空、角色库管理与批量生成。
- 任务日志可实时展示，失败有明确提示。

## 13. 里程碑建议
1) M1：项目管理 + 工作台框架 + Monaco 编辑器  
2) M2：Step1-4 + 文件读写  
3) M3：配置管理 + 日志流  
4) M4：一致性检查 + 知识库 + 角色库 + 批量生成（MVP 完整闭环）  

## 14. 风险与待确认事项
- 后端存储模型（基于文件 or 数据库）未最终确认。
- Plot Arcs 生成逻辑未覆盖，若需支持需补充后端功能。
- 角色库文件结构与 API 设计需与后端对齐。
- 向量库与知识库切分依赖 NLTK 分句数据，部署需提前准备相关资源。
