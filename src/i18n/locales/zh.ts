export type TranslationSchema = {
  nav: {
    session: string;
    creation: string;
    settings: string;
    collapseSidebar: string;
    expandSidebar: string;
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
    emptyAgent: string;
    emptyChat: string;
  };
  mode: {
    chat: string;
    agent: string;
    ariaLabel: string;
  };
  input: {
    placeholderChat: string;
    placeholderAgent: string;
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
    imageSection: string;
    imageApiUrl: string;
    imageApiKey: string;
    imageModel: string;
    imageDefaultSize: string;
    imageCount: string;
    imageTestTitle: string;
    imageTestPromptLabel: string;
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
    requestFailed: string;
  };
  agent: {
    analyzing: string;
    recognizing: string;
    reading: string;
    projectFile: string;
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
      resultsEmpty: string;
      colIndex: string;
      colReel: string;
      colChapter: string;
      colContent: string;
      colEvent: string;
      noEvent: string;
    };
    aiScriptStep: {
      generateScript: string;
      generating: string;
      prerequisiteHint: string;
      emptyHint: string;
      stageSkeleton: string;
      stageAdaptation: string;
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
      statusSuccess: string;
      statusError: string;
      statusPending: string;
      noContent: string;
      chatWelcome: string;
      chatWelcomeHint: string;
      chatSuggestGenerate: string;
      chatSuggestGeneratePrompt: string;
      chatAgentCoordinator: string;
      chatAgentWriter: string;
      chatPipelineComplete: string;
      chatPipelineStopped: string;
      chatFallback: string;
      retryFailed: string;
      retryFailedProgress: (completed: number, total: number) => string;
      chatRetryFailedComplete: string;
      chatRetryFailedNone: string;
    };
    generateAssetsStep: {
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
      colActions: string;
      edit: string;
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
      noPreview: string;
      viewImage: string;
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
      promptLabel: string;
      promptPlaceholder: string;
      modelLabel: string;
      modelEmpty: string;
      sizeLabel: string;
      countLabel: string;
      inferenceStepsLabel: string;
      cancel: string;
      confirm: string;
      generating: string;
      abortGenerating: string;
    };
    editAssetModal: {
      title: string;
      cancel: string;
      confirm: string;
      saving: string;
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
      novelTypePlaceholder: string;
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
    collapseSidebar: "收起侧边栏",
    expandSidebar: "展开侧边栏",
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
    emptyAgent:
      "TextFlow 助手 · Agent 模式：可读取本地项目文件；输入「查看文件」或「读取项目」试试",
    emptyChat:
      "TextFlow 助手：以产品助手身份与你对话，可解答流程与创作问题",
  },
  mode: {
    chat: "对话",
    agent: "Agent",
    ariaLabel: "对话模式",
  },
  input: {
    placeholderChat: "输入消息… Shift+Enter 换行，Enter 发送",
    placeholderAgent: "Agent 模式：可输入「读取项目」「查看文件」等…",
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
    imageSection: "图片生成 API",
    imageApiUrl: "图片 API 地址",
    imageApiKey: "图片 API 密钥",
    imageModel: "图片模型",
    imageDefaultSize: "默认尺寸",
    imageCount: "生成数量 (n)",
    imageTestTitle: "图片连接测试",
    imageTestPromptLabel: "测试提示词",
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
    requestFailed: "请求失败：{{error}}",
  },
  agent: {
    analyzing: "正在分析意图…",
    recognizing: "意图识别中…",
    reading: "正在读取 {{file}}…",
    projectFile: "项目文件",
    organizing: "整理观察结果…",
    done: "Agent 执行完成",
    idle: "待命",
    contextPrefix:
      "以下是通过本地 Agent 读取的真实文件内容，请基于此回答用户：\n",
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
    editProject: "编辑项目",
    backToList: "返回项目列表",
    backShort: "返回",
    workflow: {
      extractEvents: "提取事件",
      aiScript: "AI 写剧本",
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
      resultsEmpty: "点击「事件提取」，AI 将分析各章节并在此展示结构化事件。",
      colIndex: "序号",
      colReel: "卷",
      colChapter: "章节名称",
      colContent: "章节内容",
      colEvent: "事件",
      noEvent: "—",
    },
    aiScriptStep: {
      generateScript: "生成剧本",
      generating: "正在生成剧本…",
      prerequisiteHint: "请先完成「提取事件」步骤，再生成剧本。",
      emptyHint: "点击「生成剧本」，AI 将依次构建故事骨架、改编策略，并逐集生成剧本。",
      stageSkeleton: "正在构建故事骨架…",
      stageAdaptation: "正在制定改编策略…",
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
      statusSuccess: "已完成",
      statusError: "失败",
      statusPending: "待生成",
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
      chatFallback:
        "如需生成剧本，请点击「开始生成剧本」，或输入类似「开始生成剧本」的指令。",
      retryFailed: "重试失败集",
      retryFailedProgress: (completed: number, total: number) =>
        `正在重试失败集 ${completed}/${total}…`,
      chatRetryFailedComplete: "失败集已重新生成，请在右侧查看结果。",
      chatRetryFailedNone: "当前没有失败的集数。",
    },
    generateAssetsStep: {
      generateAsset: "资产生成",
      emptyHint: "点击右上角「资产生成」，填写提示词后将调用图片服务生成并保存资产。",
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
      colActions: "操作",
      edit: "编辑",
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
      noPreview: "无",
      viewImage: "查看大图",
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
      promptLabel: "提示词",
      promptPlaceholder: "描述你想生成的画面，例如：一只可爱的卡通熊猫在吃竹子，3D风格",
      modelLabel: "模型",
      modelEmpty: "未配置（请在项目设置中选择图片模型）",
      sizeLabel: "尺寸",
      countLabel: "生成数量 (n)",
      inferenceStepsLabel: "推理步数",
      cancel: "取消",
      confirm: "开始生成",
      generating: "生成中…",
      abortGenerating: "中断生成",
    },
    editAssetModal: {
      title: "编辑资产",
      cancel: "取消",
      confirm: "保存",
      saving: "保存中…",
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
      novelTypePlaceholder: "例如：玄幻、科幻、言情",
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
      defaultNovelType: "玄幻",
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
