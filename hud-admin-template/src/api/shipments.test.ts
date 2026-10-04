import { expect, it, vi } from 'vitest'
import { createHttpClient } from './http'
import { actOnShipment, fetchShipment, fetchShipmentAllocation, fetchShipmentLots, fetchShipmentOrders, fetchShipmentPage, saveShipment } from './shipments'

const row = { id: 42, shipmentNo: 'SH-LIVE', salesOrderId: 90, salesOrderNo: 'SO-LIVE', customerId: 1, customerName: '고객', itemId: 2,
    itemNo: 'P-LIVE', itemName: '제품', qty: 2.5, amount: 250, deliveryDate: '2026-12-31', status: '배차', lotId: 7, lotNo: 'LOT-LIVE' }
const page = (content: unknown[], number = 0, totalPages = 1, totalElements = content.length) => ({ content, number, size: 100, totalPages, totalElements })
const setup = (value: unknown) => { const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json(value)); return { fetch, client: createHttpClient({ baseUrl: 'https://core.test/api/core', fetch }) } }
it('normalizes historical shipments without guessing links', async () => {
    const { client } = setup({ ...row, lotId: undefined, lotNo: undefined })
    expect(await fetchShipment(client, 42)).toMatchObject({ lotId: null, inventoryTxnNo: null, receivableNo: null, vehicle: '', trackingNo: '' })
})
it.each([{ id: '42' }, { qty: 0 }, { amount: Number.MAX_SAFE_INTEGER + 1 }, { status: 'bad' }, { lotNo: undefined }, { inventoryTxnNo: 'IVT' }])('rejects malformed shipment %j', async change => {
    const { client } = setup({ ...row, ...change }); await expect(fetchShipment(client, 42)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
})
it('encodes server filters and pagination', async () => {
    const { fetch, client } = setup(page([row]))
    await fetchShipmentPage(client, { keyword: ' 고객 ', status: '배차', salesOrderId: 90, customerId: 1, itemId: 2, page: 0, size: 100, sort: 'qty,asc' })
    const url = new URL(String(fetch.mock.calls[0][0])); expect(Object.fromEntries(url.searchParams)).toEqual({ keyword: '고객', status: '배차', salesOrderId: '90', customerId: '1', itemId: '2', page: '0', size: '100', sort: 'qty,asc' })
})
it('reads every order and allocation page, excluding cancelled and edited shipments', async () => {
    const order = { id: 90, salesOrderNo: 'SO-LIVE', customerId: 1, customerName: '고객', itemId: 2, itemNo: 'P', itemName: '제품', qty: 10, unitPrice: 100,
        amount: 1000, paymentTerms: 7, leadTimeDays: 0, dueDate: '2026-12-31', orderedAt: '2026-10-02', status: '확정', workOrderNos: [] }
    const { fetch, client } = setup(null)
    fetch.mockResolvedValueOnce(Response.json(page([order], 0, 2, 2))).mockResolvedValueOnce(Response.json(page([{ ...order, id: 91 }], 1, 2, 2)))
    expect(await fetchShipmentOrders(client)).toHaveLength(2)
    fetch.mockResolvedValueOnce(Response.json(page([row, { ...row, id: 43, qty: 4 }], 0, 2, 3)))
        .mockResolvedValueOnce(Response.json(page([{ ...row, id: 44, status: '취소', qty: 6 }], 1, 2, 3)))
    expect(await fetchShipmentAllocation(client, 90, 42)).toBe(4)
})
it('validates Lot item and quantities without fallback', async () => {
    const { fetch, client } = setup([{ id: 7, lotNo: 'LOT', itemId: 2, qty: 10, warehouse: '완제품창고', status: '정상' }])
    expect(await fetchShipmentLots(client, 2)).toMatchObject([{ expiry: null }])
    fetch.mockResolvedValueOnce(Response.json([{ id: 7, lotNo: 'LOT', itemId: 3, qty: 10, warehouse: '완제품창고', status: '정상' }]))
    await expect(fetchShipmentLots(client, 2)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
})
it('saves actual IDs and requires confirmed movement and receivable links', async () => {
    const { fetch, client } = setup(row)
    await saveShipment(client, null, { salesOrderId: 90, lotId: 7, qty: 2.5, deliveryDate: '2026-12-31' })
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toMatchObject({ salesOrderId: 90, lotId: 7 })
    const confirmed = { ...row, status: '출하완료', confirmedDate: '2026-10-02', inventoryTxnNo: 'IVT', receivableNo: 'RV' }
    fetch.mockResolvedValueOnce(Response.json({ shipment: confirmed, inventoryTxnNo: 'IVT', receivableNo: 'RV' }))
    expect(await actOnShipment(client, 42, 'confirm')).toContain('출고 IVT · 미수 RV')
    fetch.mockResolvedValueOnce(Response.json({ shipment: row, receivableNo: 'RV' }))
    await expect(actOnShipment(client, 42, 'confirm')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
    fetch.mockResolvedValueOnce(Response.json({ ...row, status: '취소' }))
    expect(await actOnShipment(client, 42, 'cancel')).toContain('취소')
})
