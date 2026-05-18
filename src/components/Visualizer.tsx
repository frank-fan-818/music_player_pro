import { useEffect, useRef } from 'react'
import { audioEngine } from '../engine/audioEngine'
import { useSettingsStore } from '../stores/settingsStore'

export default function Visualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const visualizerEnabled = useSettingsStore((s) => s.visualizerEnabled)

  useEffect(() => {
    if (!visualizerEnabled) return
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const data = audioEngine.getAnalyserData()
      if (!data) return

      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)

      const barCount = 48
      const barWidth = (w / barCount) * 0.7
      const gap = (w / barCount) * 0.3
      const step = Math.floor(data.length / barCount)

      for (let i = 0; i < barCount; i++) {
        // 取低频区加权平均值（低频视觉冲击力更强）
        const idx = Math.floor(i * step * 0.6)
        const val = data[Math.min(idx, data.length - 1)] / 255
        const barH = val * h * 0.9 + 2

        // 金色渐变：低频暖金 → 高频淡金
        const hue = 44
        const sat = 80 - (i / barCount) * 40
        const light = 60 + (i / barCount) * 30
        ctx.fillStyle = `hsl(${hue}, ${sat}%, ${light}%)`

        const x = i * (barWidth + gap)
        const y = h - barH
        const r = barWidth / 2
        ctx.beginPath()
        ctx.moveTo(x, y + r)
        ctx.arcTo(x, y, x + r, y, r)
        ctx.arcTo(x + barWidth, y, x + barWidth, y + r, r)
        ctx.arcTo(x + barWidth, h, x, h, r)
        ctx.arcTo(x, h, x, y + r, r)
        ctx.fill()
      }
    }

    draw()
    return () => cancelAnimationFrame(raf)
  }, [visualizerEnabled])

  if (!visualizerEnabled) return null

  return (
    <canvas
      ref={canvasRef}
      width={280}
      height={200}
      className="w-full max-w-[280px] h-[200px] rounded-2xl opacity-80"
      style={{ imageRendering: 'auto' }}
    />
  )
}
