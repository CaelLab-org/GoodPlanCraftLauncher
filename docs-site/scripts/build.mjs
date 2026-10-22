import { spawnSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(siteDir, 'node_modules', '@docusaurus', 'core', 'bin', 'docusaurus.mjs');

// 25 种语言现在都带路径前缀，根上不该再有内容：先清掉上次的产物，
// 免得旧的中文页面留在 build/ 根目录被一起传上去。
rmSync(path.join(siteDir, 'build'), { recursive: true, force: true });

const result = spawnSync(process.execPath, [cli, 'build'], {
  cwd: siteDir,
  stdio: 'inherit',
});
if (result.status !== 0) process.exit(result.status ?? 1);

// /gpcl/docs/ → /gpcl/docs/en/
writeFileSync(
  path.join(siteDir, 'build', 'index.html'),
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>GoodPlanCraftLauncher Help</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="https://gamets.caellab.com/gpcl/docs/en/">
<meta http-equiv="refresh" content="0; url=https://gamets.caellab.com/gpcl/docs/en/">
<script>location.replace('/gpcl/docs/en/');</script>
</head>
<body><p><a href="/gpcl/docs/en/">GoodPlanCraftLauncher Help</a></p></body>
</html>
`,
  'utf8'
);
