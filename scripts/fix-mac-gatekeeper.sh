#!/usr/bin/env bash
# Remove macOS quarantine flags so Gatekeeper stops showing "app is damaged".
# Run on the Mac that will OPEN the app (after copying from DMG / download).
set -euo pipefail

APP_NAME="Isshin AI TextFlow.app"
CANDIDATES=(
  "/Applications/${APP_NAME}"
  "${HOME}/Applications/${APP_NAME}"
  "${HOME}/Desktop/${APP_NAME}"
  "${HOME}/Downloads/${APP_NAME}"
)

TARGET=""
for path in "${CANDIDATES[@]}"; do
  if [[ -d "$path" ]]; then
    TARGET="$path"
    break
  fi
done

if [[ -z "$TARGET" ]]; then
  echo "未找到 ${APP_NAME}，请把 .app 拖到「应用程序」后重试，或手动执行：" >&2
  echo '  xattr -cr "/路径/Isshin AI TextFlow.app"' >&2
  exit 1
fi

xattr -cr "$TARGET"
echo "已处理: $TARGET"
echo "请再次双击打开；若仍提示，请右键应用 → 打开 → 仍要打开。"
