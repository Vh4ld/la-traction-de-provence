const INTERVAL_MS = 6000;

/**
 * Bandeau photo : défilement automatique toutes les 6 s, en pause au survol,
 * au focus, sur demande (bouton) et toujours si « mouvement réduit » est demandé.
 * Sans JavaScript, le bandeau reste une bande défilante au doigt ou à la molette.
 */
export function initBanner(root: HTMLElement): void {
  const track = root.querySelector<HTMLElement>('[data-banner-track]')!;
  const slides = Array.from(track.children) as HTMLElement[];
  const status = root.querySelector<HTMLElement>('[data-banner-status]')!;
  const pauseBtn = root.querySelector<HTMLButtonElement>('[data-banner-pause]')!;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let index = 0;
  let userPaused = reduced;
  let hovered = false;
  let focused = false;
  let timer: number | undefined;

  const render = () => {
    status.textContent = `Photo ${index + 1} sur ${slides.length}`;
    pauseBtn.setAttribute('aria-pressed', String(userPaused));
    pauseBtn.setAttribute('aria-label', userPaused ? 'Relancer le diaporama' : 'Mettre le diaporama en pause');
    // Annonce les changements seulement quand le visiteur pilote lui-même.
    status.setAttribute('aria-live', userPaused ? 'polite' : 'off');
  };

  const goTo = (i: number) => {
    index = (i + slides.length) % slides.length;
    track.scrollTo({ left: slides[index].offsetLeft, behavior: reduced ? 'instant' : 'smooth' });
    render();
  };

  const schedule = () => {
    window.clearInterval(timer);
    timer = undefined;
    if (!userPaused && !hovered && !focused && !document.hidden) {
      timer = window.setInterval(() => goTo(index + 1), INTERVAL_MS);
    }
  };

  root.querySelector('[data-banner-prev]')!.addEventListener('click', () => goTo(index - 1));
  root.querySelector('[data-banner-next]')!.addEventListener('click', () => goTo(index + 1));
  pauseBtn.addEventListener('click', () => {
    userPaused = !userPaused;
    render();
    schedule();
  });

  root.addEventListener('mouseenter', () => { hovered = true; schedule(); });
  root.addEventListener('mouseleave', () => { hovered = false; schedule(); });
  root.addEventListener('focusin', () => { focused = true; schedule(); });
  root.addEventListener('focusout', (e) => {
    if (!root.contains(e.relatedTarget as Node)) { focused = false; schedule(); }
  });
  document.addEventListener('visibilitychange', schedule);

  // Défilement manuel (doigt, molette) : on resynchronise l'index.
  track.addEventListener('scrollend', () => {
    const i = Math.round(track.scrollLeft / track.clientWidth);
    if (i !== index) { index = i; render(); }
  });

  root.querySelector<HTMLElement>('[data-banner-controls]')!.hidden = false;
  render();
  schedule();
}
