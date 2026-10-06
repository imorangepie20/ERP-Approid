import { beforeEach, expect, it, vi } from 'vitest'
import { createHttpClient } from './http'
import {
    cancelPurchaseOrder, createPurchaseOrder, deletePurchaseOrder, fetchPurchaseOrder,
    fetchPurchaseOrderPage, updatePurchaseOrder,
} from './purchaseOrders'

const row = (overrides = {}) => ({ id: 11, purchaseOrderNo: 'PO-2610-001', vendorId: 3, vendorName: '공급사',
    itemId: 7, itemNo: 'RM-001', itemName: '원자재', qty: 600, receivedQty: 0, unitPrice: 1200, amount: 720000,
    dueDate: '2026-10-20', status: '발주', ...overrides })
const input = () => ({ purchaseOrderNo: 'PO-2610-009', vendorId: 3, itemId: 7, qty: 600, unitPrice: 1200, dueDate: '2026-10-20' })
const json = (data: unknown, status: number) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

beforeEach(() => { vi.unstubAllGlobals() })

it('reads a server-paged order list with status and vendor filters', async () => {
    const page = { content: [row()], number: 0, size: 20, totalElements: 1, totalPages: 1 }
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json(page))
    const core = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch, getAccessToken: () => 'jwt' })
    const result = await fetchPurchaseOrderPage(core, { status: '발주', vendorId: 3, page: 0, size: 20, sort: 'purchaseOrderNo,asc' })
    expect(result.rows[0].purchaseOrderNo).toBe('PO-2610-001')
    const url = String(fetch.mock.calls[0][0])
    expect(url).toContain('purchase-orders?page=0')
    expect(url).toContain('status=')
    await expect(fetchPurchaseOrderPage(core, { status: 'UNKNOWN', page: 0, size: 20, sort: 'purchaseOrderNo,asc' })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(fetchPurchaseOrderPage(core, { page: -1, size: 20, sort: 'purchaseOrderNo,asc' })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
})

it('reads order detail and rejects malformed rows', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json(row()))
    const core = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch, getAccessToken: () => 'jwt' })
    expect((await fetchPurchaseOrder(core, 11)).receivedQty).toBe(0)
    expect(String(fetch.mock.calls[0][0])).toContain('/purchase-orders/11')
    fetch.mockResolvedValue(Response.json({ ...row(), status: 'UNKNOWN' }, { headers: { 'X-Trace-Id': 'trace-po' } }))
    await expect(fetchPurchaseOrder(core, 11)).rejects.toMatchObject({ code: 'INVALID_RESPONSE', traceId: 'trace-po' })
})

it('creates an order and validates client input before sending', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(json(row(), 201))
    const core = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch, getAccessToken: () => 'jwt' })
    expect((await createPurchaseOrder(core, input())).purchaseOrderNo).toBe('PO-2610-001')
    expect(fetch.mock.calls[0][1]?.method).toBe('POST')
    for (const bad of [{ ...input(), purchaseOrderNo: '' }, { ...input(), vendorId: 0 }, { ...input(), qty: 0 },
        { ...input(), unitPrice: -1 }, { ...input(), dueDate: '2026/10/20' }]) {
        await expect(createPurchaseOrder(core, bad as never)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    }
    expect(fetch.mock.calls.filter(([, init]) => init?.method === 'POST').length).toBe(1)
})

it('updates an order with PATCH and deletes with an empty 204', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json(row({ qty: 700 })))
    const core = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch, getAccessToken: () => 'jwt' })
    const updated = await updatePurchaseOrder(core, 11, input())
    expect(updated.qty).toBe(700)
    expect(fetch.mock.calls[0][1]?.method).toBe('PATCH')
    fetch.mockResolvedValue(new Response(null, { status: 204 }))
    await deletePurchaseOrder(core, 11)
    expect(fetch.mock.calls[1][1]?.method).toBe('DELETE')
    await expect(updatePurchaseOrder(core, 0, input())).rejects.toMatchObject({ code: 'INVALID_INPUT' })
})

it('cancels an open order and reports the closed state', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json(row({ status: '취소' })))
    const core = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch, getAccessToken: () => 'jwt' })
    expect((await cancelPurchaseOrder(core, 11)).status).toBe('취소')
    expect(fetch.mock.calls[0][1]?.method).toBe('POST')
    expect(String(fetch.mock.calls[0][0])).toContain('/purchase-orders/11/cancel')
})
