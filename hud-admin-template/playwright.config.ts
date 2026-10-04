import { defineConfig, devices } from '@playwright/test'

// Fixed loopback ports prevent accidental transactions against the normal app.
if (process.env.E2E_ISOLATED !== 'true') throw new Error('Start docker-compose.e2e.yml, then set E2E_ISOLATED=true. Never run on the development DB.')
export default defineConfig({
    testDir: './e2e', fullyParallel: false, workers: 1, retries: 0, forbidOnly: true,
    timeout: 90000, expect: { timeout: 15000 }, outputDir: 'test-results',
    reporter: [['list'], ['html', { open: 'never' }], ['junit', { outputFile: 'test-results/e2e.xml' }]],
    use: { baseURL: 'http://127.0.0.1:3001', trace: 'retain-on-failure', screenshot: 'only-on-failure',
        video: 'retain-on-failure', actionTimeout: 15000 },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: 'npm run dev -- --host 127.0.0.1 --port 3001 --strictPort',
        url: 'http://127.0.0.1:3001', reuseExistingServer: false,
        env: {
            VITE_API_CORE_URL: 'http://127.0.0.1:38081/api/core',
            // Required client configuration only; analytics is not implemented or used by Phase 1.
            VITE_API_ANALYTICS_URL: 'http://127.0.0.1:38082/api/analytics',
        },
    },
})
