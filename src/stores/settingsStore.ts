import { create } from 'zustand'

export interface EQBand {
  freq: number  // Hz
  gain: number  // -12 ~ +12 dB
}

export interface EQPreset {
  id: string
  label: string
  bands: { freq: number; gain: number }[]
}

// 5 段均衡器预设音效
export const EQ_PRESETS: EQPreset[] = [
  {
    id: 'flat',
    label: '默认',
    bands: [
      { freq: 60, gain: 0 },
      { freq: 250, gain: 0 },
      { freq: 1000, gain: 0 },
      { freq: 4000, gain: 0 },
      { freq: 16000, gain: 0 },
    ],
  },
  {
    id: 'bass',
    label: '重低音',
    bands: [
      { freq: 60, gain: 8 },
      { freq: 250, gain: 4 },
      { freq: 1000, gain: 0 },
      { freq: 4000, gain: -1 },
      { freq: 16000, gain: -2 },
    ],
  },
  {
    id: 'vocal',
    label: '人声增强',
    bands: [
      { freq: 60, gain: -2 },
      { freq: 250, gain: -3 },
      { freq: 1000, gain: 5 },
      { freq: 4000, gain: 4 },
      { freq: 16000, gain: 2 },
    ],
  },
  {
    id: 'treble',
    label: '高音增强',
    bands: [
      { freq: 60, gain: -2 },
      { freq: 250, gain: 0 },
      { freq: 1000, gain: 1 },
      { freq: 4000, gain: 5 },
      { freq: 16000, gain: 7 },
    ],
  },
  {
    id: 'rock',
    label: '摇滚',
    bands: [
      { freq: 60, gain: 6 },
      { freq: 250, gain: 3 },
      { freq: 1000, gain: -3 },
      { freq: 4000, gain: 4 },
      { freq: 16000, gain: 5 },
    ],
  },
  {
    id: 'pop',
    label: '流行',
    bands: [
      { freq: 60, gain: 3 },
      { freq: 250, gain: 2 },
      { freq: 1000, gain: 2 },
      { freq: 4000, gain: 3 },
      { freq: 16000, gain: 4 },
    ],
  },
  {
    id: 'classical',
    label: '古典',
    bands: [
      { freq: 60, gain: 4 },
      { freq: 250, gain: 2 },
      { freq: 1000, gain: 0 },
      { freq: 4000, gain: 3 },
      { freq: 16000, gain: 4 },
    ],
  },
  {
    id: 'electronic',
    label: '电子',
    bands: [
      { freq: 60, gain: 8 },
      { freq: 250, gain: 3 },
      { freq: 1000, gain: -4 },
      { freq: 4000, gain: 3 },
      { freq: 16000, gain: 6 },
    ],
  },
]

const DEFAULT_EQ: EQBand[] = [
  { freq: 60, gain: 0 },
  { freq: 250, gain: 0 },
  { freq: 1000, gain: 0 },
  { freq: 4000, gain: 0 },
  { freq: 16000, gain: 0 },
]

interface SettingsStore {
  visualizerEnabled: boolean
  eqEnabled: boolean
  eqBands: EQBand[]
  activePreset: string | null
  toggleVisualizer: () => void
  toggleEQ: () => void
  setEQBand: (index: number, gain: number) => void
  applyPreset: (preset: EQPreset) => void
  resetEQ: () => void
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  visualizerEnabled: false,
  eqEnabled: loadBoolFromStorage('eq_enabled', false),
  eqBands: loadEQFromStorage(),
  activePreset: loadStrFromStorage('eq_preset'),

  toggleVisualizer: () => set((s) => ({ visualizerEnabled: !s.visualizerEnabled })),

  toggleEQ: () =>
    set((s) => {
      const next = !s.eqEnabled
      saveBoolToStorage('eq_enabled', next)
      return { eqEnabled: next }
    }),

  setEQBand: (index, gain) =>
    set((s) => {
      const bands = [...s.eqBands]
      bands[index] = { ...bands[index], gain: Math.max(-12, Math.min(12, gain)) }
      saveEQToStorage(bands)
      return { eqBands: bands, activePreset: null }
    }),

  applyPreset: (preset) =>
    set(() => {
      const bands = preset.bands.map((b) => ({ freq: b.freq, gain: b.gain }))
      saveEQToStorage(bands)
      saveStrToStorage('eq_preset', preset.id)
      saveBoolToStorage('eq_enabled', true)
      return { eqBands: bands, activePreset: preset.id, eqEnabled: true }
    }),

  resetEQ: () =>
    set(() => {
      const bands = DEFAULT_EQ.map((b) => ({ ...b }))
      saveEQToStorage(bands)
      saveStrToStorage('eq_preset', null)
      return { eqBands: bands, activePreset: null }
    }),
}))

function loadEQFromStorage(): EQBand[] {
  try {
    const raw = localStorage.getItem('eq_bands')
    if (raw) return JSON.parse(raw)
  } catch {}
  return DEFAULT_EQ.map((b) => ({ ...b }))
}
function saveEQToStorage(bands: EQBand[]) {
  localStorage.setItem('eq_bands', JSON.stringify(bands))
}
function loadBoolFromStorage(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key)
    return v !== null ? v === '1' : fallback
  } catch { return fallback }
}
function saveBoolToStorage(key: string, val: boolean) {
  localStorage.setItem(key, val ? '1' : '0')
}
function loadStrFromStorage(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function saveStrToStorage(key: string, val: string | null) {
  if (val) localStorage.setItem(key, val)
  else localStorage.removeItem(key)
}
