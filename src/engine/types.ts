/**
 * 音频引擎接口 — 双轨策略的核心抽象
 *
 * webAudioEngine  (PWA 模式): Web Audio API 完整实现
 * nativeAudioEngine (APK 模式): Capacitor 桥接 ExoPlayer
 */
import type { EQBand } from '../stores/settingsStore'

export type EngineState = 'idle' | 'loading' | 'ready' | 'playing' | 'paused'

export interface PlaybackListener {
  onStateChange: (state: EngineState) => void
  onTimeUpdate: (currentTime: number, duration: number) => void
  onTrackEnd: () => void | Promise<void>
  onError: (error: string) => void
  onLoadingProgress?: (phase: string) => void
}

export interface IAudioEngine {
  load(songId: string): Promise<void>
  play(vol?: number): Promise<void>
  pause(): void
  resume(): Promise<void>
  seek(time: number): Promise<void>
  setVolume(vol: number): void
  dispose(): void

  getState(): EngineState
  getCurrentSongId(): string | null
  getAnalyserData(): Uint8Array | null

  setListener(l: PlaybackListener | null): void
  buildEQChain(bands: EQBand[]): void
  updateEQBandGain(index: number, gain: number): void
}
