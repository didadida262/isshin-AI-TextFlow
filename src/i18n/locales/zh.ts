export type TranslationSchema = {
  nav: {
    session: string;
    creation: string;
    settings: string;
    notifications: string;
    collapseSidebar: string;
    expandSidebar: string;
  };
  notifications: {
    title: string;
    open: string;
    close: string;
    empty: string;
    markAllRead: string;
    dismiss: string;
    viewResult: string;
    statusRunning: string;
    statusSuccess: string;
    typeImage: string;
    typeVideo: string;
  };
  language: {
    label: string;
    switchToEn: string;
    switchToZh: string;
    zh: string;
    en: string;
  };
  session: {
    history: string;
    newSession: string;
    deleteSession: string;
  };
  chat: {
    title: string;
    greeting: string;
    emptyAssistant: string;
    emptyChat: string;
  };
  mode: {
    chat: string;
    assistant: string;
    ariaLabel: string;
  };
  input: {
    placeholderChat: string;
    placeholderAssistant: string;
    send: string;
    stop: string;
  };
  model: {
    label: string;
    none: string;
    empty: string;
  };
  settings: {
    title: string;
    baseUrl: string;
    apiKey: string;
    models: string;
    refresh: string;
    refreshing: string;
    syncHint: string;
    modelsLoaded: string;
    fetchingModels: string;
    removeModel: string;
    apiKeyHint: string;
    testConnection: string;
    testing: string;
    selectModelFirst: string;
    connectionOk: string;
    testDurationLabel: string;
    generalApiSection: string;
    imageSection: string;
    promptRefineSection: string;
    promptRefineApiUrl: string;
    promptRefineApiKey: string;
    promptRefineApiKeyOptional: string;
    promptRefineModel: string;
    promptRefineTestTitle: string;
    promptRefineTestPromptLabel: string;
    promptRefineTestPlaceholder: string;
    promptRefineTestConfirm: string;
    promptRefineTestResultLabel: string;
    promptRefineExpanding: string;
    imageApiUrl: string;
    imageApiKey: string;
    imageModel: string;
    imageDefaultSize: string;
    imageCount: string;
    imageTestTitle: string;
    imageTestPromptLabel: string;
    imageTestConfirm: string;
    videoTestPromptLabel: string;
    videoTestConfirm: string;
    testEphemeralHint: string;
    testAgain: string;
    testClose: string;
    download: string;
    imageTestDownloadTitle: string;
    videoTestDownloadTitle: string;
    videoSection: string;
    videoApiUrl: string;
    videoApiKey: string;
    videoModel: string;
    videoTestTitle: string;
    kuaiziVideoModeLabel: string;
    kuaiziVideoResolutionLabel: string;
    kuaiziVideoRatioLabel: string;
    kuaiziVideoDurationLabel: string;
    kuaiziVideoGenerationTypeLabel: string;
    kuaiziVideoModelNotUsed: string;
    imageToVideoSection: string;
    imageToVideoApiUrl: string;
    imageToVideoApiKey: string;
    imageToVideoModel: string;
    imageToVideoTestTitle: string;
    imageToVideoTestConfirm: string;
    imageToVideoTestDownloadTitle: string;
    imageToVideoReferenceLabel: string;
    imageToVideoReferencePick: string;
    imageToVideoReferenceEmpty: string;
    imageToVideoNegativePromptLabel: string;
    tabModelService: string;
    tabDatabase: string;
    database: {
      title: string;
      overviewTitle: string;
      overviewDesc: string;
      overviewAction: string;
      exportTitle: string;
      exportDesc: string;
      exportAction: string;
      importTitle: string;
      importDesc: string;
      importAction: string;
      clearTableTitle: string;
      clearTableDesc: string;
      clearTableAction: string;
      clearTableSelect: string;
      clearAllTitle: string;
      clearAllDesc: string;
      clearAllAction: string;
      overviewModalTitle: string;
      dbPathLabel: string;
      tableName: string;
      rowCount: string;
      close: string;
      exporting: string;
      importing: string;
      clearing: string;
      exportSuccess: string;
      exportSuccessTo: string;
      exportDialogTitle: string;
      importSuccess: string;
      clearTableSuccess: string;
      clearAllSuccess: string;
      confirmImportTitle: string;
      confirmImportBody: string;
      confirmClearTableTitle: string;
      confirmClearTableBody: string;
      confirmClearTableBodyWithAssets: string;
      confirmClearAllTitle: string;
      confirmClearAllBody: string;
      confirm: string;
      cancel: string;
    };
  };
  errors: {
    configRequired: string;
    modelsRequired: string;
    imageConfigRequired: string;
    promptRefineConfigRequired: string;
    promptRequired: string;
    promptRefineEmptyResponse: string;
    videoConfigRequired: string;
    imageToVideoConfigRequired: string;
    imageToVideoReferenceRequired: string;
    requestFailed: string;
  };
  toolAgent: {
    analyzing: string;
    recognizing: string;
    querying: string;
    organizing: string;
    done: string;
    idle: string;
    contextPrefix: string;
  };
  auth: {
    title: string;
    subtitle: string;
    username: string;
    usernamePlaceholder: string;
    password: string;
    passwordPlaceholder: string;
    login: string;
    loggingIn: string;
    loginFailed: string;
    showPassword: string;
    hidePassword: string;
    logout: string;
  };
  creation: {
    title: string;
    newProject: string;
    empty: string;
    editProject: string;
    deleteProject: string;
    openProjectMenu: string;
    deleteConfirmTitle: string;
    deleteConfirm: (name: string) => string;
    deleteConfirmHint: string;
    cancel: string;
    deleting: string;
    backToList: string;
    backShort: string;
    workflow: {
      extractEvents: string;
      aiScript: string;
      generateAssets: string;
      storyboard: string;
      generateVideo: string;
      editExport: string;
      placeholder: string;
      loading: string;
    };
    extractEventsStep: {
      importSource: string;
      extractEvents: string;
      emptyHint: string;
      charsUnit: string;
      chapterCount: (count: number) => string;
      extracting: string;
      extractingProgress: (completed: number, total: number) => string;
      extractingRowEvent: string;
      reExtractEvents: string;
      extractionDurationTip: (duration: string) => string;
      resultsEmpty: string;
      colIndex: string;
      colReel: string;
      colChapter: string;
      colContent: string;
      colEvent: string;
      noEvent: string;
      colErrorReason: string;
      chapterDetailTitle: (index: number, name: string) => string;
      extractionDurationLabel: string;
      formatDuration: (ms: number) => string;
    };
    aiScriptStep: {
      generateScript: string;
      generating: string;
      prerequisiteHint: string;
      emptyHint: string;
      stageSkeleton: string;
      stageAdaptation: string;
      stageSkeletonComplete: string;
      stageAdaptationComplete: string;
      stageScriptsComplete: string;
      stageScripts: string;
      stageScriptsProgress: (completed: number, total: number) => string;
      storySkeletonTitle: string;
      adaptationStrategyTitle: string;
      tabScripts: string;
      tabSkeletonEmpty: string;
      tabStrategyEmpty: string;
      colEpisode: string;
      colName: string;
      colStatus: string;
      colContent: string;
      colActions: string;
      viewDetail: string;
      colErrorReason: string;
      scriptDetailTitle: (episodeIndex: number, name: string) => string;
      statusSuccess: string;
      statusError: string;
      statusPending: string;
      generatingRowScript: string;
      noContent: string;
      chatWelcome: string;
      chatWelcomeHint: string;
      chatSuggestGenerate: string;
      chatSuggestGeneratePrompt: string;
      chatAgentCoordinator: string;
      chatAgentWriter: string;
      chatPipelineComplete: string;
      chatPipelineStopped: string;
      chatPipelineErrorTitle: string;
      chatPipelineErrorSkeletonBody: string;
      chatPipelineErrorAdaptationBody: string;
      chatPipelineErrorScriptsBody: string;
      chatPipelineErrorGenericBody: string;
      chatPipelineErrorTips: string;
      chatPipelineErrorDetailPrefix: string;
      chatFallback: string;
      retryFailed: string;
      retryFailedProgress: (completed: number, total: number) => string;
      chatRetryFailedComplete: string;
      chatRetryFailedNone: string;
    };
    editExportStep: {
      libraryTitle: string;
      libraryHint: string;
      libraryEmpty: string;
      episodeLabel: (episode: number) => string;
      previewTitle: string;
      previewEmpty: string;
      timelineTitle: string;
      timelineHint: string;
      videoTrack: string;
      audioTrack: string;
      play: string;
      pause: string;
      removeClip: string;
      fillTimeline: string;
      clearTimeline: string;
      export: string;
      exporting: string;
      exportDialogTitle: string;
      exportEmpty: string;
      exportFailed: string;
    };
    generateVideoStep: {
      emptyHint: string;
      colEpisode: string;
      colName: string;
      colStatus: string;
      colContent: string;
      colPrompt: string;
      colDuration: string;
      colVideoStatus: string;
      colActions: string;
      colVideo: string;
      openActionsMenu: string;
      edit: string;
      generateVideo: string;
      regenerateVideo: string;
      formatDuration: (ms: number) => string;
      statusSuccess: string;
      statusError: string;
      statusPending: string;
      statusGenerating: string;
      noContent: string;
      noPrompt: string;
      noVideo: string;
      batchGeneratePrompts: string;
      batchGeneratingPrompts: string;
      batchGeneratingPromptsProgress: (completed: number, total: number) => string;
      batchGeneratePromptsComplete: string;
      noScriptsToGeneratePrompts: string;
      configRequired: string;
      modelRequired: string;
      promptEditTitle: string;
      promptEditPlaceholder: string;
      save: string;
      cancel: string;
      saving: string;
      charsUnit: string;
      savePromptFailed: string;
      noPromptToGenerate: string;
      generatingPrompt: string;
    };
    generateAssetsStep: {
      batchExtract: string;
      viewExtractedAssets: string;
      batchExtracting: string;
      batchExtractingProgress: (completed: number, total: number) => string;
      batchExtractModalTitle: string;
      draftEditTitle: string;
      save: string;
      charsUnit: string;
      colSelect: string;
      selectAll: string;
      noDraftSelected: string;
      batchGenerate: string;
      batchGenerating: string;
      batchGenerateComplete: string;
      batchGenerateBackground: string;
      draftHint: string;
      noScriptsToExtract: string;
      extractNoAssets: string;
      extractSuccess: (count: number) => string;
      draftInvalid: string;
      statusPending: string;
      statusGenerating: string;
      regenerate: string;
      generateAsset: string;
      emptyHint: string;
      loading: string;
      colPreview: string;
      colName: string;
      colType: string;
      colPrompt: string;
      colModel: string;
      colSize: string;
      colInferenceSteps: string;
      colDuration: string;
      formatDuration: (ms: number) => string;
      colStatus: string;
      colErrorReason: string;
      assetDetailTitle: string;
      colActions: string;
      edit: string;
      download: string;
      downloadDialogTitle: string;
      downloadNoFile: string;
      delete: string;
      openActionsMenu: string;
      deleteConfirmTitle: string;
      deleteConfirm: (name: string) => string;
      deleteConfirmHint: string;
      cancel: string;
      deleting: string;
      statusSuccess: string;
      statusError: string;
      typeCharacter: string;
      typeScene: string;
      typeProp: string;
      typeVideo: string;
      noPreview: string;
      viewImage: string;
      viewVideo: string;
      previewTitle: string;
      previewClose: string;
      prevPage: string;
      nextPage: string;
      pageInfo: (page: number, totalPages: number, total: number) => string;
    };
    generateAssetModal: {
      title: string;
      nameLabel: string;
      namePlaceholder: string;
      typeLabel: string;
      typeCharacter: string;
      typeScene: string;
      typeProp: string;
      typeVideo: string;
      promptLabel: string;
      promptPlaceholder: string;
      expandPrompt: string;
      expandingPrompt: string;
      modelLabel: string;
      modelEmpty: string;
      sizeLabel: string;
      countLabel: string;
      inferenceStepsLabel: string;
      cancel: string;
      confirm: string;
      generating: string;
      abortGenerating: string;
      closeWhileGenerating: string;
      backgroundGeneratingHint: string;
    };
    textToVideoModal: {
      title: string;
      nameLabel: string;
      namePlaceholder: string;
      promptLabel: string;
      promptPlaceholder: string;
      modelLabel: string;
      modelDefault: string;
      sizeLabel: string;
      numFramesLabel: string;
      fpsLabel: string;
      inferenceStepsLabel: string;
      guidanceScaleLabel: string;
      guidanceScale2Label: string;
      boundaryRatioLabel: string;
      flowShiftLabel: string;
      seedLabel: string;
      cancel: string;
      confirm: string;
      generating: string;
      abortGenerating: string;
      closeWhileGenerating: string;
      backgroundGeneratingHint: string;
    };
    editAssetModal: {
      title: string;
      cancel: string;
      confirm: string;
      saving: string;
      regenerate: string;
      regenerating: string;
    };
    importNovelModal: {
      title: string;
      uploadHint: string;
      uploadFormats: string;
      or: string;
      pasteLabel: string;
      pastePlaceholder: string;
      charsUnit: string;
      save: string;
      unsupportedFormat: string;
      fileTooLarge: string;
      docxComingSoon: string;
      readFailed: string;
    };
    modal: {
      title: string;
      editTitle: string;
      projectType: string;
      projectTypeNovel: string;
      projectName: string;
      projectNamePlaceholder: string;
      novelType: string;
      novelTypeUrban: string;
      novelTypeWuxia: string;
      imageModel: string;
      videoModel: string;
      selectModel: string;
      quality: string;
      mode: string;
      aspectRatio: string;
      intro: string;
      introPlaceholder: string;
      visualManual: string;
      directorManual: string;
      newVisualManual: string;
      newDirectorManual: string;
      cancel: string;
      confirm: string;
      creating: string;
      saving: string;
      qualityStandard: string;
      qualityHigh: string;
      qualityUltra: string;
      modeStandard: string;
      modeFast: string;
      modeQuality: string;
      defaultProjectName: string;
      defaultNovelType: string;
      defaultIntro: string;
    };
    skillDetail: {
      viewVisualManual: string;
      viewDirectorManual: string;
      visualName: string;
      directorName: string;
      visualFile: string;
      directorFile: string;
      visualCover: string;
      directorCover: string;
      visualPromptTabs: string;
      directorPromptTabs: string;
      viewDetail: string;
      loading: string;
      emptyContent: string;
      close: string;
    };
  };
};

