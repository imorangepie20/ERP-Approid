import { expect, it, vi } from 'vitest'
import { createHttpClient } from './http'
import { fetchDashboard } from './dashboard'
import { dashboardFixture } from '../test/dashboardFixture'

it('uses the authenticated core read API with date/item filters and abort signal', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json(dashboardFixture()))
    const client = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch, getAccessToken: () => 'jwt' })
    const signal = new AbortController().signal
    expect((await fetchDashboard(client, { from: '2026-10-01', to: '2026-10-04', itemId: 7 }, signal)).kpis.revenueKrw).toBe(1400)
    const [url, init] = fetch.mock.calls[0]
    expect(String(url)).toBe('https://core.test/api/core/analytics/dashboard?from=2026-10-01&to=2026-10-04&itemId=7')
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer jwt')
    expect(init?.signal).toBe(signal)
})
it('accepts null rates for an empty cohort instead of fabricating zero percent', async () => {
    const d = dashboardFixture()
    Object.assign(d.kpis, { onTimeOrders: 0, eligibleDeliveryOrders: 0, onTimeDeliveryPercent: null, meanOrderDefectPercent: null, completedWorkOrders: 0 })
    const client = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch: vi.fn().mockResolvedValue(Response.json(d)) })
    expect((await fetchDashboard(client, { from: d.metadata.from, to: d.metadata.to })).kpis.onTimeDeliveryPercent).toBeNull()
})
it.each(['unsafe money', 'out of range rate', 'inconsistent trend', 'untrusted alert path', 'incorrect total', 'invalid date', 'missing null', 'invalid month'])('rejects %s with the response trace ID', async reason => {
    const d = dashboardFixture()
    if (reason === 'unsafe money') d.kpis.revenueKrw = Number.MAX_SAFE_INTEGER + 1
    if (reason === 'out of range rate') d.kpis.onTimeDeliveryPercent = 101
    if (reason === 'inconsistent trend') d.trends[0].revenueKrw = 20
    if (reason === 'untrusted alert path') d.alerts.rows[0].path = 'https://evil.test'
    if (reason === 'incorrect total') d.alerts.total = 4
    if (reason === 'invalid date') d.metadata.asOf = 'invalid'
    if (reason === 'missing null') Object.assign(d.kpis, { inventoryTurnover: undefined })
    if (reason === 'invalid month') d.trends[0].month = '2026-13'
    const client = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch: vi.fn().mockResolvedValue(Response.json(d, { headers: { 'X-Trace-Id': 'dashboard-invalid' } })) })
    await expect(fetchDashboard(client, { from: d.metadata.from, to: d.metadata.to })).rejects.toMatchObject({ code: 'INVALID_RESPONSE', traceId: 'dashboard-invalid' })
})
