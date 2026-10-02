import { expect, it, vi } from 'vitest'
import { createHttpClient } from './http'
import { actOnWorkOrder, fetchWorkOrder, fetchWorkOrderPage } from './workOrders'

const order = { id: 42, workOrderNo: 'WO-LIVE', itemId: 7, itemNo: 'P-LIVE', itemName: '제품', qty: 10,
    goodQty: 8, defectQty: 2, progress: 100, startDate: '2026-10-02', dueDate: '2026-12-31', status: '완료',
    delayed: false, assignee: '', priority: 1, plannedTimeHours: 0, subcontractTimeHours: 0, routingSteps: [] }
function client(value: unknown) {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json(value, { headers: { 'X-Trace-Id': 'wo-response' } }))
    return { fetch, http: createHttpClient({ baseUrl: 'https://core.test/api/core', fetch }) }
}

it('normalizes omitted nullable sales fields and preserves historical over-quantity closed actuals', async () => {
    const { http } = client({ ...order, status: '마감', defectQty: 3 })
    expect(await fetchWorkOrder(http, 42)).toMatchObject({ salesOrderId: null, salesOrderNo: null, defectQty: 3 })
})

it.each([
    { priority: 4 }, { priority: 1.5 }, { assignee: null }, { progress: 101 }, { status: 'unknown' },
    { goodQty: -1 }, { salesOrderId: -1 }, { routingSteps: [{ routingId: 1 }] },
])('rejects malformed work-order responses with trace IDs (%j)', async invalid => {
    const { http } = client({ ...order, ...invalid })
    await expect(fetchWorkOrder(http, 42)).rejects.toMatchObject({ code: 'INVALID_RESPONSE', traceId: 'wo-response' })
})

it('sends all server list parameters and validates page metadata', async () => {
    const { http, fetch } = client({ content: [order], number: 1, size: 5, totalElements: 6, totalPages: 2 })
    const result = await fetchWorkOrderPage(http, { keyword: ' SO-LIVE ', status: '완료', itemId: 7, salesOrderId: 9, page: 1, size: 5, sort: 'qty,desc' })
    expect(result).toMatchObject({ page: 1, totalElements: 6 })
    const p = new URL(String(fetch.mock.calls[0][0])).searchParams
    expect(Object.fromEntries(p)).toEqual({ keyword: 'SO-LIVE', status: '완료', itemId: '7', salesOrderId: '9', page: '1', size: '5', sort: 'qty,desc' })
    const malformed = client({ content: [order], number: 0, size: 0, totalElements: 1, totalPages: 1 })
    await expect(fetchWorkOrderPage(malformed.http, { keyword: '', status: '', page: 0, size: 10, sort: 'qty,asc' })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
})

it.each([{ lotNo: '' }, { inventoryTxnNo: null }, { workOrder: { ...order, priority: 9 } }])('rejects incomplete production-completion results (%j)', async invalid => {
    const { http } = client({ workOrder: order, lotNo: 'LOT-LIVE', inventoryTxnNo: 'TX-LIVE', ...invalid })
    await expect(actOnWorkOrder(http, 42, 'complete', { goodQty: 8, defectQty: 2 })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
})
