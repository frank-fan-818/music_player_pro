/**
 * 触觉反馈工具 — Android vibrate API 封装
 */

type HapticType = 'light' | 'medium' | 'heavy' | 'selection'

const patterns: Record<HapticType, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 40,
  selection: 5,
}

export function haptic(type: HapticType = 'light'): void {
  if (!navigator.vibrate) return
  navigator.vibrate(patterns[type])
}
