/**
 * Pont Capacitor vers ExoPlayer (films / séries sur Android).
 *
 * Le direct reste hls.js / mpegts.js : il a déjà du son. La WebView
 * ne décode pas l'AC-3 des VOD IPTV ; ExoPlayer, si.
 */
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface NativeVodPlayerPlugin {
  play(options: { url: string; resumeAt?: number }): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  seek(options: { seconds: number }): Promise<void>;
  setVolume(options: { value: number }): Promise<void>;
  setMuted(options: { value: boolean }): Promise<void>;
  release(): Promise<void>;
  addListener(
    event: 'ready' | 'time' | 'playing' | 'paused' | 'buffering' | 'ended' | 'error',
    cb: (data: NativeVodEvent) => void
  ): Promise<PluginListenerHandle>;
}

export interface NativeVodEvent {
  duration?: number;
  position?: number;
  value?: boolean;
  kind?: string;
}

export const NativeVodPlayer = registerPlugin<NativeVodPlayerPlugin>('NativeVodPlayer');

export function shouldUseNativeVod(isLive: boolean): boolean {
  return !isLive && Capacitor.isNativePlatform();
}
