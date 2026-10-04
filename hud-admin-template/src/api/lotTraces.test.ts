import { expect, it, vi } from 'vitest'
import { createHttpClient } from './http'
import { fetchLotTrace, fetchLotTracePage } from './lotTraces'
import { lotTraceDetail, lotTracePage } from '../test/lotTraceFixture'
const filters = { itemId: 9, status: '보류', warehouse: '창고_100%', keyword: 'Lot_100%', sort: 'expiry,desc', page: 0, size: 10 }
it('reads the paged resource with JWT, literal filters and abort; does not change the legacy lots API', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json(lotTracePage())), signal = new AbortController().signal
    const client = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch, getAccessToken: () => 'jwt' })
    expect((await fetchLotTracePage(client, filters, signal)).rows[0].unit).toBe('kg')
    const [input, init] = fetch.mock.calls[0], url = new URL(String(input))
    expect(url.pathname).toBe('/api/core/lot-traces'); expect(url.searchParams.get('keyword')).toBe('Lot_100%')
    expect(url.searchParams.get('warehouse')).toBe('창고_100%'); expect(url.searchParams.get('itemId')).toBe('9')
    expect(init?.signal).toBe(signal); expect(init?.method).toBe('GET'); expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer jwt')
})
it('preserves negative source quantities and nullable unlinked references', async () => {
    const d = lotTraceDetail(); Object.assign(d.movements.content[0], { qty: -5, sourceType: 'UNLINKED', sourceId: null, sourceNo: null, refType: null, refNo: null })
    const fetch = vi.fn().mockResolvedValue(Response.json(d)), client = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch })
    const data = await fetchLotTrace(client, 7, 0)
    expect(data.movements.rows[0].qty).toBe(-5); expect(data.movements.rows[0].sourceId).toBeNull()
    expect(String(fetch.mock.calls[0][0])).toContain('/lot-traces/7?page=0&size=20')
})
it.each(['bad date', 'missing unit', 'unsafe qty', 'missing expiry', 'bad status', 'bad flag', 'different lot', 'missing notes', 'bad timezone', 'unlinked id', 'linked no id', 'bad source'])('rejects %s with trace', async reason => {
    const d = lotTraceDetail()
    if (reason === 'bad date') d.lot.producedAt = '2026-02-30'
    if (reason === 'missing unit') d.lot.unit = ''
    if (reason === 'unsafe qty') d.lot.qty = 1e14
    if (reason === 'missing expiry') Object.assign(d.lot, { expiry: undefined })
    if (reason === 'bad status') d.lot.status = '가용'
    if (reason === 'bad flag') Object.assign(d.lot, { expired: 'yes' })
    if (reason === 'different lot') d.lot.id = 8
    if (reason === 'missing notes') d.notes = []
    if (reason === 'bad timezone') d.timeZone = 'UTC'
    if (reason === 'unlinked id') d.movements.content[0].sourceType = 'UNLINKED'
    if (reason === 'linked no id') d.movements.content[0].sourceId = null
    if (reason === 'bad source') d.movements.content[0].sourceType = 'GUESSED'
    const client = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch: vi.fn().mockResolvedValue(Response.json(d, { headers: { 'X-Trace-Id': 'trace-invalid' } })) })
    await expect(fetchLotTrace(client, 7, 0)).rejects.toMatchObject({ code: 'INVALID_RESPONSE', traceId: 'trace-invalid' })
})
