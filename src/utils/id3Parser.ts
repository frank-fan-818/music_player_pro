/**
 * ID3 元数据解析器 v2
 *
 * 支持: ID3v1 (文件末尾128字节), ID3v2.3/2.4 (文件头部)
 *
 * v2 修复:
 *   - 帧数据读取提升至 128KB (覆盖封面嵌入的标签)
 *   - APIC 帧直接按 offset 重读，不再依赖 chunk 内数据
 *   - ID3v2.3 帧大小用普通 int，v2.4 用 sync-safe
 *   - 文本编码支持 ISO-8859-1 / UTF-8 / UTF-16 LE+BE
 */

export interface SongMetadata {
  title: string
  artist: string
  album: string
  coverArt: string | null
  lyrics: string | null
  trackNumber: number
}

export async function parseMetadata(file: File): Promise<SongMetadata> {
  const fallback: SongMetadata = {
    title: file.name.replace(/\.[^.]+$/, ''),
    artist: '未知歌手',
    album: '未知专辑',
    coverArt: null,
    lyrics: null,
    trackNumber: 0,
  }

  try {
    const header = await readBytes(file, 0, 10)
    if (header[0] === 0x49 && header[1] === 0x44 && header[2] === 0x33) {
      return await parseId3v2(file, fallback)
    }

    const tail = await readBytes(file, Math.max(0, file.size - 128), 128)
    if (tail[0] === 0x54 && tail[1] === 0x41 && tail[2] === 0x47) {
      return parseId3v1(tail, fallback)
    }

    return fallback
  } catch {
    return fallback
  }
}

// ====== ID3v1 ======

function parseId3v1(bytes: Uint8Array, fb: SongMetadata): SongMetadata {
  const decode = (start: number, len: number, fallback: string): string => {
    let end = start + len
    while (end > start && (bytes[end - 1] === 0 || bytes[end - 1] === 32)) end--
    if (end <= start) return fallback
    const slice = bytes.slice(start, end)
    const hasHigh = slice.some((b) => b > 0x7f)
    // 高位字节 → 优先 GBK (中文 MP3 标签惯例)
    if (hasHigh) {
      try { const gbk = new TextDecoder('gbk').decode(slice).trim(); if (gbk) return gbk } catch {}
    }
    // 低字节 → Latin-1 / ASCII
    try { const l1 = new TextDecoder('windows-1252').decode(slice).trim(); if (l1) return l1 } catch {}
    return fallback
  }
  console.log('[id3] ID3v1 found, parsing...')
  return {
    title: decode(3, 30, fb.title),
    artist: decode(33, 30, fb.artist),
    album: decode(63, 30, fb.album),
    coverArt: null,
    lyrics: null,
    trackNumber: bytes[126] === 0 ? (bytes[127] || 0) : 0,
  }
}

// ====== ID3v2 ======

async function parseId3v2(file: File, fb: SongMetadata): Promise<SongMetadata> {
  const meta = { ...fb }
  const header = await readBytes(file, 0, 10)

  const verMajor = header[3] // 3 or 4
  const tagSize = syncSafe(header, 6)

  // 跳过扩展头
  let offset = 10
  if (header[5] & 0x40) {
    const eh = await readBytes(file, offset, 4)
    const extSize = syncSafe(eh, 0)
    offset += 4 + extSize
  }

  // 读取帧区域 (128KB — 覆盖文本帧 + 封面帧头部)
  const headChunk = await readBytes(file, offset, Math.min(tagSize, 131072))
  let pos = 0
  let apicOffset = -1
  let apicSize = 0

  while (pos < headChunk.length - 10) {
    const frameId = String.fromCharCode(headChunk[pos], headChunk[pos + 1], headChunk[pos + 2], headChunk[pos + 3])
    if (frameId[0] === '\x00' || !/^[A-Z0-9]{4}$/.test(frameId)) break

    // 帧大小: 用乘法避免 << 24 的 int32 溢出
    const useSyncSafe = verMajor === 4
    const size = useSyncSafe
      ? syncSafe(headChunk, pos + 4)
      : (headChunk[pos + 4] * 16777216) + (headChunk[pos + 5] * 65536) + (headChunk[pos + 6] * 256) + headChunk[pos + 7]

    // 无效大小 → 停止 (标签损坏)
    if (size <= 0 || size > 10 * 1024 * 1024) break

    const dataStart = pos + 10

    if (frameId === 'APIC' && apicOffset < 0) {
      apicOffset = offset + dataStart
      apicSize = size
    } else if (frameId === 'USLT' && !meta.lyrics) {
      // 歌词帧: 结构 = enc(1) + lang(3) + descriptor + \0 + lyrics text
      const getData = async () => {
        if (dataStart + size <= headChunk.length) return headChunk.slice(dataStart, dataStart + size)
        return await readBytes(file, offset + dataStart, Math.min(size, 65536))
      }
      const usltData = await getData()
      meta.lyrics = parseUSLT(usltData)
    } else if (frameId !== 'APIC' && frameId !== 'USLT') {
      if (dataStart + size <= headChunk.length) {
        parseTextFrame(frameId, headChunk.slice(dataStart, dataStart + size), meta)
      } else {
        const frameBytes = await readBytes(file, offset + dataStart, Math.min(size, 65536))
        parseTextFrame(frameId, frameBytes, meta)
      }
    }

    // 始终推进 pos (之前 APIC 不在 chunk 内时 pos 卡死)
    pos = dataStart + size
  }

  // 提取 APIC 封面
  if (apicOffset >= 0 && apicSize > 0) {
    try {
      const apicData = await readBytes(file, apicOffset, Math.min(apicSize, 5 * 1024 * 1024))
      const cover = extractAPIC(apicData)
      if (cover) meta.coverArt = cover
      else console.warn('[id3] APIC extraction returned null', { apicOffset, apicSize })
    } catch (e) { console.warn('[id3] APIC read failed', e) }
  }

  console.log('[id3] ID3v2 parsed', { artist: meta.artist, title: meta.title, album: meta.album, hasCover: meta.coverArt !== null })
  return meta
}

