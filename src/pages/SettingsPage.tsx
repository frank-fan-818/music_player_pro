import { useSettingsStore, EQ_PRESETS } from '../stores/settingsStore'
import type { EQPreset } from '../stores/settingsStore'
import { audioController as audioEngine } from '../engine/audioController'

const bandLabels = ['60 Hz', '250 Hz', '1 kHz', '4 kHz', '16 kHz']

/** Mini EQ 曲线图标 — 5 根竖线对应 5 个频段的增益 */
function MiniEQ({ preset, active }: { preset: EQPreset; active: boolean }) {
  const maxGain = 12
  const barW = 2.5
  const gap = 3.5
  const totalW = preset.bands.length * (barW + gap) - gap
  const h = 18
  const baseline = h - 2

  return (
    <svg
      viewBox={`0 0 ${totalW} ${h}`}
      className="w-5 h-4 flex-shrink-0"
      fill="none"
    >
      {preset.bands.map((band, i) => {
        const x = i * (barW + gap)
        // 增益 → 柱高度: 0dB = 5px (mid), +12dB = 14px, -12dB = 2px
        const ratio = band.gain / maxGain
        const barH = Math.max(2, 5 + ratio * 9)
        const y = baseline - barH
        const isPositive = band.gain >= 0
        const isZero = band.gain === 0
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={barH}
            rx="1.25"
            fill={
              active
                ? isZero
                  ? 'rgba(245,197,66,0.35)'
                  : isPositive
                    ? 'rgba(245,197,66,0.9)'
                    : 'rgba(245,197,66,0.45)'
                : isZero
                  ? 'rgba(255,255,255,0.12)'
                  : isPositive
                    ? 'rgba(255,255,255,0.3)'
                    : 'rgba(255,255,255,0.16)'
            }
          />
        )
      })}
    </svg>
  )
}

export default function SettingsPage() {
  const {
    visualizerEnabled, eqEnabled, eqBands, activePreset,
    toggleVisualizer, toggleEQ, setEQBand, applyPreset, resetEQ,
  } = useSettingsStore()

  const handleEQToggle = () => {
    toggleEQ()
    const { eqEnabled: nowOn, eqBands: bands } = useSettingsStore.getState()
    if (!nowOn) {
      audioEngine.buildEQChain(bands.map((b) => ({ ...b, gain: 0 })))
    } else {
      audioEngine.buildEQChain(bands)
    }
  }

  const handleBandChange = (index: number, value: number) => {
    setEQBand(index, value)
    audioEngine.buildEQChain(useSettingsStore.getState().eqBands)
  }

  const handlePreset = (preset: EQPreset) => {
    applyPreset(preset)
    audioEngine.buildEQChain(useSettingsStore.getState().eqBands)
  }

  return (
    <div className="pt-14 px-5 pb-4">
      <h1 className="text-display font-extrabold text-[32px] tracking-[-0.025em] text-text-primary mb-6">设置</h1>

      {/* 可视化开关 */}
      <div className="glass rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">播放可视化</h3>
            <p className="text-[11px] text-text-muted mt-0.5">在全屏播放器中显示频谱动画</p>
          </div>
          <button
            onClick={toggleVisualizer}
            className={`w-12 h-7 rounded-full transition-all relative ${
              visualizerEnabled ? 'bg-gold-400' : 'bg-white/[0.08]'
            }`}
          >
            <div
              className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform ${
                visualizerEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* EQ 均衡器 */}
      <div className="glass rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">均衡器 (EQ)</h3>
            <p className="text-[11px] text-text-muted mt-0.5">5 段频率调节 · 预设音效一键切换</p>
          </div>
          <button
            onClick={handleEQToggle}
            className={`w-12 h-7 rounded-full transition-all relative ${
              eqEnabled ? 'bg-gold-400' : 'bg-white/[0.08]'
            }`}
          >
            <div
              className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform ${
                eqEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {/* 预设音效 */}
        {eqEnabled && (
          <div className="mt-5">
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.15em] mb-3">
              推荐音效
            </p>
            <div className="grid grid-cols-4 gap-2">
              {EQ_PRESETS.map((preset) => {
                const isActive = activePreset === preset.id
                return (
                  <button
                    key={preset.id}
                    onClick={() => handlePreset(preset)}
                    className={`flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl transition-all duration-200 active:scale-95 ${
                      isActive
                        ? 'bg-gold-400/[0.08] ring-1 ring-gold-400/25 shadow-[0_0_12px_rgba(245,197,66,0.06)]'
                        : 'hover:bg-white/[0.03] ring-1 ring-white/[0.04]'
                    }`}
                  >
                    <MiniEQ preset={preset} active={isActive} />
                    <span
                      className={`text-[10px] font-semibold tracking-wide transition-colors duration-200 ${
                        isActive ? 'text-gold-400' : 'text-text-muted'
                      }`}
                    >
                      {preset.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* 手动调节滑块 */}
        {eqEnabled && (
          <div className="mt-6 space-y-4">
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.15em]">
              手动微调{activePreset ? ' · 已自定义' : ''}
            </p>
            {eqBands.map((band, i) => (
              <div key={band.freq} className="flex items-center gap-3">
                <span className="text-[11px] text-text-muted w-12 tabular-nums font-medium">{bandLabels[i]}</span>
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="0.5"
                  value={band.gain}
                  onChange={(e) => handleBandChange(i, parseFloat(e.target.value))}
                  className="flex-1 h-1.5 bg-white/[0.06] rounded-full appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gold-400 [&::-webkit-slider-thumb]:shadow-md"
                />
                <span
                  className={`text-[11px] tabular-nums w-8 text-right font-medium ${
                    band.gain === 0 ? 'text-text-muted' : band.gain > 0 ? 'text-gold-400' : 'text-red-400/70'
                  }`}
                >
                  {band.gain > 0 ? '+' : ''}
                  {band.gain.toFixed(1)} dB
                </span>
              </div>
            ))}
            <button
              onClick={resetEQ}
              className="text-[11px] text-text-muted hover:text-gold-400 transition-colors font-medium mt-2"
            >
              重置为默认
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
