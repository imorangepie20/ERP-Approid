/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                // HUD Theme Colors - CSS Variable based
                hud: {
                    bg: {
                        primary: 'var(--hud-bg-primary)',
                        secondary: 'var(--hud-bg-secondary)',
                        card: 'var(--hud-bg-card)',
                        hover: 'var(--hud-bg-hover)',
                    },
                    accent: {
                        primary: 'var(--hud-accent-primary)',
                        secondary: 'var(--hud-accent-secondary)',
                        warning: 'var(--hud-accent-warning)',
                        info: 'var(--hud-accent-info)',
                        success: 'var(--hud-accent-success)',
                        danger: 'var(--hud-accent-danger)',
                    },
                    text: {
                        primary: 'var(--hud-text-primary)',
                        secondary: 'var(--hud-text-secondary)',
                        muted: 'var(--hud-text-muted)',
                    },
                    border: {
                        primary: 'var(--hud-border-primary)',
                        secondary: 'var(--hud-border-secondary)',
                    }
                }
            },
            fontFamily: {
                sans: ['Inter', 'Roboto', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
            },
            boxShadow: {
                'hud': 'var(--hud-shadow)',
                'hud-glow': 'var(--hud-shadow-glow)',
                'hud-pink': '0 0 20px rgba(var(--hud-glow-pink-rgb), 0.3)',
            },
            animation: {
                'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
                'fade-in': 'fadeIn 0.3s ease-out',
                'slide-in': 'slideIn 0.3s ease-out',
            },
            keyframes: {
                'pulse-glow': {
                    '0%, 100%': { boxShadow: '0 0 20px rgba(var(--hud-glow-primary-rgb), 0.2)' },
                    '50%': { boxShadow: '0 0 40px rgba(var(--hud-glow-primary-rgb), 0.4)' },
                },
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideIn: {
                    '0%': { transform: 'translateX(-10px)', opacity: '0' },
                    '100%': { transform: 'translateX(0)', opacity: '1' },
                },
            },
            backgroundImage: {
                'hud-grid': `
          linear-gradient(var(--hud-grid-color) 1px, transparent 1px),
          linear-gradient(90deg, var(--hud-grid-color) 1px, transparent 1px)
        `,
            },
            backgroundSize: {
                'grid': '50px 50px',
            },
        },
    },
    plugins: [],
}
