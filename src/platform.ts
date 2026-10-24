/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 3
 * or any later version. https://www.caellab.com/license/cbs-v3.txt
 * Source: https://github.com/CaelLab-org/GoodPlanCraftLauncher
 * Project: https://gamets.caellab.com/gpcl/
 */

import path from 'path';

export const IS_WINDOWS: boolean = process.platform === 'win32';

export const IS_LINUX: boolean = process.platform === 'linux';

export const JAVA_BIN_NAME: string = IS_WINDOWS ? 'java.exe' : 'java';

export const JAVA_UI_BIN_NAME: string = IS_WINDOWS ? 'javaw.exe' : 'java';

export const CLASSPATH_SEPARATOR: string = path.delimiter;

export const ADOPTIUM_OS: string = IS_WINDOWS ? 'windows' : process.platform === 'darwin' ? 'mac' : 'linux';

export const ADOPTIUM_ARCH: string = process.arch === 'arm64' ? 'aarch64' : 'x64';

export function nativesClassifier(): string {
  if (IS_WINDOWS) return 'natives-windows';
  if (IS_LINUX) return 'natives-linux';
  return process.arch === 'arm64' ? 'natives-macos-arm64' : 'natives-macos';
}

export function matchesLibraryRules(rules: any[]): boolean {
  if (!rules || rules.length === 0) return true;
  let allowed: boolean = false;
  for (const rule of rules) {
    let match: boolean = true;
    if (rule.os) {
      if (rule.os.name === 'windows' && !IS_WINDOWS) match = false;
      if (rule.os.name === 'linux' && !IS_LINUX) match = false;
      if (rule.os.name === 'osx' && process.platform !== 'darwin') match = false;
    }
    if (match) {
      allowed = (rule.action === 'allow');
    }
  }
  return allowed;
}
