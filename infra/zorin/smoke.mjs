// Read-only browser smoke against the deployed demo, not transactional Phase 1 E2E.
import { chromium } from '../../hud-admin-template/node_modules/playwright/index.mjs'
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { strict as assert } from 'node:assert'

const credentials = JSON.parse(execFileSync('ssh', [
    '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', 'approid@192.168.219.174',
    'cat /home/approid/erp-approid/secrets/initial-admin.json',
], { encoding: 'utf8' }))
const directory = 'hud-admin-template/test-results/deploy-demo'
mkdirSync(directory, { recursive: true })
const browser = await chromium.launch({ headless: true })
try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    const errors = [], apiResponses = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('response', response => {
        if (response.url().includes('/api/core/')) apiResponses.push([response.url(), response.status()])
    })
    const response = await page.goto('https://erp.approid.team/', { waitUntil: 'networkidle' })
    assert.equal(response.status(), 200)
    await page.waitForURL('**/login')
    await page.locator('#username').fill(credentials.username)
    await page.locator('#password').fill(credentials.password)
    const dashboardLoaded = page.waitForResponse(r => r.url().includes('/api/core/analytics/') && r.status() === 200)
    await page.getByRole('button', { name: '로그인', exact: true }).click()
    await page.waitForURL('https://erp.approid.team/')
    await dashboardLoaded
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: `${directory}/dashboard.png`, fullPage: true })
    await page.goto('https://erp.approid.team/inventory/lots', { waitUntil: 'networkidle' })
    assert(apiResponses.some(([url, status]) => url.includes('/lot-traces') && status === 200))
    assert(await page.getByRole('cell', { name: /LOT-/ }).count() > 0)
    await page.screenshot({ path: `${directory}/lots.png`, fullPage: true })
    assert.equal(errors.length, 0, 'Browser runtime errors')
    assert(apiResponses.every(([url]) => url.startsWith('https://erp.approid.team/')))
    assert(!apiResponses.some(([, status]) => status >= 500))
    console.log(`PASS browser: HTTPS login, analytics dashboard, real Lot listing; ${apiResponses.length} same-origin API responses; no runtime errors`)
    console.log(`Screenshots: ${directory}/dashboard.png, ${directory}/lots.png`)
} finally {
    await browser.close()
}
