const SPLASH_DURATION_MS: number = 2000;

function createParticles(container: HTMLElement): void {
  for (let i = 0; i < 25; i++) {
    const particle: HTMLDivElement = document.createElement('div');
    particle.className = 'boot-particle';
    particle.style.left = `${Math.random() * 100}%`;
    particle.style.bottom = '-10px';
    particle.style.animationDelay = `${Math.random() * 6}s`;
    particle.style.animationDuration = `${4 + Math.random() * 4}s`;
    container.appendChild(particle);
  }
}

export function initBootSplash(skip: boolean): void {
  const overlay: HTMLElement | null = document.getElementById('boot-splash');
  if (!overlay) return;
  if (skip) {
    overlay.remove();
    return;
  }

  const particles: HTMLElement | null = document.getElementById('boot-particles');
  if (particles) createParticles(particles);

  window.gpcl.getAppVersion().then((version: string): void => {
    const versionEl: HTMLElement | null = document.getElementById('boot-version');
    if (versionEl) versionEl.textContent = `v${version}`;
  }).catch((): void => {});

  window.setTimeout((): void => {
    overlay.classList.add('boot-splash-leaving');
    window.setTimeout((): void => overlay.remove(), 550);
  }, SPLASH_DURATION_MS);
}
