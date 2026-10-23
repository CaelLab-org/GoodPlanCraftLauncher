/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 3
 * or any later version. https://www.caellab.com/license/cbs-v3.txt
 * Source: https://github.com/CaelLab-org/GoodPlanCraftLauncher
 * Project: https://gamets.caellab.com/gpcl/
 */


// __IMPORTS_BEGIN__
import { t } from '../i18n';
import { formatSpeed } from './speed';
// __IMPORTS_END__

declare const Chart: any;


export let chartLoaded: boolean = false;


export function loadChartJs(): Promise<void> {
  return new Promise((resolve) => {
    if (chartLoaded || window.Chart) {
      resolve();
      return;
    }
    const script: HTMLScriptElement = document.createElement('script');
    script.src = 'js/chart.umd.js';
    script.onload = () => {
      chartLoaded = true;
      resolve();
    };
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
}


export let speedChart: any = null;

export let speedData: number[] = [];

export let peakSpeed: number = 0;

export function initChart(): void {
  const ctx: HTMLCanvasElement | null = document.getElementById('speedChart') as HTMLCanvasElement | null;
  if (!ctx) return;

  const chartCtx: CanvasRenderingContext2D = ctx.getContext('2d')!;

  const gradient: CanvasGradient = chartCtx.createLinearGradient(0, 0, 0, 180);
  gradient.addColorStop(0, 'rgba(79, 195, 247, 0.3)');
  gradient.addColorStop(1, 'rgba(79, 195, 247, 0)');

  speedChart = new Chart(chartCtx, {
    type: 'line',
    data: {
      labels: Array(40).fill(''),
      datasets: [{
        label: t('ui.download_speed'),
        data: Array(40).fill(0),
        borderColor: '#4fc3f7',
        backgroundColor: gradient,
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: '#4fc3f7'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#fff',
          bodyColor: '#4fc3f7',
          borderColor: 'rgba(79, 195, 247, 0.3)',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: function(context: any): string {
              return formatSpeed(Number(context.parsed.y) || 0);
            }
          }
        }
      },
      scales: {
        x: { display: false },
        y: {
          beginAtZero: true,
          suggestedMax: 1024 * 1024,
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { display: false }
        }
      }
    }
  });
}


export function updateChart(speed: number): void {
  if (!speedChart) return;

  speedData.push(speed);
  if (speedData.length > 40) speedData.shift();

  speedChart.data.datasets[0].data = speedData;

  const maxSpeed: number = Math.max(...speedData, 1);
  speedChart.options.scales.y.suggestedMax = maxSpeed * 1.5;

  speedChart.update('none');
}


export function resetChart(): void {
  speedData = Array(40).fill(0);
  peakSpeed = 0;

  if (speedChart) {
    speedChart.data.datasets[0].data = speedData;
    speedChart.update();
  }

  const currentSpeedEl: HTMLElement | null = document.getElementById('current-speed');
  const peakSpeedEl: HTMLElement | null = document.getElementById('peak-speed');
  const progressFillEl: HTMLElement | null = document.getElementById('progress-fill');
  const progressTextEl: HTMLElement | null = document.getElementById('progress-text');

  if (currentSpeedEl) currentSpeedEl.textContent = formatSpeed(0);
  if (peakSpeedEl) peakSpeedEl.textContent = formatSpeed(0);
  if (progressFillEl) progressFillEl.style.width = '0%';
  if (progressTextEl) progressTextEl.textContent = '0%';
}

/** 跨模块写入用：peakSpeed 归本模块所有，其它模块只能经此写入 */
export function setPeakSpeed(value: number): void { peakSpeed = value; }
