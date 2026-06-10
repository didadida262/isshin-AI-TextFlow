---
name: seedance-compliant-prompt
description: >-
  Rewrites scripts and video prompts for Seedance 2.0 / Kuaizi text-to-video API
  to pass copyright and content safety checks. Use when writing or converting
  text-to-video prompts, when API returns copyright/合规 errors, when adapting
  screenplay or dialogue into video prompts, or when the user mentions Seedance,
  筷子, 文生视频, or Volcengine prompt guidelines.
---

# Seedance 合规提示词

将剧本、分镜或粗糙描述改写为可通过 Seedance 2.0（含筷子 OpenAPI）审核的文生视频提示词。

官方参考：[Doubao Seedance 2.0 系列提示词指南](https://www.volcengine.com/docs/82379/2222480?lang=zh)

## 何时启用

- 用户要写/改文生视频提示词
- API 返回版权、合规、审核类错误
- 输入是剧本格式（△、角色表、对白行）
- 项目内 `VideoTestResultModal` / `TextToVideoModal` / 批量生成视频前的提示词处理

## 核心原则

1. **过滤器读的是整场景意图**，不是逐词扫描；但要避免真实品牌、版权 IP、真实名人、显性灾难暴力。
2. **像导演写 shot list**，不像编剧写剧本：只写镜头能拍到的可见事实。
3. **本项目筷子 API 请求体仅含**：`prompt`、`mode`、`resolution`、`ratio`、`duration`、`generation_type`。**不要**在 prompt 里假设会传 `model` 或其它字段。
4. **单次生成时长通常 5 秒**：一条 prompt 聚焦一个节拍或短蒙太奇；多场景要么合并为快切描述，要么建议用户分次生成。

## 改写流程

```
原文 → 风险扫描 → 去风险替换 → 剧本转电影化 → 分层补全 → 自检 → 输出
```

### Step 1：风险扫描

对照 [checklist.md](checklist.md) 标出违规项。常见触发源：

| 类别 | 示例 | 处理 |
|------|------|------|
| 真实品牌 | 茅台、iPhone、迪士尼 | 改为「无标识白酒瓶」「智能手机」「卡通角色」 |
| 版权 IP | 漫威角色、动漫名、游戏角色 | 改为外观描述，不出现作品/角色名 |
| 真实人物 | 明星、政客、具体姓名可对应真人 | 改为「年轻男职员」「中年客户」等虚构身份 |
| 显性灾难/暴力 | 蘑菇云、核爆、枪战、血腥 | 改为「远处异常天光」「云状光晕」「对峙氛围」 |
| 不良饮酒 | 拼酒、第三瓶、一饮而尽宣传 | 保留压力感，弱化酗酒鼓动描写 |
| 剧本符号 | △、角色：、旁白音、场次标题 | 全部删除，并入视觉描述 |
| 不可拍信息 | 内心独白、潜台词、台词全文 | 改为表情、动作、镜头反应 |

### Step 2：剧本转电影化

删除所有剧本标记后，按四层组织（见官方指南）：

1. **主题与节拍**：这一镜要展示什么（一句话）
2. **视觉风格**：写实/电影感、色调、光照（如暖黄低照度、35mm 颗粒）
3. **画面与动态**：场景元素、人物动作、镜头运动（推近/切窗/定格）
4. **格式约束**：时长、画幅意图；结尾加合规声明句

### Step 3：输出模板

默认输出**一条**中文提示词，结构如下：

```text
[时长]秒[画幅可选]电影感短片，[风格]，[光照/色调]。[场景与陈设，无品牌]。
[镜头1：机位+动作+可见细节]。
[镜头2或转场（可选）]。
人物均为虚构面孔。无字幕、无品牌标识、无受版权保护角色。
不出现[本稿需规避的敏感具象，如爆炸/蘑菇云/武器/倒计时]。
[可选]结尾[定格/淡出]在[画面]。
```

### Step 4：自检（必须执行）

输出前逐项确认 [checklist.md](checklist.md) 全部通过。若用户原文含高风险项，在回复中附简短「已替换项」说明（3–5 条 bullet），便于用户理解。

### Step 5：与项目集成

- 改写结果直接可用于 `generateVideoB64` / 连接测试弹框的 `prompt` 字段
- 不要建议添加 API 未支持的参数
- 若用户要求「合并成一条」：用快切或单空间连续动作串联，并提示 `duration` 可设为 10 若平台允许

## 禁止事项

- 不要保留真实商标、产品全称、名人姓名
- 不要用 JSON 剧本或对白格式作为最终 prompt（除非用户明确要求 JSON 模式且平台支持）
- 不要用英文替换中文来「绕过」审核（可能仍失败且损失叙事精度）
- 不要添加「仅供参考」「AI 生成」等与画面无关的免责声明塞进 prompt 正文

## 降级策略

若用户坚持保留高风险意象，按顺序降级：

1. 具象 → 隐喻（蘑菇云 → 远处云状光晕）
2. 品牌 → 无标识同类物
3. 多场景 → 单场景最关键节拍
4. 仍失败 → 建议拆成两次生成或缩短 prompt

## 附加资源

- 合规检查清单：[checklist.md](checklist.md)
- 改写前后示例：[examples.md](examples.md)
