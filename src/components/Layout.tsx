import { Outlet } from 'react-router-dom'
import { useState, useEffect } from 'react'
import TabBar from './TabBar'
import MiniPlayer from './MiniPlayer'
import FullPlayer from './FullPlayer'
import { initMediaSession } from '../engine/mediaSession'

export default function Layout() {
  const [fullPlayerOpen, setFullPlayerOpen] = useState(false)

  useEffect(() => { initMediaSession() }, [])

  return (
    <div className="h-screen flex flex-col bg-obsidian-900 overflow-hidden">
      {/* 主内容区 */}
      <div className="flex-1 overflow-y-auto pb-2 safe-top">
        <Outlet />
      </div>

      {/* MiniPlayer - 点击展开全屏播放器 */}
      <MiniPlayer onExpand={() => setFullPlayerOpen(true)} />

      {/* 底部导航 */}
      <TabBar />

      {/* 全屏播放器 (Apple Music 风格上滑展开) */}
      <FullPlayer
        isOpen={fullPlayerOpen}
        onClose={() => setFullPlayerOpen(false)}
      />
    </div>
  )
}
