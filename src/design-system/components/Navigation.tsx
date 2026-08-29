'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, Tv, Film, BookOpen, Heart, Search, History,
  Settings, List, Radio, ChevronRight, X, Menu
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
  { href: '/favorites', labelKey: 'nav.favorites', icon: Heart },
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
        'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group',
        isActive
          ? 'bg-accent/15 text-white'
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
        'flex flex-col bg-surface-1/95 backdrop-blur-xl border-r border-white/5 transition-all duration-300 flex-shrink-0',
        sidebarOpen ? 'w-56' : 'w-16'
      )}>
        <SidebarContent collapsed={!sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} profile={profile} />
      </aside>
    );
  }

  // Desktop
  return (
    <aside className={cn(
      'flex flex-col bg-surface-1/95 backdrop-blur-xl border-r border-white/5 transition-all duration-300 flex-shrink-0',
      sidebarOpen ? 'w-56' : 'w-56'
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
        'flex items-center border-b border-white/5 flex-shrink-0',
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
          'border-t border-white/5 flex-shrink-0',
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
    { href: '/favorites', label: t('nav.favorites'), icon: Heart },
    { href: '/search', label: t('nav.search'), icon: Search },
  ];

  return (
    <nav aria-label={t('nav.mainMenu')} className="fixed bottom-0 left-0 right-0 z-50 bg-surface-1/95 backdrop-blur-xl border-t border-white/5 safe-area-pb">
      <div className="flex items-center justify-around px-2 py-2">
        {mobileItems.map(({ href, label, icon: Icon }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-0',
                isActive ? 'text-accent' : 'text-white/40 hover:text-white/70'
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
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
  const { isMobile } = useDeviceType();
  const { setSidebarOpen } = useAppStore();
  const pathname = usePathname();

  if (!isMobile) return null;

  const currentItem = navItems.find((item) =>
    item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
  );

  return (
    <header className="sticky top-0 z-40 flex items-center gap-3 px-4 py-3 bg-surface-1/90 backdrop-blur-xl border-b border-white/5">
      <button
        onClick={() => setSidebarOpen(true)}
        className="text-white/60 hover:text-white transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>
      <NovaLogo variant="compact" size="xs" className="flex-1" />
      <Link href="/search" className="text-white/60 hover:text-white transition-colors">
        <Search className="w-5 h-5" aria-label={t('nav.search')} />
      </Link>
    </header>
  );
}
