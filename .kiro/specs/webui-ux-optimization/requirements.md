# Requirements Document

## Introduction

本文档定义了 AI 小说生成器 Web UI 的用户体验优化需求。基于对现有系统的分析，识别出 12 个核心痛点，涵盖工作流引导、自动保存、章节生成效率、任务状态反馈、配置切换、文件管理等方面。优化目标是提升工作流流畅度、减少重复操作、增强智能化上下文感知能力。

## Glossary

- **Workbench**: 工作台视图，用户进行小说生成操作的主界面
- **RightPanel**: 右侧面板，包含生成控制表单和操作按钮
- **EditorPane**: 编辑器面板，用于查看和编辑文件内容
- **BottomPanel**: 底部面板，显示任务日志和状态
- **FileTree**: 文件树组件，展示项目文件结构
- **StepIndicator**: 步骤指示器，可视化展示当前工作流进度
- **ProjectStore**: 项目状态管理存储
- **TaskStore**: 任务状态管理存储
- **ConfigStore**: 配置状态管理存储
- **AutoSave**: 自动保存功能，定时或基于变更自动保存编辑内容
- **ChapterInfo**: 章节信息，从蓝图中解析的章节元数据

## Requirements

### Requirement 1: 工作流步骤引导

**User Story:** As a user, I want to see a visual workflow indicator showing my current progress, so that I know which step I'm on and what to do next.

#### Acceptance Criteria

1. WHEN the Workbench loads, THE StepIndicator SHALL display four steps: 架构生成、蓝图生成、草稿生成、定稿
2. WHEN a generation task completes successfully, THE StepIndicator SHALL automatically advance to highlight the next step
3. WHILE a prerequisite step is incomplete, THE RightPanel SHALL disable buttons for dependent steps
4. WHEN a step is completed, THE System SHALL display a toast notification suggesting the next action
5. WHEN the user hovers over a disabled button, THE System SHALL show a tooltip explaining the prerequisite

### Requirement 2: 章节号自动递增

**User Story:** As a user, I want the chapter number to auto-increment after generating a chapter, so that I don't have to manually update it each time.

#### Acceptance Criteria

1. WHEN a chapter draft generation task completes successfully, THE RightPanel SHALL automatically increment the chapter number field by 1
2. WHEN a chapter finalization task completes successfully, THE RightPanel SHALL automatically increment the chapter number field by 1
3. THE RightPanel SHALL provide a "下一章" quick button that increments chapter number and clears chapter-specific fields
4. WHEN the chapter number exceeds the total number of chapters, THE System SHALL display a completion message

### Requirement 3: 章节信息自动填充

**User Story:** As a user, I want chapter-related fields to be auto-populated from the blueprint, so that I don't have to manually copy information.

#### Acceptance Criteria

1. WHEN the chapter number changes, THE System SHALL attempt to extract chapter info from the blueprint
2. IF chapter info is available, THE RightPanel SHALL auto-fill the characters_involved field with extracted character names
3. IF chapter info is available, THE RightPanel SHALL auto-fill the scene_location field with extracted scene information
4. THE User SHALL be able to override auto-filled values by editing the fields manually
5. WHEN no blueprint exists, THE System SHALL leave fields empty and allow manual input

### Requirement 4: 编辑器自动保存

**User Story:** As a user, I want my edits to be automatically saved, so that I don't lose work if I forget to click save.

#### Acceptance Criteria

1. WHEN the editor content changes, THE EditorPane SHALL start a debounced auto-save timer of 3 seconds
2. WHEN the auto-save timer expires, THE System SHALL save the content to the backend
3. THE EditorPane SHALL display an "未保存" indicator when there are unsaved changes
4. THE EditorPane SHALL display a "已保存" indicator after successful save
5. WHEN the user presses Ctrl+S (or Cmd+S on Mac), THE System SHALL immediately save the content
6. WHEN the user attempts to navigate away with unsaved changes, THE System SHALL prompt for confirmation

### Requirement 5: 任务进度可视化

**User Story:** As a user, I want to see clear progress indicators for running tasks, so that I know how long to wait.

#### Acceptance Criteria

1. WHILE a task is running, THE BottomPanel SHALL display an animated progress indicator
2. WHEN a task fails, THE BottomPanel SHALL highlight the error message prominently with a red background
3. THE BottomPanel log area SHALL auto-scroll to show the latest log entries
4. WHEN a task completes, THE System SHALL display a brief toast notification with the result
5. THE TaskStore SHALL track task duration and display elapsed time for running tasks

### Requirement 6: 工作台内快速模型切换

