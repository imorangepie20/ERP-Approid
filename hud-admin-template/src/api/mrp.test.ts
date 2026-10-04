import { expect, it, vi } from 'vitest'
import { createHttpClient } from './http'
import { addDateDays, fetchMrp, createMrpPurchase } from './mrp'
import { mrpFixture, mrpPurchaseFixture } from '../test/mrpFixture'

it('reads Spring with exact filters, JWT and abort signal', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json(mrpFixture()))
    const client = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch, getAccessToken: () => 'jwt' })
    const signal = new AbortController().signal
    expect((await fetchMrp(client, { through: '2027-01-02', itemId: 7, page: 0, size: 50 }, signal)).rows[0].suggestedPurchaseQty).toBe(51.55)
    const [url, init] = fetch.mock.calls[0]
    expect(String(url)).toBe('https://core.test/api/core/analytics/mrp/suggestions?through=2027-01-02&page=0&size=50&itemId=7')
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer jwt')
    expect(init?.signal).toBe(signal)
})
it.each(['quantity', 'unit', 'action', 'page', 'stock', 'wrong purchase type'])('rejects invalid %s with trace', async reason => {
    const d = mrpFixture()
    if (reason === 'quantity') d.rows[0].netRequirement = NaN
    if (reason === 'unit') d.rows[0].unit = ''
    if (reason === 'action') d.rows[0].action = 'UNKNOWN'
    if (reason === 'page') d.totalPages = 2
    if (reason === 'stock') d.rows[0].usableStock = 11
    if (reason === 'wrong purchase type') d.rows[0].itemType = '제품'
    const client = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch: vi.fn().mockResolvedValue(Response.json(d, { headers: { 'X-Trace-Id': 'mrp-invalid' } })) })
    await expect(fetchMrp(client, { through: d.through, page: 0, size: 50 })).rejects.toMatchObject({ code: 'INVALID_RESPONSE', traceId: 'mrp-invalid' })
})
it('writes an actual purchase order with chosen vendor and server proposal quantity', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json(mrpPurchaseFixture(), { status: 201 }))
    const client = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch })
    const input = { purchaseOrderNo: 'PO-MRP-LIVE', vendorId: 8, itemId: 7, qty: 51.55, unitPrice: 100, dueDate: '2026-10-20' }
    expect((await createMrpPurchase(client, input)).amount).toBe(5155)
    expect(String(fetch.mock.calls[0][0])).toBe('https://core.test/api/core/purchase-orders')
    expect(fetch.mock.calls[0][1]?.method).toBe('POST')
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual(input)
})
it('preserves purchase validation errors instead of pretending conversion succeeded', async () => {
    const client = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch: vi.fn().mockResolvedValue(Response.json({ code: 'INVALID_INPUT', message: '단가 범위 오류' }, { status: 400, headers: { 'X-Trace-Id': 'mrp-price' } })) })
    await expect(createMrpPurchase(client, { purchaseOrderNo: 'PO', vendorId: 8, itemId: 7, qty: 1, unitPrice: 100, dueDate: '2026-10-20' })).rejects.toMatchObject({ code: 'INVALID_INPUT', traceId: 'mrp-price' })
})
it('accepts an empty plan and calculates date-only lead time across year boundaries', async () => {
    const d = mrpFixture(); d.rows = []; d.totalElements = 0; d.totalPages = 0
    const client = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch: vi.fn().mockResolvedValue(Response.json(d)) })
    expect((await fetchMrp(client, { through: d.through, page: 0, size: 50 })).rows).toEqual([])
    expect(addDateDays('2026-12-31', 1)).toBe('2027-01-01')
})
