import { NavLink, useLocation } from 'react-router-dom'
import { haptic } from '../utils/haptics'

const tabs = [
  {
    path: '/now-playing',
    label: '现在就听',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    ),
  },
  {
    path: '/playlists',
    label: '歌单',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </svg>
    ),
  },
  {
    path: '/artists',
    label: '歌手',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    path: '/albums',
    label: '专辑',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    path: '/favorites',
    label: '收藏',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
  },
]

export default function TabBar() {
  const location = useLocation()

  return (
    <div className="glass">
      <div className="flex items-center justify-around h-[56px] safe-bottom">
        {tabs.map((tab) => {
          const isActive = location.pathname.startsWith(tab.path)
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              onClick={() => { if (!isActive) haptic('selection') }}
              className="flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 h-full relative"
            >
              <div className={`w-[22px] h-[22px] transition-colors duration-200 ${
                isActive ? 'text-gold-400' : 'text-text-muted'
              }`}>
                {tab.icon}
              </div>
              <span className={`text-[10px] font-semibold tracking-wide transition-colors duration-200 ${
                isActive ? 'text-gold-400' : 'text-text-muted'
              }`}>
                {tab.label}
              </span>
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-gold-400 rounded-full shadow-[0_0_5px_rgba(245,197,66,0.5)]" />
              )}
            </NavLink>
          )
        })}
      </div>
    </div>
  )
}
