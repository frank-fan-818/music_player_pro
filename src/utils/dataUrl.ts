/**
 * base64 data URL ↔ Blob URL 转换工具
 * 用于 Media Session artwork (不接受 data URL, 需要 blob URL)
 */

const blobUrlCache = new Map<string, string>()

/** base64 data URL → blob URL，带缓存。trackId 用于变更时撤销旧 URL */
export function dataUrlToBlobUrl(dataUrl: string | null, trackId: string): string | null {
  if (!dataUrl) return null

  // 撤销同 trackId 的旧 blob URL
  revoke(trackId)

  try {
    const [header, b64] = dataUrl.split(',')
    const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg'
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const blob = new Blob([bytes], { type: mime })
    const url = URL.createObjectURL(blob)
    blobUrlCache.set(trackId, url)
    return url
  } catch {
    return dataUrl // fallback: 返回原始 data URL
  }
}

/** 撤销指定 trackId 的 blob URL */
export function revoke(trackId: string): void {
  const url = blobUrlCache.get(trackId)
  if (url) {
    URL.revokeObjectURL(url)
    blobUrlCache.delete(trackId)
  }
}
