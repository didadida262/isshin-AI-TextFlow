# Isshin AI TextFlow

个人桌面端文生视频客户端 — 基于 **Tauri 2 + React + TypeScript** 构建，继承自 [Isshin AI Agent](https://github.com/isshin) 终端脚手架，面向「文本描述 → 视频生成 → 本地预览与导出」的完整工作流。

## 功能

- **视频 API 配置**：Base URL、API Key、可用模型白名单，本地持久化
- **模型切换**：顶部下拉快速切换当前使用的文生视频模型
- **Prompt 创作区**：多行文本输入，支持参数提示与生成前校验
- **异步任务追踪**：提交生成任务后轮询状态，实时展示排队 / 生成中 / 完成 / 失败
- **视频预览与导出**：生成完成后在对话流内嵌预览，通过 Tauri 将视频保存至本地目录
- **会话历史**：按 Prompt 与生成结果归档，侧边栏管理历史任务

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19、TypeScript、Vite、Tailwind CSS 4、Framer Motion |
| 图标 | Font Awesome 6 |
| 桌面 | Tauri 2、Rust |
| HTTP | `@tauri-apps/plugin-http`（绕过 CORS，直连视频生成 API） |

## 开发

```bash
npm install
npm run desktop:dev
```

## 桌面端打包（macOS / Windows）

项目基于 **Tauri 2**，需在对应操作系统上分别打包（或使用下方 CI 在云端构建）。

| 平台 | 命令 | 产出物 |
|------|------|--------|
| **macOS** | `npm run desktop:build:mac` | `.app`、`.dmg` |
| **Windows** | `npm run desktop:build:win` | `.msi`、NSIS `.exe` |

也可使用脚本（参数 `mac` 或 `win`）：

```bash
chmod +x scripts/build-desktop.sh
./scripts/build-desktop.sh mac    # 仅在 macOS 上执行
./scripts/build-desktop.sh win    # 仅在 Windows 上执行
```

构建完成后，安装包位于：

- macOS **请发这个目录里的文件**：`src-tauri/target/release/bundle/dmg/`（例如 `Isshin AI TextFlow_1.0.0_*.dmg`）
- macOS 同目录下的 `.app`：`src-tauri/target/release/bundle/macos/Isshin AI TextFlow.app`（可压缩成 zip 分发）
- Windows: `src-tauri/target/release/bundle/msi/`、`src-tauri/target/release/bundle/nsis/`

**不要**把 `bundle/macos/` 里名为 `rw.xxxxx.*.dmg` 的文件发给别人——那是打包过程中的临时镜像，不是最终安装包，对方打开常会报错。

### macOS 分发：提示「已损坏」怎么办？

未经过 **Apple 开发者签名 + 公证（Notarization）** 的应用，从网络发给其他 Mac 时，系统 Gatekeeper 常会显示「已损坏，无法打开」（文件本身未必真坏）。

**安装成功但打开提示「已损坏」**（内测常见，应用本身通常没问题）：

1. **图形界面（优先）**：在 Finder 中找到 `Isshin AI TextFlow.app` → **右键** → **打开** → 点 **「打开」**（不要用双击第一次启动）。
2. **终端一键**（项目根目录执行）：
   ```bash
   chmod +x scripts/fix-mac-gatekeeper.sh
   ./scripts/fix-mac-gatekeeper.sh
   ```
3. **手动命令**（.app 已在「应用程序」时）：
   ```bash
   xattr -cr "/Applications/Isshin AI TextFlow.app"
   ```
4. 仍不行时：**系统设置 → 隐私与安全性** → 下方 **「仍要打开」**。

下次打包前项目已配置 ad-hoc 签名（`tauri.conf.json` → `bundle.macOS.signingIdentity: "-"`），需 **重新执行** `npm run desktop:build:mac` 后再分发；要彻底免上述步骤仍需 Apple 开发者签名 + 公证。

**安装后「意外退出」**：旧版在他人 Mac 上启动时会因找不到 `data/sqlite` 直接崩溃；已改为使用系统应用数据目录（`~/Library/Application Support/com.isshin.ai-textflow/`）存放数据库与资产，skills 从安装包内资源读取。**必须重新打包并分发新版 DMG** 后对方再安装。

若对方 Mac 为 Apple Silicon，请分发 **arm64** 或 **universal** 构建的 DMG，避免仅 x64 包在 M 系列芯片上异常退出。

**正式对外分发（推荐）：**

1. 加入 [Apple Developer Program](https://developer.apple.com/programs/)（付费）
2. 申请 **Developer ID Application** 证书并安装到钥匙串
3. 构建前设置环境变量，由 Tauri 自动签名并公证，例如：

```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: 你的名字 (TEAMID)"
export APPLE_ID="your@email.com"
export APPLE_PASSWORD="应用专用密码"
export APPLE_TEAM_ID="TEAMID"
npm run desktop:build:mac
```

详见 [Tauri macOS 代码签名](https://v2.tauri.app/distribute/sign/macos/)。

### 环境要求

- **Node.js** 20+
- **Rust** stable（[rustup](https://rustup.rs/)）
- **macOS**：Xcode Command Line Tools
- **Windows**：Visual Studio Build Tools（含 MSVC）、WebView2（Win10/11 通常已自带）

### 云端双平台构建

推送标签 `v*` 或在 GitHub Actions 中手动运行 **Build Desktop** 工作流，会分别在 `macos-latest` 与 `windows-latest` 上构建并上传产物。

## 使用流程

1. 打开设置面板，填写视频 API 的 **Base URL** 与 **API Key**，并注册可用模型 ID（如 `kling-v1`、`runway-gen3` 等，依服务商而定）
2. 在主界面选择目标模型，输入视频描述 Prompt
3. 点击发送，客户端提交生成任务并展示进度
4. 任务完成后预览视频，可一键导出至本地

## 项目结构

```
src/
  components/     # UI 组件（侧边栏、创作区、设置抽屉、视频预览等）
  hooks/          # 应用状态与会话管理
  services/       # API 配置、任务提交与状态轮询
  types/          # 类型定义（任务状态、视频结果等）
src-tauri/        # Rust 命令（配置持久化、本地文件读写、视频导出）
```

## 与 AI 终端模板的继承关系

本项目以 AI 终端为脚手架，复用了以下能力：

| 模块 | 用途 |
|------|------|
| Tauri 桌面壳 + HTTP 插件 | 跨域请求与本地文件系统访问 |
| 设置抽屉 + 配置持久化 | API 密钥与模型白名单管理 |
| 会话 / 侧边栏布局 | 历史任务归档与切换 |
| Framer Motion 动效 | 面板展开、状态卡片、进度反馈 |

Agent 对话链路与文件读取逻辑将在后续迭代中替换为文生视频任务流。

## 配置存储位置

- macOS: `~/Library/Application Support/isshin-ai-textflow/config.json`
- Linux: `~/.config/isshin-ai-textflow/config.json`
- Windows: `%APPDATA%\isshin-ai-textflow\config.json`
