#!/usr/bin/env node
/**
 * Guard desktop bundle scripts: Windows installers must be built on Windows.
 * Usage: node scripts/ensure-desktop-platform.mjs mac|win
 */
const target = process.argv[2];
const platform = process.platform;

if (target === "mac" && platform !== "darwin") {
  console.error(
    "\n❌ macOS 安装包（.app / .dmg）只能在 macOS 上构建。\n" +
      "   当前系统: " +
      platform +
      "\n   请在本机执行: npm run desktop:build:mac\n",
  );
  process.exit(1);
}

if (target === "win" && platform !== "win32") {
  console.error(
    "\n❌ Windows 安装包（.msi / .exe）只能在 Windows 上构建，在 Mac 上会报错。\n" +
      "   当前系统: " +
      platform +
      "\n\n" +
      "   可选方案：\n" +
      "   1. 在 Windows 电脑执行: npm run desktop:build:win\n" +
      "   2. 用 GitHub Actions：推送代码后在 Actions 里运行「Build Desktop」工作流，下载 desktop-windows 产物\n",
  );
  process.exit(1);
}
