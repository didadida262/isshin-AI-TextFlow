# AI 写剧本（aiScript）技术文档

> 本文档描述 Isshin AI TextFlow 中「AI 写剧本」工作流步骤的**当前实现**（截至 2026-06），及其与参考项目 Toonflow-app Script Agent 的对应关系。

---

## 1. 功能概述

「AI 写剧本」是项目创作流程六步中的第二步（`aiScript`）。在「提取事件」全部完成后，用户通过左侧**剧本统筹对话区**触发三阶段 LLM 流水线，依次产出：

1. **故事骨架**（`storySkeleton`）
2. **改编策略**（`adaptationStrategy`）
3. **逐集剧本**（默认 **1 章 = 1 集**，XML 标签 `scriptItem`）

右侧 **Tab 工作台**切换查看上述三类产物；所有数据持久化至 SQLite。单集失败时可单独「重试失败集」，无需重跑全流程。

核心公式：

```
章节事件表 + 项目配置 + 导演 Skill
    → 故事骨架 Agent → 改编策略 Agent → 逐集剧本 Agent × N
    → XML / Markdown 解析 → SQLite → Tab 工作台展示
```

---

## 2. 与 Toonflow 的对应关系

| 维度 | Toonflow-app | Isshin AI TextFlow |
|------|--------------|-------------------|
| 架构模式 | 决策 Agent + 子 Agent 工具调用 + Socket 流式 | **三阶段顺序流水线** + 前端对话 UI |
| 实时通道 | Socket.IO `/api/socket/scriptAgent` | 无 Socket；`chatCompletion` 同步调用 + 对话区阶段进度 |
| 决策层 | `runDecisionAI`（统筹）调度子 Agent | `useScriptAgentChat` 识别「开始生成」后调用 `runScriptPipeline` |
| 执行层 | skeleton / adaptation / script 子 Agent | `storySkeletonAgent` / `adaptationStrategyAgent` / `episodeScriptAgent` |
| 监督层 | `supervisionAgent`（阶段 1–2 质检） | **暂未实现** |
| 中间存储 | `o_agentWorkData`（JSON） | `script_work_data` 表 |
| 剧本存储 | `o_script`（按 name upsert） | `scripts` 表（按 `episode_index` upsert） |
| 上下文获取 | LLM tool：`get_novel_events` 等 | 编排器预取，注入 User Message（`tools.ts`） |
| 输出契约 | XML：`<storySkeleton>` / `<adaptationStrategy>` / `<scriptItem>` | **相同** |
| Skill | `data/skills/script_*.md` | `src/prompts/script/*.ts` + `director_planning_narrative` Tab |
| UI | 左 30% 对话 + 右 70% 三 Tab 工作台 | 左 32% 对话 + 右 68% 三 Tab（骨架 / 策略 / 逐集剧本） |

**设计取舍：** 参考 Toonflow 的 Agent 分层与 XML 契约；在 Tauri 桌面场景下用**对话触发 + 顺序编排**替代 Socket 决策层，降低复杂度，后续可升级为完整 Decision Agent。

---

## 3. 系统架构

### 3.1 模块分层

```
┌──────────────────────────────────────────────────────────────────┐
│  UI 层                                                            │
│  AiScriptStep.tsx           — 左对话 + 右 Tab 工作台               │
│  ScriptAgentChatPanel.tsx   — 消息、快捷指令、输入、停止             │
│  ScriptWorkspacePanel.tsx   — 三 Tab：骨架 / 策略 / 逐集剧本         │
│  ScriptEpisodesTable.tsx    — 剧本列表表格                          │
│  ProjectDetailView.tsx      — 加载 aiScript 节点详情               │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  对话编排层                                                        │
│  useScriptAgentChat.ts      — 消息、触发流水线、重试失败集、中止      │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  Agent 编排层                                                      │
│  orchestrator.ts            — runScriptPipeline                    │
│                               regenerateFailedEpisodes             │
│  storySkeletonAgent.ts      — 阶段 1                              │
│  adaptationStrategyAgent.ts — 阶段 2                              │
│  episodeScriptAgent.ts      — 阶段 3（逐章，最多 3 次 LLM 重试）    │
│  tools.ts                   — 项目配置、事件表、原文、上一集剧本       │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  Prompt / 后处理                                                   │
│  prompts/script/*.ts        — 各 Agent System Prompt              │
│  stripThink.ts              — 去除 reasoning 块                   │
│  xmlTags.ts                 — XML 解析 + Markdown 兜底             │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  持久化 / 工作流（Rust）                                            │
│  script.rs                  — 表结构 + Tauri 命令                 │
│  workflow.rs                — 节点详情、完成判定、自动推进           │
│  novel.rs                   — 重导入时清空剧本                      │
│  permissions/app-commands.toml — allow-script 权限                 │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
              chatCompletion → llm_chat_completion (Rust)
              POST {baseUrl}/chat/completions
```

