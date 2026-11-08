#!/usr/bin/env bash
# Publish only the self-contained sample-data trial; never runtime data/uploads.
set -euo pipefail
cd "$(dirname "$0")/.."
trial_root=$PWD
node frontend/scripts/build-offline.mjs
trial_publish_dir=$(mktemp -d /tmp/baihuali-trial-publish.XXXXXX)
trial_remote=$(git remote get-url origin)
git init -q -b gh-pages "$trial_publish_dir"
git -C "$trial_publish_dir" remote add origin "$trial_remote"
trial_remote_status=0
git ls-remote --exit-code --heads origin gh-pages >/dev/null || trial_remote_status=$?
if [[ "$trial_remote_status" == 0 ]]; then
  git -C "$trial_publish_dir" fetch -q --depth=1 origin gh-pages
  git -C "$trial_publish_dir" checkout -q -B gh-pages FETCH_HEAD
elif [[ "$trial_remote_status" != 2 ]]; then
  echo '无法确认远程试用分支，未推送。'
  exit "$trial_remote_status"
fi
cp docs/trial/百花里餐饮考核系统-试用版.html "$trial_publish_dir/index.html"
touch "$trial_publish_dir/.nojekyll"
python - "$trial_publish_dir" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1])
(p/'README.md').write_text('''# 百花里 · 免费个人试用页

此分支仅含自包含试用网页，不含服务器、真实评分或上传文件。
首次发布需要仓库所有者在 Settings → Pages 中选择 Deploy from a branch → gh-pages → / (root) → Save。
网站实际使用地址以 GitHub Pages 设置页显示并成功部署的地址为准。
试用评分和文件只保存在访问者的浏览器中，不同设备不共享；正式版本位于 main 分支。
''')
PY
trial_author_name=$(git config user.name || true)
trial_author_email=$(git config user.email || true)
git -C "$trial_publish_dir" config user.name "${trial_author_name:-Baihuali Trial Publisher}"
git -C "$trial_publish_dir" config user.email "${trial_author_email:-41898282+github-actions[bot]@users.noreply.github.com}"
git -C "$trial_publish_dir" add index.html .nojekyll README.md
if ! git -C "$trial_publish_dir" diff --cached --quiet; then
  git -C "$trial_publish_dir" commit -q -m "Publish browser trial from $(git -C "$trial_root" rev-parse --short HEAD)"
fi
git -C "$trial_publish_dir" push origin HEAD:gh-pages
