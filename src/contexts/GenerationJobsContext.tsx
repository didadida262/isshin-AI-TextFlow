import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { GenerateAssetFormValues } from "../components/GenerateAssetModal";
import type { TextToVideoFormValues } from "../components/TextToVideoModal";
import { createProjectAsset, type ProjectAssetRecord } from "../services/assets";
import type { AppConfig } from "../types";
import { generateAssetImageB64 } from "../services/imageGeneration";
import { generateVideoB64 } from "../services/videoGeneration";
import {
  DEFAULT_IMAGE_COUNT,
  DEFAULT_IMAGE_SIZE,
  getVideoSettingsFromConfig,
  loadConfig,
} from "../services/config";

export type GenerationJobKind = "image" | "video";
export type GenerationJobStatus = "running" | "success" | "error";

export interface GenerationJob {
  id: string;
  kind: GenerationJobKind;
  projectId: string;
  projectName: string;
  itemName: string;
  status: GenerationJobStatus;
  errorMessage?: string;
  assetId?: number;
  scriptName?: string;
  createdAt: number;
  completedAt?: number;
  read: boolean;
}

export interface GenerationNavigationTarget {
  projectId: string;
  stepId: "generateAssets" | "generateVideo";
  assetId?: number;
  scriptName?: string;
}

export interface ImageJobCompleteResult {
  success: boolean;
  asset?: ProjectAssetRecord;
  errorMessage?: string;
}

interface StartImageJobInput {
  projectId: string;
  projectName: string;
  /** Visual manual id from project creation (`CreationProject.artStyle`). */
  artStyleId?: string;
  values: Omit<GenerateAssetFormValues, "generationDurationMs">;
  config: AppConfig;
  onWorkflowChange?: () => void;
  onComplete?: (result: ImageJobCompleteResult) => void;
}

interface StartVideoJobInput {
  projectId: string;
  projectName: string;
  values: Omit<TextToVideoFormValues, "generationDurationMs">;
  onWorkflowChange?: () => void;
}

interface GenerationJobsContextValue {
  jobs: GenerationJob[];
  unreadCount: number;
  /** Increments once per completed notification (success or error). */
  notificationShakeTick: number;
  panelOpen: boolean;
  navigationTarget: GenerationNavigationTarget | null;
  setPanelOpen: (open: boolean) => void;
  startImageJob: (input: StartImageJobInput) => string;
  startVideoJob: (input: StartVideoJobInput) => string;
  navigateToJob: (job: GenerationJob) => void;
  clearNavigationTarget: () => void;
  markJobRead: (jobId: string) => void;
  markAllRead: () => void;
  dismissJob: (jobId: string) => void;
}

const GenerationJobsContext = createContext<GenerationJobsContextValue | null>(
  null,
);

function createJobId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getImageSettings(config: AppConfig) {
  const imageModel = config.imageModel.trim();
  const defaultSize = config.imageDefaultSize.trim() || DEFAULT_IMAGE_SIZE;
  const imageCount =
    Number.isFinite(config.imageCount) && config.imageCount >= 1
      ? config.imageCount
      : DEFAULT_IMAGE_COUNT;

  return {
    imageModel,
    defaultSize,
    imageCount,
    imageSettings: {
      imageApiUrl: config.imageApiUrl,
      imageApiKey: config.imageApiKey,
      imageModel,
      imageDefaultSize: defaultSize,
      imageCount,
    },
  };
}

interface GenerationJobsProviderProps {
  children: ReactNode;
  onNavigateToCreation?: () => void;
}

