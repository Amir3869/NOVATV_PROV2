'use client';

import React from 'react';
import {
  User, Globe, Palette,
  ChevronRight, Volume2, Wifi, Monitor,
  Sun, Moon, Laptop, Ratio, RotateCcw
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/utils/cn';
import { Avatar } from '@/design-system/components/Avatar';
import { GlassCard } from '@/design-system/components/GlassCard';
import { useAppStore, useActiveProfile } from '@/store/useAppStore';
import { useHydrated } from '@/hooks/useHydrated';
import { useDeviceType } from '@/hooks/useDeviceType';
import { resolveGlass } from '@/hooks/useGlass';
import { resolveAnimations } from '@/hooks/useAnimations';
import { QUALITY_POLICIES, type QualityPolicy } from '@/services/player/qualityLadder';
import { VIDEO_FIT_MODES, type VideoFitMode } from '@/services/player/videoFit';
import { ListPageSkeleton } from '@/design-system/components/LoadingSkeleton';
import { NovaLogo } from '@/design-system/components/NovaLogo';
import { ConfirmDialog } from '@/design-system/components/ConfirmDialog';
import { useTranslation, useSetLocale, LOCALES, LOCALE_NAMES, type MessageKey } from '@/i18n';

/**
 * Les trois choix de thème. « Système » suit le réglage du téléphone ou
 * du téléviseur, qui bascule souvent en sombre à la tombée du jour.
 */
const THEME_OPTIONS = [
  { value: 'light' as const, labelKey: 'settings.themeLightFull', icon: Sun },
  { value: 'dark' as const, labelKey: 'settings.themeDarkFull', icon: Moon },
  { value: 'system' as const, labelKey: 'settings.themeSystemFull', icon: Laptop },
] as const satisfies ReadonlyArray<{ value: 'light' | 'dark' | 'system'; labelKey: MessageKey; icon: React.ElementType }>;

/**
 * Horizons proposes pour le guide TV.
 *
 * Le guide vit en memoire seule : une semaine pour cinq cents chaines
 * represente des dizaines de milliers de programmes, ce qui fait tuer
 * l'application par le systeme sur un boitier TV a faible memoire.
 */
const EPG_DAY_CHOICES = [1, 3, 7] as const;

interface SettingsRowProps {
  label: string;
  description?: string;
  icon?: React.ElementType;
  rightElement?: React.ReactNode;
  onClick?: () => void;
  /**
   * Destination, quand la ligne mene a une autre page.
   *
   * Une vraie navigation se fait avec un lien, pas avec un bouton qui
   * appelle `router.push`. Un lien s'ouvre dans un nouvel onglet par un
   * clic du milieu, se copie par un clic droit, et les lecteurs d'ecran
   * l'annoncent comme un lien. Un bouton ne fait rien de tout cela.
   */
  href?: string;
  className?: string;
}

function SettingsRow({ label, description, icon: Icon, rightElement, onClick, href, className }: SettingsRowProps) {
  // Une ligne n'est un <button> que si elle declenche vraiment une action.
  // Sinon elle reste un <div> : les lignes « Sous-titres », « Theme »,
  // « Qualite »... portent deja un interrupteur, un groupe radio ou un
  // <select> dans `rightElement`. Un <button> (ou un <select>) imbrique dans
  // un <button> est du HTML invalide : React le signale en erreur
  // d'hydratation, et le clic sur l'element interieur devient imprevisible
  // selon le navigateur. Meme correctif que pour le bouton favori de
  // ChannelCard.
  const interactive = Boolean(onClick || href);

  const rowClassName = cn(
    'w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-left transition-all',
    interactive ? 'hover:bg-white/5 cursor-pointer' : 'cursor-default',
    className
  );

  // Contenu commun aux trois formes possibles de la ligne.
  const inner = (
    <>
      {Icon && (
        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-white/60" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{label}</p>
        {description && <p className="text-xs text-white/40 mt-0.5">{description}</p>}
      </div>
      {/* Le chevron ne s'affiche que si la ligne mene quelque part. Sur
          les lignes inertes il promettait une suite qui n'existait pas. */}
      {rightElement || (interactive && <ChevronRight className="w-4 h-4 text-white/20 flex-shrink-0" />)}
    </>
  );

  // Trois branches ecrites en clair plutot qu'un composant choisi dans une
  // variable. TypeScript ne sait pas relier « l'element est un Link » a
  // « href est defini » a travers une variable, et refusait le rendu ;
  // ecrit ainsi, chaque cas se verifie tout seul.
  if (href) {
    return <Link href={href} className={rowClassName}>{inner}</Link>;
  }
  if (onClick) {
    return <button type="button" onClick={onClick} className={rowClassName}>{inner}</button>;
  }
  return <div className={rowClassName}>{inner}</div>;
}

function Toggle2({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      onClick={() => onChange(!value)}
      className={cn(
        'relative w-11 h-6 rounded-full transition-all duration-300',
        value ? 'bg-accent' : 'bg-white/10'
      )}
    >
      <div className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-[color:var(--knob)] shadow-md transition-transform duration-300', value ? 'translate-x-5' : 'translate-x-0.5')} />
    </button>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <GlassCard variant="glass" padding="none" className="overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5">
        <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">{title}</p>
      </div>
      <div className="divide-y divide-white/5">{children}</div>
    </GlassCard>
  );
}

/**
 * Libellés et descriptions des politiques de qualité.
 *
 * Le réglage ne propose plus de résolution (« 720p ») mais une
 * intention. Une résolution fixe n'a de sens que rapportée à un flux
 * précis : les variantes disponibles ne sont connues qu'après lecture du
 * manifeste, et diffèrent d'une chaîne à l'autre. Le choix d'une
 * résolution réelle appartient au menu du lecteur.
 *
 * `satisfies` : le compilateur vérifie que chaque politique a bien son
 * entrée et que chaque clé existe dans les traductions.
 */
const QUALITY_LABELS = {
  auto: 'settings.qualityAuto',
  saver: 'settings.qualitySaver',
  best: 'settings.qualityBest',
} as const satisfies Record<QualityPolicy, MessageKey>;

const QUALITY_DESCRIPTIONS = {
  auto: 'settings.qualityAutoDescription',
  saver: 'settings.qualitySaverDescription',
  best: 'settings.qualityBestDescription',
} as const satisfies Record<QualityPolicy, MessageKey>;

/**
 * Ajustement de l'image. Les libelles sont partages avec le menu du
 * lecteur : un meme reglage ne doit pas porter deux noms selon l'endroit
 * ou on le rencontre.
 */
const FIT_LABELS = {
  contain: 'player.fitContain',
  cover: 'player.fitCover',
  fill: 'player.fitFill',
} as const satisfies Record<VideoFitMode, MessageKey>;

const FIT_DESCRIPTIONS = {
  contain: 'player.fitContainDescription',
  cover: 'player.fitCoverDescription',
  fill: 'player.fitFillDescription',
} as const satisfies Record<VideoFitMode, MessageKey>;

export function SettingsPage() {
  // `t` traduit une clé en texte ; `setLocale` enregistre la langue choisie.
  const { t, locale } = useTranslation();
  const setLocale = useSetLocale();
  const profile = useActiveProfile();
  const preferences = useAppStore((s) => s.preferences);
  // Le verre n'a pas d'état par défaut universel : sans choix explicite
  // il suit l'appareil. L'interrupteur doit donc montrer ce qui est
  // RÉELLEMENT appliqué à l'écran, pas la valeur brute enregistrée —
  // sinon il afficherait « actif » sur un téléviseur sans verre.
  const { isTV, prefersReducedMotion } = useDeviceType();
  const glassOn = resolveGlass(preferences.glassEnabled, isTV);
  // Même raisonnement pour les animations : l'interrupteur montre l'état
  // réellement appliqué, qui dépend aussi du réglage système.
  const animationsOn = resolveAnimations(
    preferences.animationsEnabled,
    isTV,
    prefersReducedMotion
  );
  const updatePreferences = useAppStore((s) => s.updatePreferences);
  const setOnboarded = useAppStore((s) => s.setOnboarded);
  const router = useRouter();

  /**
   * Ouverture de la demande de confirmation du rejeu.
   *
   * Tous les hooks sont appelés AVANT le `return` de chargement plus
   * bas : React exige que le nombre de hooks d'un composant ne change
   * jamais d'un rendu à l'autre, ce qu'un hook placé après un `return`
   * conditionnel violerait.
   */
  const [replayOpen, setReplayOpen] = React.useState(false);

  /**
   * Relance le parcours de configuration.
   *
   * Ce que cela fait : remet le drapeau `isOnboarded` à `false` et
   * efface la reprise d'étape, puis ouvre l'écran d'accueil.
   *
   * Ce que cela NE fait PAS, volontairement : rien n'est supprimé. Les
   * profils, les sources et le catalogue restent en place. Le parcours
   * sert à revoir ou compléter sa configuration, pas à réinitialiser
   * l'application — une remise à zéro destructive mérite son propre
   * réglage, avec un avertissement autrement plus net.
   */
  const handleReplay = React.useCallback(() => {
    setReplayOpen(false);
    try {
      window.localStorage.removeItem('novatv-onboarding');
    } catch {
      // Mode privé ou quota : sans conséquence, le parcours repart de
      // sa première étape.
    }
    setOnboarded(false);
    router.replace('/welcome');
  }, [setOnboarded, router]);

  // Voir useHydrated : sans ce garde, les réglages affichent un instant
  // les valeurs par défaut au lieu de celles enregistrées — un
  // interrupteur pouvait donc sembler désactivé alors qu'il est actif.
  const hydrated = useHydrated();

  if (!hydrated) return <ListPageSkeleton rows={5} />;

  return (
    <div className="min-h-screen px-4 md:px-8 lg:px-10 py-6 space-y-6 max-w-2xl">
      <h1 className="text-2xl font-black text-white">{t('settings.title')}</h1>

      {/* Profile */}
      <SettingsSection title={t('settings.profile')}>
        <SettingsRow
          icon={User}
          label={profile?.name || t('settings.profile')}
          description={profile?.isKidsProfile ? t('settings.profileKid') : t('settings.profileAdult')}
          rightElement={profile ? <Avatar profile={profile} size="xs" /> : undefined}
          href="/profiles"
        />
        <SettingsRow icon={User} label={t('settings.manageProfiles')} href="/profiles" />
        <SettingsRow
          icon={RotateCcw}
          label={t('settings.replayOnboarding')}
          description={t('settings.replayOnboardingDescription')}
          onClick={() => setReplayOpen(true)}
        />
        {/* « Controle parental » a ete retire du menu. Le champ `pinHash`
            existe dans le type `Profile` mais rien ne l'ecrit ni ne le
            lit : aucun ecran n'est protege. Une ligne de reglage laissait
            croire a un verrou inexistant, ce qui est pire que son
            absence — un parent aurait pu s'y fier. Elle reviendra avec le
            code PIN reel (hachage PBKDF2, verrouillage des profils). */}
      </SettingsSection>

      {/* Playback */}
      <SettingsSection title={t('settings.playback')}>
        <SettingsRow
          icon={Monitor}
          label={t('settings.quality')}
          description={t(QUALITY_DESCRIPTIONS[preferences.defaultQuality])}
          rightElement={
            <select
              value={preferences.defaultQuality}
              onChange={(e) => updatePreferences({ defaultQuality: e.target.value as typeof preferences.defaultQuality })}
              onClick={(e) => e.stopPropagation()}
              className="bg-transparent text-sm text-white/60 focus:outline-none cursor-pointer"
            >
              {QUALITY_POLICIES.map((q) => (
                <option key={q} value={q} className="bg-surface-3">
                  {t(QUALITY_LABELS[q])}
                </option>
              ))}
            </select>
          }
        />
        {/* Le meme reglage existe dans le lecteur, ou il se voit en
            direct sur l'image. Il est repris ici parce qu'une chaine
            d'archives en 4:3 se corrige une fois pour toutes, sans
            rouvrir le lecteur a chaque fois. */}
        <SettingsRow
          icon={Ratio}
          label={t('player.fitTitle')}
          description={t(FIT_DESCRIPTIONS[preferences.videoFit])}
          rightElement={
            <select
              value={preferences.videoFit}
              onChange={(e) => updatePreferences({ videoFit: e.target.value as VideoFitMode })}
              onClick={(e) => e.stopPropagation()}
              aria-label={t('player.fitTitle')}
              className="bg-transparent text-sm text-white/60 focus:outline-none cursor-pointer"
            >
              {VIDEO_FIT_MODES.map((mode) => (
                <option key={mode} value={mode} className="bg-surface-3">
                  {t(FIT_LABELS[mode])}
                </option>
              ))}
            </select>
          }
        />
        <SettingsRow
          icon={Volume2}
          label={t('settings.audioLanguagePreferred')}
          description={t('settings.audioLanguagePreferredDescription')}
          rightElement={
            // Meme choix que pour la langue de l'interface : une liste
            // deroulante native, pilotable a la telecommande sur Fire TV.
            // La preference sert a preselectionner une piste audio quand
            // le flux en propose plusieurs.
            <select
              value={preferences.defaultAudioLanguage}
              onChange={(e) => updatePreferences({ defaultAudioLanguage: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              aria-label={t('settings.audioLanguagePreferred')}
              className="bg-transparent text-sm text-white/60 focus:outline-none cursor-pointer"
            >
              {LOCALES.map((code) => (
                <option key={code} value={code} className="bg-surface-3">
                  {LOCALE_NAMES[code]}
                </option>
              ))}
            </select>
          }
        />
        <SettingsRow
          icon={Globe}
          label={t('settings.subtitles')}
          description={t('settings.subtitlesDescription')}
          rightElement={<Toggle2 label={t('settings.subtitles')} value={preferences.subtitlesEnabled} onChange={(v) => updatePreferences({ subtitlesEnabled: v })} />}
        />
        {/* Libelle « Episode suivant automatique » et non « Lecture
            automatique » : le reglage ne commande que l'enchainement en
            fin d'episode, jamais le demarrage d'une video. */}
        <SettingsRow
          label={t('settings.autoNextEpisode')}
          description={t('settings.autoPlayDescription')}
          rightElement={<Toggle2 label={t('settings.autoNextEpisode')} value={preferences.autoNextEpisode} onChange={(v) => updatePreferences({ autoNextEpisode: v })} />}
        />
      </SettingsSection>

      {/* Appearance */}
      <SettingsSection title={t('settings.appearance')}>
        <SettingsRow
          icon={preferences.theme === 'light' ? Sun : preferences.theme === 'dark' ? Moon : Laptop}
          label={t('settings.theme')}
          description={
            preferences.theme === 'light'
              ? t('settings.themeLight')
              : preferences.theme === 'dark'
                ? t('settings.themeDark')
                : t('settings.themeSystem')
          }
          rightElement={
            // Trois boutons plutôt qu'un interrupteur : « suivre le système »
            // n'est ni l'un ni l'autre, il ne rentre pas dans un oui/non.
            <div
              role="radiogroup"
              aria-label={t('settings.themeSectionLabel')}
              className="flex items-center gap-1 p-1 rounded-xl bg-white/5"
            >
              {THEME_OPTIONS.map(({ value, labelKey, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={preferences.theme === value}
                  aria-label={t(labelKey)}
                  onClick={(e) => {
                    e.stopPropagation();
                    updatePreferences({ theme: value });
                  }}
                  className={cn(
                    'flex items-center justify-center w-9 h-8 rounded-lg transition-colors',
                    preferences.theme === value
                      ? 'bg-white/15 text-white'
                      : 'text-white/40 hover:text-white/70'
                  )}
                >
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          }
        />
        <SettingsRow
          icon={Palette}
          label={t('settings.glassmorphism')}
          description={t('settings.glassmorphismDescription')}
          rightElement={<Toggle2 label={t('settings.glassmorphism')} value={glassOn} onChange={(v) => updatePreferences({ glassEnabled: v })} />}
        />
        <SettingsRow
          label={t('settings.animations')}
          description={t('settings.animationsDescription')}
          rightElement={<Toggle2 label={t('settings.animations')} value={animationsOn} onChange={(v) => updatePreferences({ animationsEnabled: v })} />}
        />
      </SettingsSection>

      {/* EPG */}
      <SettingsSection title={t('settings.tvGuide')}>
        <SettingsRow
          icon={Wifi}
          label={t('settings.epgDaysLabel')}
          description={
            preferences.epgDays === 1
              ? t('settings.epgDaysDescriptionOne')
              : t('settings.epgDaysDescription', { count: preferences.epgDays })
          }
          rightElement={
            <select
              value={preferences.epgDays}
              onChange={(e) => updatePreferences({ epgDays: Number(e.target.value) })}
              onClick={(e) => e.stopPropagation()}
              aria-label={t('settings.epgDaysLabel')}
              className="bg-transparent text-sm text-white/60 focus:outline-none cursor-pointer"
            >
              {/* Trois choix seulement : la liste se parcourt a la
                  telecommande, chaque valeur en plus est un appui en
                  plus. 1 = connexion lente ou boitier a faible memoire,
                  3 = defaut, 7 = semaine complete sur un appareil a
                  l'aise. */}
              {EPG_DAY_CHOICES.map((d) => (
                <option key={d} value={d} className="bg-surface-3">
                  {d === 1 ? t('settings.epgDaysOptionOne') : t('settings.epgDaysOption', { count: d })}
                </option>
              ))}
            </select>
          }
        />
      </SettingsSection>

      {/* Language */}
      <SettingsSection title={t('settings.language')}>
        <SettingsRow
          icon={Globe}
          label={t('settings.interfaceLanguage')}
          description={LOCALE_NAMES[locale]}
          rightElement={
            // Une liste déroulante plutôt que des boutons : le nombre de
            // langues est appelé à grandir, et un <select> natif reste
            // pilotable à la télécommande sur Fire TV, contrairement à un
            // menu maison qu'il faudrait recâbler au clavier directionnel.
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as (typeof LOCALES)[number])}
              onClick={(e) => e.stopPropagation()}
              aria-label={t('settings.interfaceLanguage')}
              className="bg-transparent text-sm text-white/60 focus:outline-none cursor-pointer"
            >
              {LOCALES.map((code) => (
                <option key={code} value={code} className="bg-surface-3">
                  {LOCALE_NAMES[code]}
                </option>
              ))}
            </select>
          }
        />
      </SettingsSection>

      {/* About */}
      <SettingsSection title={t('settings.about')}>
        <div className="p-6 flex flex-col items-center gap-4">
          <NovaLogo variant="full" size="md" />
          <div className="text-center space-y-1">
            <p className="text-sm font-semibold text-white">NovaTV</p>
            <p className="text-xs text-white/40">{t('settings.version', { number: '1.0.0' })}</p>
            <p className="text-xs text-white/30">{t('settings.tagline')}</p>
          </div>
        </div>
        <SettingsRow label={t('settings.privacy')} href="/legal/privacy" />
        <SettingsRow label={t('settings.terms')} href="/legal/terms" />
        <SettingsRow label={t('settings.licenses')} href="/legal/licenses" />
      </SettingsSection>

      {/* Legal */}
      <GlassCard variant="dark" padding="md">
        <p className="text-xs text-white/40 leading-relaxed">
          <strong className="text-white/60">{t('settings.legalTitle')}</strong>{' '}
          {t('settings.legalText')}
        </p>
      </GlassCard>

      <ConfirmDialog
        open={replayOpen}
        title={t('settings.replayOnboardingConfirmTitle')}
        message={t('settings.replayOnboardingConfirmMessage')}
        detail={t('settings.replayOnboardingConfirmDetail')}
        confirmLabel={t('settings.replayOnboardingConfirmAction')}
        tone="default"
        onConfirm={handleReplay}
        onCancel={() => setReplayOpen(false)}
      />
    </div>
  );
}
