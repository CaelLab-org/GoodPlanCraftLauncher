import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const payload = path.join(root, 'release', 'win-unpacked');
const exeName = `${pkg.build.productName}.exe`;

if (!fs.existsSync(path.join(payload, exeName))) {
    console.error(`找不到应用产物：${payload}\n先跑 npm run pack（= npm run build-ts && electron-builder --win --dir）`);
    process.exit(1);
}

const iscc = [
    process.env.ISCC,
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Inno Setup 6', 'ISCC.exe'),
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Inno Setup 6', 'ISCC.exe')
].find(p => p && fs.existsSync(p));

if (!iscc) {
    console.error('找不到 ISCC.exe：装 Inno Setup 6.5+（https://jrsoftware.org/isdl.php），或用 ISCC 环境变量给出路径');
    process.exit(1);
}

// exe 的文件版本信息必须是四段纯数字
const versionInfo = pkg.version.replace(/-.*$/, '').split('.')
    .map(part => (/^\d+$/.test(part) ? part : '0'))
    .concat(['0', '0', '0'])
    .slice(0, 4)
    .join('.');

console.log(`ISCC: ${iscc}`);
execFileSync(iscc, [
    `/DAppVersion=${pkg.version}`,
    `/DVersionInfoVersion=${versionInfo}`,
    `/DPayloadDir=${payload}`,
    `/DInnoOutputDir=${path.join(root, 'release')}`,
    path.join(root, 'installer', 'gpcl.iss')
], { stdio: 'inherit' });

const setupName = `GPCL-${pkg.version}-Setup.exe`;
const setupPath = path.join(root, 'release', setupName);
if (!fs.existsSync(setupPath)) {
    console.error(`ISCC 跑完了但没找到 ${setupPath}`);
    process.exit(1);
}

// 启动器更新时按 https://dl.caellab.com/file/games/gpcl/GPCL.sha1 校验下载到的安装包
const sha1 = crypto.createHash('sha1').update(fs.readFileSync(setupPath)).digest('hex');
fs.writeFileSync(path.join(root, 'release', 'GPCL.sha1'), `${sha1}  ${setupName}\n`);

const mb = (fs.statSync(setupPath).size / 1024 / 1024).toFixed(1);
console.log(`\n安装包已生成：release/${setupName}（${mb} MB）`);
console.log(`校验文件已生成：release/GPCL.sha1（${sha1}）`);
