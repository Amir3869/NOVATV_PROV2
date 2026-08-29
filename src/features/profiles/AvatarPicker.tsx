'use client';

import React, { useCallback, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/utils/cn';
import { AVATARS } from '@/services/profiles/avatars';
import type { AvatarId } from '@/types';
import { useTranslation } from '@/i18n';

/**
 * Nombre de colonnes de la grille d'avatars.
 *
 * La grille est en 4 × 2 : quatre avatars par rangée. Une flèche
 * gauche/droite change la colonne, une flèche haut/bas saute d'exactement
 * `COLUMNS` cellules. Si l'on change un jour le nombre de colonnes (par
 * exemple 5 × 2 pour un écran plus large), il suffit de modifier cette
 * constante : le déplacement suit.
 */
export const AVATAR_GRID_COLUMNS = 4;

/**
 * Calcule la nouvelle position du focus pour une touche de navigation,
 * dans une grille de `count` cellules disposées sur `columns` colonnes.
 *
 * ── Pourquoi une fonction pure ──
 * Le déplacement dans une grille est le seul point de cette fonctionnalité
 * qui puisse être testé sans navigateur (il n'existe pas encore de test de
 * composant dans le projet). On la sort du composant pour la vérifier, et
 * le composant ne fait plus qu'appeler cette fonction. Les bornes (ne pas
 * sortir des cellules, ne pas passer du haut au bas de la grille via
 * haut/bas) vivent ici, une fois pour toutes.
 */
export function moveAvatarFocus(
  index: number,
  key: string,
  count: number,
  columns: number = AVATAR_GRID_COLUMNS
): number {
  if (count <= 0) return 0;
  if (key === 'ArrowLeft') return Math.max(0, index - 1);
  if (key === 'ArrowRight') return Math.min(count - 1, index + 1);
  if (key === 'ArrowUp') {
    // Déjà en première rangée : ne pas monter plus haut.
    return index - columns < 0 ? index : index - columns;
  }
  if (key === 'ArrowDown') {
    // Déjà en dernière rangée : ne pas redescendre. Sans ce garde-fou,
    // une flèche Bas depuis la colonne 1 de la dernière rangée
    // rebondirait jusqu'à la colonne 4 (dernière cellule) — une
    // télécommande qui saute en diagonale est un piège à utilisateur.
    const next = index + columns;
    return next >= count ? index : next;
  }
  return index;
}

/**
 * Grille de choix d'avatar (4 × 2) pour la fenêtre « Nouveau profil ».
 *
 * ─────────────────────────────────────────────────────────────
 * Pourquoi un composant à part plutôt que du code dans la fenêtre
 * ─────────────────────────────────────────────────────────────
 * La fenêtre « Nouveau profil » et la future fenêtre « Modifier le
 * profil » (étape 3) doivent présenter exactement la même grille, avec
 * les mêmes règles de navigation. Les deux affiches auraient fini par
 * diverger. On extrait donc la grille une fois, ici, et chaque fenêtre
 * se contente de la poser.
 *
 * ─────────────────────────────────────────────────────────────
 * Les deux états à ne pas confondre (piège classique de la télé)
 * ─────────────────────────────────────────────────────────────
 *  • choisi  : pleine couleur, cercle blanc **collé**, pastille rouge ✓.
 *  • survolé : cercle blanc **écarté**, pas de pastille, opacité
 *    intermédiaire.
 * Sans cette distinction, on ne sait plus si l'on a validé un avatar ou
 * si l'on est juste en train de le survoler.
 */
export function AvatarPicker({
  value,
  onChange,
}: {
  /** Avatar actuellement sélectionné. */
  value: AvatarId;
  /** Appelé avec le nouvel identifiant dès qu'un avatar est choisi. */
  onChange: (avatarId: AvatarId) => void;
}) {
  const { t } = useTranslation();

  // Index de la cellule portant le focus télécommande/clavier. Il part
  // de l'avatar déjà sélectionné pour que l'utilisateur ne se perde pas :
  // à l'ouverture, le curseur est déjà là où se trouve le choix courant.
  const startIndex = Math.max(
    0,
    AVATARS.findIndex((a) => a.id === value)
  );
  const [focusedIndex, setFocusedIndex] = useState(startIndex);

  const cellRefs = useRef<Array<HTMLButtonElement | null>>([]);

  /**
   * Déplace le focus dans la grille. La grille fait 4 colonnes : une
   * flèche gauche/droite change la colonne, haut/bas saute d'une rangée.
   * On borne l'index pour ne jamais sortir des 8 cellules.
   */
  const focusCell = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(AVATARS.length - 1, index));
    setFocusedIndex(clamped);
    cellRefs.current[clamped]?.focus();
  }, []);

  /**
   * Les flèches ne sont captées que lorsque le focus est sur un avatar.
   * Le champ Nom garde ses flèches (déplacement du curseur de saisie),
   * et les boutons bas de la fenêtre restent accessibles. On n'écoute
   * donc que les touches reçues par la grille elle-même (via `onKeyDown`
   * sur la grille), et non toutes celles de la page.
   */
  const handleGridKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        focusCell(moveAvatarFocus(focusedIndex, event.key, AVATARS.length));
      }
    },
    [focusedIndex, focusCell]
  );

  return (
    <div
      role="group"
      aria-label={t('profiles.avatar')}
      className="grid grid-cols-4 gap-2.5"
      onKeyDown={handleGridKeyDown}
    >
      {AVATARS.map((avatar, index) => {
        const selected = avatar.id === value;
        const focused = index === focusedIndex;
        return (
          <button
            key={avatar.id}
            ref={(el) => {
              cellRefs.current[index] = el;
            }}
            type="button"
            onClick={() => onChange(avatar.id)}
            aria-pressed={selected}
            aria-label={t('profiles.chooseAvatar')}
            className={cn(
              'relative aspect-square rounded-full transition-all duration-150',
              'focus:outline-none'
            )}
          >
            {/* L'avatar, en ronde. Opacité selon l'état. */}
            <img
              src={avatar.src}
              alt=""
              aria-hidden="true"
              width={256}
              height={256}
              loading="eager"
              draggable={false}
              className={cn(
                'w-full h-full rounded-full object-cover transition-opacity',
                selected ? 'opacity-100' : focused ? 'opacity-85' : 'opacity-50'
              )}
            />

            {/* Cercle blanc collé = avatar choisi. */}
            {selected && (
              <span className="pointer-events-none absolute -inset-[3px] rounded-full border-2 border-white" />
            )}

            {/* Cercle blanc écarté = survolé par la télécommande. */}
            {focused && !selected && (
              <span className="pointer-events-none absolute -inset-[5px] rounded-full border-2 border-white/80" />
            )}

            {/* Pastille rouge ✓ = avatar choisi. */}
            {selected && (
              <span className="pointer-events-none absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-accent flex items-center justify-center border-2 border-surface-0">
                <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