### 3.2 页面布局

| 区域 | 尺寸 | 内容 |
|------|------|------|
| 左侧对话 | 32%（min 280px, max 420px） | 统筹欢迎语、快捷指令「开始生成剧本」、用户/Agent 气泡、输入框、停止按钮 |
| 右侧工作台 | 剩余宽度 | Tab：**故事骨架** / **改编策略** / **逐集剧本** |

**触发入口（仅对话区）：**

- 点击快捷指令「开始生成剧本」
- 输入「开始生成剧本」或含「生成 / 开始 / 启动」的文本

**重试入口：**

- 「逐集剧本」Tab 内，存在 `script_state = 2` 的记录时，显示「重试失败集」按钮（Tab 标题旁有红点提示）

---

## 4. 前置条件与工作流

### 4.1 进入 aiScript 节点

1. 用户完成「提取事件」，全部章节 `event_state = 1`。
2. Rust `maybe_advance_after_extract` 将 `projects.current_workflow_node` 设为 `aiScript`。
3. Stepper 步骤 2 高亮为当前节点。

### 4.2 生成前校验

| 校验项 | 实现位置 |
|--------|----------|
| 全部章节事件已提取 | `isEventExtractionComplete(chapters)` |
| API Base URL / Key | `useScriptAgentChat.runPipeline` |
| 已选择模型 | 同上 |

未满足事件提取：整页展示「请先完成提取事件」占位。  
API/模型未配置：`onConfigError` 提示，且**仅此类错误**自动打开设置抽屉（`App.tsx`）。

### 4.3 完成后推进

- `is_ai_script_completed`：成功剧本数 ≥ 章节数。
- 每次 `upsert_script` 成功后调用 `maybe_advance_after_script`，将当前节点推进至 `generateAssets`。

### 4.4 重导入小说

`import_novel` 事务内：

1. 删除 `novel_chapters`
2. `script::clear_project_script_data`（清空 `script_work_data` + `scripts`）
3. `reset_to_extract_events`

---

## 5. 三阶段 Agent 流水线

### 5.1 主编排：`runScriptPipeline`

文件：`src/agents/scriptAgent/orchestrator.ts`

```
Stage 1  storySkeleton
           runStorySkeletonAgent → extractXmlTag → set_script_work_data
Stage 2  adaptationStrategy
           runAdaptationStrategyAgent → extractXmlTag → set_script_work_data
Stage 3  scripts（按 chapter_index 升序逐章）
           writeEpisodeScript → runEpisodeScriptAgent → upsert_script
```

`writeEpisodeScript`：单集 try/catch，失败写入 `script_state = 2` 与 `error_reason`，**不中断**后续章节。

### 5.2 阶段 1：故事骨架 Agent

| 项 | 说明 |
|----|------|
| 文件 | `storySkeletonAgent.ts` |
| Prompt | `prompts/script/storySkeleton.ts` |
| User 输入 | 项目配置、导演 Skill（可选）、全章事件表、章节数 |
| 输出 | `<storySkeleton>...</storySkeleton>` |
| 持久化 | `script_work_data.story_skeleton` |
| LLM label | `script-skeleton` |

### 5.3 阶段 2：改编策略 Agent

| 项 | 说明 |
|----|------|
| 文件 | `adaptationStrategyAgent.ts` |
| Prompt | `prompts/script/adaptationStrategy.ts` |
| User 输入 | 项目配置、故事骨架、全章事件表 |
| 输出 | `<adaptationStrategy>...</adaptationStrategy>` |
| 持久化 | `script_work_data.adaptation_strategy` |
| LLM label | `script-adaptation` |

### 5.4 阶段 3：逐集剧本 Agent

