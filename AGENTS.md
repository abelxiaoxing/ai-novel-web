# Repository Guidelines

## Project Structure & Module Organization
- `backend/` hosts the FastAPI service and task runtime.
- `webui/` contains the Vue 3 Web UI.
- `novel_generator/` holds core generation logic (blueprints, chapters, vector store utilities).
- `llm_adapters.py` and `embedding_adapters.py` wrap model providers; `prompt_definitions.py` centralizes prompt text.
- `config_manager.py` manages `config.json`; `config.example.json` is the template to share.
- `docs/` stores design notes; `icon.ico` is the app icon asset.

## Build, Test, and Development Commands
- `pip install -r requirements.txt` installs runtime dependencies.
- `python -m uvicorn backend.api_server:app --host 0.0.0.0 --port 8000` starts the API service.
- `npm --prefix webui install` installs the Web UI dependencies.
- `npm --prefix webui run dev` launches the Web UI in development mode.
- `scripts/dev.sh` starts both backend and frontend together.

## Coding Style & Naming Conventions
- Python style: 4-space indentation, PEP 8 conventions, and standard library imports grouped before third-party imports.
- Naming: `snake_case` for functions/variables/modules, `PascalCase` for classes, and `*_tab.py` for UI tabs.
- Keep UI-facing strings in `prompt_definitions.py` or UI modules; avoid scattering prompts across core logic.
- Do not commit `config.json`; update `config.example.json` when new keys are added.

## Testing Guidelines
- There is no automated test suite currently.
- For manual validation, start the backend + Web UI, open the workbench, and exercise Step 1–3 to confirm generation and file output.
- If you add logic that touches vector storage or consistency checks, verify the related files under the configured output path.

## Commit & Pull Request Guidelines
- Commit messages are short and descriptive; existing history uses prefixes like `feat:` and `fix:` when appropriate.
- Pull requests should include: a clear summary, test steps (even if manual), and screenshots for UI changes.
- Link related issues and call out config changes so reviewers know to update `config.example.json`.

## Security & Configuration Tips
- Store API keys only in `config.json` and keep it untracked.
- Generated story files should live in a user-selected output directory, not in the repo.