**User Story:** As a user, I want to quickly switch LLM models without leaving the workbench, so that I can experiment with different models efficiently.

#### Acceptance Criteria

1. THE RightPanel SHALL include a collapsible "模型配置" section
2. WHEN expanded, THE model config section SHALL display dropdowns for selecting LLM and Embedding configurations
3. WHEN a model is selected, THE System SHALL use it for subsequent generation tasks
4. THE System SHALL remember the last selected model configuration per project
5. THE model dropdowns SHALL show the currently active configuration name

### Requirement 7: 项目参数同步

**User Story:** As a user, I want project parameters from creation to sync with the workbench form, so that I don't have to re-enter the same information.

#### Acceptance Criteria

1. WHEN a project is loaded, THE RightPanel SHALL populate the topic field from project metadata if available
2. WHEN a project is loaded, THE RightPanel SHALL populate the genre field from project.genre
3. WHEN a project is loaded, THE RightPanel SHALL populate numberOfChapters from project.num_chapters
4. WHEN a project is loaded, THE RightPanel SHALL populate wordNumber from project.word_number
5. WHEN the user updates form fields, THE System SHALL persist changes to project state

### Requirement 8: 文件树增强操作

**User Story:** As a user, I want to perform common file operations from the file tree, so that I can manage my project files efficiently.

#### Acceptance Criteria

1. WHEN the user right-clicks a file in FileTree, THE System SHALL display a context menu
2. THE context menu SHALL include options: 打开、重命名、删除
3. WHEN the user selects "删除", THE System SHALL prompt for confirmation before deleting
4. WHEN the user selects "重命名", THE System SHALL show an inline edit field
5. IF the file is a chapter file, THE context menu SHALL include "在编辑器中打开" option

### Requirement 9: 简化提示词构建流程

**User Story:** As a user, I want a streamlined draft generation flow, so that I can generate chapters with fewer clicks.

#### Acceptance Criteria

1. THE RightPanel SHALL merge "构建提示词" into an expandable "高级选项" section
2. THE "生成草稿" button SHALL directly generate the draft without requiring prompt preview
3. WHEN the user wants to customize the prompt, THE User SHALL expand "高级选项" and click "预览/编辑提示词"
4. THE PromptModal SHALL only appear when explicitly requested by the user
5. THE default workflow SHALL be: fill parameters → click "生成草稿" → view result

### Requirement 10: 批量章节生成

**User Story:** As a user, I want to generate multiple chapters in sequence, so that I can automate repetitive generation tasks.

#### Acceptance Criteria

1. THE RightPanel SHALL include a "批量生成" button in the chapter draft section
2. WHEN clicked, THE System SHALL display a modal to configure batch generation parameters
3. THE batch modal SHALL allow specifying start chapter, end chapter, and delay between generations
4. WHILE batch generation is running, THE System SHALL display progress (e.g., "正在生成第 3/10 章")
5. THE User SHALL be able to cancel batch generation at any time
6. WHEN batch generation completes, THE System SHALL display a summary of results

### Requirement 11: 项目列表搜索和排序

**User Story:** As a user, I want to search and sort my projects, so that I can quickly find the project I need.

#### Acceptance Criteria

1. THE ProjectSelectView SHALL include a search input field above the project grid
2. WHEN the user types in the search field, THE System SHALL filter projects by name in real-time
3. THE ProjectSelectView SHALL include a sort dropdown with options: 名称、创建时间、更新时间
4. WHEN a sort option is selected, THE System SHALL reorder the project list accordingly
5. THE System SHALL remember the last used sort preference

### Requirement 12: 统一错误提示位置

**User Story:** As a user, I want error messages to appear in a consistent location, so that I don't miss important notifications.

#### Acceptance Criteria

1. THE System SHALL display all error messages in a fixed toast container at the top-right of the viewport
2. WHEN an error occurs, THE System SHALL show a toast notification with the error message
3. THE toast notification SHALL auto-dismiss after 5 seconds unless it's a critical error
4. THE User SHALL be able to manually dismiss toast notifications
5. WHEN multiple errors occur, THE System SHALL stack toast notifications vertically

### Requirement 13: 角色库占位处理

**User Story:** As a user, I want unimplemented features to be clearly marked, so that I have appropriate expectations.

#### Acceptance Criteria

1. THE ActivityBar SHALL display a "即将推出" badge on the 角色库 icon
2. WHEN the user clicks 角色库, THE System SHALL display a placeholder panel with feature description
3. THE placeholder panel SHALL include a "了解更多" link to documentation or roadmap
4. THE System SHALL NOT show the 角色库 option in contexts where it would be confusing
