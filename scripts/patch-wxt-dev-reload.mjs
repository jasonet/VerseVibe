import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();

const targetFiles = [
  path.join(rootDir, 'node_modules/.pnpm/wxt@0.20.7_@types+node@22.10.7_rollup@4.30.1/node_modules/wxt/dist/virtual/background-entrypoint.mjs'),
  path.join(rootDir, 'node_modules/.pnpm/@wxt-dev+webextension-polyfill@1.0.0_webextension-polyfill@0.12.0_wxt@0.20.7_@types+node@22.10.7_rollup@4.30.1_/node_modules/wxt/dist/virtual/background-entrypoint.mjs'),
];

const originalSnippet = `async function reloadTabsForContentScript(contentScript) {
  const allTabs = await browser.tabs.query({});
  const matchPatterns = contentScript.matches.map(
    (match) => new MatchPattern(match)
  );
  const matchingTabs = allTabs.filter((tab) => {
    const url = tab.url;
    if (!url) return false;
    return !!matchPatterns.find((pattern) => pattern.includes(url));
  });
  await Promise.all(
    matchingTabs.map(async (tab) => {
      try {
        await browser.tabs.reload(tab.id);
      } catch (err) {
        logger.warn("Failed to reload tab:", err);
      }
    })
  );
}`;

const patchedSnippet = `async function reloadTabsForContentScript(contentScript) {
  const activeTabs = await browser.tabs.query({ active: true, lastFocusedWindow: true });
  const matchPatterns = contentScript.matches.map(
    (match) => new MatchPattern(match)
  );
  const matchingTabs = activeTabs.filter((tab) => {
    const url = tab.url;
    if (!url) return false;
    return !!matchPatterns.find((pattern) => pattern.includes(url));
  });
  await Promise.all(
    matchingTabs.map(async (tab) => {
      try {
        await browser.tabs.reload(tab.id);
      } catch (err) {
        logger.warn("Failed to reload active tab:", err);
      }
    })
  );
}`;

let patchedCount = 0;

for (const filePath of targetFiles) {
  if (!fs.existsSync(filePath)) continue;

  const source = fs.readFileSync(filePath, 'utf8');
  if (source.includes(patchedSnippet)) {
    patchedCount++;
    continue;
  }

  if (!source.includes(originalSnippet)) {
    console.warn(`[patch-wxt-dev-reload] 未找到预期代码块: ${filePath}`);
    continue;
  }

  fs.writeFileSync(filePath, source.replace(originalSnippet, patchedSnippet), 'utf8');
  patchedCount++;
  console.log(`[patch-wxt-dev-reload] 已修补: ${filePath}`);
}

if (patchedCount === 0) {
  console.warn('[patch-wxt-dev-reload] 未找到任何可修补的 WXT 文件');
}
