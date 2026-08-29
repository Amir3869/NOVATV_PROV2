'use client';

import React, { useMemo } from 'react';
import type { SubtitleCue } from '@/services/player/subtitleCues';
import { isCueActive } from '@/services/player/subtitleCues';
import {
  subtitleBackgroundCss,
  subtitleFontSize,
  subtitleFontStack,
  subtitlePositionCss,
  type SubtitleBackground,
  type SubtitleFont,
  type SubtitlePosition,
  type SubtitleSize,
} from '@/services/player/subtitleSettings';

/** Réglages d'apparence lus depuis les préférences. */
export interface SubtitleAppearance {
  size: SubtitleSize;
  position: SubtitlePosition;
  background: SubtitleBackground;
  font: SubtitleFont;
}

interface SubtitleOverlayProps {
  /** Répliques collectées par le moteur. */
  cues: SubtitleCue[];
  /** Position courante de la vidéo, en secondes. */
  currentTime: number;
  /** Vrai si une piste de sous-titres est active. */
  active: boolean;
  /** Réglages d'apparence. */
  appearance: SubtitleAppearance;
}

/**
 * Peint les sous-titres là où la vidéo n'y touche pas.
 *
 * Le rendu est natif lorsque les répliques viennent du navigateur : on
 * ne peut alors ni changer la taille, ni la position, ni le fond, ni la
 * police. En désactivant `renderTextTracksNatively`, éteindre le rendu
 * du navigateur, et en peignant ici, `SubtitleOverlay` rend chaque
 * réglage effectif.
 *
 * Posé AU-DESSUS de la vidéo mais SOUS les contrôles : un sous-titre ne
 * doit jamais passer sous la barre de commandes. La position « bas »
 * laisse donc la place du bandeau, comme le défaut Netflix.
 */
export function SubtitleOverlay({
  cues,
  currentTime,
  active,
  appearance,
}: SubtitleOverlayProps) {
  const { size, position, background, font } = appearance;

  const visible = useMemo(
    () => cues.filter((cue) => isCueActive(cue, currentTime)),
    [cues, currentTime]
  );

  if (!active || visible.length === 0) return null;

  const pos = subtitlePositionCss(position);
  const backgroundColor = subtitleBackgroundCss(background);
  const hasBox = background !== 'none';

  // Essentiel pour un direct : `position` repliée sur `bottom` par
  // l'alignement ci-dessous n'a pas besoin de translation verticale.
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div
        className="absolute left-1/2 -translate-x-1/2 flex -translate-y-1/2 flex-col items-center gap-1 sm:gap-1.5 w-full max-w-[88%]"
        style={{
          top: pos.top,
          bottom: pos.bottom,
          transform:
            position === 'middle'
              ? 'translate(-50%, -50%)'
              : 'translate(-50%, 0)',
        }}
      >
        {visible.map((cue, index) => (
          <div
            key={`${cue.start}-${cue.end}-${index}`}
            aria-hidden="true"
            style={{
              color: '#fff',
              fontFamily: subtitleFontStack(font),
              fontSize: subtitleFontSize(size),
              fontWeight: 500,
              lineHeight: 1.35,
              letterSpacing: 0.3,
              textAlign: 'center',
              whiteSpace: 'pre-wrap',
              textShadow: hasBox
                ? 'none'
                : '0 2px 4px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.9)',
              backgroundColor,
              borderRadius: hasBox ? 4 : 0,
              padding: hasBox ? '2px 8px' : 0,
            }}
          >
            {cue.text}
          </div>
        ))}
      </div>
    </div>
  );
}
