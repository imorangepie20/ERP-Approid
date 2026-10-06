import { beforeEach, expect, it, vi } from 'vitest'
import { createHttpClient } from './http'
import { adjustStock } from './inventory'

const row = (overrides = {}) => ({ itemId: 9, itemNo: 'M-LIVE', itemName: '실제 자재', previousStock: 100,
    ledgerBalance: 40, countedQty: 130, adjustedQty: 90, txnNo: 'IVT-LIVE', txnType: '실사', txnDate: '2026-10-06', ...overrides })
const input = () => ({ itemId: 9, countedQty: 130, warehouse: '자재창고', reason: '월말 실사' })

beforeEach(() => { vi.unstubAllGlobals() })

it('records a stocktaking adjustment against the ledger balance', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
        new Response(JSON.stringify(row()), { status: 201, headers: { 'Content-Type': 'application/json' } }))
    const core = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch, getAccessToken: () => 'jwt' })
    const result = await adjustStock(core, input())
    expect(result.adjustedQty).toBe(90)
    expect(result.txnType).toBe('실사')
    expect(fetch.mock.calls[0][1]?.method).toBe('POST')
    expect(String(fetch.mock.calls[0][0])).toContain('/inventory/adjustments')
    for (const bad of [{ ...input(), itemId: 0 }, { ...input(), countedQty: -1 }, { ...input(), warehouse: '' },
        { ...input(), warehouse: 'x'.repeat(33) }, { ...input(), reason: '' }, { ...input(), reason: 'x'.repeat(201) }]) {
        await expect(adjustStock(core, bad as never)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    }
    expect(fetch.mock.calls.filter(([, init]) => init?.method === 'POST').length).toBe(1)
})

it('rejects malformed adjustment responses', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
        Response.json({ ...row(), txnType: 'UNKNOWN' }, { headers: { 'X-Trace-Id': 'trace-adj' } }))
    const core = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch, getAccessToken: () => 'jwt' })
    await expect(adjustStock(core, input())).rejects.toMatchObject({ code: 'INVALID_RESPONSE', traceId: 'trace-adj' })
})