| 项 | 说明 |
|----|------|
| 文件 | `episodeScriptAgent.ts` |
| Prompt | `prompts/script/episodeScript.ts` |
| 映射 | **1 章 = 1 集**（`episode_index = chapter_index`） |
| User 输入 | 骨架、策略、本章事件、本章原文、上一集剧本（衔接） |
| 期望 name | `{项目名} EP{NN}：{章标题}` |
| 输出 | `<scriptItem name="...">...</scriptItem>` |
| 重试 | 每集最多 **3 次** LLM 调用，失败后追加 XML 格式提醒 |
| 持久化 | `scripts` upsert |
| LLM label | `script-episode` |

### 5.5 导演 Skill 注入

- 项目字段 `directorManual` → Story Skill ID。
- `loadStorySkillDetail(id)` → Tab `director_planning_narrative` 正文。
- **仅**注入故事骨架 Agent 的 User Message。

### 5.6 增量重试：`regenerateFailedEpisodes`

前提：骨架与策略已存在（`workData` 非空）。

1. 筛选 `scripts` 中 `script_state = 2` 的 `episode_index`。
2. 仅对这些章节重新调用 `writeEpisodeScript`。
3. 不重新跑 Stage 1 / 2。

由 `useScriptAgentChat.retryFailed()` 触发，对话区显示「正在重试失败集 n/m…」。

---

## 6. 输出解析与容错

文件：`src/utils/xmlTags.ts`

### 6.1 骨架 / 策略

`extractXmlTag(text, tagName)` — 标准 XML 闭合标签，大小写不敏感。

### 6.2 逐集剧本：`parseEpisodeScriptOutput`

解析顺序：

1. **`extractScriptItems`** — 多种 `scriptItem` 写法：
   - 双引号 / 单引号 `name`
   - 大小写 `scriptItem` / `scriptitem`
   - 无闭合标签时的兜底匹配
2. **`extractScriptMarkdownFallback`** — 模型未包 XML 时：
   - 匹配 `# {期望标题}` 起始的 Markdown 剧本
   - 或匹配 `# ... EP{NN}...` 标题行（正文 ≥ 80 字）

### 6.3 后处理链

```
LLM raw
  → stripThink()          // 去掉 reasoning 块
  → parseEpisodeScriptOutput / extractXmlTag
  → 持久化
```

---

## 7. 对话区逻辑

文件：`src/hooks/useScriptAgentChat.ts`  
UI：`src/components/ScriptAgentChatPanel.tsx`  
类型：`src/agents/scriptAgent/chatTypes.ts`

### 7.1 角色

| 角色名 | 职责 |
|--------|------|
| **统筹** | 欢迎语、引导、非生成类回复 |
| **编剧** | 生成进度 streaming 消息 |

### 7.2 初始状态

- 统筹发送欢迎语 + 说明
- 快捷指令 chip：「开始生成剧本」

### 7.3 消息路由

```
用户 sendMessage(text)
  ├─ text ===「开始生成剧本」或含 生成|开始|启动
  │     → runPipeline() → runScriptPipeline
  └─ 其他
        → 统筹回复引导 + 再次展示快捷指令
```

### 7.4 进度回显

编剧消息 `status: streaming`，`onProgress` 更新文案：

| stage | 文案 |
|-------|------|
| `skeleton` | 正在构建故事骨架… |
| `adaptation` | 正在制定改编策略… |
| `scripts` | 正在生成剧本 {n}/{total}… |

完成 →「剧本生成完成，请在右侧工作台查看…」  
停止 → `AbortController.abort()` →「已停止生成。」

### 7.5 消息结构（可扩展）

```typescript
interface ScriptChatMessage {
  id: string;
  role: "user" | "assistant";
  name?: string;           // 统筹 | 编剧
  content: string;
  thinking?: { title, text, collapsed? };  // 预留
  suggestions?: { title, prompt }[];
  status?: "pending" | "streaming" | "complete" | "error" | "stop";
}
```

---

## 8. 右侧 Tab 工作台

文件：`src/components/ScriptWorkspacePanel.tsx`

| Tab | 有数据时 | 无数据时 |
|-----|----------|----------|
| 故事骨架 | `MarkdownContent` 渲染 | 「生成剧本后，故事骨架将显示在此。」 |
| 改编策略 | `MarkdownContent` 渲染 | 「生成剧本后，改编策略将显示在此。」 |
| 逐集剧本 | `ScriptEpisodesTable` | 「点击「生成剧本」…」 |

