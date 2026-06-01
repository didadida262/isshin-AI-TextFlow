export type TranslationSchema = {
  nav: {
    session: string;
    creation: string;
    settings: string;
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
  };
  errors: {
    configRequired: string;
    modelsRequired: string;
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
  creation: {
    title: string;
    newProject: string;
    empty: string;
    modal: {
      title: string;
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
    creation: "创作",
    settings: "设置",
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
      "Agent 模式：输入「查看文件」或「读取项目」可读取本地 package.json 等项目文件",
    emptyChat: "对话模式：直接与模型聊天；切换到 Agent 可读取本地项目文件",
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
  },
  errors: {
    configRequired: "请先在设置中配置 Base URL 与 API Key",
    modelsRequired: "请先在设置中同步模型列表",
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
  creation: {
    title: "我的项目",
    newProject: "新建项目",
    empty: "暂无项目，点击右上角创建第一个视频创作",
    modal: {
      title: "新建项目",
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
