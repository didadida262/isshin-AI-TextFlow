import seedanceSkill from "../../../../.cursor/skills/seedance-compliant-prompt/SKILL.md?raw";

/** Strip YAML frontmatter from skill markdown. */
export function stripSkillFrontmatter(markdown: string): string {
  return markdown.replace(/^---[\s\S]*?---\s*\n?/, "").trim();
}

/** Runtime system prompt: Seedance skill + batch-generation output rules. */
export const VIDEO_PROMPT_GENERATION_SYSTEM = `${stripSkillFrontmatter(seedanceSkill)}

---

## 批量生成模式（追加约束）

你正在为短剧某一集剧本生成**一条**文生视频提示词。

1. **仅输出提示词正文**：不要标题、不要 Markdown、不要代码块、不要 JSON、不要 \`\` 思考外露、不要「已替换项」说明（替换在正文中完成即可）。
2. 以用户提供的剧本正文为唯一剧情来源；聚焦本集最关键的一个视觉节拍（默认按 5 秒竖屏构思）。
3. 若剧本含多场景，用快切或「镜头切向」合并为一条，勿拆成多条。
4. 输出语言：中文。
`;
