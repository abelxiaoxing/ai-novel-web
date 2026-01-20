# 📖 自动小说生成工具


<div align="center">
  
✨ **核心功能** ✨

| 功能模块          | 关键能力                          |
|-------------------|----------------------------------|
| 🎨 小说设定工坊    | 世界观架构 / 角色设定 / 剧情蓝图   |
| 📖 智能章节生成    | 多阶段生成保障剧情连贯性           |
| 🧠 状态追踪系统    | 角色发展轨迹 / 伏笔管理系统         |
| 🔍 语义检索引擎    | 基于向量的长程上下文一致性维护      |
| 📚 知识库集成      | 支持本地文档参考         |
| ✅ 自动审校机制    | 检测剧情矛盾与逻辑冲突          |
| 🖥 可视化工作台    | 全流程 Web 操作，配置/生成/审校一体化 |

</div>

> 一款基于大语言模型的多功能小说生成器，助您高效创作逻辑严谨、设定统一的长篇故事

---

## 📑 目录导航
1. [环境准备](#-环境准备)  
2. [项目架构](#-项目架构)  
3. [配置指南](#⚙️-配置指南)  
4. [运行说明](#🚀-运行说明)  
5. [使用教程](#📘-使用教程)  
6. [疑难解答](#❓-疑难解答)  

---

## 🛠 环境准备
确保满足以下运行条件：
- **Python 3.9+** 运行环境（推荐3.10-3.12之间）
- **uv** Python包管理工具
- **Node.js** 18+ 环境（用于 Web UI）
- 有效API密钥：
  - 云端服务：OpenAI / DeepSeek 等
  - 本地服务：Ollama 等兼容 OpenAI 的接口

### 安装 uv

#### Linux
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

#### Windows
```powershell
# PowerShell
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

#### 通用安装方式
```bash
pip install uv
```

---

## 📥 安装说明

### 1. 下载项目
通过 [GitHub](https://github.com) 下载项目 ZIP 文件，或使用以下命令克隆本项目：
```bash
git clone https://github.com/abelxiaoxing/ai-novel-web
```

### 2. 安装编译工具
部分 Python 依赖包需要编译，请确保系统已安装编译工具：

#### Ubuntu
```bash
sudo apt-get update
sudo apt-get install -y build-essential python3-dev
```

#### Arch Linux
```bash
sudo pacman -S base-devel python
```

#### Windows
通常无需额外工具，如遇问题请安装 [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)

### 3. 安装依赖并运行

#### Linux

1. 打开终端，进入项目目录：
```bash
cd ai-novel-web
```

2. 安装 Python 依赖：
```bash
uv sync
```

3. 安装 Web UI 依赖：
```bash
npm --prefix webui install
```

4. 启动后端服务：
```bash
uv run uvicorn backend.api_server:app --host 0.0.0.0 --port 8000
```

5. 启动 Web UI（新开一个终端）：
```bash
npm --prefix webui run dev
```

或使用一键启动脚本：
```bash
bash scripts/dev.sh
```

#### Windows

1. 打开 PowerShell 或命令提示符，进入项目目录：
```powershell
cd ai-novel-web
```

2. 安装 Python 依赖：
```powershell
uv sync
```

3. 安装 Web UI 依赖：
```powershell
npm --prefix webui install
```

4. 启动后端服务：
```powershell
uv run uvicorn backend.api_server:app --host 0.0.0.0 --port 8000
```

5. 启动 Web UI（新开一个终端）：
```powershell
npm --prefix webui run dev
```

> **依赖补充说明**  
> 如果安装过程中缺失部分依赖，可后续手动执行：
> ```bash
> uv add XXX
> ```

## 🗂 项目架构
```
ai-novel-web/
├── backend/                     # FastAPI 服务
├── consistency_checker.py       # 一致性检查, 防止剧情冲突
|—— chapter_directory_parser.py  # 目录解析
|—— embedding_adapters.py        # Embedding 接口封装
|—— llm_adapters.py              # LLM 接口封装
├── prompt_definitions.py        # 定义 AI 提示词
├── utils.py                     # 常用工具函数, 文件操作
├── config_manager.py            # 管理配置 (API Key, Base URL)
├── config.example.json          # 配置模板（不含密钥）
├── novel_generator/             # 章节生成核心逻辑
├── webui/                       # Web 前端
└── vectorstore/                 # (可选) 本地向量数据库存储
```

---

## ⚙️ 配置指南
### 📌 配置位置（分层加载）
1. **模板**：仓库内 `config.example.json`
2. **本地配置**：默认 `~/.config/.ai_novel_web/config.json`
3. **环境变量覆盖**：运行时合并，不写回配置文件

> 可用 `AINOVEL_CONFIG_FILE` 指定本地配置路径。

### 🔧 配置结构（示意）
```json
{
  "llm_configs": {
    "my_llm": {
      "api_key": "",
      "base_url": "https://api.openai.com/v1",
      "model_name": "gpt-4o-mini",
      "temperature": 0.7,
      "max_tokens": 4096,
      "timeout": 900,
      "interface_format": "OpenAI"
    }
  },
  "embedding_configs": {
    "my_embedding": {
      "api_key": "",
      "base_url": "https://api.openai.com/v1",
      "model_name": "text-embedding-3-small",
      "retrieval_k": 4,
      "interface_format": "OpenAI"
    }
  },
  "choose_configs": {
    "architecture_llm": "my_llm",
    "chapter_outline_llm": "my_llm",
    "prompt_draft_llm": "my_llm",
    "final_chapter_llm": "my_llm",
    "consistency_llm": "my_llm"
  }
}
```

### 🔐 环境变量覆盖（常用）
- `AINOVEL_LLM_API_KEY`：填充所有 LLM 配置的 `api_key`（仅在为空时）
- `AINOVEL_EMBEDDING_API_KEY`：填充所有 Embedding 配置的 `api_key`（仅在为空时）
- `AINOVEL_CONFIG_OVERRIDES`：JSON 字符串，深度合并到配置中

---

## 🚀 运行说明

### Linux

**方式 1：手动启动**
```bash
# 终端 1 - 启动后端
uv run uvicorn backend.api_server:app --host 0.0.0.0 --port 8000

# 终端 2 - 启动前端
npm --prefix webui run dev
```

**方式 2：一键启动**
```bash
bash scripts/dev.sh
```

### Windows

**方式 1：手动启动**
```powershell
# 终端 1 - 启动后端
uv run uvicorn backend.api_server:app --host 0.0.0.0 --port 8000

# 终端 2 - 启动前端
npm --prefix webui run dev
```

启动后在浏览器打开 `http://localhost:5173` 即可访问 Web 工作台。

---

## 📘 使用教程
1. **启动后，先完成基本参数设置：**  
   - **API Key & Base URL**（如 `https://api.openai.com/v1`）  
   - **模型名称**（如 `gpt-3.5-turbo`、`gpt-4o` 等）  
   - **Temperature** (0~1，决定文字创意程度)  
   - **主题(Topic)**（如 “废土世界的 AI 叛乱”）  
   - **类型(Genre)**（如 “科幻”/“魔幻”/“都市幻想”）  
   - **章节数**、**每章字数**（如 10 章，每章约 3000 字）  
   - **保存路径**（建议创建一个新的输出文件夹）

2. **点击「Step1. 生成设定」**  
   - 系统将基于主题、类型、章节数等信息，生成：  
     - `Novel_architecture.txt`：包含世界观、角色信息、雷点暗线等。  
   - 可以在生成后的 `Novel_architecture.txt` 中查看或修改设定内容。

3. **点击「Step2. 生成目录」**  
   - 系统会根据已完成的 `Novel_architecture.txt` 内容，为全部章节生成：  
     - `Novel_directory.txt`：包括每章标题和简要提示。  
   - 可以在生成后的文件中查看、修改或补充章节标题和描述。

4. **点击「Step3. 生成章节草稿」**  
   - 在生成章节之前，你可以：  
     - **设置章节号**（如写第 1 章，就填 `1`）  
     - **在“本章指导”输入框**中提供对本章剧情的任何期望或提示  
   - 点击按钮后，系统将：  
     - 自动读取前文设定、`Novel_directory.txt`、以及已定稿章节  
     - 调用向量检索回顾剧情，保证上下文连贯  
     - 生成本章正文 (`chapter_X.txt`)  
   - 生成完成后，你可在左侧的文本框查看、编辑本章草稿内容。

5. **点击「Step4. 定稿当前章节」**  
   - 系统将：  
     - **更新全局摘要**（写入 `global_summary.txt`）  
     - **更新角色状态**（写入 `character_state.txt`）  
     - **更新向量检索库**（保证后续章节可以调用最新信息）  
     - **剧情要点** (`plot_arcs.txt`) 需手动维护，用于一致性检查参考  
   - 定稿完成后，你可以在 `chapter_X.txt` 中看到定稿后的文本。

6. **一致性检查（可选）**  
   - 点击「[可选] 一致性审校」按钮，对最新章节进行冲突检测，如角色逻辑、剧情前后矛盾等。  
   - 若有冲突，会在日志区输出详细提示。

7. **重复第 4-6 步** 直到所有章节生成并定稿！

> **向量检索配置提示**
> 1. embedding模型需要显示指定接口和模型名称
> 2. 使用**本地Ollama**的**Embedding**时需提前启动Ollama服务：
>
>    ** Linux:**
>    ```bash
>    ollama serve  # 启动服务
>    ollama pull nomic-embed-text  # 下载/启用模型
>    ```
>
>    **Windows:**
>    ```powershell
>    ollama serve  # 启动服务
>    ollama pull nomic-embed-text  # 下载/启用模型
>    ```
>
> 3. 切换不同Embedding模型后建议清空vectorstore目录
> 4. 云端Embedding需确保对应API权限已开通

