'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, Tv, Film, BookOpen, Search, History,
  Settings, List, Radio, ChevronRight, X, Menu, MoreHorizontal, CalendarDays
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { Avatar } from './Avatar';
import { NovaLogo } from './NovaLogo';
import { useAppStore, useActiveProfile } from '@/store/useAppStore';
import { useDeviceType } from '@/hooks/useDeviceType';
import { useTranslation, type MessageKey } from '@/i18n';

/**
 * Entrées du menu.
 *
 * On stocke une *clé* de traduction (`labelKey`) et non le texte : la
 * liste est définie une fois, hors du composant, alors que le texte
 * affiché doit changer quand l'utilisateur change de langue. La
 * traduction est donc faite au moment du rendu, pas ici.
 */
const navItems: { href: string; labelKey: MessageKey; icon: React.ElementType }[] = [
  { href: '/', labelKey: 'nav.home', icon: Home },
  { href: '/live', labelKey: 'nav.liveTV', icon: Tv },
  { href: '/movies', labelKey: 'nav.movies', icon: Film },
  { href: '/series', labelKey: 'nav.series', icon: BookOpen },
  { href: '/epg', labelKey: 'nav.epg', icon: Radio },
  { href: '/lists', labelKey: 'nav.lists', icon: List },
  { href: '/search', labelKey: 'nav.search', icon: Search },
  { href: '/history', labelKey: 'nav.history', icon: History },
  { href: '/playlists', labelKey: 'nav.playlists', icon: Radio },
  { href: '/settings', labelKey: 'nav.settings', icon: Settings },
];

function NavItem({ href, label, icon: Icon, collapsed = false, onNavigate }: {
  href: string;
  label: string;
  icon: React.ElementType;
  collapsed?: boolean;
  /**
   * Appele juste apres un clic sur le lien.
   *
   * Sur mobile, le menu lateral est un tiroir superpose a la page. Le
   * clic sur un lien change bien de page, mais le tiroir, lui, ne se
   * ferme pas tout seul : il reste ouvert par-dessus la nouvelle page,
   * qu'il masque entierement. L'utilisateur croit que rien ne s'est
   * passe. On ferme donc le tiroir explicitement a la navigation.
   *
   * Sur ordinateur et tablette, le menu fait partie de la mise en page
   * et doit rester visible : `onNavigate` n'y est pas fourni.
   */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all duration-300 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset',
        isActive
          ? 'bg-accent/15 text-white shadow-[0_0_24px_rgba(220,38,38,0.12)]'
          : 'text-white/50 hover:text-white hover:bg-white/5',
        collapsed && 'justify-center px-2'
      )}
      title={collapsed ? label : undefined}
    >
      <Icon className={cn(
        'flex-shrink-0 transition-colors',
        collapsed ? 'w-5 h-5' : 'w-4.5 h-4.5',
        isActive ? 'text-accent' : 'group-hover:text-white'
      )} />
      {!collapsed && (
        <span className={cn('text-sm font-medium', isActive && 'text-white font-semibold')}>
          {label}
        </span>
      )}
      {isActive && !collapsed && (
        <div className="ml-auto w-1 h-4 rounded-full bg-accent" />
      )}
    </Link>
  );
}

export function Sidebar() {
  const { t } = useTranslation();
  const { isMobile, isTablet, isDesktop } = useDeviceType();
  const { sidebarOpen, setSidebarOpen } = useAppStore();
  const profile = useActiveProfile();

  // On mobile, sidebar is a drawer
  if (isMobile) {
    if (!sidebarOpen) return null;
    return (
      <>
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setSidebarOpen(false)}
        />
        <aside className="fixed left-0 top-0 bottom-0 w-64 z-50 flex flex-col bg-surface-1/95 backdrop-blur-xl border-r border-white/5">
          <SidebarContent onClose={() => setSidebarOpen(false)} profile={profile} />
        </aside>
      </>
    );
  }

  // On tablet, collapsed by default
  if (isTablet) {
    return (
      <aside className={cn(
        'my-4 ml-4 flex flex-col rounded-[2rem] border border-white/10 bg-black/35 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.45),0_0_35px_rgba(220,38,38,0.06)] transition-all duration-300 flex-shrink-0 overflow-hidden',
        sidebarOpen ? 'w-56' : 'w-20'
      )}>
        <SidebarContent collapsed={!sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} profile={profile} />
      </aside>
    );
  }

  // Desktop
  return (
    <aside className={cn(
      'my-4 ml-4 flex flex-col rounded-[2rem] border border-white/10 bg-black/35 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.45),0_0_35px_rgba(220,38,38,0.06)] transition-all duration-300 flex-shrink-0 overflow-hidden',
      sidebarOpen ? 'w-60' : 'w-60'
    )}>
      <SidebarContent profile={profile} />
    </aside>
  );
}

