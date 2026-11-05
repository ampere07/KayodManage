/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Height-aware breakpoints for pages that fill the window instead of
      // scrolling (the Dashboard). `fit` is a laptop or desktop window (1280px
      // or wider, every laptop size) tall enough to hold the whole page;
      // `compact` and `tight` are shorter ones, where secondary lines give way.
      // Extended screens come after the width breakpoints in the CSS, so they
      // win over sm:/lg:/xl: when both apply.
      screens: {
        fit: { raw: '(min-width: 1280px) and (min-height: 600px)' },
        compact: { raw: '(min-width: 1280px) and (max-height: 820px)' },
        tight: { raw: '(min-width: 1280px) and (max-height: 700px)' },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
        'ping-slow': 'ping 3s cubic-bezier(0, 0, 0.2, 1) infinite',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'slide-up': 'slide-up 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}