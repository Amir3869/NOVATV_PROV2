import { describe, expect, it, vi } from 'vitest';
import { normalizeEpgText, syncXtreamShortEPG } from './epgSync';
import { xtreamService, type XtreamCredentials } from '@/services/xtream/xtreamService';
import type { LiveChannel } from '@/types';

const credentials: XtreamCredentials = {
  serverUrl: 'https://iptv.example.test',
  username: 'user',
  password: 'pass',
};

const channel: LiveChannel = {
  id: 'pl-1:live:42',
  name: 'TF1',
  streamUrl: 'https://iptv.example.test/live/42.ts',
  streamType: 'other',
  playlistId: 'pl-1',
  streamId: 42,
  isFavorite: false,
  isRecent: false,
};

describe('normalizeEpgText', () => {
  it('décode un titre Xtream en Base64 quand le résultat est lisible', () => {
    expect(normalizeEpgText('Sm91cm5hbCBUViAx')).toBe('Journal TV 1');
  });

  it('nettoie les entités XML et écarte une pseudo-balise illisible', () => {
    expect(normalizeEpgText('&lt;jfis6', 'Programme TV')).toBe('Programme TV');
    expect(normalizeEpgText('Journal &amp; météo')).toBe('Journal & météo');
  });
});

describe('syncXtreamShortEPG', () => {
  it('normalise les programmes Xtream courts par chaîne', async () => {
    vi.spyOn(xtreamService, 'getShortEpg').mockResolvedValue([
      {
        title: 'Journal',
        description: 'Actualités',
        start_timestamp: String(Math.floor(Date.now() / 1000) - 60),
        stop_timestamp: String(Math.floor(Date.now() / 1000) + 1800),
      },
    ]);

    const result = await syncXtreamShortEPG(credentials, [channel], 'pl-1');

    expect(result.source).toBe('xtream_short');
    expect(result.matchedChannels).toBe(1);
    expect(result.programs[0]).toMatchObject({
      channelId: channel.id,
      title: 'Journal',
      description: 'Actualités',
    });
  });

  it('continue malgré une chaîne courte indisponible', async () => {
    vi.spyOn(xtreamService, 'getShortEpg').mockRejectedValue(new Error('serveur indisponible'));

    const result = await syncXtreamShortEPG(credentials, [channel], 'pl-1');

    expect(result.programs).toEqual([]);
    expect(result.matchedChannels).toBe(0);
    expect(result.unmatchedChannels).toBe(1);
    expect(result.warnings).toHaveLength(1);
  });
});
