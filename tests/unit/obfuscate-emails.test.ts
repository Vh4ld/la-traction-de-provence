import { describe, expect, test } from 'vitest';
import { obfuscateEmails } from '../../src/lib/obfuscate-emails';

describe('obfuscateEmails', () => {
  test('encode l’adresse du lien et son texte en entités HTML', () => {
    const out = obfuscateEmails('<p>Courriel : <a href="mailto:a.b@gmail.com">a.b@gmail.com</a></p>');
    expect(out).not.toMatch(/a\.b@gmail\.com/);
    expect(out).toContain('<a href="&#109;&#97;&#105;&#108;&#116;&#111;&#58;');
    // Le navigateur décode les entités : le lien reste identique pour le visiteur.
    const decoded = out.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
    expect(decoded).toBe('<p>Courriel : <a href="mailto:a.b@gmail.com">a.b@gmail.com</a></p>');
  });

  test('conserve les autres attributs et ne touche pas aux autres liens', () => {
    const out = obfuscateEmails('<a class="x" href="mailto:c@d.fr" data-a="1">écrire</a> <a href="/contact/">c@d.fr</a>');
    expect(out).toContain('class="x"');
    expect(out).toContain('data-a="1"');
    expect(out).toContain('>écrire</a>');
    expect(out).toContain('<a href="/contact/">&#99;&#64;&#100;&#46;&#102;&#114;</a>');
  });

  test('masque aussi une adresse écrite en clair hors lien', () => {
    expect(obfuscateEmails('<p>Écrire à c@d.fr.</p>')).toBe('<p>Écrire à &#99;&#64;&#100;&#46;&#102;&#114;.</p>');
  });

  test('laisse intactes les adresses dans les scripts et les styles', () => {
    const html = '<script type="application/ld+json">{"email":"c@d.fr"}</script>';
    expect(obfuscateEmails(html)).toBe(html);
  });
});