export function GenerationJobsProvider({
  children,
  onNavigateToCreation,
}: GenerationJobsProviderProps) {
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [notificationShakeTick, setNotificationShakeTick] = useState(0);
  const [navigationTarget, setNavigationTarget] =
    useState<GenerationNavigationTarget | null>(null);
  const unreadCount = useMemo(
    () => jobs.filter((job) => !job.read && job.status !== "running").length,
    [jobs],
  );

  const bumpNotificationShake = useCallback(() => {
    setNotificationShakeTick((tick) => tick + 1);
  }, []);

  const updateJob = useCallback(
    (jobId: string, patch: Partial<GenerationJob>) => {
      setJobs((prev) =>
        prev.map((job) => (job.id === jobId ? { ...job, ...patch } : job)),
      );
    },
    [],
  );

  const runImageJob = useCallback(
    async (jobId: string, input: StartImageJobInput) => {
      const { projectId, artStyleId, values, config, onWorkflowChange, onComplete } =
        input;
      const { imageModel, defaultSize, imageCount, imageSettings } =
        getImageSettings(config);
      const startedAt = performance.now();

      try {
        const imageB64 = await generateAssetImageB64({
          prompt: values.prompt,
          artStyleId,
          assetType: values.assetType,
          size: values.size || defaultSize,
          model: values.model || imageModel,
          n: values.n ?? imageCount,
          numInferenceSteps: values.numInferenceSteps,
          settings: imageSettings,
        });

        const generationDurationMs = Math.max(
          0,
          Math.round(performance.now() - startedAt),
        );

        const saved = await createProjectAsset({
          projectId,
          name: values.name,
          assetType: values.assetType,
          prompt: values.prompt,
          model: values.model || imageModel,
          size: values.size || defaultSize,
          imageB64,
          generationDurationMs,
          numInferenceSteps: values.numInferenceSteps,
        });

        updateJob(jobId, {
          status: "success",
          assetId: saved.id,
          completedAt: Date.now(),
          read: false,
        });
        bumpNotificationShake();
        onComplete?.({ success: true, asset: saved });
        onWorkflowChange?.();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        updateJob(jobId, {
          status: "error",
          errorMessage: message,
          completedAt: Date.now(),
          read: false,
        });
        bumpNotificationShake();
        onComplete?.({ success: false, errorMessage: message });
        onWorkflowChange?.();
      }
    },
    [bumpNotificationShake, updateJob],
  );

  const runVideoJob = useCallback(
    async (jobId: string, input: StartVideoJobInput) => {
      const { projectId, values, onWorkflowChange } = input;
      const startedAt = performance.now();

      try {
        const config = await loadConfig();
        const settings = getVideoSettingsFromConfig(config);
        const videoB64 = await generateVideoB64(
          values.kuaizi
            ? {
                prompt: values.prompt,
                settings,
                kuaizi: values.kuaizi,
              }
            : values.seedance
              ? {
                  prompt: values.prompt,
                  settings,
                  seedance: values.seedance,
                }
              : {
                  prompt: values.prompt,
                  settings,
                  size: values.size,
                  numFrames: values.numFrames,
                  fps: values.fps,
                  numInferenceSteps: values.numInferenceSteps,
                  guidanceScale: values.guidanceScale,
                  guidanceScale2: values.guidanceScale2,
                  boundaryRatio: values.boundaryRatio,
                  flowShift: values.flowShift,
                  seed: values.seed,
                },
        );

        const generationDurationMs = Math.max(
          0,
          Math.round(performance.now() - startedAt),
        );

        const saved = await createProjectAsset({
          projectId,
          name: values.name,
          assetType: "video",
          prompt: values.prompt,
          model: values.model,
          size: values.size,
          videoB64,
          generationDurationMs,
          numInferenceSteps: values.numInferenceSteps,
        });

        updateJob(jobId, {
          status: "success",
          assetId: saved.id,
          scriptName: values.name,
          completedAt: Date.now(),
          read: false,
        });
        bumpNotificationShake();
        onWorkflowChange?.();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        updateJob(jobId, {
          status: "error",
          errorMessage: message,
          completedAt: Date.now(),
          read: false,
        });
        bumpNotificationShake();
      }
    },
    [bumpNotificationShake, updateJob],
  );

  const startImageJob = useCallback(
    (input: StartImageJobInput) => {
      const jobId = createJobId();
      const job: GenerationJob = {
        id: jobId,
        kind: "image",
        projectId: input.projectId,
        projectName: input.projectName,
        itemName: input.values.name,
        status: "running",
        createdAt: Date.now(),
        read: true,
      };

      setJobs((prev) => [job, ...prev]);
      void runImageJob(jobId, input);
      return jobId;
    },
    [runImageJob],
  );

  const startVideoJob = useCallback(
    (input: StartVideoJobInput) => {
      const jobId = createJobId();
      const job: GenerationJob = {
        id: jobId,
        kind: "video",
        projectId: input.projectId,
        projectName: input.projectName,
        itemName: input.values.name,
        scriptName: input.values.name,
        status: "running",
        createdAt: Date.now(),
        read: true,
      };

      setJobs((prev) => [job, ...prev]);
      void runVideoJob(jobId, input);
      return jobId;
    },
    [runVideoJob],
  );

  const markJobRead = useCallback((jobId: string) => {
    setJobs((prev) =>
      prev.map((job) => (job.id === jobId ? { ...job, read: true } : job)),
    );
  }, []);

  const markAllRead = useCallback(() => {
    setJobs((prev) =>
      prev.map((job) =>
        job.status === "running" ? job : { ...job, read: true },
      ),
    );
  }, []);

  const dismissJob = useCallback((jobId: string) => {
    setJobs((prev) => prev.filter((job) => job.id !== jobId));
  }, []);

  const navigateToJob = useCallback(
    (job: GenerationJob) => {
      if (job.status === "running") return;

      markJobRead(job.id);
      setPanelOpen(false);
      onNavigateToCreation?.();

      if (job.kind === "image" && job.assetId != null) {
        setNavigationTarget({
          projectId: job.projectId,
          stepId: "generateAssets",
          assetId: job.assetId,
        });
        return;
      }

      if (job.kind === "video" && job.scriptName) {
        setNavigationTarget({
          projectId: job.projectId,
          stepId: "generateVideo",
          scriptName: job.scriptName,
          assetId: job.assetId,
        });
      }
    },
    [markJobRead, onNavigateToCreation],
  );

  const clearNavigationTarget = useCallback(() => {
    setNavigationTarget(null);
  }, []);

  const value = useMemo(
    () => ({
      jobs,
      unreadCount,
      notificationShakeTick,
      panelOpen,
      navigationTarget,
      setPanelOpen,
      startImageJob,
      startVideoJob,
      navigateToJob,
      clearNavigationTarget,
      markJobRead,
      markAllRead,
      dismissJob,
    }),
    [
      jobs,
      unreadCount,
      notificationShakeTick,
      panelOpen,
      navigationTarget,
      startImageJob,
      startVideoJob,
      navigateToJob,
      clearNavigationTarget,
      markJobRead,
      markAllRead,
      dismissJob,
    ],
  );

  return (
    <GenerationJobsContext.Provider value={value}>
      {children}
    </GenerationJobsContext.Provider>
  );
}

export function useGenerationJobs(): GenerationJobsContextValue {
  const context = useContext(GenerationJobsContext);
  if (!context) {
    throw new Error("useGenerationJobs must be used within GenerationJobsProvider");
  }
  return context;
}
