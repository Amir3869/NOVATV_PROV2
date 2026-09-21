/**
 * Pont Capacitor vers ExoPlayer sur Android.
 *
 * Les films, séries et directs HTTP utilisent le même moteur natif :
 * ExoPlayer conserve ainsi la lecture quand l'activité passe en PiP.
 * La WebView reste le moteur de repli sur le Web et iOS.
 */
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface NativeVodPlayerPlugin {
  play(options: { url: string; resumeAt?: number; resizeMode?: string }): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  seek(options: { seconds: number }): Promise<void>;
  setVolume(options: { value: number }): Promise<void>;
  setMuted(options: { value: boolean }): Promise<void>;
  setResizeMode(options: { mode: string }): Promise<void>;
  setPictureInPictureEnabled(options: { enabled: boolean }): Promise<void>;
  enterPictureInPicture(): Promise<void>;
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

export function shouldUseNativeVod(_isLive: boolean): boolean {
  return Capacitor.getPlatform() === 'android';
}
