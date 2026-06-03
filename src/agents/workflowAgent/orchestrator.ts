import { runAdaptationStrategyAgent } from "./adaptationStrategyAgent";
import { runEpisodeScriptAgent } from "./episodeScriptAgent";
import { runStorySkeletonAgent } from "./storySkeletonAgent";
import type { ScriptAgentContext, ScriptGenerationProgress } from "./types";
import { loadStorySkillDetail } from "../../services/skills";
import {
  isEventExtractionComplete,
  type NovelChapterRecord,
} from "../../services/novel";
import {
  SCRIPT_STATE_ERROR,
  SCRIPT_STATE_SUCCESS,
  setScriptWorkData,
  upsertScript,
  type ScriptRecord,
} from "../../services/script";
import type { AppConfig, CreationProject } from "../../types";

export interface RunScriptPipelineOptions {
  project: CreationProject;
  config: AppConfig;
  model: string;
  chapters: NovelChapterRecord[];
  initialWorkData?: { storySkeleton: string; adaptationStrategy: string };
  initialScripts?: ScriptRecord[];
  onProgress?: (progress: ScriptGenerationProgress) => void;
  signal?: AbortSignal;
}

export interface RunScriptPipelineResult {
  workData: { storySkeleton: string; adaptationStrategy: string };
  scripts: ScriptRecord[];
}

async function loadDirectorSkillContent(
  directorManual: string,
): Promise<string | undefined> {
  if (!directorManual.trim()) return undefined;
  const detail = await loadStorySkillDetail(directorManual);
  const tab = detail?.tabs.find(
    (item) => item.value === "director_planning_narrative",
  );
  return tab?.content;
}

function upsertLocalScript(scripts: ScriptRecord[], saved: ScriptRecord): void {
  const existingIndex = scripts.findIndex(
    (item) => item.episodeIndex === saved.episodeIndex,
  );
  if (existingIndex >= 0) {
    scripts[existingIndex] = saved;
  } else {
    scripts.push(saved);
  }
}

async function writeEpisodeScript(
  ctxBase: Omit<ScriptAgentContext, "workData" | "scripts">,
  workData: { storySkeleton: string; adaptationStrategy: string },
  scripts: ScriptRecord[],
  chapter: NovelChapterRecord,
  projectId: string,
): Promise<void> {
  try {
    const episode = await runEpisodeScriptAgent(
      { ...ctxBase, workData, scripts },
      chapter,
    );
    const saved = await upsertScript({
      projectId,
      episodeIndex: chapter.chapterIndex,
      name: episode.name,
      content: episode.content,
      scriptState: SCRIPT_STATE_SUCCESS,
      errorReason: null,
    });
    upsertLocalScript(scripts, saved);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const saved = await upsertScript({
      projectId,
      episodeIndex: chapter.chapterIndex,
      name: `${ctxBase.project.name} EP${String(chapter.chapterIndex).padStart(2, "0")}`,
      content: "",
      scriptState: SCRIPT_STATE_ERROR,
      errorReason: message,
    });
    upsertLocalScript(scripts, saved);
  }
}

export interface RegenerateFailedEpisodesOptions {
  project: CreationProject;
  config: AppConfig;
  model: string;
  chapters: NovelChapterRecord[];
  workData: { storySkeleton: string; adaptationStrategy: string };
  scripts: ScriptRecord[];
  onProgress?: (progress: ScriptGenerationProgress) => void;
  signal?: AbortSignal;
}

/** Re-run only episodes that previously failed (requires skeleton + strategy). */
export async function regenerateFailedEpisodes(
  options: RegenerateFailedEpisodesOptions,
): Promise<RunScriptPipelineResult> {
  const {
    project,
    config,
    model,
    chapters,
    workData,
    scripts: initialScripts,
    onProgress,
    signal,
  } = options;

  if (!workData.storySkeleton.trim() || !workData.adaptationStrategy.trim()) {
    throw new Error("请先完成故事骨架与改编策略生成");
  }

  const directorSkillContent = await loadDirectorSkillContent(
    project.directorManual,
  );
  const scripts: ScriptRecord[] = [...initialScripts];
  const ctxBase = {
    project,
    config,
    model,
    chapters,
    directorSkillContent,
    signal,
  };

  const failedIndexes = new Set(
    scripts
      .filter((item) => item.scriptState === SCRIPT_STATE_ERROR)
      .map((item) => item.episodeIndex),
  );
  const chaptersToRetry = chapters
    .filter((chapter) => failedIndexes.has(chapter.chapterIndex))
    .sort((a, b) => a.chapterIndex - b.chapterIndex);

  if (chaptersToRetry.length === 0) {
    return { workData, scripts };
  }

  onProgress?.({
    stage: "scripts",
    completed: 0,
    total: chaptersToRetry.length,
  });

  for (let index = 0; index < chaptersToRetry.length; index += 1) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    const chapter = chaptersToRetry[index];
    await writeEpisodeScript(ctxBase, workData, scripts, chapter, project.id);
    onProgress?.({
      stage: "scripts",
      completed: index + 1,
      total: chaptersToRetry.length,
    });
  }

  return { workData, scripts };
}

/** Three-stage script pipeline: skeleton → adaptation → per-episode scripts. */
export async function runScriptPipeline(
  options: RunScriptPipelineOptions,
): Promise<RunScriptPipelineResult> {
  const {
    project,
    config,
    model,
    chapters,
    initialWorkData,
    initialScripts = [],
    onProgress,
    signal,
  } = options;

  if (!isEventExtractionComplete(chapters)) {
    throw new Error("请先完成全部章节的事件提取");
  }

  const directorSkillContent = await loadDirectorSkillContent(
    project.directorManual,
  );

  let workData = {
    storySkeleton: initialWorkData?.storySkeleton ?? "",
    adaptationStrategy: initialWorkData?.adaptationStrategy ?? "",
  };
  const scripts: ScriptRecord[] = [...initialScripts];

  const ctxBase = {
    project,
    config,
    model,
    chapters,
    directorSkillContent,
    signal,
  };

  onProgress?.({ stage: "skeleton" });
  const storySkeleton = await runStorySkeletonAgent({
    ...ctxBase,
    workData,
    scripts,
  });
  workData = await setScriptWorkData(project.id, { storySkeleton });

  onProgress?.({ stage: "adaptation" });
  const adaptationStrategy = await runAdaptationStrategyAgent({
    ...ctxBase,
    workData,
    scripts,
  });
  workData = await setScriptWorkData(project.id, { adaptationStrategy });

  const sortedChapters = [...chapters].sort(
    (a, b) => a.chapterIndex - b.chapterIndex,
  );
  onProgress?.({ stage: "scripts", completed: 0, total: sortedChapters.length });

  for (let index = 0; index < sortedChapters.length; index += 1) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const chapter = sortedChapters[index];
    await writeEpisodeScript(ctxBase, workData, scripts, chapter, project.id);

    onProgress?.({
      stage: "scripts",
      completed: index + 1,
      total: sortedChapters.length,
    });
  }

  return { workData, scripts };
}