// ====== 文本帧解析 ======

function parseTextFrame(id: string, data: Uint8Array, meta: SongMetadata): void {
  if (data.length < 2) return

  const enc = data[0]
  const raw = data.slice(1)
  const text = decodeText(raw, enc)

  if (id === 'TIT2' && text) meta.title = text
  else if (id === 'TPE1' && text) { meta.artist = text; console.log('[id3] TPE1 found', { enc, size: data.length, text }) }
  else if (id === 'TALB' && text) meta.album = text
  else if (id === 'TRCK') {
    const m = text.match(/\d+/)
    if (m) meta.trackNumber = parseInt(m[0])
  }
}

function decodeText(data: Uint8Array, enc: number): string {
  const raw = () => {
    switch (enc) {
      case 0: {
        // ISO-8859-1 / Latin-1。但中文 MP3 标签常用 GBK 或 UTF-8 存为 Latin-1 字节
        const hasHigh = data.some((b) => b > 0x7f)
        if (hasHigh) {
          // 优先 GBK (国内最常用)
          try { const gbk = new TextDecoder('gbk').decode(data); if (looksValid(gbk)) return gbk } catch {}
          // 回退 UTF-8 (部分现代 tagger)
          try { const utf8 = new TextDecoder('utf-8').decode(data); if (looksValid(utf8)) return utf8 } catch {}
        }
        return new TextDecoder('windows-1252').decode(data)
      }
      case 1: {
        if (data.length >= 2 && data[0] === 0xFF && data[1] === 0xFE)
          return new TextDecoder('utf-16le').decode(data.slice(2))
        if (data.length >= 2 && data[0] === 0xFE && data[1] === 0xFF)
          return new TextDecoder('utf-16be').decode(data.slice(2))
        return new TextDecoder('utf-16le').decode(data)
      }
      case 2: return new TextDecoder('utf-16be').decode(data)
      case 3: return new TextDecoder('utf-8').decode(data)
      default: return new TextDecoder('utf-8').decode(data)
    }
  }
  try {
    return raw().replace(/\0/g, '').trim()
  } catch {
    return ''
  }
}

// ======  USLT 歌词提取 ======

function parseUSLT(data: Uint8Array): string | null {
  if (data.length < 5) return null
  const enc = data[0]
  // skip enc(1) + lang(3) = 4 bytes, then skip descriptor (null-terminated)
  let i = 4
  while (i < data.length && data[i] !== 0) i++
  i++ // skip \0
  if (i >= data.length) return null
  const text = decodeText(data.slice(i), enc)
  return text || null
}

// ====== APIC 封面提取 ======

function extractAPIC(data: Uint8Array): string | null {
  if (data.length < 4) return null

  let i = 1
  while (i < data.length && data[i] !== 0) i++ // mime
  if (i >= data.length - 1) return null
  const mimeEnd = i
  const mime = new TextDecoder().decode(data.slice(1, mimeEnd))

  i++ // skip \0
  if (i >= data.length) return null
  i++ // skip picture type

  while (i < data.length && data[i] !== 0) i++ // skip description
  i++ // skip \0

  if (i < data.length) {
    const bytes = data.slice(i)
    const base64 = uint8ToBase64(bytes)
    return `data:${mime || 'image/jpeg'};base64,${base64}`
  }
  return null
}

// ====== 工具 ======

async function readBytes(file: File, offset: number, length: number): Promise<Uint8Array> {
  const blob = file.slice(offset, Math.min(offset + length, file.size))
  const buf = await blob.arrayBuffer()
  return new Uint8Array(buf)
}

/** 快速判断解码后的文本是否有效（不是乱码） */
function looksValid(s: string): boolean {
  // 替换次数过多表示很可能解码失败
  return s.length > 0 && !s.includes('\uFFFD')
}

/** Uint8Array → base64 分块编码，避免大图栈溢出 */
function uint8ToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000 // 32KB per chunk
  const chunks: string[] = []
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
    chunks.push(String.fromCharCode(...chunk))
  }
  return btoa(chunks.join(''))
}

function syncSafe(bytes: Uint8Array, start: number): number {
  return ((bytes[start] & 0x7f) << 21) |
         ((bytes[start + 1] & 0x7f) << 14) |
         ((bytes[start + 2] & 0x7f) << 7) |
         (bytes[start + 3] & 0x7f)
}
