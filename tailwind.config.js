/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        obsidian: {
          900: '#060608', // true black
          800: '#0C0C10', // deep space
          700: '#121215', // surface primary
          600: '#1A1A1E', // surface elevated
          500: '#24242A', // surface highlight
        },
        gold: {
          400: '#F5C542', // primary accent
          500: '#E8B830', // hover/pressed
          300: '#F9D97A', // light accent
          200: '#FCE9B3', // subtle highlight
        },
        text: {
          primary: '#FFFFFF',
          secondary: '#9E9EA4',
          muted: '#6A6A70',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont',
          '"SF Pro Text"', '"Helvetica Neue"',
          '"PingFang SC"', '"Noto Sans SC"',
          'sans-serif',
        ],
        display: [
          '"SF Pro Display"', '-apple-system',
          'BlinkMacSystemFont', 'sans-serif',
        ],
      },
      animation: {
        'slide-up': 'slideUp 0.45s cubic-bezier(0.22, 0.61, 0.36, 1)',
        'slide-up-mini': 'slideUpMini 0.35s cubic-bezier(0.22, 0.61, 0.36, 1)',
        'fade-in': 'fadeIn 0.35s ease-out',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.22, 0.61, 0.36, 1)',
        'pulse-glow': 'pulseGlow 3s ease-in-out infinite',
        'stagger-fade': 'staggerFade 0.5s ease-out both',
        'breathe': 'breathe 8s ease-in-out infinite',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(120%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideUpMini: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.92)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.4', filter: 'blur(60px)' },
          '50%': { opacity: '0.7', filter: 'blur(40px)' },
        },
        staggerFade: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        breathe: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.03)' },
        },
      },
      backdropBlur: {
        xs: '2px',
        glass: '24px',
        heavy: '40px',
      },
    },
  },
  plugins: [],
}
