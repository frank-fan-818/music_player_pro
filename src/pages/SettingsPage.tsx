import { useSettingsStore, EQ_PRESETS } from '../stores/settingsStore'
import { audioEngine } from '../engine/audioEngine'

const bandLabels = ['60 Hz', '250 Hz', '1 kHz', '4 kHz', '16 kHz']

export default function SettingsPage() {
  const {
    visualizerEnabled, eqEnabled, eqBands, activePreset,
    toggleVisualizer, toggleEQ, setEQBand, applyPreset, resetEQ,
  } = useSettingsStore()

  const handleEQToggle = () => {
    toggleEQ()
    const { eqEnabled: nowOn, eqBands: bands } = useSettingsStore.getState()
    if (!nowOn) {
      // 刚关闭 EQ → 使用直通链
      audioEngine.buildEQChain(bands.map((b) => ({ ...b, gain: 0 })))
    } else {
      // 刚开启 EQ → 构建当前频段链
      audioEngine.buildEQChain(bands)
    }
  }

  const handleBandChange = (index: number, value: number) => {
    setEQBand(index, value)
    const { eqEnabled: on, eqBands: bands } = useSettingsStore.getState()
    audioEngine.buildEQChain(on ? bands : bands.map((b) => ({ ...b, gain: 0 })))
  }

  const handlePreset = (preset: typeof EQ_PRESETS[number]) => {
    applyPreset(preset)
    const { eqBands: bands, eqEnabled: on } = useSettingsStore.getState()
    audioEngine.buildEQChain(on ? bands : bands.map((b) => ({ ...b, gain: 0 })))
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
          <div className="mt-4 -mx-1">
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2 px-1">推荐音效</p>
            <div className="flex flex-wrap gap-1.5">
              {EQ_PRESETS.map((preset) => {
                const isActive = activePreset === preset.id
                return (
                  <button
                    key={preset.id}
                    onClick={() => handlePreset(preset)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all active:scale-95 ${
                      isActive
                        ? 'bg-gold-400/15 text-gold-400 ring-1 ring-gold-400/30'
                        : 'bg-white/[0.04] text-text-secondary hover:bg-white/[0.06] hover:text-text-primary'
                    }`}
                  >
                    {preset.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* 手动调节滑块 */}
        {eqEnabled && (
          <div className="mt-5 space-y-4">
            <p className="text-[10px] text-text-muted uppercase tracking-wider">手动微调</p>
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
