/**
 * 音频控制器 — 运行时选择引擎
 *
 * 当前: 始终使用 WebAudioEngine
 *   - Capacitor WebView 内也有完整的 Web Audio API
 *   - NativeAudioEngine 需要 ExoPlayer 插件 (Phase 1.3, 待实现)
 *
 *   待 ExoPlayer 插件就绪后，切换为:
 *     isCapacitorNative() ? NativeAudioEngine : WebAudioEngine
 */
import { WebAudioEngine } from './webAudioEngine'
import type { IAudioEngine } from './types'

let _instance: IAudioEngine | null = null

function getEngine(): IAudioEngine {
  if (!_instance) {
    _instance = new WebAudioEngine()
  }
  return _instance
}

export const audioController: IAudioEngine = getEngine()
