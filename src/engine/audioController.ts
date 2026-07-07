/**
 * 音频控制器 — 运行时选择引擎
 *
 * Capacitor 环境 → NativeAudioEngine (ExoPlayer)
 * 浏览器环境    → WebAudioEngine  (Web Audio API)
 */
import { WebAudioEngine } from './webAudioEngine'
import { NativeAudioEngine } from './nativeAudioEngine'
import type { IAudioEngine } from './types'

let _instance: IAudioEngine | null = null

function isCapacitorNative(): boolean {
  try {
    // @ts-ignore
    return !!(window.Capacitor?.isNativePlatform?.())
  } catch {
    return false
  }
}

function getEngine(): IAudioEngine {
  if (!_instance) {
    _instance = isCapacitorNative()
      ? new NativeAudioEngine()
      : new WebAudioEngine()
  }
  return _instance
}

export const audioController: IAudioEngine = getEngine()
