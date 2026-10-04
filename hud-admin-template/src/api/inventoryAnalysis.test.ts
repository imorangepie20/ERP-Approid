import { expect, it, vi } from 'vitest'
import { createHttpClient } from './http'
import { fetchInventoryAnalysis } from './inventoryAnalysis'
import { inventoryAnalysisFixture } from '../test/inventoryAnalysisFixture'
const filters = { from: '2026-10-01', to: '2026-10-04', ageDays: 91, itemId: 7, itemType: '자재', risk: 'ledger', keyword: '재고_100%', sort: 'stockLedgerDelta,asc', page: 0, size: 20 }
it('uses authenticated core GET with literal filters and abort without any writes', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json(inventoryAnalysisFixture()))
    const signal = new AbortController().signal
    const client = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch, getAccessToken: () => 'jwt' })
    const d = await fetchInventoryAnalysis(client, filters, signal)
    expect(d.summary.inventoryTurnover).toBeNull(); expect(d.rows[0].unit).toBe('kg')
    const [input, init] = fetch.mock.calls[0], url = new URL(String(input))
    expect(url.pathname).toBe('/api/core/analytics/inventory/summary')
    expect(Object.fromEntries(url.searchParams)).toEqual({ ...filters, ageDays: '91', itemId: '7', page: '0', size: '20' })
    expect(init?.method).toBe('GET'); expect(init?.signal).toBe(signal)
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer jwt')
})
it('preserves signed ledger differences and decreases without fabricating a ratio', async () => {
    const d = inventoryAnalysisFixture(); d.rows[0].ledgerBalance = -2; d.rows[0].stockLedgerDelta = 32; d.rows[0].periodNetQty = -5
    const client = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch: vi.fn().mockResolvedValue(Response.json(d)) })
    expect((await fetchInventoryAnalysis(client, filters)).rows[0].periodNetQty).toBe(-5)
})
it.each(['unsafe qty', 'negative subset', 'invalid date', 'missing unit', 'bad risk', 'bad pages', 'bad age', 'ratio fabricated',
    'missing nullable ratio', 'subset exceeds lots', 'count exceeds items', 'invalid lots count', 'missing notes', 'bad type'])('rejects %s with trace', async reason => {
    const d = inventoryAnalysisFixture()
    if (reason === 'unsafe qty') d.rows[0].currentStock = 1e14
    if (reason === 'negative subset') d.rows[0].heldLotQty = -1
    if (reason === 'invalid date') d.from = '2026-02-30'
    if (reason === 'missing unit') d.rows[0].unit = ''
    if (reason === 'bad risk') d.risk = 'unknown'
    if (reason === 'bad pages') d.totalPages = 2
    if (reason === 'bad age') d.ageDays = 0
    if (reason === 'ratio fabricated') Object.assign(d.summary, { inventoryTurnover: 2.5 })
    if (reason === 'missing nullable ratio') Object.assign(d.summary, { inventoryTurnover: undefined })
    if (reason === 'subset exceeds lots') d.rows[0].knownUsableLotQty = 26
    if (reason === 'count exceeds items') d.summary.agedItems = 2
    if (reason === 'invalid lots count') d.rows[0].invalidLots = 5
    if (reason === 'missing notes') d.notes = []
    if (reason === 'bad type') d.rows[0].itemType = '창고'
    const client = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch: vi.fn().mockResolvedValue(Response.json(d, { headers: { 'X-Trace-Id': 'inventory-invalid' } })) })
    await expect(fetchInventoryAnalysis(client, filters)).rejects.toMatchObject({ code: 'INVALID_RESPONSE', traceId: 'inventory-invalid' })
})
