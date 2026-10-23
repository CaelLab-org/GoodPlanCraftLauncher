import { loadSettings } from './settings';

export type SpeedUnit = 'mbps' | 'mbs';

let speedUnit: SpeedUnit = 'mbps';

export function normalizeSpeedUnit(value: unknown): SpeedUnit {
  return String(value || '').toLowerCase() === 'mbs' ? 'mbs' : 'mbps';
}

export function getSpeedUnit(): SpeedUnit {
  return speedUnit;
}

export function setSpeedUnit(value: unknown): void {
  speedUnit = normalizeSpeedUnit(value);
}

export function formatSpeed(bytesPerSecond: number): string {
  const bytes: number = Number(bytesPerSecond);
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return speedUnit === 'mbs' ? '0.0 MB/s' : '0.0 Mbps';
  }

  if (speedUnit === 'mbs') {
    const megabytes: number = bytes / (1024 * 1024);
    if (megabytes >= 1) return `${megabytes.toFixed(1)} MB/s`;
    return `${Math.max(1, Math.round(bytes / 1024))} KB/s`;
  }

  const bitsPerSecond: number = bytes * 8;
  const megabits: number = bitsPerSecond / 1000000;
  if (megabits >= 1) return `${megabits.toFixed(1)} Mbps`;
  return `${Math.max(1, Math.round(bitsPerSecond / 1000))} Kbps`;
}

export function formatSpeedValue(bytesPerSecond: number): number {
  const bytes: number = Number(bytesPerSecond);
  if (!Number.isFinite(bytes) || bytes <= 0) return 0;
  return speedUnit === 'mbs' ? bytes / (1024 * 1024) : (bytes * 8) / 1000000;
}

export function speedUnitLabel(): string {
  return speedUnit === 'mbs' ? 'MB/s' : 'Mbps';
}

async function loadSpeedUnit(): Promise<void> {
  try {
    const settings = await loadSettings();
    setSpeedUnit(settings?.download?.speedUnit);
  } catch {}
}

void loadSpeedUnit();

window.addEventListener('gpcl-speed-unit-changed', (event: Event): void => {
  const detail: any = (event as CustomEvent).detail;
  setSpeedUnit(detail);
});