- 逐集 Tab 有失败记录时，Tab 标签显示**红点**。
- 「重试失败集」按钮仅在该 Tab 激活且存在失败时显示。

---

## 9. 数据库设计

数据库：`data/sqlite/app.db`  
初始化：`db.rs` → `script::init_schema`

### 9.1 `script_work_data`

| 列 | 类型 | 说明 |
|----|------|------|
| `project_id` | TEXT PK | FK → `projects.id` |
| `story_skeleton` | TEXT | 故事骨架 |
| `adaptation_strategy` | TEXT | 改编策略 |
| `updated_at` | INTEGER | Unix 秒 |

### 9.2 `scripts`

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | INTEGER PK | 自增 |
| `project_id` | TEXT | 项目 ID |
| `episode_index` | INTEGER | 集序号 = `chapter_index` |
| `name` | TEXT | 剧本名称 |
| `content` | TEXT | 剧本正文 |
| `script_state` | INTEGER | 0 待生成 / 1 成功 / 2 失败 |
| `error_reason` | TEXT | 失败原因 |
| `updated_at` | INTEGER | Unix 秒 |

唯一约束：`(project_id, episode_index)`

### 9.3 状态常量

```typescript
// frontend & rust
SCRIPT_STATE_PENDING  = 0
SCRIPT_STATE_SUCCESS  = 1
SCRIPT_STATE_ERROR    = 2
```

---

## 10. Tauri 命令与权限

### 10.1 命令

| 命令 | 说明 |
|------|------|
| `get_script_work_data` | 读取骨架与策略 |
| `set_script_work_data` | 部分更新 work data |
| `list_scripts` | 列表（按 episode_index 排序） |
| `upsert_script` | 写入单集；触发工作流推进检查 |
| `get_project_workflow_node_detail` | `kind: "aiScript"` 返回 chapters + workData + scripts |

注册：`src-tauri/src/lib.rs` → `invoke_handler`

### 10.2 权限（Tauri 2 必须配置）

`src-tauri/permissions/app-commands.toml`：

```toml
[[permission]]
identifier = "allow-script"
commands.allow = [
  "get_script_work_data",
  "set_script_work_data",
  "list_scripts",
  "upsert_script",
]
```

`src-tauri/capabilities/default.json` 需包含 `"allow-script"`。  
未配置时会报错：`set_script_work_data not allowed. Command not found`。

前端封装：`src/services/script.ts`

---

## 11. 工作流集成

文件：`src-tauri/src/workflow.rs`、`src/services/workflow.ts`

### 11.1 节点详情

```typescript
interface AiScriptNodeDetail {
  kind: "aiScript";
  nodeId: ProjectWorkflowStepId;
  source: NovelSourceRecord | null;
  chapters: NovelChapterRecord[];
  workData: { storySkeleton: string; adaptationStrategy: string };
  scripts: ScriptRecord[];
}
```

### 11.2 完成判定

```rust
// script.rs
is_ai_script_completed(conn, project_id, chapter_count)
// success_count >= chapter_count
```

### 11.3 前端加载

`ProjectDetailView` 进入项目 / 切换步骤时：

1. `list_project_workflow_nodes`
2. `get_project_workflow_node_detail(projectId, "aiScript")`
3. 传入 `AiScriptStep`：`chapters`, `workData`, `scripts`, `config`, `selectedModel`

生成完成后 `onWorkflowChange` → 刷新 Stepper 状态。

---

## 12. LLM 调用

与「提取事件」共用 `chatCompletion`（`src/services/chat.ts`）：

```
chatCompletion(config, model, messages, signal, label)
  → invoke("llm_chat_completion")
  → Rust reqwest POST /chat/completions
```

配置来源：设置抽屉 → localStorage `textflow-config`；模型选择与「会话」页共用 `useAppState.selectedModel`。

| 阶段 | messages | label |
|------|----------|-------|
| 骨架 | system + user | `script-skeleton` |
| 策略 | system + user | `script-adaptation` |
| 单集 | system + user（含上一集） | `script-episode` |

---

## 13. 关键类型索引

### 13.1 前端

