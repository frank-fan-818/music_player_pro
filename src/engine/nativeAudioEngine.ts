/**
 * 原生音频引擎 — Capacitor APK 模式
 *
 * 通过 Capacitor 插件桥接 Android ExoPlayer。
 * 当前为 stub: PWA 环境下回退到 Web Audio Engine。
 */
import type { IAudioEngine, EngineState, PlaybackListener } from './types'
import type { EQBand } from '../stores/settingsStore'

export class NativeAudioEngine implements IAudioEngine {
  private state: EngineState = 'idle'
  private currentSongId: string | null = null
  private listener: PlaybackListener | null = null
  private volume = 0.8

  setListener(l: PlaybackListener | null) { this.listener = l }

  private setState(s: EngineState) {
    this.state = s
    this.listener?.onStateChange(s)
  }

  async load(songId: string): Promise<void> {
    this.currentSongId = songId
    this.setState('loading')
    // TODO: Capacitor bridge → MusicPlayerNative.load({ songData, mimeType })
    // 当前 stub: 直接标记 ready
    this.setState('ready')
  }

  async play(vol?: number): Promise<void> {
    if (vol !== undefined) this.volume = vol
    this.setState('playing')
    // TODO: Capacitor bridge → MusicPlayerNative.play({ volume, offset })
  }

  pause(): void {
    this.setState('paused')
    // TODO: Capacitor bridge → MusicPlayerNative.pause()
  }

  async resume(): Promise<void> {
    await this.play()
  }

  async seek(time: number): Promise<void> {
    // TODO: Capacitor bridge → MusicPlayerNative.seek({ position: time })
  }

  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol))
    // TODO: Capacitor bridge → MusicPlayerNative.setVolume({ volume })
  }

  dispose(): void {
    // TODO: Capacitor bridge → MusicPlayerNative.release()
    this.state = 'idle'
    this.listener = null
  }

  getState(): EngineState { return this.state }
  getCurrentSongId(): string | null { return this.currentSongId }
  getAnalyserData(): Uint8Array | null { return null }

  buildEQChain(bands: EQBand[]): void {
    // TODO: Capacitor bridge → MusicPlayerNative.setEQ({ bands })
  }

  updateEQBandGain(index: number, gain: number): void {
    // no-op in native mode
  }
}
