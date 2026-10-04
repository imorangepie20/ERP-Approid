import { expect, it, vi } from 'vitest'
import { createHttpClient } from './http'
import { fetchProductionAnalysis } from './productionAnalysis'
import { productionAnalysisFixture } from '../test/productionAnalysisFixture'

const filters = { from: '2026-09-04', to: '2026-11-03', status: 'active', keyword: '현장_100%', sort: 'dueDate,asc', page: 0, size: 20, itemId: 7 }
it('sends authenticated read filters with once-encoded literal search and abort signal', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json(productionAnalysisFixture()))
    const client = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch, getAccessToken: () => 'jwt' })
    const signal = new AbortController().signal
    expect((await fetchProductionAnalysis(client, filters, signal)).rows[0].remainingQty).toBe(5)
    const [input, init] = fetch.mock.calls[0], url = new URL(String(input))
    expect(url.pathname).toBe('/api/core/analytics/production/progress')
    expect(Object.fromEntries(url.searchParams)).toEqual({ ...filters, itemId: '7', page: '0', size: '20' })
    expect(init?.method).toBe('GET')
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer jwt')
    expect(init?.signal).toBe(signal)
})
it('accepts empty cohorts and explicit over-actual history without substituting zero rates', async () => {
    const d = productionAnalysisFixture()
    Object.assign(d.summary, { activeOrders: 0, completedOrders: 1, delayedOrders: 0, unassignedActiveOrders: 0,
        overActualOrders: 1, eligibleActiveOrders: 0, eligibleYieldOrders: 0, meanActiveProgressPercent: null, meanReportedYieldPercent: null })
    Object.assign(d.rows[0], { status: '마감', goodQty: 11, remainingQty: 0, overActual: true, delayed: false, progressPercent: null, yieldPercent: null })
    const client = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch: vi.fn().mockResolvedValue(Response.json(d)) })
    expect((await fetchProductionAnalysis(client, filters)).summary.meanActiveProgressPercent).toBeNull()
})
it.each(['bad date', 'bad rate', 'negative quantity', 'missing unit', 'summary total', 'page total', 'missing nullable rate',
    'over-actual rate', 'closed delay', 'invalid priority', 'missing notes', 'nonfinite snapshot'])('rejects %s with trace evidence', async reason => {
    const d = productionAnalysisFixture()
    if (reason === 'bad date') d.rows[0].dueDate = '2026-02-30'
    if (reason === 'bad rate') d.rows[0].yieldPercent = 101
    if (reason === 'negative quantity') d.rows[0].remainingQty = -1
    if (reason === 'missing unit') d.rows[0].unit = ''
    if (reason === 'summary total') d.summary.totalOrders = 2
    if (reason === 'page total') d.totalPages = 5
    if (reason === 'missing nullable rate') Object.assign(d.summary, { meanReportedYieldPercent: undefined })
    if (reason === 'over-actual rate') d.rows[0].overActual = true
    if (reason === 'closed delay') d.rows[0].status = '완료'
    if (reason === 'invalid priority') d.rows[0].priority = 4
    if (reason === 'missing notes') d.notes = []
    if (reason === 'nonfinite snapshot') d.asOf = 'invalid'
    const client = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch: vi.fn().mockResolvedValue(Response.json(d, { headers: { 'X-Trace-Id': 'production-invalid' } })) })
    await expect(fetchProductionAnalysis(client, filters)).rejects.toMatchObject({ code: 'INVALID_RESPONSE', traceId: 'production-invalid' })
})
