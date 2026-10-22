/**
 * GPCL TypeScript 构建脚本
 * 使用 esbuild 编译 TS → JS，复制静态资源到 dist/
 */
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const DIST = path.resolve('dist');
const SRC = path.resolve('src');

// 确保 dist 目录存在
fs.mkdirSync(DIST, { recursive: true });

// 编译 main process (main.ts + preload.ts + 各功能模块) → dist/
// bundle:false 只编译列出的入口，主进程拆成多文件后必须全部列出，否则 dist/ 缺文件、
// require 直接失败。types.ts 是纯类型，没有运行时输出。
async function buildMain() {
  const mainEntries = fs.readdirSync(SRC)
    .filter(f => f.endsWith('.ts') && f !== 'types.ts')
    .map(f => `src/${f}`);
  mainEntries.push('src/i18n/index.ts');

  await esbuild.build({
    entryPoints: mainEntries,
    bundle: false,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    outdir: 'dist',
    outbase: 'src',
    sourcemap: false,
  });
  console.log(`✅ main process 编译完成 (${mainEntries.length} 个模块)`);
}

// 编译 renderer → dist/renderer/renderer.js (单文件输出)
async function buildRenderer() {
  await esbuild.build({
    entryPoints: ['src/renderer/renderer.ts'],
    bundle: true,
    platform: 'browser',
    target: 'chrome120',
    format: 'iife',
    outfile: 'dist/renderer/renderer.js',
    sourcemap: false,
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  });
  console.log('✅ renderer 编译完成');
}

// 复制静态文件
function copyStatic() {
  // renderer HTML + CSS + assets
  const rendererDir = path.join(DIST, 'renderer');
  fs.mkdirSync(rendererDir, { recursive: true });

  // 复制 HTML 文件
  for (const html of ['index.html']) {
    const src = path.join('renderer', html);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(rendererDir, html));
    }
  }

  // 复制 CSS
  const cssSrc = path.join('renderer', 'style.css');
  if (fs.existsSync(cssSrc)) {
    fs.copyFileSync(cssSrc, path.join(rendererDir, 'style.css'));
  }

  // 复制 chart.js
  const jsDir = path.join(rendererDir, 'js');
  fs.mkdirSync(jsDir, { recursive: true });
  const chartSrc = path.join('renderer', 'js', 'chart.umd.js');
  if (fs.existsSync(chartSrc)) {
    fs.copyFileSync(chartSrc, path.join(jsDir, 'chart.umd.js'));
  }

  // 复制 skin
  const skinDir = path.join(rendererDir, 'skin');
  fs.mkdirSync(skinDir, { recursive: true });
  const skinSrc = path.join('renderer', 'skin');
  if (fs.existsSync(skinSrc)) {
    for (const f of fs.readdirSync(skinSrc)) {
      fs.copyFileSync(path.join(skinSrc, f), path.join(skinDir, f));
    }
  }

  // 复制图标（独立 svg，靠 CSS mask 跟随 currentColor）
  const iconsSrc = path.join('renderer', 'icons');
  if (fs.existsSync(iconsSrc)) {
    const iconsDir = path.join(rendererDir, 'icons');
    fs.mkdirSync(iconsDir, { recursive: true });
    for (const f of fs.readdirSync(iconsSrc)) {
      fs.copyFileSync(path.join(iconsSrc, f), path.join(iconsDir, f));
    }
  }

  // 复制 logo.png
  const logoSrc = path.join('renderer', 'logo.png');
  if (fs.existsSync(logoSrc)) {
    fs.copyFileSync(logoSrc, path.join(rendererDir, 'logo.png'));
  }

  // 复制 static 目录
  const staticDir = path.join(DIST, 'static');
  fs.mkdirSync(staticDir, { recursive: true });
  for (const sub of ['icon', 'more']) {
    const srcDir = path.join('static', sub);
    if (fs.existsSync(srcDir)) {
      fs.cpSync(srcDir, path.join(staticDir, sub), { recursive: true });
    }
  }

  // 复制 version.txt
  if (fs.existsSync('version.txt')) {
    fs.copyFileSync('version.txt', path.join(DIST, 'version.txt'));
  }

  // 关于页的许可证原文，随程序本地携带
  if (fs.existsSync('LICENSE')) {
    fs.copyFileSync('LICENSE', path.join(DIST, 'LICENSE.txt'));
  }

  // 主进程用 require 读语言包，renderer 由 esbuild 直接内联同一份 JSON
  const localesSrc = path.join(SRC, 'i18n', 'locales');
  if (fs.existsSync(localesSrc)) {
    fs.cpSync(localesSrc, path.join(DIST, 'i18n', 'locales'), { recursive: true });
  }

  // 生成 dist/package.json
  const pkg = require('./package.json');
  // electron-builder 读的是 dist/package.json：缺 description / author 会报警告，
  // 而且 author 决定产物 exe 的 CompanyName 字段
  const distPkg = {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    author: pkg.author,
    main: 'main.js',
    type: 'commonjs',
  };
  fs.writeFileSync(path.join(DIST, 'package.json'), JSON.stringify(distPkg, null, 2));

  console.log('✅ 静态资源复制完成');
}

async function main() {
  await buildMain();
  await buildRenderer();
  copyStatic();
  console.log('🎉 构建完成! dist/ 目录已就绪');
}

main().catch(err => {
  console.error('构建失败:', err);
  process.exit(1);
});
