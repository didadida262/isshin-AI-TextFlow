# Session Assistant 工具链详解

> 工具链是 Assistant 模式下的**前置步骤**：在调用 LLM 之前，先判断用户是否要读本地文件；若要，则读取并把结果注入 system prompt。
>
> 整体采用 **Thought → Action → Observation** 三节点，**不调用 LLM 做决策**，纯规则 + Tauri IPC。

---

## 1. 何时调用：两道门槛

工具链不是每条消息都跑，需要同时满足：

### 门槛一：模式必须是 Assistant

```typescript
// src/hooks/useAppState.ts
if (chatMode === "assistant") {
  // 才进入工具链
}
```

「对话」模式完全跳过 `runToolLoop`，直连 LLM。

### 门槛二：用户消息命中关键词（在 thoughtNode 里判断）

```typescript
// src/agents/sessionAssistant/schema.ts
export const AGENT_KEYWORDS = ["查看文件", "读取项目", "读取文件", "查看项目"];
```

- 使用 `state.userMessage.includes(kw)`，**子串匹配**
- 关键词是中文，不受 `toLowerCase` 影响
- 例：「帮我读取项目配置」→ 命中「读取项目」
- 未命中 → `shouldAct = false`，不读文件

---

## 2. 完整时序

用户点击发送后，`useAppState.sendMessage` 的执行顺序：

```
1. 校验 API / 模型配置
2. 追加 user 消息到会话
3. setIsLoading(true)
4. [仅 assistant] 跑工具链          ← 工具链在这里
5. 检查 cancelRef（用户是否已中止）
6. 追加 assistant 空气泡
7. streamSessionChat / streamChatCompletion 流式生成
```

工具链与 LLM **串行**：先等 `runToolLoop` 完成，再调 LLM。

---

## 3. 如何调用：入口与编排

### 3.1 调度入口（`useAppState.ts`）

```typescript
setToolAgentRunning(true);

// 插入 tool-status 气泡
appendMessage(sessionId, {
  role: "tool-status",
  content: "正在分析意图…",
  toolPhase: "thought",
});

const agentResult = await runToolLoop(text, (phase, detail) => {
  // 每个阶段 → patchMessage 更新 tool-status 气泡
});

agentObservation = agentResult.observation;

// 收尾
if (agentResult.shouldAct || agentObservation) {
  patchMessage(..., { toolPhase: "done", content: agentResult.thought });
} else {
  // 未触发：删除 tool-status 气泡
}

setToolAgentRunning(false);
```

**phase → UI 文案映射：**

| phase | UI 文案 |
|-------|---------|
| `thought` | `detail`（thought 文本）或「意图识别中…」 |
| `action` | 「正在读取 {file}…」 |
| `observation` | 「整理观察结果…」 |
| `done` | 「工具执行完成」 |

### 3.2 编排器（`toolLoop.ts`）

```typescript
// src/agents/sessionAssistant/toolLoop.ts
export async function runToolLoop(userMessage, onPhase?) {
  let state = { userMessage, shouldAct: false, phase: "idle", ... };

  onPhase?.("thought");
  state = { ...state, ...await thoughtNode(state) };
  onPhase?.(state.phase, state.thought);

  if (!state.shouldAct) return state;   // 早退

  onPhase?.("action", state.targetFile);
  state = { ...state, ...await actionNode(state) };
  onPhase?.(state.phase);

  onPhase?.("observation");
  state = { ...state, ...observationNode(state) };
  onPhase?.("done");

  return state;
}
```

**特点：**

- 无循环：最多一轮 Thought → Action → Observation
- 无 LLM：三个节点都是本地逻辑
- 早退：Thought 判定不行动时，跳过后续节点
- 状态合并：每个节点返回 `Partial<AgentGraphState>`，spread 合并

---

## 4. 三节点具体实现

### 4.1 Thought — 意图识别 + 选文件

**文件：** `src/agents/sessionAssistant/nodes.ts` → `thoughtNode()`

```typescript
const matched = AGENT_KEYWORDS.some((kw) => state.userMessage.includes(kw));

if (!matched) {
  return {
    thought: "用户消息未触发 Agent 工具链，走普通对话。",
    shouldAct: false,
    phase: "done",
  };
}

let targetFile = "package.json";
for (const [key, file] of Object.entries(FILE_KEYWORD_MAP)) {
  if (msg.includes(key.toLowerCase())) {
    targetFile = file;
    break;
  }
}

return {
  thought: `检测到文件操作意图，准备读取项目文件：${targetFile}`,
  shouldAct: true,
  targetFile,
  phase: "thought",
};
```

**文件选择规则（`schema.ts` → `FILE_KEYWORD_MAP`）：**

| 消息里包含 | 读取文件 |
|-----------|----------|
| 无更具体匹配 | `package.json`（默认） |
| `package` / `package.json` | `package.json` |
| `gitignore` / `.gitignore` | `.gitignore` |

这是规则引擎，不是语义理解。「帮我看看依赖版本」不会触发，除非带上四个关键词之一。

### 4.2 Action — Tauri 读本地文件

**文件：** `src/agents/sessionAssistant/nodes.ts` → `actionNode()`

```typescript
const result = await invoke("read_project_file", { filename: state.targetFile });
// 成功 → fileResult
// 失败 → errorMessage（不抛异常到 UI）
```

**Rust 端（`src-tauri/src/lib.rs`）：**

```rust
fn read_project_file(filename: String) -> Result<FileReadResult, String> {
    let allowed = ["package.json", ".gitignore"];
    if !allowed.contains(&filename.as_str()) {
        return Err(format!("不允许读取的文件: {filename}"));
    }

    let root = project_root();  // std::env::current_dir()
    let file_path = root.join(&filename);
    // 不存在 → Err；存在 → fs::read_to_string
}
```

