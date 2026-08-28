/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#e8eef8',
          100: '#c5d3ee',
          200: '#9fb5e2',
          300: '#7897d6',
          400: '#5a80ce',
          500: '#3d6ac5',
          600: '#2d5ab8',
          700: '#1e48a5',
          800: '#143990',
          900: '#0b3d91',
          950: '#072d6e',
        },
        gold: {
          50: '#fef9ed',
          100: '#fdf0cc',
          200: '#fbe09a',
          300: '#f8ca5e',
          400: '#f5a623',
          500: '#f39011',
          600: '#d96d0a',
          700: '#b44f0c',
          800: '#923d10',
          900: '#783310',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Poppins', 'system-ui', 'sans-serif'],
      },
      animation: {
        'typing': 'typing 1.2s steps(3) infinite',
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        typing: {
          '0%, 100%': { opacity: '0.2' },
          '50%': { opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        }
      },
      boxShadow: {
        'card': '0 4px 20px rgba(11, 61, 145, 0.08)',
        'card-hover': '0 8px 30px rgba(11, 61, 145, 0.15)',
      }
    },
  },
  plugins: [],
}
