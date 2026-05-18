interface Props {
  coverArt: string | null
  title: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/** 从字符串生成稳定的 HSL 色相 (0-360) */
function hashHue(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h) % 360
}

export default function CoverImage({ coverArt, title, size = 'md', className = '' }: Props) {
  if (coverArt) {
    return <img src={coverArt} alt={title} className={`w-full h-full object-cover ${className}`} />
  }

  const hue = hashHue(title)
  const char = title.charAt(0).toUpperCase() || '?'
  const textSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-4xl' : 'text-xl'

  return (
    <div
      className={`w-full h-full flex items-center justify-center ${className}`}
      style={{ background: `linear-gradient(135deg, hsl(${hue},30%,18%), hsl(${hue},25%,12%))` }}
    >
      <span className={`${textSize} font-bold`} style={{ color: `hsl(${hue},50%,60%)` }}>
        {char}
      </span>
    </div>
  )
}
