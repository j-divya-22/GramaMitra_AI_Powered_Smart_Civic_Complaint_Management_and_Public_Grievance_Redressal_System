/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          ink: '#1F4736',
          'ink-dark': '#143426',
          'ink-soft': '#3E7255',
        },
        surface: {
          canvas: '#F7E0C4',
          card: '#FFF8EE',
          subtle: '#F1D2AE',
        },
        saffron: {
          DEFAULT: '#F29B38',
          muted: '#9C4F18',
          soft: '#FFC173',
          light: '#FDE8CC',
        },
        chakra: {
          DEFAULT: '#2D66B2',
          light: '#E3EEFC',
        },
        neutral: {
          text: '#25352D',
          muted: '#58665C',
          light: '#E9D1B6',
        },
        success: '#2F6B4F',
        warning: '#8C4F0C',
        error: '#B42318',
        info: '#2D5F91',
      },
      fontFamily: {
        sans: ['"Inter"', '"Noto Sans"', 'sans-serif'],
        display: ['"Playfair Display"', '"Noto Serif"', 'serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.6s ease-out forwards',
        'float': 'float 6s ease-in-out infinite',
        'pulse-soft': 'pulseSoft 4s ease-in-out infinite',
        'waveform': 'waveform 0.5s ease-in-out infinite',
        'slide-in-right': 'slideInRight 0.4s ease-out forwards',
        'slide-out-right': 'slideOutRight 0.4s ease-in forwards',
        'slide-in-left': 'slideInLeft 0.4s ease-out forwards',
        'slide-out-left': 'slideOutLeft 0.4s ease-in forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-15px)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '0.9', transform: 'scale(1.05)' },
        },
        waveform: {
          '0%, 100%': { height: '4px' },
          '50%': { height: '16px' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideOutRight: {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(100%)', opacity: '0' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideOutLeft: {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(-100%)', opacity: '0' },
        },
      },
      boxShadow: {
        'premium': '0 20px 40px -10px rgba(31, 71, 54, 0.14)',
        'saffron': '0 0 30px rgba(242, 155, 56, 0.24)',
        'card': '0 4px 20px -4px rgba(37, 53, 45, 0.08)',
      },
      dropShadow: {
        'saffron': '0 0 16px rgba(242, 155, 56, 0.38)',
      },
      borderRadius: {
        'premium': '24px',
        'xl': '32px',
        'full': '9999px',
      },
    },
  },
  plugins: [],
}
