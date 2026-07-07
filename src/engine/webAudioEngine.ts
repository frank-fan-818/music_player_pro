/**
 * Web Audio 音频引擎 — 浏览器 PWA 模式
 *
 * v4.1 + IAudioEngine 接口
 */
import { songService } from '../db/songService'
import type { IAudioEngine, EngineState, PlaybackListener } from './types'
import type { EQBand } from '../stores/settingsStore'

export class WebAudioEngine implements IAudioEngine {
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
  private playGen = 0

  // v4.1: 重入锁 + 取消标记
  private playingPromise: Promise<void> | null = null
  private cancelRequested = false
  private stateChangeBound = false

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
      this.analyser.fftSize = 256
      this.analyser.smoothingTimeConstant = 0.8
      this.gainNode = this.ctx.createGain()
      this.analyser.connect(this.gainNode)
      this.gainNode.connect(this.ctx.destination)
      this.stateChangeBound = false
    }

    // H2: 监听 AudioContext 状态变化 (标签页后台化/恢复)
    if (!this.stateChangeBound && this.ctx) {
      this.stateChangeBound = true
      this.ctx.addEventListener('statechange', () => {
        if (!this.ctx) return
        if (this.ctx.state === 'suspended' && this.state === 'playing') {
          // 标签页被后台化 → 记录位置并暂停
          this.pausedAt = this.ctx.currentTime - this.startedAt
          this.stopSource()
          this.setState('paused')
          this.log('auto_pause', { reason: 'context_suspended', position: this.pausedAt })
        }
      })
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

    if (bands.length === 0) {
      // 空 bands → 直连
      this.analyser.connect(this.gainNode)
      return
    }

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

  /** 更新单个 EQ 频段增益 (不重建链, 无爆音) */
  updateEQBandGain(index: number, gain: number): void {
    if (index >= 0 && index < this.eqFilters.length) {
      this.eqFilters[index].gain.value = gain
    }
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
    this.cancelRequested = false
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
      // 抑制超时后 decodePromise 的未处理 rejection
      decodePromise.catch(() => {})
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

  /**
   * 播放音频
   *
   * v4.1: 添加重入锁 (C2 fix)
   * 如果前一次 play() 尚未完成 (在 async 间隙中), 返回正在进行的 Promise
   * 防止并发调用产生两个同时播放的 AudioBufferSourceNode
   */
  async play(vol?: number): Promise<void> {
    if (!this.buffer || !this.ctx || !this.gainNode) return

    // C2 fix: 重入锁 — 前一次 play() 未完成则复用其 Promise
    if (this.playingPromise) return this.playingPromise

    this.playingPromise = this.doPlay(vol)
    try {
      await this.playingPromise
    } finally {
      this.playingPromise = null
    }
  }

  private async doPlay(vol?: number): Promise<void> {
    if (!this.buffer || !this.ctx || !this.gainNode) return

    this.cancelRequested = false
    this.stopSource()

    await this.ensureContext()

    // H1 fix: ensureContext() 期间 pause() 或新的 play() 可能已设置取消标记
    if (this.cancelRequested || !this.buffer) return

    if (vol !== undefined) this.volume = vol

    const gen = this.playGen

    this.source = this.ctx.createBufferSource()
    this.source.buffer = this.buffer
    this.source.connect(this.analyser!)
    this.gainNode!.gain.value = this.volume

    this.source.onended = () => {
      if (gen !== this.playGen) return
      if (this.state === 'playing') {
        this.setState('idle')
        this.listener?.onTrackEnd()
      }
    }

    this.source.start(0, this.pausedAt)
    this.startedAt = this.ctx.currentTime - this.pausedAt
    this.setState('playing') // H1 fix: 移到 source.start() 之后
    this.log('play', { offset: this.pausedAt, gen })
    this.trackProgress()
  }

  pause(): void {
    // H1 fix: 设置取消标记，阻断正在 await ensureContext() 的 play()
    this.cancelRequested = true
    if (!this.source) return

    // 30ms 淡出防止咔嗒声
    if (this.ctx && this.gainNode) {
      const now = this.ctx.currentTime
      this.gainNode.gain.setValueAtTime(this.volume, now)
      this.gainNode.gain.linearRampToValueAtTime(0, now + 0.03)
    }

    this.pausedAt = this.ctx!.currentTime - this.startedAt
    this.stopSource()

    // 恢复增益值 (下一次 play() 会设置正确的音量)
    if (this.gainNode) {
      this.gainNode.gain.value = this.volume
    }

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
      // 30ms 淡出防止咔嗒声
      if (this.ctx && this.gainNode) {
        const now = this.ctx.currentTime
        this.gainNode.gain.setValueAtTime(this.volume, now)
        this.gainNode.gain.linearRampToValueAtTime(0, now + 0.03)
        await new Promise(r => setTimeout(r, 35))
      }
      this.stopSource()
      await this.play()
    }
  }

  // ======  音量 ======

  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol))
    // 使用 setTargetAtTime 做斜坡, 消除阶跃咔嗒声
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.01)
    }
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

export const webAudioEngine = new WebAudioEngine()
