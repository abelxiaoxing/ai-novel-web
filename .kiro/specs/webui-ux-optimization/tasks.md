# Implementation Plan: Web UI UX Optimization

## Overview

本实现计划将 Web UI 用户体验优化分解为可执行的编码任务。采用增量开发方式，每个任务构建在前一个任务的基础上，确保代码始终可运行。

技术栈: Vue 3 + TypeScript + Pinia + Vitest + fast-check

## Tasks

- [x] 1. 基础设施搭建
  - [x] 1.1 创建 Toast 通知系统
    - 创建 `webui/src/stores/toast.ts` Toast 状态管理
    - 创建 `webui/src/components/ToastContainer.vue` 通知容器组件
    - 实现 toast 添加、移除、自动消失逻辑
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_
  - [ ]* 1.2 编写 Toast 系统属性测试
    - **Property 17: Toast 通知显示和自动消失**
    - **Validates: Requirements 12.2, 12.3**
  - [x] 1.3 创建工作流状态管理
    - 创建 `webui/src/stores/workflow.ts` 工作流状态 Store
    - 实现步骤完成状态追踪
    - 实现前置条件检查逻辑
    - _Requirements: 1.1, 1.2, 1.3_
  - [ ]* 1.4 编写工作流状态属性测试
    - **Property 1: 任务完成后步骤自动推进**
    - **Property 2: 基于前置条件的按钮禁用状态**
    - **Validates: Requirements 1.2, 1.3**

- [x] 2. Checkpoint - 确保基础设施测试通过
  - 运行所有测试，确保通过
  - 如有问题请询问用户

- [x] 3. 步骤指示器组件
  - [x] 3.1 创建 StepIndicator 组件
    - 创建 `webui/src/components/StepIndicator.vue`
    - 实现四步骤可视化显示
    - 实现当前步骤高亮和完成状态标记
    - 实现禁用按钮的 tooltip 提示
    - _Requirements: 1.1, 1.4, 1.5_
  - [x] 3.2 集成 StepIndicator 到 WorkbenchView
    - 在 RightPanel 顶部添加 StepIndicator
    - 连接 workflowStore 状态
    - _Requirements: 1.1_

- [x] 4. 编辑器自动保存功能
  - [x] 4.1 创建 useAutoSave composable
    - 创建 `webui/src/composables/useAutoSave.ts`
    - 实现 3 秒防抖自动保存逻辑
    - 实现保存状态追踪 (saved/unsaved/saving)
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - [ ]* 4.2 编写自动保存属性测试
    - **Property 5: 自动保存防抖和触发**
    - **Property 6: 未保存状态指示**
    - **Validates: Requirements 4.1, 4.2, 4.3**
  - [x] 4.3 增强 EditorPane 组件
    - 添加保存状态指示器 (未保存/已保存/保存中)
    - 集成 useAutoSave composable
    - 添加 Ctrl+S / Cmd+S 快捷键支持
    - 添加离开页面未保存确认
    - _Requirements: 4.3, 4.4, 4.5, 4.6_

- [x] 5. Checkpoint - 确保编辑器功能测试通过
  - 运行所有测试，确保通过
  - 如有问题请询问用户

- [-] 6. 章节信息自动化
  - [x] 6.1 创建章节信息解析工具
    - 创建 `webui/src/utils/chapterParser.ts`
    - 实现从蓝图文本中提取章节信息的逻辑
    - 提取章节标题、人物、场景等信息
    - _Requirements: 3.1, 3.2, 3.3_
  - [ ]* 6.2 编写章节解析属性测试
    - **Property 4: 章节信息自动填充**
    - **Validates: Requirements 3.1, 3.2, 3.3**
  - [x] 6.3 创建 useChapterInfo composable
    - 创建 `webui/src/composables/useChapterInfo.ts`
    - 监听章节号变化，自动提取并填充信息
    - 支持手动覆盖自动填充的值
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [ ] 6.4 实现章节号自动递增
    - 在 taskStore 中监听任务完成事件
    - 草稿/定稿完成后自动递增章节号
    - 添加"下一章"快捷按钮到 RightPanel
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [ ]* 6.5 编写章节号递增属性测试
    - **Property 3: 章节号自动递增**
    - **Validates: Requirements 2.1, 2.2**

- [ ] 7. Checkpoint - 确保章节自动化测试通过
  - 运行所有测试，确保通过
  - 如有问题请询问用户

- [ ] 8. 任务进度可视化增强
  - [ ] 8.1 增强 TaskStore 时间追踪
    - 添加 startedAt、completedAt 字段
    - 实现运行时间计算和显示
    - _Requirements: 5.5_
  - [ ]* 8.2 编写任务时间追踪属性测试
    - **Property 8: 任务耗时追踪**
    - **Validates: Requirements 5.5**
  - [ ] 8.3 增强 BottomPanel 组件
    - 添加任务进度动画指示器
    - 实现错误消息红色高亮
    - 实现日志区域自动滚动
    - 显示任务运行时间
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [ ]* 8.4 编写日志自动滚动属性测试
    - **Property 7: 日志自动滚动**
    - **Validates: Requirements 5.3**