export const zh: TranslationSchema = {
  nav: {
    session: "会话",
    creation: "项目",
    settings: "设置",
    notifications: "消息提醒",
    collapseSidebar: "收起侧边栏",
    expandSidebar: "展开侧边栏",
  },
  notifications: {
    title: "生成消息",
    open: "打开消息面板",
    close: "关闭",
    empty: "暂无生成消息",
    markAllRead: "全部已读",
    dismiss: "移除",
    viewResult: "查看结果",
    statusRunning: "生成中…",
    statusSuccess: "生成完成",
    typeImage: "文生图片",
    typeVideo: "文生视频",
  },
  language: {
    label: "语言",
    switchToEn: "切换为 English",
    switchToZh: "切换为中文",
    zh: "中文",
    en: "EN",
  },
  session: {
    history: "历史会话",
    newSession: "新对话",
    deleteSession: "删除会话",
  },
  chat: {
    title: "对话",
    greeting: "有什么需要帮忙的吗？",
    emptyAssistant:
      "Assistant 模式 · TextFlow 助手：注入产品 Skill，并可查询本地项目与工作流数据",
    emptyChat: "对话模式：直接与所选模型对话，无产品人设与工具",
  },
  mode: {
    chat: "对话",
    assistant: "Assistant",
    ariaLabel: "对话模式",
  },
  input: {
    placeholderChat: "输入消息… Shift+Enter 换行，Enter 发送",
    placeholderAssistant: "Assistant 模式：可询问项目数量、工作流进度、章节/剧本/资产等数据…",
    send: "发送",
    stop: "停止生成",
  },
  model: {
    label: "模型",
    none: "未选择",
    empty: "暂无模型，请打开左侧「设置」填写 API Key 并同步模型列表",
  },
  settings: {
    title: "模型配置中心",
    baseUrl: "API 基础路径",
    apiKey: "API 密钥",
    models: "可用模型",
    refresh: "刷新列表",
    refreshing: "拉取中…",
    syncHint: "通过平台接口自动同步：",
    modelsLoaded: "已加载 {{count}} 个模型",
    fetchingModels: "正在获取模型列表…",
    removeModel: "从列表移除",
    apiKeyHint: "填写 API Key 后将自动拉取可用模型",
    testConnection: "连接测试",
    testing: "测试中…",
    selectModelFirst: "请先选择一个模型",
    connectionOk: "连接成功",
    testDurationLabel: "耗时",
    generalApiSection: "通用 API",
    imageSection: "图片生成 API",
    promptRefineSection: "提示词扩充 API",
    promptRefineApiUrl: "扩充 API 地址",
    promptRefineApiKey: "扩充 API 密钥",
    promptRefineApiKeyOptional: "可选，无鉴权可留空",
    promptRefineModel: "扩充模型",
    promptRefineTestTitle: "提示词扩充连接测试",
    promptRefineTestPromptLabel: "测试提示词",
    promptRefineTestPlaceholder: "输入要扩充的提示词，例如：生成一只小狗的图片",
    promptRefineTestConfirm: "开始测试",
    promptRefineTestResultLabel: "扩充结果",
    promptRefineExpanding: "扩充中…",
    imageApiUrl: "图片 API 地址",
    imageApiKey: "图片 API 密钥",
    imageModel: "图片模型",
    imageDefaultSize: "默认尺寸",
    imageCount: "生成数量 (n)",
    imageTestTitle: "图片连接测试",
    imageTestPromptLabel: "测试提示词",
    imageTestConfirm: "开始测试",
    videoTestPromptLabel: "测试提示词",
    videoTestConfirm: "开始测试",
    testEphemeralHint: "测试结果仅用于连通性验证，不会保存到本地，关闭弹窗后即清除。",
    testAgain: "重新测试",
    testClose: "关闭",
    download: "下载",
    imageTestDownloadTitle: "保存测试图片",
    videoTestDownloadTitle: "保存测试视频",
    videoSection: "文生视频 API",
    videoApiUrl: "文生视频 API 地址",
    videoApiKey: "文生视频 API 密钥",
    videoModel: "文生视频模型",
    videoTestTitle: "文生视频连接测试",
    kuaiziVideoModeLabel: "模式 (mode)",
    kuaiziVideoResolutionLabel: "分辨率 (resolution)",
    kuaiziVideoRatioLabel: "比例 (ratio)",
    kuaiziVideoDurationLabel: "时长 (duration)",
    kuaiziVideoGenerationTypeLabel: "生成类型 (generation_type)",
    kuaiziVideoModelNotUsed: "此接口无需 model 参数",
    imageToVideoSection: "图生视频 API",
    imageToVideoApiUrl: "图生视频 API 地址",
    imageToVideoApiKey: "图生视频 API 密钥",
    imageToVideoModel: "图生视频模型",
    imageToVideoTestTitle: "图生视频连接测试",
    imageToVideoTestConfirm: "开始测试",
    imageToVideoTestDownloadTitle: "保存测试视频",
    imageToVideoReferenceLabel: "参考图片",
    imageToVideoReferencePick: "选择图片",
    imageToVideoReferenceEmpty: "未选择图片",
    imageToVideoNegativePromptLabel: "负向提示词",
    tabModelService: "模型服务",
    tabDatabase: "数据库操作",
    database: {
      title: "数据库操作",
      overviewTitle: "数据库概览",
      overviewDesc: "查看所有数据表名称和记录数",
      overviewAction: "查看信息",
      exportTitle: "导出数据库",
      exportDesc: "将所有数据表导出为 JSON 备份文件",
      exportAction: "导出数据",
      importTitle: "导入数据库",
      importDesc: "从 JSON 备份文件恢复数据（将覆盖当前数据）",
      importAction: "导入数据",
      clearTableTitle: "清空指定表",
      clearTableDesc: "选择一个数据表并清空其中的数据",
      clearTableAction: "清空表",
      clearTableSelect: "请选择表",
      clearAllTitle: "清空数据库",
      clearAllDesc: "清空所有数据表中的数据，保留表结构，并删除资产生成的图片文件",
      clearAllAction: "清空数据",
      overviewModalTitle: "数据库概览",
      dbPathLabel: "数据库路径",
      tableName: "表名",
      rowCount: "记录数",
      close: "关闭",
      exporting: "导出中…",
      importing: "导入中…",
      clearing: "清空中…",
      exportSuccess: "数据库已导出",
      exportSuccessTo: "已导出至 {{path}}",
      exportDialogTitle: "导出数据库备份",
      importSuccess: "已导入 {{count}} 条记录",
      clearTableSuccess: "已清空表 {{table}}（{{count}} 条）",
      clearAllSuccess: "已清空全部数据（{{count}} 条）",
      confirmImportTitle: "确认导入数据库",
      confirmImportBody: "导入将覆盖当前所有业务数据，是否继续？",
      confirmClearTableTitle: "确认清空数据表",
      confirmClearTableBody: "将清空表「{{table}}」中的所有数据，是否继续？",
      confirmClearTableBodyWithAssets:
        "将清空表「{{table}}」中的所有数据，关联资产生成的图片文件也会一并删除。是否继续？",
      confirmClearAllTitle: "确认清空数据库",
      confirmClearAllBody:
        "将清空所有业务数据表，仅保留表结构；data/assets 目录下的资产生成图片也会一并删除。清空 users 表后会自动恢复默认 admin 账号。是否继续？",
      confirm: "确认",
      cancel: "取消",
    },
  },
  errors: {
    configRequired: "请先在设置中配置 Base URL 与 API Key",
    modelsRequired: "请先在设置中同步模型列表",
    imageConfigRequired: "请先在设置中配置图片生成 API",
    promptRefineConfigRequired: "请先在设置中配置提示词扩充 API",
    promptRequired: "请先输入提示词",
    promptRefineEmptyResponse: "提示词扩充服务未返回有效内容",
    videoConfigRequired: "请先在设置中配置文生视频 API",
    imageToVideoConfigRequired: "请先在设置中配置图生视频 API",
    imageToVideoReferenceRequired: "请先上传参考图片",
    requestFailed: "请求失败：{{error}}",
  },
  toolAgent: {
    analyzing: "正在分析意图…",
    recognizing: "意图识别中…",
    querying: "正在查询数据库（{{count}} 个项目）…",
    organizing: "整理查询结果…",
    done: "查询完成",
    idle: "待命",
    contextPrefix:
      "以下是通过本地数据库查询的真实业务数据，请基于此回答用户：\n",
  },
  auth: {
    title: "Isshin AI TextFlow",
    subtitle: "登录后继续使用",
    username: "账户名",
    usernamePlaceholder: "请输入账户名",
    password: "密码",
    passwordPlaceholder: "请输入密码",
    login: "登录",
    loggingIn: "登录中…",
    loginFailed: "用户名或密码错误",
    showPassword: "显示密码",
    hidePassword: "隐藏密码",
    logout: "退出登录",
  },
  creation: {
    title: "项目列表",
    newProject: "新建项目",
    empty: "暂无项目，点击右上角创建第一个视频创作",
    editProject: "编辑",
    deleteProject: "删除",
    openProjectMenu: "项目操作",
    deleteConfirmTitle: "删除项目",
    deleteConfirm: (name: string) => `确定删除「${name}」吗？`,
    deleteConfirmHint:
      "将删除该项目下的原文、事件、剧本、资产等全部数据，且不可恢复。",
    cancel: "取消",
    deleting: "删除中…",
    backToList: "返回项目列表",
    backShort: "返回",
    workflow: {
      extractEvents: "提取事件",
      aiScript: "生成剧本",
      generateAssets: "生成资产",
      storyboard: "制作分镜",
      generateVideo: "生成视频",
      editExport: "剪辑导出",
      placeholder: "此步骤内容即将上线，敬请期待。",
      loading: "加载流程中…",
    },
    extractEventsStep: {
      importSource: "导入原文",
      extractEvents: "事件提取",
      emptyHint: "请先导入小说原文，再进行事件提取。",
      charsUnit: "字符",
      chapterCount: (count: number) => `已解析 ${count} 章`,
      extracting: "正在提取事件…",
      extractingProgress: (completed: number, total: number) =>
        `正在提取事件 ${completed}/${total}…`,
      extractingRowEvent: "正在分析…",
      reExtractEvents: "重新提取",
      extractionDurationTip: (duration: string) => `耗时 ${duration}`,
      resultsEmpty: "点击「事件提取」，AI 将分析各章节并在此展示结构化事件。",
      colIndex: "序号",
      colReel: "卷",
      colChapter: "章节名称",
      colContent: "章节内容",
      colEvent: "事件",
      noEvent: "—",
      colErrorReason: "失败原因",
      chapterDetailTitle: (index: number, name: string) =>
        `第 ${index} 章 · ${name}`,
      extractionDurationLabel: "耗时",
      formatDuration: (ms: number) => {
        if (ms < 1000) return `${ms} 毫秒`;
        if (ms < 60_000) return `${(ms / 1000).toFixed(1)} 秒`;
        const minutes = Math.floor(ms / 60_000);
        const seconds = Math.floor((ms % 60_000) / 1000);
        return `${minutes} 分 ${seconds} 秒`;
      },
    },
    aiScriptStep: {
      generateScript: "生成剧本",
      generating: "正在生成剧本…",
      prerequisiteHint: "请先完成「提取事件」步骤，再生成剧本。",
      emptyHint: "点击「生成剧本」，AI 将依次构建故事骨架、改编策略，并逐集生成剧本。",
      stageSkeleton: "正在构建故事骨架…",
      stageAdaptation: "正在制定改编策略…",
      stageSkeletonComplete: "故事骨架已完成",
      stageAdaptationComplete: "改编策略已完成",
      stageScriptsComplete: "逐集剧本已完成",
      stageScripts: "正在生成剧本…",
      stageScriptsProgress: (completed: number, total: number) =>
        `正在生成剧本 ${completed}/${total}…`,
      storySkeletonTitle: "故事骨架",
      adaptationStrategyTitle: "改编策略",
      tabScripts: "逐集剧本",
      tabSkeletonEmpty: "生成剧本后，故事骨架将显示在此。",
      tabStrategyEmpty: "生成剧本后，改编策略将显示在此。",
      colEpisode: "集数",
      colName: "剧本名称",
      colStatus: "状态",
      colContent: "内容",
      colActions: "操作",
      viewDetail: "详情",
      colErrorReason: "失败原因",
      scriptDetailTitle: (episodeIndex: number, name: string) =>
        `第 ${episodeIndex} 集 · ${name}`,
      statusSuccess: "已完成",
      statusError: "失败",
      statusPending: "待生成",
      generatingRowScript: "正在生成…",
      noContent: "—",
      chatWelcome: "你好，我是剧本统筹 Agent。",
      chatWelcomeHint:
        "我可以帮你依次完成故事骨架、改编策略和逐集剧本。点击下方快捷指令，或直接输入「开始生成剧本」。",
      chatSuggestGenerate: "开始生成剧本",
      chatSuggestGeneratePrompt: "开始生成剧本",
      chatAgentCoordinator: "统筹",
      chatAgentWriter: "编剧",
      chatPipelineComplete: "剧本生成完成，请在右侧工作台查看故事骨架、改编策略与各集剧本。",
      chatPipelineStopped: "已停止生成。",
      chatPipelineErrorTitle: "剧本生成失败",
      chatPipelineErrorSkeletonBody:
        "故事骨架阶段未能完成，模型未返回符合要求的 Markdown 内容。",
      chatPipelineErrorAdaptationBody:
        "改编策略阶段未能完成，模型未返回符合要求的 Markdown 内容。右侧「故事骨架」若已生成，可先查看后再重试。",
      chatPipelineErrorScriptsBody:
        "逐集剧本阶段出现问题，部分集数可能未成功写入。",
      chatPipelineErrorGenericBody: "生成流程中断，请根据下方建议排查后重试。",
      chatPipelineErrorTips:
        "**建议：**\n- 在「设置」中确认 LLM API 地址、密钥与当前模型可用\n- 可尝试切换其他模型后重新生成\n- 若小说简介过长或信息过杂，可适当精简后重试",
      chatPipelineErrorDetailPrefix: "详情：",
      chatFallback:
        "如需生成剧本，请点击「开始生成剧本」，或输入类似「开始生成剧本」的指令。",
      retryFailed: "重试失败集",
      retryFailedProgress: (completed: number, total: number) =>
        `正在重试失败集 ${completed}/${total}…`,
      chatRetryFailedComplete: "失败集已重新生成，请在右侧查看结果。",
      chatRetryFailedNone: "当前没有失败的集数。",
    },
    editExportStep: {
      libraryTitle: "视频素材",
      libraryHint: "拖拽到下方轨道进行拼接",
      libraryEmpty: "请先在「生成视频」步骤完成各集视频。",
      episodeLabel: (episode: number) => `第 ${episode} 集`,
      previewTitle: "预览",
      previewEmpty: "将素材拖入轨道后，在此预览时间线画面",
      timelineTitle: "时间线",
      timelineHint: "拖入视频轨；片段可拖动、裁切",
      videoTrack: "视频",
      audioTrack: "音频",
      play: "播放",
      pause: "暂停",
      removeClip: "移除片段",
      fillTimeline: "按集数排列",
      clearTimeline: "清空轨道",
      export: "导出视频",
      exporting: "导出中…",
      exportDialogTitle: "导出成片",
      exportEmpty: "时间线为空，请先添加视频片段",
      exportFailed: "导出失败，请确认已安装 ffmpeg",
    },
    generateVideoStep: {
      emptyHint: "请先在「生成剧本」步骤完成逐集剧本，再在此根据剧本生成视频。",
      colEpisode: "集数",
      colName: "剧本名称",
      colStatus: "剧本状态",
      colContent: "内容",
      colPrompt: "提示词",
      colDuration: "生成耗时",
      colVideoStatus: "视频状态",
      colActions: "操作",
      colVideo: "视频",
      openActionsMenu: "操作菜单",
      edit: "编辑",
      generateVideo: "生成视频",
      regenerateVideo: "重新生成",
      formatDuration: (ms: number) =>
        ms < 1000 ? `${ms} 毫秒` : `${(ms / 1000).toFixed(1)} 秒`,
      statusSuccess: "已完成",
      statusError: "失败",
      statusPending: "待生成",
      statusGenerating: "生成中",
      noContent: "—",
      noPrompt: "—",
      noVideo: "暂无视频",
      batchGeneratePrompts: "批量生成提示词",
      batchGeneratingPrompts: "AI 生成提示词中…",
      batchGeneratingPromptsProgress: (completed, total) =>
        `AI 生成提示词中 ${completed}/${total}…`,
      batchGeneratePromptsComplete: "全部提示词已生成，可在列表中查看或继续生成视频。",
      noScriptsToGeneratePrompts: "没有可生成提示词的成功剧本，请先完成剧本生成",
      configRequired: "请先在设置中配置 API 地址与密钥",
      modelRequired: "请先在设置中选择文本模型",
      promptEditTitle: "编辑视频提示词",
      promptEditPlaceholder: "输入 Seedance 文生视频提示词…",
      save: "保存",
      cancel: "取消",
      saving: "保存中…",
      charsUnit: "字符",
      savePromptFailed: "提示词保存失败，请重试",
      noPromptToGenerate: "请先生成或编辑提示词，再生成视频",
      generatingPrompt: "生成中…",
    },
    generateAssetsStep: {
      batchExtract: "批量提取资产",
      viewExtractedAssets: "自动生成资产",
      batchExtracting: "AI 提取资产中…",
      batchExtractingProgress: (completed, total) =>
        `AI 提取资产中 ${completed}/${total}…`,
      batchExtractModalTitle: "提取资产草稿",
      draftEditTitle: "编辑资产草稿",
      save: "保存",
      charsUnit: "字符",
      colSelect: "选择",
      selectAll: "全选",
      noDraftSelected: "请至少勾选一条待生成的资产",
      batchGenerate: "批量生成资产",
      batchGenerating: "批量生成中…",
      batchGenerateComplete:
        "全部资产生成完成，可在下方列表点击缩略图查看大图，或点击行查看详情。",
      batchGenerateBackground:
        "资产正在后台生成，完成后将通过通知提醒。",
      draftHint:
        "已由 AI 从剧本提取人物与场景草稿，点击行可编辑名称与提示词，确认后点击「批量生成资产」。生成过程中可关闭弹框，任务将在后台继续并在通知栏提醒。提取或生成过程中「批量提取资产」将暂时不可用。",
      noScriptsToExtract: "没有可提取的成功剧本，请先完成剧本生成",
      extractNoAssets: "未能从剧本中识别出人物或场景，请检查剧本格式",
      extractSuccess: (count: number) =>
        `已从剧本识别出 ${count} 条资产草稿，请确认后点击「批量生成资产」。`,
      draftInvalid: "请为每条资产填写名称和提示词",
      statusPending: "待生成",
      statusGenerating: "生成中",
      regenerate: "重新生成",
      generateAsset: "资产生成",
      emptyHint:
        "点击「批量提取资产」从剧本中识别人物与场景，或点击「资产生成」手动创建单条资产。",
      loading: "加载资产列表…",
      colPreview: "预览",
      colName: "名称",
      colType: "类型",
      colPrompt: "提示词",
      colModel: "模型",
      colSize: "尺寸",
      colInferenceSteps: "推理步数",
      colDuration: "生成耗时",
      formatDuration: (ms: number) =>
        ms < 1000 ? `${ms} 毫秒` : `${(ms / 1000).toFixed(1)} 秒`,
      colStatus: "状态",
      colErrorReason: "失败原因",
      assetDetailTitle: "资产详情",
      colActions: "操作",
      edit: "编辑",
      download: "下载",
      downloadDialogTitle: "保存资产",
      downloadNoFile: "该资产暂无文件可下载",
      delete: "删除",
      openActionsMenu: "操作菜单",
      deleteConfirmTitle: "删除资产",
      deleteConfirm: (name: string) => `确定删除资产「${name}」吗？`,
      deleteConfirmHint: "删除后无法恢复，关联图片文件也会一并移除。",
      cancel: "取消",
      deleting: "删除中…",
      statusSuccess: "已完成",
      statusError: "失败",
      typeCharacter: "角色",
      typeScene: "场景",
      typeProp: "道具",
      typeVideo: "视频",
      noPreview: "无",
      viewImage: "查看大图",
      viewVideo: "播放视频",
      previewTitle: "生成结果",
      previewClose: "关闭",
      prevPage: "上一页",
      nextPage: "下一页",
      pageInfo: (page: number, totalPages: number, total: number) =>
        `第 ${page}/${totalPages} 页，共 ${total} 条`,
    },
    generateAssetModal: {
      title: "资产生成",
      nameLabel: "资产名称",
      namePlaceholder: "例如：主角小张",
      typeLabel: "资产类型",
      typeCharacter: "角色",
      typeScene: "场景",
      typeProp: "道具",
      typeVideo: "视频",
      promptLabel: "提示词",
      promptPlaceholder: "描述你想生成的画面，例如：一只可爱的卡通熊猫在吃竹子，3D风格",
      expandPrompt: "扩充提示词",
      expandingPrompt: "扩充中…",
      modelLabel: "模型",
      modelEmpty: "未配置（请在项目设置中选择图片模型）",
      sizeLabel: "尺寸",
      countLabel: "生成数量 (n)",
      inferenceStepsLabel: "推理步数",
      cancel: "取消",
      confirm: "开始生成",
      generating: "生成中…",
      abortGenerating: "中断生成",
      closeWhileGenerating: "关闭",
      backgroundGeneratingHint: "关闭窗口后可在通知面板继续查看进度",
    },
    textToVideoModal: {
      title: "视频生成",
      nameLabel: "视频名称",
      namePlaceholder: "例如：柯基奔跑",
      promptLabel: "提示词",
      promptPlaceholder:
        "描述你想生成的视频画面，例如：一只可爱的柯基犬在开满向日葵的田野里快乐地奔跑",
      modelLabel: "模型",
      modelDefault: "wan2.2-t2v-5b",
      sizeLabel: "尺寸",
      numFramesLabel: "帧数",
      fpsLabel: "帧率 (fps)",
      inferenceStepsLabel: "推理步数",
      guidanceScaleLabel: "引导强度",
      guidanceScale2Label: "二阶段引导强度",
      boundaryRatioLabel: "噪声边界比例",
      flowShiftLabel: "流匹配偏移",
      seedLabel: "随机种子",
      cancel: "取消",
      confirm: "开始生成",
      generating: "生成中…",
      abortGenerating: "中断生成",
      closeWhileGenerating: "关闭",
      backgroundGeneratingHint: "关闭窗口后可在通知面板继续查看进度",
    },
    editAssetModal: {
      title: "编辑资产",
      cancel: "取消",
      confirm: "保存",
      saving: "保存中…",
      regenerate: "重新生成",
      regenerating: "重新生成中…",
    },
    importNovelModal: {
      title: "上传小说原文",
      uploadHint: "拖拽小说原文文件到此处或点击上传",
      uploadFormats: "支持 .txt, .docx 格式，建议文件大小不超过 10MB",
      or: "或",
      pasteLabel: "直接粘贴小说原文内容",
      pastePlaceholder: "请输入小说原文内容",
      charsUnit: "字符",
      save: "保存",
      unsupportedFormat: "仅支持 .txt、.docx 格式文件",
      fileTooLarge: "文件大小不能超过 10MB",
      docxComingSoon: ".docx 解析即将上线，请暂时使用 .txt 或粘贴文本",
      readFailed: "文件读取失败，请重试",
    },
    modal: {
      title: "新建项目",
      editTitle: "编辑项目",
      projectType: "项目类型",
      projectTypeNovel: "基于小说原文",
      projectName: "项目名称",
      projectNamePlaceholder: "请输入项目名称",
      novelType: "小说类型",
      novelTypeUrban: "都市",
      novelTypeWuxia: "武侠",
      imageModel: "选择图片模型",
      videoModel: "选择视频模型",
      selectModel: "请选择模型",
      quality: "质量",
      mode: "模式",
      aspectRatio: "影片比例",
      intro: "小说简介",
      introPlaceholder: "请输入小说简介",
      visualManual: "视觉手册",
      directorManual: "导演手册",
      newVisualManual: "新建视觉手册",
      newDirectorManual: "新建导演手册",
      cancel: "取消",
      confirm: "确定",
      creating: "创建中…",
      saving: "保存中…",
      qualityStandard: "标准",
      qualityHigh: "高清",
      qualityUltra: "超清",
      modeStandard: "标准",
      modeFast: "快速",
      modeQuality: "品质",
      defaultProjectName: "未命名项目",
      defaultNovelType: "都市",
      defaultIntro: "在一个充满灵气的世界中，少年意外获得神秘传承，踏上修行之路……",
    },
    skillDetail: {
      viewVisualManual: "查看视觉手册",
      viewDirectorManual: "查看导演手册",
      visualName: "视觉手册名称",
      directorName: "导演手册名称",
      visualFile: "视觉手册文件",
      directorFile: "导演手册文件",
      visualCover: "视觉手册封面",
      directorCover: "导演手册封面",
      visualPromptTabs: "视觉手册提示词",
      directorPromptTabs: "导演手册提示词",
      viewDetail: "查看详情",
      loading: "加载中…",
      emptyContent: "暂无内容",
      close: "关闭",
    },
  },
};
