#!/bin/sh
# Validates the extension, writes a fresh unpacked copy to dist/localmind and zips it to dist/localmind.zip
set -e
cd "$(dirname "$0")"

node --check background.js
node --check sidepanel.js
node -e 'JSON.parse(require("fs").readFileSync("manifest.json", "utf8"))'

FILES="manifest.json background.js sidepanel.html sidepanel.css sidepanel.js icons/icon16.png icons/icon48.png icons/icon128.png docs/USER_GUIDE.md"
rm -rf dist/localmind dist/localmind.zip
mkdir -p dist/localmind
rsync -R $FILES dist/localmind/
(cd dist/localmind && zip -rq ../localmind.zip $FILES)
echo "Built dist/localmind (load this in chrome://extensions) and dist/localmind.zip (to share)"
