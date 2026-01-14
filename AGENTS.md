# Repository Guidelines

## Project Structure & Module Organization
- `backend/` hosts the FastAPI service and task runtime.
- `webui/` contains the Vue 3 Web UI.
- `novel_generator/` holds core generation logic (blueprints, chapters, vector store utilities).
- `llm_adapters.py` and `embedding_adapters.py` wrap model providers; `prompt_definitions.py` centralizes prompt text.
- `config_manager.py` manages `config.json`; `config.example.json` is the template to share.
- `docs/` stores design notes; `icon.ico` is the app icon asset.
- Reference architecture: `docs/logic_refactoring_design_v2.md` documents the three-tier architecture (Web UI + Backend API + Core Engine).

## Build, Test, and Development Commands

### Python Backend
```bash
# Install dependencies
pip install -r requirements.txt

# Start API server
python -m uvicorn backend.api_server:app --host 0.0.0.0 --port 8000

# Run with custom config
python -m uvicorn backend.api_server:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend Web UI
```bash
# Install dependencies
npm --prefix webui install

# Development server with hot reload
npm --prefix webui run dev

# Production build
npm --prefix webui run build

# Preview production build
npm --prefix webui run preview

# Run tests (vitest)
npm --prefix webui test

# Watch mode for tests
npm --prefix webui test:watch
```

### All-in-One
```bash
# Start both backend and frontend
scripts/dev.sh
```

### Manual Testing Workflow (No Automated Tests)
1. Start backend: `python -m uvicorn backend.api_server:app --host 0.0.0.0 --port 8000`
2. Start frontend: `npm --prefix webui run dev`
3. Open browser to Web UI workbench
4. Exercise Step 1-3: Generate architecture → Blueprint → Chapter draft
5. Verify files appear in configured output path

## Coding Style & Naming Conventions

### Python (PEP 8 + Project Conventions)
- **Indentation**: 4 spaces (no tabs)
- **Line length**: Soft limit 120 characters
- **Import order** (strict):
  1. `from __future__ import annotations` (top of file)
  2. Standard library (`os`, `json`, `logging`, `typing`, etc.)
  3. Third-party packages (`fastapi`, `langchain`, `chromadb`, etc.)
  4. Local imports (relative imports without `.py` extension)
- **Naming**:
  - `snake_case` for functions, variables, modules, file names
  - `PascalCase` for classes
  - `UPPER_SNAKE_CASE` for constants
  - UI tabs: `*_tab.py` (e.g., `settings_tab.py`)
- **Type hints**: Use `typing` module (`Dict`, `List`, `Optional`, `Any`, `Callable`)
- **Docstrings**: Chinese comments accepted; prefer Chinese for user-facing docs, English for internal APIs
- **Error handling**: Log with `logging` module; use `try/except` with specific exceptions
- **Retry logic**: Use patterns from `novel_generator/common.py` (`invoke_with_cleaning`, `call_with_retry`)

### Frontend (Vue 3 + TypeScript)
- **Components**: Vue 3 Composition API with `<script setup>`
- **State management**: Pinia stores in `webui/src/stores/`
- **TypeScript**: Strict mode; interfaces for API responses
- **Styling**: No specific framework enforced; follow existing component patterns

### Code Patterns (Do)
```python
from __future__ import annotations

import os
import json
import logging
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException
from novel_generator.chapter import build_chapter_prompt

# Constants at module level
MAX_RETRIES = 7
DEFAULT_TIMEOUT = 900

def process_data(filepath: str, config: Optional[Dict] = None) -> Dict[str, Any]:
    """Process novel data with optional config override."""
    if not os.path.exists(filepath):
        logging.warning(f"File not found: {filepath}")
        return {}
    # ... implementation
```

### Code Patterns (Don't)
```python
# BAD: Wrong import order
from novel_generator.chapter import build_chapter_prompt
import os
import json

# BAD: Type suppression
result = some_func()  # type: ignore

# BAD: Empty exception handling
try:
    risky_call()
except:
    pass

# BAD: Mixed tabs and spaces
def bad_indent():
	print("uses tab")  # Never do this

# BAD: Magic numbers
if retry_count < 7:  # Use constant
```

## Testing Guidelines
- **Python**: No automated test suite currently. Manual validation via Web UI workbench.
- **Frontend**: Vitest configured in `webui/package.json`. Run `npm --prefix webui test`.
- **Vector storage tests**: Verify files under configured output path after generating chapters.
- **Consistency checks**: Test `consistency_checker.py` with multi-chapter scenarios.

## Commit & Pull Request Guidelines
- **Commit messages**: Short, descriptive with prefixes: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- **PR requirements**: Clear summary, test steps (manual or automated), screenshots for UI changes.
- **Config changes**: Explicitly call out updates to `config.example.json`.
- **Issue linking**: Reference related issues in PR body.

## Security & Configuration
- **API keys**: Store only in `config.json` (untracked by git).
- **Generated content**: Output to user-selected directory, never in repo.
- **Logging**: `invoke_with_cleaning` logs prompts/responses; control via logger level in production.

## Common Development Tasks

### Adding New API Endpoint
1. Define request/response models in `backend/api_server.py`
2. Implement logic in `backend/services.py`
3. Add route to FastAPI app with proper tags
4. Test via Web UI workbench

### Adding Novel Generator Function
1. Implement core logic in `novel_generator/` (e.g., `new_feature.py`)
2. Import and call from `backend/services.py`
3. Add API endpoint if exposing to frontend
4. Document in `docs/logic_refactoring_design_v2.md`

### Debugging Vector Store Issues
1. Check `vectorstore/` directory exists in project output path
2. Verify embedding config matches configured model
3. Clear vectorstore via UI and re-import knowledge files
4. Check logs for `novel_generator/vectorstore_utils.py` operations
