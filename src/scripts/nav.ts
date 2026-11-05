/**
 * Sous-menus du menu principal (motif « disclosure ») :
 * un bouton ouvre/ferme son sous-menu, Échap referme et rend le focus,
 * un clic à l'extérieur ou l'ouverture d'un autre sous-menu referme le précédent.
 */
export function initNav(): void {
  document.documentElement.classList.add('js');

  const toggles = Array.from(document.querySelectorAll<HTMLButtonElement>('.nav__toggle'));

  const setOpen = (button: HTMLButtonElement, open: boolean) => {
    button.setAttribute('aria-expanded', String(open));
  };

  const closeAll = (except?: HTMLButtonElement) => {
    toggles.forEach((t) => t !== except && setOpen(t, false));
  };

  toggles.forEach((button) => {
    button.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') !== 'true';
      closeAll(button);
      setOpen(button, open);
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const open = toggles.find((t) => t.getAttribute('aria-expanded') === 'true');
    if (!open) return;
    setOpen(open, false);
    open.focus();
  });

  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Node)) return;
    if (!toggles.some((t) => t.parentElement?.contains(event.target as Node))) closeAll();
  });
}
