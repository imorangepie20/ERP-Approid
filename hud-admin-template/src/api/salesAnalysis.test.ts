import { expect, it, vi } from 'vitest'
import { createHttpClient } from './http'
import { fetchSalesAnalysis } from './salesAnalysis'
import { salesAnalysisFixture } from '../test/salesAnalysisFixture'
const filters = { from: '2026-10-01', to: '2026-10-04', itemId: 7, customerId: 90, keyword: '고객_100%', scope: 'backlog', sort: 'dueDate,asc', page: 0, size: 20 }
it('uses authenticated core GET with literal customer search, filters, page and abort', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json(salesAnalysisFixture()))
    const signal = new AbortController().signal
    const client = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch, getAccessToken: () => 'jwt' })
    expect((await fetchSalesAnalysis(client, filters, signal)).summary.periodRevenueKrw).toBe(400)
    const [input, init] = fetch.mock.calls[0], url = new URL(String(input))
    expect(url.pathname).toBe('/api/core/analytics/sales/summary')
    expect(Object.fromEntries(url.searchParams)).toEqual({ ...filters, itemId: '7', customerId: '90', page: '0', size: '20' })
    expect(init?.method).toBe('GET'); expect(init?.signal).toBe(signal)
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer jwt')
})
it('preserves explicit unknown backlog rather than replacing it with a fabricated amount', async () => {
    const d = salesAnalysisFixture(); d.rows[0].historyUnknown = true; d.rows[0].currentBacklogKrw = null
    d.summary.unknownBacklogOrders = 1; d.summary.knownCurrentBacklogKrw = 0
    const client = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch: vi.fn().mockResolvedValue(Response.json(d)) })
    expect((await fetchSalesAnalysis(client, filters)).rows[0].currentBacklogKrw).toBeNull()
})
it.each(['unsafe money', 'negative money', 'invalid date', 'missing unit', 'bad scope', 'bad pages', 'unknown nonnull backlog',
    'missing nullable backlog', 'overdue exceeds open', 'cancelled exceeds orders', 'closed delayed', 'missing notes'])('rejects %s with trace', async reason => {
    const d = salesAnalysisFixture()
    if (reason === 'unsafe money') d.summary.periodOrderKrw = Number.MAX_SAFE_INTEGER + 1
    if (reason === 'negative money') d.rows[0].amountKrw = -1
    if (reason === 'invalid date') d.from = '2026-02-30'
    if (reason === 'missing unit') d.rows[0].unit = ''
    if (reason === 'bad scope') d.scope = 'bad'
    if (reason === 'bad pages') d.totalPages = 2
    if (reason === 'unknown nonnull backlog') d.rows[0].historyUnknown = true
    if (reason === 'missing nullable backlog') Object.assign(d.rows[0], { currentBacklogKrw: undefined })
    if (reason === 'overdue exceeds open') d.summary.currentOverdueReceivableKrw = 500
    if (reason === 'cancelled exceeds orders') d.summary.periodCancelledOrders = 2
    if (reason === 'closed delayed') d.rows[0].status = '출하완료'
    if (reason === 'missing notes') d.notes = []
    const client = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch: vi.fn().mockResolvedValue(Response.json(d, { headers: { 'X-Trace-Id': 'sales-invalid' } })) })
    await expect(fetchSalesAnalysis(client, filters)).rejects.toMatchObject({ code: 'INVALID_RESPONSE', traceId: 'sales-invalid' })
})
