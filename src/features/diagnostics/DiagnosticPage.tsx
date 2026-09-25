'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, ClipboardCopy, FileJson, Image as ImageIcon, ListTree, LoaderCircle, Radio, Search, TriangleAlert } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { cn } from '@/utils/cn';
import { GlassCard } from '@/design-system/components/GlassCard';
import { EmptyState } from '@/design-system/components/EmptyState';
import { ListPageSkeleton } from '@/design-system/components/LoadingSkeleton';
import { useTranslation } from '@/i18n';
import {
  buildSourceDiagnosticReport,
  copySourceDiagnostic,
  formatSourceCategoryDiagnostic,
  formatSourceDiagnostic,
  formatSourceDiagnosticSummary,
  splitSourceDiagnostic,
  type SourceDiagnosticReport,
} from '@/services/diagnostics/sourceDiagnostic';

type DiagnosticSection = 'summary' | 'images' | 'epg' | 'categories' | 'full';

export function DiagnosticPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const playlistId = params.get('playlistId');
  const [report, setReport] = useState<SourceDiagnosticReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [analysisError, setAnalysisError] = useState(false);
  const [analysisPhase, setAnalysisPhase] = useState<'images' | 'epg' | null>(null);
  const [section, setSection] = useState<DiagnosticSection>('summary');
  const [chunkIndex, setChunkIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setAnalysisRunning(false);
    setAnalysisError(false);
    setAnalysisPhase(null);
    setReport(null);
    if (!playlistId) {
      setLoading(false);
      setError(true);
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        // Le catalogue et les catégories sont affichés immédiatement. Les
        // sondes réseau potentiellement longues continuent ensuite en tâche
        // de fond, au lieu de laisser l'écran Android vide pendant plusieurs
        // minutes.
        const initialReport = await buildSourceDiagnosticReport(playlistId, { probe: false });
        if (cancelled) return;
        setReport(initialReport);
        setLoading(false);
        setAnalysisRunning(true);

        try {
          const completeReport = await buildSourceDiagnosticReport(playlistId, {
            onProgress: (progress) => {
              if (!cancelled) setAnalysisPhase(progress.phase);
            },
          });
          if (!cancelled) setReport(completeReport);
        } catch {
          if (!cancelled) setAnalysisError(true);
        } finally {
          if (!cancelled) {
            setAnalysisRunning(false);
            setAnalysisPhase(null);
          }
        }
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [playlistId]);

  const sectionText = useMemo(() => {
    if (!report) return '';
    if (section === 'summary') return formatSourceDiagnosticSummary(report);
    if (section === 'categories') return formatSourceCategoryDiagnostic(report);
    if (section === 'images') return JSON.stringify({ imageSummary: report.imageSummary, images: report.images }, null, 2);
    if (section === 'epg') return JSON.stringify({ epg: report.epg }, null, 2);
    return formatSourceDiagnostic(report);
  }, [report, section]);

  const chunks = useMemo(() => splitSourceDiagnostic(sectionText), [sectionText]);
  const safeChunkIndex = Math.min(chunkIndex, Math.max(0, chunks.length - 1));
  const currentChunk = chunks[safeChunkIndex] ?? '';

  useEffect(() => {
    setChunkIndex(0);
  }, [section]);

  const copyText = async (text: string) => {
    try {
      await copySourceDiagnostic(text);
      toast.success(t('playlists.diagnosticCopied'));
    } catch {
      toast.error(t('playlists.diagnosticFailed'));
    }
  };

  const copyCurrentChunk = async () => {
    if (!currentChunk) return;
    const header = `[NOVA TV DIAGNOSTIC — ${t('playlists.diagnosticBlock', {
      current: safeChunkIndex + 1,
      total: chunks.length,
    })}]`;
    await copyText(`${header}\n${currentChunk}`);
  };

  const copySummary = async () => {
    await copyText(formatSourceDiagnosticSummary(report!));
  };

  const copyCategories = async () => {
    await copyText(formatSourceCategoryDiagnostic(report!));
  };

  if (loading) return <ListPageSkeleton rows={5} />;

  if (error || !report) {
    return (
      <div className="library-page min-h-screen px-4 pb-12 pt-6 md:px-8 md:pb-16 md:pt-8 lg:px-10 lg:pt-10">
        <EmptyState
          emoji="🧪"
          title={t('playlists.diagnosticNoSource')}
          description={t('playlists.diagnosticFailed')}
          action={{ label: t('common.back'), onClick: () => router.push('/playlists') }}
        />
      </div>
    );
  }

  const imageFailures = report.images.filter((image) => image.status === 'error' || image.status === 'timeout').length;
  const epgProblems = report.epg.probes.filter(
    (probe) =>
      probe.requestStatus !== 'not-tested' &&
      (probe.requestStatus !== 'ok' || probe.listingCount === 0),
  ).length;
  const categoryProblems = report.categoryAnomalies.length + report.categoryContentMatches.length;
  const sections: Array<{ id: DiagnosticSection; label: string; icon: typeof Radio }> = [
    { id: 'summary', label: t('playlists.diagnosticSummary'), icon: CheckCircle2 },
    { id: 'images', label: t('playlists.diagnosticImages'), icon: ImageIcon },
    { id: 'epg', label: t('playlists.diagnosticEpg'), icon: Radio },
    { id: 'categories', label: t('playlists.diagnosticCategories'), icon: ListTree },
    { id: 'full', label: t('playlists.diagnosticFull'), icon: FileJson },
  ];

  return (
    <div className="library-page min-h-screen bg-surface-0 px-4 pb-12 pt-6 md:px-8 md:pb-16 md:pt-8 lg:px-10 lg:pt-10">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <button
              type="button"
              onClick={() => router.push('/playlists')}
              aria-label={t('common.back')}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/5 text-white/75 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-black text-white">{t('playlists.diagnosticTitle')}</h1>
              <p className="mt-1 max-w-3xl text-sm text-white/45">{t('playlists.diagnosticHint')}</p>
              {analysisRunning && (
                <p className="mt-2 flex items-center gap-2 text-xs text-accent">
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  {t('playlists.diagnosticLoading')}
                  {analysisPhase ? ` · ${t(analysisPhase === 'images' ? 'playlists.diagnosticImages' : 'playlists.diagnosticEpg')}` : ''}
                </p>
              )}
              {analysisError && !analysisRunning && (
                <p className="mt-2 flex items-center gap-2 text-xs text-amber-300">
                  <TriangleAlert className="h-3.5 w-3.5" />
                  {t('playlists.diagnosticFailed')}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copySummary}
              className="flex min-h-10 items-center gap-2 rounded-xl bg-accent px-3 text-xs font-semibold text-white transition hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <ClipboardCopy className="h-4 w-4" />
              {t('playlists.diagnosticCopySummary')}
            </button>
            <button
              type="button"
              onClick={copyCategories}
              className="flex min-h-10 items-center gap-2 rounded-xl bg-white/5 px-3 text-xs font-semibold text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <ListTree className="h-4 w-4" />
              {t('playlists.diagnosticCopyCategories')}
            </button>
            <span className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line bg-surface-1 px-3 text-xs text-white/55">
              <FileJson className="h-4 w-4 text-accent" />
              v{report.version}
            </span>
          </div>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <GlassCard variant="glass" padding="sm">
            <p className="text-xs text-white/45">{t('common.channels')}</p>
            <p className="mt-1 text-2xl font-black text-white">{report.catalog.channels}</p>
            <p className="text-xs text-white/35">{report.epg.channelsWithPrograms} EPG</p>
          </GlassCard>
          <GlassCard variant="glass" padding="sm">
            <p className="text-xs text-white/45">{t('playlists.diagnosticImages')}</p>
            <p className="mt-1 text-2xl font-black text-white">{report.images.length}</p>
            <p className={cn('text-xs', imageFailures ? 'text-amber-300' : 'text-white/35')}>{imageFailures} problème(s)</p>
          </GlassCard>
          <GlassCard variant="glass" padding="sm">
            <p className="text-xs text-white/45">{t('playlists.diagnosticEpg')}</p>
            <p className="mt-1 text-2xl font-black text-white">{report.epg.programsStored}</p>
            <p className={cn('text-xs', epgProblems ? 'text-amber-300' : 'text-white/35')}>{epgProblems} point(s) à vérifier</p>
          </GlassCard>
          <GlassCard variant="glass" padding="sm">
            <p className="text-xs text-white/45">{t('playlists.diagnosticCategories')}</p>
            <p className="mt-1 text-2xl font-black text-white">{report.categories.length}</p>
            <p className={cn('text-xs', categoryProblems ? 'text-amber-300' : 'text-white/35')}>{categoryProblems} anomalie(s)</p>
          </GlassCard>
        </div>

        <div className="flex gap-2 overflow-x-auto border-b border-line pb-2 scrollbar-none" role="tablist" aria-label={t('playlists.diagnosticTitle')}>
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={section === id}
              onClick={() => setSection(id)}
              className={cn(
                'flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                section === id ? 'bg-accent/15 text-white' : 'text-white/50 hover:bg-white/5 hover:text-white',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <GlassCard variant="dark" padding="sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-white/50">
              <Search className="h-4 w-4 text-accent" />
              {t('playlists.diagnosticBlock', { current: safeChunkIndex + 1, total: chunks.length })}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setChunkIndex((index) => Math.max(0, index - 1))}
                disabled={safeChunkIndex === 0}
                className="min-h-10 rounded-xl bg-white/5 px-3 text-xs font-semibold text-white/65 transition hover:bg-white/10 disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {t('playlists.diagnosticPreviousBlock')}
              </button>
              <button
                type="button"
                onClick={() => setChunkIndex((index) => Math.min(chunks.length - 1, index + 1))}
                disabled={safeChunkIndex >= chunks.length - 1}
                className="min-h-10 rounded-xl bg-white/5 px-3 text-xs font-semibold text-white/65 transition hover:bg-white/10 disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {t('playlists.diagnosticNextBlock')}
              </button>
              <button
                type="button"
                onClick={copyCurrentChunk}
                className="flex min-h-10 items-center gap-2 rounded-xl bg-accent px-3 text-xs font-semibold text-white transition hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <ClipboardCopy className="h-4 w-4" />
                {t('playlists.diagnosticCopyBlock')}
              </button>
            </div>
          </div>
          <textarea
            readOnly
            value={currentChunk}
            onFocus={(event) => event.currentTarget.select()}
            aria-label={t('playlists.diagnosticTitle')}
            className="min-h-[28rem] w-full resize-y rounded-xl border border-line bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-white/80 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
          <p className="mt-2 flex items-center gap-2 text-xs text-white/35">
            {analysisRunning ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {t('playlists.diagnosticBlock', { current: safeChunkIndex + 1, total: chunks.length })}
          </p>
        </GlassCard>

        {section === 'categories' && report.categoryContentMatches.length > 0 && (
          <GlassCard variant="glass" padding="md">
            <div className="mb-3 flex items-center gap-2">
              <TriangleAlert className="h-4 w-4 text-amber-300" />
              <h2 className="text-sm font-bold text-white">{t('playlists.diagnosticCategoryMatches')}</h2>
            </div>
            <div className="space-y-2">
              {report.categoryContentMatches.slice(0, 50).map((match) => (
                <div key={`${match.family}-${match.contentId}-${match.categoryId}`} className="rounded-xl border border-line bg-surface-1 p-3 text-xs text-white/65">
                  <span className="font-semibold text-white">{match.contentName}</span>
                  <span className="mx-2 text-white/30">→</span>
                  <span>{match.categoryName}</span>
                  <span className="ms-2 text-white/35">({match.family}{match.onlyContentInCategory ? ', unique' : ''})</span>
                </div>
              ))}
            </div>
          </GlassCard>
        )}
      </div>
    </div>
  );
}