function SidebarContent({
  collapsed = false,
  onClose,
  onToggle,
  profile,
}: {
  collapsed?: boolean;
  onClose?: () => void;
  onToggle?: () => void;
  profile: ReturnType<typeof useActiveProfile>;
}) {
  const { t } = useTranslation();
  return (
    <>
      {/* Logo */}
      <div className={cn(
        'flex items-center border-b border-white/10 flex-shrink-0 bg-white/[0.025]',
        collapsed ? 'px-2 py-4 justify-center' : 'px-4 py-4 gap-3'
      )}>
        {collapsed ? (
          <NovaLogo variant="icon" size="sm" />
        ) : (
          <>
            <NovaLogo variant="compact" size="sm" className="flex-1" />
            {onClose && (
              <button type="button" onClick={onClose} aria-label={t('nav.closeMenu')} className="text-white/40 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
            {onToggle && (
              <button type="button" onClick={onToggle} aria-label={t('nav.collapseMenu')} className="text-white/40 hover:text-white transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Nav items */}
      <nav aria-label={t('nav.mainMenu')} className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto scrollbar-none">
        {navItems.map(({ href, labelKey, icon }) => (
          <NavItem
            key={href}
            href={href}
            label={t(labelKey)}
            icon={icon}
            collapsed={collapsed}
            onNavigate={onClose}
          />
        ))}
      </nav>

      {/* Profile */}
      {profile && (
        <div className={cn(
          'border-t border-white/10 flex-shrink-0 bg-white/[0.025]',
          collapsed ? 'p-2' : 'p-3'
        )}>
          <Link
            href="/profiles"
            onClick={onClose}
            className={cn(
              'flex items-center gap-3 rounded-xl hover:bg-white/5 transition-colors',
              collapsed ? 'justify-center p-2' : 'p-2'
            )}
          >
            <Avatar profile={profile} size="sm" />
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{profile.name}</p>
                <p className="text-xs text-white/40">
                  {profile.isKidsProfile ? t('settings.profileKid') : t('settings.profileAdult')}
                </p>
              </div>
            )}
          </Link>
        </div>
      )}
    </>
  );
}

export function BottomNav() {
  const { t } = useTranslation();
  const { isMobile } = useDeviceType();
  // Les Hooks doivent TOUS être appelés avant le moindre `return`,
  // et toujours dans le même ordre à chaque rendu (règle de React).
  // `usePathname` était appelé après `if (!isMobile) return null`,
  // ce qui changeait le nombre de Hooks entre deux rendus au
  // redimensionnement et provoquait un plantage de l'application.
  const pathname = usePathname();

  if (!isMobile) return null;

  const mobileItems = [
    { href: '/', label: t('nav.home'), icon: Home },
    { href: '/live', label: t('nav.liveTV'), icon: Tv },
    { href: '/movies', label: t('nav.movies'), icon: Film },
    { href: '/lists', label: t('nav.lists'), icon: List },
    { href: '/search', label: t('nav.search'), icon: Search },
  ];

  return (
    <nav
      aria-label={t('nav.mainMenu')}
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl overflow-hidden rounded-[32px] border border-white/15 bg-black/45 shadow-[0_18px_50px_rgba(0,0,0,0.55),0_0_30px_rgba(220,38,38,0.10)] backdrop-blur-2xl safe-area-pb"
      style={{ borderRadius: 32, left: '1rem', right: '1rem', bottom: '1rem' }}
    >
      <div className="flex items-center justify-around gap-1 px-2 py-2">
        {mobileItems.map(({ href, label, icon: Icon }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'relative flex flex-col items-center gap-1 px-3 py-2.5 rounded-full transition-all duration-300 min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                isActive ? 'bg-accent/15 text-white shadow-[0_0_20px_rgba(220,38,38,0.18)]' : 'text-white/45 hover:bg-white/5 hover:text-white/80'
              )}
            >
              <Icon className={cn("w-5 h-5 flex-shrink-0 transition-transform", isActive && "scale-110 text-accent")} />
              <span className="text-[9px] font-medium truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function TopBar() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const profile = useActiveProfile();
  const [moreOpen, setMoreOpen] = useState(false);
  const primaryItems = [
    { href: '/', label: t('nav.home'), icon: Home },
    { href: '/live', label: t('nav.liveTV'), icon: Tv },
    { href: '/movies', label: t('nav.movies'), icon: Film },
    { href: '/series', label: t('nav.series'), icon: BookOpen },
    { href: '/lists', label: t('nav.lists'), icon: List },
  ];
  const secondaryItems = [
    { href: '/epg', label: t('nav.epg'), icon: CalendarDays },
    { href: '/history', label: t('nav.history'), icon: History },
    { href: '/playlists', label: t('nav.playlists'), icon: Radio },
  ];

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5 lg:px-6">
      <nav aria-label={t('nav.mainMenu')} className="relative mx-auto flex min-h-16 max-w-[1500px] flex-wrap items-center gap-2 rounded-[1.75rem] border border-white/10 bg-surface-1/75 px-3 py-2 shadow-[0_16px_45px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
        <NovaLogo variant="compact" size="xs" className="mx-2 shrink-0" />
        <div className="hidden h-7 w-px shrink-0 bg-white/10 sm:block" />
        <div className="order-3 flex w-full min-w-0 items-center justify-center gap-1 overflow-hidden sm:order-none sm:w-auto sm:flex-1 sm:gap-2">
          {primaryItems.map(({ href, label, icon: Icon }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link key={href} href={href} className={cn('flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-semibold leading-tight transition-all duration-300 sm:flex-none sm:flex-row sm:gap-2 sm:rounded-full sm:px-4 sm:py-2.5 sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent', isActive ? 'bg-accent/15 text-white shadow-[0_0_24px_rgba(217,74,82,0.18)]' : 'text-white/55 hover:bg-white/5 hover:text-white')}>
                <Icon className={cn('h-4 w-4 shrink-0', isActive && 'text-accent')} />
                <span className="whitespace-nowrap text-center sm:truncate">{label}</span>
              </Link>
            );
          })}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Link href="/search" aria-label={t('nav.search')} className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><Search className="h-4 w-4" /></Link>
          <button type="button" aria-label={'Plus'} aria-expanded={moreOpen} onClick={() => setMoreOpen((open) => !open)} className={cn('flex h-9 w-9 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent', moreOpen && 'bg-white/10 text-white')}><MoreHorizontal className="h-5 w-5" /></button>
          <Link href="/settings" aria-label={t('nav.settings')} className={cn('flex h-9 w-9 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent', pathname.startsWith('/settings') && 'bg-accent/15 text-accent')}><Settings className="h-4 w-4" /></Link>
          <Link href="/profiles" aria-label={t('nav.profiles')} className="flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1.5 pr-2 sm:pr-3 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            {profile ? <Avatar profile={profile} size="sm" /> : <Settings className="h-4 w-4" />}
            <span className="hidden text-xs font-semibold text-white/75 sm:inline">{profile?.name ?? t('nav.profiles')}</span>
          </Link>
        </div>
        {moreOpen && (
          <div className="absolute right-3 top-[calc(100%+0.5rem)] z-50 grid min-w-56 gap-1 rounded-2xl border border-white/10 bg-surface-2/95 p-2 shadow-2xl backdrop-blur-2xl">
            {secondaryItems.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} onClick={() => setMoreOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><Icon className="h-4 w-4 text-accent" />{label}</Link>
            ))}
          </div>
        )}
      </nav>
    </header>
  );
}

