import { beforeEach, expect, it, vi } from 'vitest'
import { createHttpClient } from './http'
import { disposeLot } from './lots'

const row = (overrides = {}) => ({ id: 21, lotNo: 'LOT-LIVE', itemId: 9, itemNo: 'M-LIVE', itemName: '실제 자재',
    warehouse: '자재창고', qty: 0, producedAt: '2026-10-01', expiry: null, status: '폐기', expiringSoon: false, ...overrides })

beforeEach(() => { vi.unstubAllGlobals() })

it('disposes a lot and reports the zeroed scrapped state', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json(row()))
    const core = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch, getAccessToken: () => 'jwt' })
    const result = await disposeLot(core, 21)
    expect(result.status).toBe('폐기')
    expect(result.qty).toBe(0)
    expect(fetch.mock.calls[0][1]?.method).toBe('POST')
    expect(String(fetch.mock.calls[0][0])).toContain('/lots/21/dispose')
    await expect(disposeLot(core, 0)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
})

it('rejects malformed disposal responses', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
        Response.json({ ...row(), status: 'UNKNOWN' }, { headers: { 'X-Trace-Id': 'trace-lot' } }))
    const core = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch, getAccessToken: () => 'jwt' })
    await expect(disposeLot(core, 21)).rejects.toMatchObject({ code: 'INVALID_RESPONSE', traceId: 'trace-lot' })
})