**安全边界：**

- 白名单：只允许 `package.json`、`.gitignore`
- 路径：项目根 = 进程 cwd，filename 不含路径，无 `../` 穿越
- 错误写入 `errorMessage`，交给 Observation 处理

### 4.3 Observation — 结果格式化

**文件：** `src/agents/sessionAssistant/nodes.ts` → `observationNode()`

Observation **不展示给用户**，产出给 LLM 的 Markdown 字符串：

**读文件成功：**

```markdown
**Agent 观察结果** — 已读取 `{path}`

（代码块：文件完整内容，json 或 text 高亮）
```

**读文件失败：**

```markdown
**Agent 执行失败**

（代码块：errorMessage）
```

- 文件名以 `.json` 结尾 → 代码块语言 `json`，否则 `text`

---

## 5. 后续处理：观察结果如何进 LLM

`agentObservation` **拼进 system prompt**，不作为 chat message 展示：

```typescript
// src/agents/sessionAssistant/textflowChatAgent.ts
export function buildSessionSystemPrompt(agentObservation?) {
  const parts = [SESSION_ASSISTANT_PROMPT, TEXTFLOW_PRODUCT_SKILL];
  if (agentObservation?.trim()) {
    parts.push(`## 本地工具 Agent 读取结果\n${agentObservation.trim()}`);
  }
  return parts.join("\n\n");
}
```

**最终发给 LLM 的 messages 结构：**

```
[
  { role: "system", content: "角色 Prompt + 产品 Skill + [可选] 文件内容" },
  { role: "user", content: "..." },
  { role: "assistant", content: "..." },
  { role: "user", content: "当前这条消息" }
]
```

**history 构建时过滤掉 `tool-status`：**

```typescript
activeSession.messages.filter((m) => m.role === "user" || m.role === "assistant")
```

工具链状态气泡**不进 LLM 上下文**，只给用户看过程。

Product Skill 约束：「Agent 未提供上下文时不假装读过文件」。

---

## 6. UI 层

### 消息类型

```typescript
// src/types/index.ts
export type MessageRole = "user" | "assistant" | "tool-status";

export interface ChatMessage {
  toolPhase?: "thought" | "action" | "observation" | "done";
}
```

### tool-status 气泡（`MessageBubble.tsx`）

- 绿色边框 + Spinner（进行中）/ Brain（完成）
- 显示 `Tool · {phase}` + 阶段文案

### 两种收尾

| 情况 | UI 行为 |
|------|---------|
| 命中关键词 | 保留 tool-status，最终 `done`，content 显示 thought |
| 未命中 | **删除** tool-status，聊天区无痕迹 |
| 读文件失败 | 保留 tool-status，LLM system 里带错误信息 |

---

## 7. 状态机

```
用户发送 (assistant 模式)
        │
        ▼
   chatMode === "assistant" ?
        │ 否 → 跳过整个工具链
        ▼ 是
   thoughtNode
        │
   ┌────┴────┐
   │ 未命中   │ shouldAct=false → 返回，删 tool-status
   │ 关键词   │
   └────┬────┘
        │ 命中
        ▼
   actionNode ── invoke read_project_file
        │
        ▼
   observationNode ── 生成 observation 字符串
        │
        ▼
   streamSessionChat(agentObservation)
        │
        ▼
   流式 assistant 回复
```

### AgentGraphState 全字段

```typescript
{
  userMessage: string;           // 原始输入
  thought: string | null;        // Thought 推理文本（UI 展示用）
  shouldAct: boolean;            // 是否执行 Action
  targetFile: string | null;     // 目标文件名
  fileResult: { filename, content, path } | null;
  errorMessage: string | null;
  phase: AgentPhase;             // idle | thought | action | observation | done
  observation: string | null;    // 给 LLM 的 Markdown
}
```

---

## 8. 边界与局限

| 点 | 说明 |
|----|------|
| 中止时机 | `cancelRef` 在工具链**之后**检查；工具链期间点停止可能仍跑完 IPC |
| 文件大小 | 无截断，整文件塞进 system prompt |
| 非 Function Calling | 扩展工具需改 schema + nodes + Rust 白名单 |
| 无语义理解 | 必须含四个中文关键词之一，同义表达不触发 |
| 无多步循环 | 固定一轮，不能连续读多个文件 |

---

## 9. 关键文件对照

| 环节 | 文件 | 核心符号 |
|------|------|----------|
| 触发条件 | `src/hooks/useAppState.ts` | `chatMode === "assistant"` |
| 编排 | `src/agents/sessionAssistant/toolLoop.ts` | `runToolLoop` |
| 三节点 | `src/agents/sessionAssistant/nodes.ts` | `thoughtNode` / `actionNode` / `observationNode` |
| 关键词 / 类型 | `src/agents/sessionAssistant/schema.ts` | `AGENT_KEYWORDS` / `AgentGraphState` |
| 注入 LLM | `src/agents/sessionAssistant/textflowChatAgent.ts` | `buildSessionSystemPrompt` |
| 读文件后端 | `src-tauri/src/lib.rs` | `read_project_file` |
| 进度 UI | `src/components/MessageBubble.tsx` | `role === "tool-status"` |

---

## 总结

工具链 = Assistant 模式下的**同步前置管道**：

1. `useAppState` 在调 LLM 前调用 `runToolLoop`
2. 关键词决定是否读白名单文件
3. Observation 产出 Markdown → 追加到 system prompt
4. UI 用 `tool-status` 展示过程，但不进对话历史

架构上是 ReAct 的简化版（固定一轮、规则驱动 Thought），「智能」仍在后面的 LLM 流式回复里。
