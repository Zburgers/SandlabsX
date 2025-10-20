/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'lab-dark': '#0a0e27',
        'lab-darker': '#060914',
        'lab-primary': '#00d9ff',
        'lab-secondary': '#7b2cbf',
        'lab-accent': '#10b981',
        'lab-danger': '#ef4444',
        'lab-warning': '#f59e0b',
        'lab-gray': '#1e293b',
        'lab-gray-light': '#334155',
      },
      fontFamily: {
        mono: ['Fira Code', 'Courier New', 'monospace'],
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
    },
  },
  plugins: [],
}
