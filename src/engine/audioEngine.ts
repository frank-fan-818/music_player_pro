/**
 * 音频引擎 v4
 *
 * 核心设计:
 *   buffer (持久)   : 解码后的音频数据, 仅 load() 时替换
 *   source (临时)   : 每次 play() 新建
 *   playGen (计数器) : stopSource() 递增, onended 检查是否过期
 *                     解决了 Web Audio onended 异步派发导致误判的问题
 */
import { songService } from '../db/songService'

export type EngineState = 'idle' | 'loading' | 'ready' | 'playing' | 'paused'

export interface PlaybackListener {
  onStateChange: (state: EngineState) => void
  onTimeUpdate: (currentTime: number, duration: number) => void
  onTrackEnd: () => void | Promise<void>
  onError: (error: string) => void
  onLoadingProgress?: (phase: string) => void
}

import type { EQBand } from '../stores/settingsStore'

export class AudioEngine {
  private ctx: AudioContext | null = null
  private gainNode: GainNode | null = null
  private analyser: AnalyserNode | null = null
  private eqFilters: BiquadFilterNode[] = []
  private source: AudioBufferSourceNode | null = null
  private buffer: AudioBuffer | null = null

  private state: EngineState = 'idle'
  private currentSongId: string | null = null
  private startedAt = 0
  private pausedAt = 0
  private songDuration = 0
  private rafId = 0
  private listener: PlaybackListener | null = null
  private volume = 0.8
  private playGen = 0 // 每次 stopSource() 递增，onended 用 gen 判断是否过期

  setListener(l: PlaybackListener | null) { this.listener = l }

  private setState(s: EngineState) {
    this.state = s
    this.listener?.onStateChange(s)
  }

  private log(phase: string, data: Record<string, unknown> = {}) {
    console.log(JSON.stringify({ layer: 'audio_engine', phase, songId: this.currentSongId, state: this.state, timestamp: Date.now(), ...data }))
  }

  // ======  Context & Pipeline ======

  private async ensureContext(): Promise<void> {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioContext()
      this.analyser = this.ctx.createAnalyser()
      this.analyser.fftSize = 256 // 128 frequency bins, 适合移动端
      this.analyser.smoothingTimeConstant = 0.8
      this.gainNode = this.ctx.createGain()
      // 默认链: analyser → gain → dest (EQ filters 插在中间)
      this.analyser.connect(this.gainNode)
      this.gainNode.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume()
    }
  }

  /** 重建 EQ 滤波链: 断开旧链 → 串联 BiquadFilter → 接 gain */
  buildEQChain(bands: EQBand[]): void {
    if (!this.ctx || !this.analyser || !this.gainNode) return
    // 断开 analyser → gain 的直接连接
    this.analyser.disconnect()
    // 拆除旧 EQ 滤镜
    for (const f of this.eqFilters) f.disconnect()
    this.eqFilters = []

    let prev: AudioNode = this.analyser
    for (const band of bands) {
      const filter = this.ctx.createBiquadFilter()
      filter.type = 'peaking'
      filter.frequency.value = band.freq
      filter.gain.value = band.gain
      filter.Q.value = 1.0
      prev.connect(filter)
      prev = filter
      this.eqFilters.push(filter)
    }
    prev.connect(this.gainNode)
  }

  /** 获取频谱数据 (给 Visualizer 组件) */
  getAnalyserData(): Uint8Array | null {
    if (!this.analyser) return null
    const data = new Uint8Array(this.analyser.frequencyBinCount)
    this.analyser.getByteFrequencyData(data)
    return data
  }

  // ======  Source ======

  /** 停止当前 source 并递增代际，使所有待处理的 onended 无效化 */
  private stopSource() {
    this.playGen++ // 递增 BEFORE stop — 异步 onended 用 gen 校验
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = 0 }
    if (this.source) {
      try { this.source.stop() } catch { /* already stopped */ }
      this.source.disconnect()
      this.source = null
    }
  }

  // ======  加载 ======

  async load(songId: string): Promise<void> {
    this.log('load_start', { songId })
    this.stopSource()
    this.buffer = null
    this.setState('loading')
    this.currentSongId = songId

    try {
      this.listener?.onLoadingProgress?.('读取音频数据...')
      const song = await songService.getById(songId)
      if (!song) throw new Error('歌曲未找到')

      this.listener?.onLoadingProgress?.('解码音频...')
      await this.ensureContext()
      const arrayBuffer = await song.audioData.arrayBuffer()
      const decodePromise = this.ctx!.decodeAudioData(arrayBuffer)
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('音频解码超时')), 10000))
      this.buffer = await Promise.race([decodePromise, timeoutPromise])

      this.songDuration = this.buffer.duration
      this.pausedAt = 0
      this.setState('ready')
      this.log('load_done', { duration: this.buffer.duration })
    } catch (err: any) {
      this.log('load_failed', { error: err.message })
      this.buffer = null
      this.setState('idle')
      this.listener?.onError(err.message || '加载失败')
      throw err
    }
  }

  // ======  播放 ======

  async play(vol?: number): Promise<void> {
    if (!this.buffer || !this.ctx || !this.gainNode) return

    this.stopSource() // 递增 playGen，停止旧 source
    this.setState('playing') // 先设状态，消除 async 间隙

    await this.ensureContext()
    if (vol !== undefined) this.volume = vol

    const gen = this.playGen // 当前代际——新 source 和 onended 都用这个值校验

    this.source = this.ctx.createBufferSource()
    this.source.buffer = this.buffer
    this.source.connect(this.analyser!) // source → analyser → [EQ] → gain → dest
    this.gainNode!.gain.value = this.volume

    this.source.onended = () => {
      // gen 不匹配 = 期间有过 stopSource() = 被人工中止，非自然结束
      if (gen !== this.playGen) return
      if (this.state === 'playing') {
        this.setState('idle')
        this.listener?.onTrackEnd()
      }
    }

    this.source.start(0, this.pausedAt)
    this.startedAt = this.ctx.currentTime - this.pausedAt
    this.log('play', { offset: this.pausedAt, gen })
    this.trackProgress()
  }

  pause(): void {
    if (!this.source) return
    this.pausedAt = this.ctx!.currentTime - this.startedAt
    this.stopSource() // playGen++ 使旧 onended 失效
    this.setState('paused')
    this.log('pause', { position: this.pausedAt })
  }

  async resume(): Promise<void> {
    if (this.state !== 'paused') return
    await this.play()
  }

  async seek(time: number): Promise<void> {
    this.pausedAt = Math.max(0, Math.min(time, this.songDuration))
    this.listener?.onTimeUpdate(this.pausedAt, this.songDuration)
    if (this.state === 'playing') {
      this.stopSource()
      await this.play()
    }
  }

  // ======  音量 ======

  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol))
    if (this.gainNode) this.gainNode.gain.value = this.volume
  }

  // ======  进度 ======

  private trackProgress(): void {
    const tick = () => {
      if (this.state !== 'playing' || !this.ctx) return
      const elapsed = this.ctx.currentTime - this.startedAt
      this.listener?.onTimeUpdate(elapsed, this.songDuration)
      if (elapsed < this.songDuration) {
        this.rafId = requestAnimationFrame(tick)
      }
    }
    this.rafId = requestAnimationFrame(tick)
  }

  dispose(): void {
    this.stopSource()
    this.buffer = null
    if (this.ctx) { this.ctx.close(); this.ctx = null; this.gainNode = null }
    this.state = 'idle'
    this.listener = null
  }

  getState(): EngineState { return this.state }
  getCurrentSongId(): string | null { return this.currentSongId }
}

export const audioEngine = new AudioEngine()