- [ ] 9. 工作台模型配置切换
  - [ ] 9.1 增强 RightPanel 模型配置
    - 添加可折叠的"模型配置"区域
    - 添加 LLM 和 Embedding 配置下拉框
    - 显示当前选中的配置名称
    - _Requirements: 6.1, 6.2, 6.5_
  - [ ] 9.2 实现模型选择持久化
    - 将选中的模型配置保存到项目状态
    - 加载项目时恢复模型配置
    - _Requirements: 6.4_
  - [ ]* 9.3 编写模型选择属性测试
    - **Property 9: 模型选择传递到 API**
    - **Property 16: 用户偏好持久化**
    - **Validates: Requirements 6.3, 6.4**

- [ ] 10. Checkpoint - 确保模型配置测试通过
  - 运行所有测试，确保通过
  - 如有问题请询问用户

- [ ] 11. 项目参数同步
  - [ ] 11.1 增强项目数据模型
    - 在 Project 类型中添加 topic 字段
    - 更新 API 类型定义
    - _Requirements: 7.1_
  - [ ] 11.2 实现项目加载时表单填充
    - 加载项目时填充 topic、genre、numberOfChapters、wordNumber
    - 确保现有字段同步逻辑正确
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  - [ ]* 11.3 编写项目字段填充属性测试
    - **Property 10: 项目字段加载填充**
    - **Property 11: 表单状态持久化**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**

- [ ] 12. 简化提示词构建流程
  - [ ] 12.1 重构 RightPanel 章节草稿区域
    - 将"构建提示词"移入可折叠的"高级选项"区域
    - 重命名为"预览/编辑提示词"
    - "生成草稿"按钮直接生成，不弹出提示词预览
    - _Requirements: 9.1, 9.2, 9.3, 9.5_
  - [ ]* 12.2 编写提示词弹窗属性测试
    - **Property 12: 提示词弹窗条件显示**
    - **Validates: Requirements 9.4**

- [ ] 13. 批量章节生成
  - [ ] 13.1 创建 BatchGenerateModal 组件
    - 创建 `webui/src/components/BatchGenerateModal.vue`
    - 实现起始章节、结束章节、延迟配置表单
    - 添加表单验证
    - _Requirements: 10.1, 10.2, 10.3_
  - [ ] 13.2 实现批量生成逻辑
    - 在 WorkbenchView 中添加批量生成处理
    - 实现进度显示 (正在生成第 X/Y 章)
    - 实现取消功能
    - 生成完成后显示结果摘要
    - _Requirements: 10.4, 10.5, 10.6_
  - [ ]* 13.3 编写批量生成进度属性测试
    - **Property 13: 批量生成进度显示**
    - **Validates: Requirements 10.4**

- [ ] 14. Checkpoint - 确保批量生成测试通过
  - 运行所有测试，确保通过
  - 如有问题请询问用户

- [ ] 15. 文件树增强操作
  - [ ] 15.1 创建 FileTreeContextMenu 组件
    - 创建 `webui/src/components/FileTreeContextMenu.vue`
    - 实现右键菜单显示/隐藏逻辑
    - 实现菜单项: 打开、重命名、删除
    - 章节文件额外显示"在编辑器中打开"
    - _Requirements: 8.1, 8.2, 8.5_
  - [ ] 15.2 实现文件操作功能
    - 实现删除确认弹窗
    - 实现内联重命名编辑
    - 连接到 projectStore 的文件操作
    - _Requirements: 8.3, 8.4_

- [ ] 16. 项目列表搜索和排序
  - [ ] 16.1 增强 ProjectSelectView 搜索功能
    - 添加搜索输入框
    - 实现实时过滤项目列表
    - _Requirements: 11.1, 11.2_
  - [ ]* 16.2 编写项目搜索属性测试
    - **Property 14: 项目搜索过滤**
    - **Validates: Requirements 11.2**
  - [ ] 16.3 实现项目排序功能
    - 添加排序下拉框 (名称、创建时间、更新时间)
    - 实现排序逻辑
    - 持久化排序偏好
    - _Requirements: 11.3, 11.4, 11.5_
  - [ ]* 16.4 编写项目排序属性测试
    - **Property 15: 项目排序**
    - **Validates: Requirements 11.4**

- [ ] 17. 角色库占位处理
  - [ ] 17.1 更新 ActivityBar 角色库显示
    - 在角色库图标上添加"即将推出"徽章
    - 更新占位面板内容，添加功能描述
    - 添加"了解更多"链接
    - _Requirements: 13.1, 13.2, 13.3_

- [ ] 18. 集成和最终测试
  - [ ] 18.1 集成 Toast 系统到全局
    - 在 App.vue 中添加 ToastContainer
    - 替换现有的 error-banner 为 Toast 通知
    - 在任务完成时显示 Toast 通知
    - _Requirements: 12.1, 12.2_
  - [ ] 18.2 连接工作流状态到任务系统
    - 任务完成时更新 workflowStore
    - 显示下一步操作提示 Toast
    - _Requirements: 1.2, 1.4_

- [ ] 19. Final Checkpoint - 确保所有测试通过
  - 运行完整测试套件
  - 验证所有属性测试通过
  - 如有问题请询问用户

## Notes

- 标记 `*` 的任务为可选测试任务，可跳过以加快 MVP 开发
- 每个 Checkpoint 确保增量代码可运行
- 属性测试使用 fast-check 库，每个测试至少 100 次迭代
- 组件测试使用 Vue Test Utils
