import { create } from 'zustand'

export interface EQBand {
  freq: number  // Hz
  gain: number  // -12 ~ +12 dB
}

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
  toggleVisualizer: () => void
  toggleEQ: () => void
  setEQBand: (index: number, gain: number) => void
  resetEQ: () => void
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  visualizerEnabled: false,
  eqEnabled: false,
  eqBands: loadEQFromStorage(),
  toggleVisualizer: () => set((s) => ({ visualizerEnabled: !s.visualizerEnabled })),
  toggleEQ: () => set((s) => ({ eqEnabled: !s.eqEnabled })),
  setEQBand: (index, gain) =>
    set((s) => {
      const bands = [...s.eqBands]
      bands[index] = { ...bands[index], gain: Math.max(-12, Math.min(12, gain)) }
      saveEQToStorage(bands)
      return { eqBands: bands }
    }),
  resetEQ: () => set({ eqBands: DEFAULT_EQ.map((b) => ({ ...b })) }),
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