| 类型 | 文件 |
|------|------|
| `ScriptWorkData`, `ScriptRecord` | `services/script.ts` |
| `AiScriptNodeDetail` | `services/workflow.ts` |
| `ScriptAgentContext`, `ScriptGenerationProgress` | `agents/scriptAgent/types.ts` |
| `ScriptChatMessage` | `agents/scriptAgent/chatTypes.ts` |
| `RunScriptPipelineOptions/Result` | `agents/scriptAgent/orchestrator.ts` |

### 13.2 Rust

| 类型 | 文件 |
|------|------|
| `ScriptWorkData`, `ScriptRecord` | `script.rs` |
| `AiScriptNodeDetail` | `workflow.rs` |

---

## 14. 文件索引

| 职责 | 路径 |
|------|------|
| 步骤容器 | `src/components/AiScriptStep.tsx` |
| 对话面板 | `src/components/ScriptAgentChatPanel.tsx` |
| Tab 工作台 | `src/components/ScriptWorkspacePanel.tsx` |
| 剧本表格 | `src/components/ScriptEpisodesTable.tsx` |
| 对话 Hook | `src/hooks/useScriptAgentChat.ts` |
| 流水线 | `src/agents/scriptAgent/orchestrator.ts` |
| 三 Agent | `src/agents/scriptAgent/*Agent.ts` |
| 上下文工具 | `src/agents/scriptAgent/tools.ts` |
| Prompt | `src/prompts/script/*.ts` |
| XML 解析 | `src/utils/xmlTags.ts` |
| 前端 DB | `src/services/script.ts` |
| Rust 持久化 | `src-tauri/src/script.rs` |
| 工作流 | `src-tauri/src/workflow.rs` |
| IPC 权限 | `src-tauri/permissions/app-commands.toml` |
| 详情页 | `src/components/ProjectDetailView.tsx` |
| i18n | `src/i18n/locales/zh.ts` → `creation.aiScriptStep` |
| 参考 | Toonflow `docs/script-agent.md` |

---

## 15. 端到端时序

### 15.1 完整生成

```
用户：「开始生成剧本」
    │
    ▼
useScriptAgentChat.sendMessage
    ├─ append 用户消息
    └─ append 编剧 streaming 消息
    │
    ▼
runScriptPipeline
    ├─ Stage1 runStorySkeletonAgent
    │      → set_script_work_data(skeleton)
    │      → onProgress: skeleton
    ├─ Stage2 runAdaptationStrategyAgent
    │      → set_script_work_data(strategy)
    │      → onProgress: adaptation
    └─ Stage3 foreach chapter
           → runEpisodeScriptAgent (≤3 attempts)
           → upsert_script (success or error)
           → onProgress: scripts n/total
    │
    ▼
onComplete
    ├─ 更新 AiScriptStep 本地 state
    ├─ refresh workflow nodes
    └─ 编剧消息 → complete
    │
    ▼
右侧 Tab 可查看骨架 / 策略 / 逐集剧本
（全部成功 → current_workflow_node → generateAssets）
```

### 15.2 重试失败集

```
用户点击「重试失败集」（逐集剧本 Tab）
    │
    ▼
regenerateFailedEpisodes
    └─ 仅对 script_state=2 的 episode_index 调用 writeEpisodeScript
    │
    ▼
onComplete → 刷新 UI / 工作流
```

---

## 16. 已知限制与后续扩展

| 项 | 现状 | 建议 |
|----|------|------|
| 决策 Agent | 关键词触发固定流水线 | 接入 Socket / Tauri Event + `runDecisionAI` |
| 监督 Agent | 无 | 阶段 1–2 后质检与用户确认 |
| 流式输出 | 阶段级进度 | `streamChatCompletion` token 流 |
| Session Memory | 无 | `projectId:scriptAgent` 隔离记忆 |
| 分集策略 | 固定 1 章 1 集 | 可配置合并/拆分规则 |
| 剧本编辑 | 只读 Tab + 表格 | Markdown 编辑器、单集重新生成按钮 |
| 工作台 | 表格预览 | Toonflow 式剧本卡片 + 折叠展开 |

---

## 17. 相关文档

- [事件提取（extractEvents）](./event-extraction.md) — 上游步骤，提供章节事件表
- Toonflow 参考：`/Toonflow-app/docs/script-agent.md`
