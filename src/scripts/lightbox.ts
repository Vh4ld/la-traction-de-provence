import { largestCandidate } from '../lib/srcset';

/**
 * Visionneuse : chaque image d'article (hors images servant de lien) devient un bouton
 * « Agrandir » qui l'ouvre dans une boîte de dialogue. Flèches gauche/droite pour naviguer,
 * Échap ou le bouton « Fermer » pour sortir ; le focus revient sur la vignette.
 * Sans JavaScript, les images restent simplement affichées.
 */
export function initLightbox(root: ParentNode = document): void {
  const images = Array.from(root.querySelectorAll<HTMLImageElement>('.prose img, [data-lightbox] img')).filter(
    (img) => !img.closest('a') && !img.closest('.lightbox'),
  );
  if (!images.length) return;

  const dialog = document.createElement('dialog');
  dialog.className = 'lightbox';
  dialog.setAttribute('aria-label', 'Visionneuse de photos');
  dialog.innerHTML = `
    <figure>
      <img alt="" />
      <figcaption></figcaption>
    </figure>
    <p class="lightbox__count" aria-live="polite"></p>
    <button type="button" class="lightbox__btn lightbox__prev" aria-label="Photo précédente">‹</button>
    <button type="button" class="lightbox__btn lightbox__next" aria-label="Photo suivante">›</button>
    <button type="button" class="lightbox__btn lightbox__close" aria-label="Fermer">×</button>`;
  document.body.append(dialog);

  const big = dialog.querySelector('img')!;
  const caption = dialog.querySelector('figcaption')!;
  const count = dialog.querySelector<HTMLElement>('.lightbox__count')!;
  const buttons: HTMLButtonElement[] = [];
  let index = 0;

  const show = (i: number) => {
    index = (i + images.length) % images.length;
    const img = images[index];
    // Vignette en taille réduite : la visionneuse affiche la plus grande version (l'original).
    big.src = img.dataset.full ?? largestCandidate(img.getAttribute('srcset') ?? undefined) ?? img.currentSrc ?? img.src;
    big.alt = img.alt;
    caption.textContent = img.alt;
    caption.hidden = !img.alt;
    count.textContent = images.length > 1 ? `${index + 1} / ${images.length}` : '';
  };

  images.forEach((img, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'zoom';
    button.setAttribute('aria-label', img.alt ? `Agrandir : ${img.alt}` : 'Agrandir la photo');
    img.replaceWith(button);
    button.append(img);
    button.addEventListener('click', () => {
      show(i);
      dialog.showModal();
    });
    buttons.push(button);
  });

  dialog.querySelector('.lightbox__prev')!.addEventListener('click', () => show(index - 1));
  dialog.querySelector('.lightbox__next')!.addEventListener('click', () => show(index + 1));
  dialog.querySelector('.lightbox__close')!.addEventListener('click', () => dialog.close());
  // Clic sur le fond (hors image et boutons) : fermeture.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') show(index + 1);
    else if (e.key === 'ArrowLeft') show(index - 1);
  });
  dialog.addEventListener('close', () => buttons[index]?.focus());

  if (images.length < 2) dialog.querySelectorAll<HTMLElement>('.lightbox__prev, .lightbox__next').forEach((b) => (b.hidden = true));
}
