import { loadChartJs } from './chart';
import { formatSpeed } from './speed';

declare const Chart: any;

let dockChart: any = null;
let dockData: number[] = Array(80).fill(0);
let loading: Promise<void> | null = null;

function accentColor(): string {
  try {
    return getComputedStyle(document.body).getPropertyValue('--accent-primary').trim() || '#4fc3f7';
  } catch {
    return '#4fc3f7';
  }
}

function createChart(): void {
  const canvas: HTMLCanvasElement | null = document.getElementById('dock-speed-chart') as HTMLCanvasElement | null;
  if (!canvas || dockChart || typeof Chart === 'undefined') return;

  const context: CanvasRenderingContext2D | null = canvas.getContext('2d');
  if (!context) return;

  const accent: string = accentColor();
  const gradient: CanvasGradient = context.createLinearGradient(0, 0, 0, 160);
  gradient.addColorStop(0, 'rgba(79, 195, 247, 0.28)');
  gradient.addColorStop(1, 'rgba(79, 195, 247, 0)');

  dockChart = new Chart(context, {
    type: 'line',
    data: {
      labels: Array(80).fill(''),
      datasets: [{
        data: dockData.slice(),
        borderColor: accent,
        backgroundColor: gradient,
        borderWidth: 2,
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.82)',
          titleColor: '#fff',
          bodyColor: accent,
          borderColor: 'rgba(79, 195, 247, 0.3)',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (context: any): string => formatSpeed(Number(context.parsed.y) || 0)
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

export async function ensureDockChart(): Promise<void> {
  if (dockChart) return;
  if (!loading) {
    loading = loadChartJs().then((): void => {
      createChart();
      loading = null;
    }).catch((): void => {
      loading = null;
    });
  }
  await loading;
}

export function resetDockChart(): void {
  dockData = Array(80).fill(0);
  if (dockChart) {
    dockChart.data.datasets[0].data = dockData;
    dockChart.update('none');
  }
}

export function updateDockChart(bytesPerSecond: number): void {
  dockData.push(Math.max(0, Number(bytesPerSecond) || 0));
  if (dockData.length > 80) dockData.shift();
  if (!dockChart) {
    void ensureDockChart();
    return;
  }
  dockChart.data.datasets[0].data = dockData;
  const maxSpeed: number = Math.max(...dockData, 1024 * 1024);
  dockChart.options.scales.y.suggestedMax = maxSpeed * 1.35;
  dockChart.update('none');
}
