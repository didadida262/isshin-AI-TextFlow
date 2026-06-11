import seedanceSkill from "./seedanceSkill.md?raw";
import type { VideoPromptManualSkills } from "../../../services/videoPromptManualSkills";

const BATCH_GENERATION_RULES = `---

## 批量生成模式（追加约束）

你正在为短剧某一集剧本生成**一条**文生视频提示词。

1. **仅输出提示词正文**：不要标题、不要 Markdown、不要代码块、不要 JSON、不要 \`\` 思考外露、不要「已替换项」说明（替换在正文中完成即可）。
2. 以用户提供的剧本正文为唯一剧情来源；聚焦本集最关键的一个视觉节拍（默认按 5 秒竖屏构思）。
3. 若剧本含多场景，用快切或「镜头切向」合并为一条，勿拆成多条。
4. 输出语言：中文。`;

function buildManualSkillBlock(manualSkills?: VideoPromptManualSkills): string {
  const sections: string[] = [];

  if (manualSkills?.directorStoryboardTable.trim()) {
    sections.push(
      `### 导演手册·分镜表\n\n${manualSkills.directorStoryboardTable.trim()}`,
    );
  }

  if (manualSkills?.visualStoryboard.trim()) {
    sections.push(
      `### 视觉手册·分镜\n\n${manualSkills.visualStoryboard.trim()}`,
    );
  }

  if (sections.length === 0) return "";

  return `

---

## 项目手册参考（分镜技法）

生成提示词时必须融合以下导演手册分镜表与视觉手册分镜技法（景别、运镜、节奏、情绪表达等）；与 Seedance 合规要求冲突时，以 Seedance 合规为准。

${sections.join("\n\n")}`;
}

/** Runtime system prompt: Seedance skill + project manuals + batch-generation rules. */
export function buildVideoPromptGenerationSystem(
  manualSkills?: VideoPromptManualSkills,
): string {
  return `${seedanceSkill.trim()}${buildManualSkillBlock(manualSkills)}

${BATCH_GENERATION_RULES}
`;
}
