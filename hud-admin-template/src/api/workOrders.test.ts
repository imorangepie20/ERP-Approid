import { expect, it, vi } from 'vitest'
import { createHttpClient } from './http'
import { actOnWorkOrder, completeWorkOrderOperation, fetchWorkOrder, fetchWorkOrderMaterials, fetchWorkOrderOperations,
    fetchWorkOrderPage, issueWorkOrderMaterials, returnWorkOrderMaterials, startWorkOrderOperation } from './workOrders'

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

const requirement = { bomId: 5, childItemId: 8, childItemNo: 'M-LIVE', childName: '자재', unit: 'EA',
    bomQty: 2, lossRate: 25, requiredQty: 25, issuedQty: 10, returnedQty: 4, netIssuedQty: 6, remainingQty: 19 }
const materials = { workOrderId: 42, workOrderNo: 'WO-LIVE', qty: 10, requirements: [requirement], notes: ['소요량 = 지시수량 × BOM 수량'] }

it('reads material requirements with issued and remaining quantities', async () => {
    const { http, fetch } = client(materials)
    const result = await fetchWorkOrderMaterials(http, 42)
    expect(result.requirements[0]).toMatchObject({ childItemNo: 'M-LIVE', requiredQty: 25, netIssuedQty: 6 })
    expect(String(fetch.mock.calls[0][0])).toContain('/work-orders/42/materials')
    await expect(fetchWorkOrderMaterials(http, 0)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
})

it('issues and returns materials against specific lots', async () => {
    const move = { workOrderId: 42, workOrderNo: 'WO-LIVE', childItemId: 8, childItemNo: 'M-LIVE',
        lotId: 21, lotNo: 'LOT-LIVE', qty: 10, txnNo: 'TX-LIVE', netIssuedQty: 10, remainingQty: 15 }
    const { http, fetch } = client(move)
    expect((await issueWorkOrderMaterials(http, 42, { childItemId: 8, lotId: 21, qty: 10 })).txnNo).toBe('TX-LIVE')
    expect(String(fetch.mock.calls[0][0])).toContain('/work-orders/42/material-issues')
    expect((await returnWorkOrderMaterials(client(move).http, 42, { childItemId: 8, lotId: 21, qty: 4 })).qty).toBe(10)
    await expect(issueWorkOrderMaterials(http, 0, { childItemId: 8, lotId: 21, qty: 10 })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(issueWorkOrderMaterials(http, 42, { childItemId: 0, lotId: 21, qty: 10 })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(issueWorkOrderMaterials(http, 42, { childItemId: 8, lotId: 21, qty: 0 })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
})

const operation = { seq: 10, routingNo: 'RT-001', process: '절단', workCenter: 'WC-CUT', stdTime: 0.5,
    subcontract: false, opStatus: '완료', startedAt: '2026-10-06', completedAt: '2026-10-06', actualGoodQty: 6, actualDefectQty: 4 }
const operations = { workOrderId: 42, workOrderNo: 'WO-LIVE', qty: 10, goodQty: 6, defectQty: 4,
    status: '진행중', steps: [operation], sumGoodQty: 6, sumDefectQty: 4, matched: true, notes: ['착수는 보관 순서대로'] }

it('reads operation actuals with header reconciliation', async () => {
    const { http, fetch } = client(operations)
    const result = await fetchWorkOrderOperations(http, 42)
    expect(result.matched).toBe(true)
    expect(result.steps[0]).toMatchObject({ seq: 10, opStatus: '완료' })
    expect(String(fetch.mock.calls[0][0])).toContain('/work-orders/42/operations')
    await expect(fetchWorkOrderOperations(http, 0)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
})

it('starts and completes operations with actual quantities', async () => {
    const { http, fetch } = client(operation)
    expect((await startWorkOrderOperation(http, 42, 10)).opStatus).toBe('완료')
    expect(String(fetch.mock.calls[0][0])).toContain('/work-orders/42/operations/10/start')
    expect((await completeWorkOrderOperation(client(operation).http, 42, 10, { goodQty: 6, defectQty: 4 })).actualGoodQty).toBe(6)
    await expect(startWorkOrderOperation(http, 0, 10)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(completeWorkOrderOperation(http, 42, 10, { goodQty: -1, defectQty: 0 })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
})
