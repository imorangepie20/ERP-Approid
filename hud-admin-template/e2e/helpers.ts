import { expect, type Page, type APIRequestContext, type Locator } from '@playwright/test'
import type { components } from '../src/api/generated/core'

export const api = 'http://127.0.0.1:38081/api/core'
export async function login(page: Page, username = 'admin') {
    await page.goto('/login')
    await page.getByLabel('사용자명').fill(username)
    await page.getByLabel('비밀번호', { exact: true }).fill('admin123')
    await page.getByRole('button', { name: '로그인', exact: true }).click()
    await expect(page).not.toHaveURL(/\/login/)
}
export async function authenticated(request: APIRequestContext, username = 'admin') {
    const response = await request.post(`${api}/auth/login`, { data: { username, password: 'admin123' } })
    expect(response.status()).toBe(200)
    const result = await response.json()
    return { Authorization: `Bearer ${result.accessToken}` }
}
export async function read(request: APIRequestContext, path: string, headers: Record<string, string>) {
    const response = await request.get(`${api}/${path}`, { headers })
    expect(response.status(), path).toBe(200)
    return response.json()
}
export async function search(page: Page, placeholder: string, value: string): Promise<Locator> {
    await page.getByPlaceholder(placeholder).fill(value)
    const row = page.getByRole('row').filter({ has: page.getByText(value, { exact: true }) })
    await expect(row).toHaveCount(1)
    return row
}
export async function transition(page: Page, row: Locator, label: string) {
    await row.getByRole('button', { name: label, exact: true }).click()
    const confirm = page.getByRole('button', { name: `${label} 확인`, exact: true })
    await confirm.click()
    await expect(confirm).toBeHidden()
}
export const futureDate = () => new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

export async function newItem(request: APIRequestContext, headers: Record<string, string>, itemType = '제품') {
    const response = await request.post(`${api}/items`, { headers, data: {
        itemNo: `E2E-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: 'E2E isolated item',
        itemType, unit: 'EA', price: 100, safetyStock: 0, leadTimeDays: 0,
    } })
    expect(response.status()).toBe(201)
    const item: Required<components['schemas']['ItemResponse']> = await response.json()
    expect(item.stock).toBe(0)
    return item
}

// Observe the real HTTP mutation; no mocked network or memory-only fallback.
export function mutation(page: Page, suffix: string, status = 200) {
    return page.waitForResponse(response => response.url().endsWith(`/api/core/${suffix}`)
        && response.request().method() === 'POST').then(async response => {
        expect(response.status(), suffix).toBe(status)
        return response.json()
    })
}
