import { expect, it, vi } from 'vitest'
import { createHttpClient } from './http'
import { cancelReceiving, fetchReceiving, fetchReceivingOrders, fetchReceivingPage, saveReceiving } from './receivings'
const row = { id: 42, receivingNo: 'RC-LIVE', purchaseOrderId: 9, purchaseOrderNo: 'PO-LIVE', vendorId: 5, vendorName: '공급사',
    itemId: 7, itemNo: 'M-LIVE', itemName: '자재', orderQty: 10, receivedQty: 10, defectQty: 2, goodQty: 8,
    receivedDate: '2026-10-02', status: '부분합격', stockApplied: true, lotNo: 'LOT-LIVE', inventoryTxnNo: 'TX-LIVE' }
const po = { id: 9, purchaseOrderNo: 'PO-LIVE', vendorId: 5, vendorName: '공급사', itemId: 7, itemNo: 'M-LIVE', itemName: '자재', qty: 10, receivedQty: 0, unitPrice: 100, amount: 1000, dueDate: '2026-12-31', status: '발주' }
const page = (content: unknown[], number = 0, total = 1) => ({ content, number, size: 1, totalElements: total, totalPages: total })
function client(value: unknown) { const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json(value, { headers: { 'X-Trace-Id': 'rc-response' } })); return { fetch, http: createHttpClient({ baseUrl: 'https://core.test/api/core', fetch }) } }
it('preserves nullable historical links without pretending stock was applied', async () => {
    const { http } = client({ ...row, stockApplied: false, lotNo: undefined, inventoryTxnNo: undefined })
    expect(await fetchReceiving(http, 42)).toMatchObject({ lotNo: null, inventoryTxnNo: null, reversalTxnNo: null, cancelledDate: null, stockApplied: false })
})
it.each([{ stockApplied: 'true' }, { defectQty: 11 }, { goodQty: -1 }, { lotNo: null }, { status: 'unknown' }, { purchaseOrderId: 0 }])('rejects malformed linked receipts (%j)', async invalid => {
    const { http } = client({ ...row, ...invalid }); await expect(fetchReceiving(http, 42)).rejects.toMatchObject({ code: 'INVALID_RESPONSE', traceId: 'rc-response' })
})
it('fetches all purchase option pages rather than only the first page', async () => {
    const { http, fetch } = client(null)
    fetch.mockReset().mockResolvedValueOnce(Response.json(page([po], 0, 2))).mockResolvedValueOnce(Response.json(page([{ ...po, id: 10 }], 1, 2)))
    expect(await fetchReceivingOrders(http)).toHaveLength(2); expect(String(fetch.mock.calls[1][0])).toContain('page=1&size=100')
})
it('sends list filters and validates page metadata', async () => {
    const { http, fetch } = client(page([row])); await fetchReceivingPage(http, { keyword: ' RC ', status: '부분합격', purchaseOrderId: 9, vendorId: 5, itemId: 7, page: 0, size: 1, sort: 'receivedQty,desc' })
    expect(Object.fromEntries(new URL(String(fetch.mock.calls[0][0])).searchParams)).toEqual({ keyword: 'RC', status: '부분합격', purchaseOrderId: '9', vendorId: '5', itemId: '7', page: '0', size: '1', sort: 'receivedQty,desc' })
})
it('accepts all-defective creation and cancellation without fake Lot or transaction numbers', async () => {
    const rejected = { ...row, goodQty: 0, defectQty: 10, status: '불합격', lotNo: undefined, inventoryTxnNo: undefined }
    expect((await saveReceiving(client({ receiving: rejected }).http, { purchaseOrderId: 9, receivedQty: 10, defectQty: 10 })).message).toContain('전량 불량')
    expect((await cancelReceiving(client({ receiving: { ...rejected, status: '취소' } }).http, 42)).message).toContain('재고 이동 없음')
})
it('rejects missing movement numbers in a successful good-quantity response', async () => {
    await expect(saveReceiving(client({ receiving: row }).http, { purchaseOrderId: 9, receivedQty: 10 })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
})
