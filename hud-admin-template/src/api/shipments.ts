import type { components } from './generated/core'
import type { HttpClient } from './http'
import { invalidMasterResponse, normalizeMasterPage } from './masterPage'
import { fetchSalesPage, type SalesOrderRow } from './salesDocuments'

type Nullable = 'lotId' | 'lotNo' | 'inventoryTxnNo' | 'receivableNo' | 'vehicle' | 'trackingNo' | 'departedDate' | 'confirmedDate'
export type ShipmentRow = Omit<Required<components['schemas']['ShipmentResponse']>, Nullable> & {
    lotId: number | null; lotNo: string | null; inventoryTxnNo: string | null; receivableNo: string | null
    vehicle: string; trackingNo: string; departedDate: string | null; confirmedDate: string | null
}
export type ShipmentInput = components['schemas']['ShipmentRequest']
export type ShipmentUpdate = components['schemas']['ShipmentUpdateRequest']
export type ShipmentAction = 'dispatch' | 'depart' | 'confirm' | 'cancel'
export const shipmentStatuses = ['지시', '배차', '출발', '출하완료', '매출반영', '취소']
export interface ShipmentParams { keyword: string; status: string; salesOrderId?: number; customerId?: number; itemId?: number; page: number; size: number; sort: string }
export interface ShipmentLot { id: number; lotNo: string; itemId: number; qty: number; warehouse: string; status: string; expiry: string | null }
const id = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v > 0
const text = (v: unknown) => typeof v === 'string' && v.trim().length > 0
const qty = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0
const date = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
function normalize(value: unknown, status: number, trace?: string): ShipmentRow {
    if (!value || typeof value !== 'object') return invalidMasterResponse(status, trace)
    const r = value as Record<string, unknown>
    if (![r.id, r.salesOrderId, r.customerId, r.itemId].every(id) || ![r.shipmentNo, r.salesOrderNo, r.customerName, r.itemNo, r.itemName].every(text)
        || !qty(r.qty) || typeof r.amount !== 'number' || !Number.isSafeInteger(r.amount) || r.amount < 0
        || !date(r.deliveryDate) || typeof r.status !== 'string' || !shipmentStatuses.includes(r.status)
        || !(r.lotId == null || id(r.lotId)) || ![r.lotNo, r.inventoryTxnNo, r.receivableNo].every(v => v == null || text(v))
        || ![r.vehicle, r.trackingNo].every(v => v == null || typeof v === 'string')
        || ![r.departedDate, r.confirmedDate].every(v => v == null || date(v))
        || ((r.lotId == null) !== (r.lotNo == null))
        || ((r.inventoryTxnNo == null) !== (r.receivableNo == null))) return invalidMasterResponse(status, trace)
    return { ...r, lotId: r.lotId ?? null, lotNo: r.lotNo ?? null, inventoryTxnNo: r.inventoryTxnNo ?? null,
        receivableNo: r.receivableNo ?? null, vehicle: r.vehicle ?? '', trackingNo: r.trackingNo ?? '',
        departedDate: r.departedDate ?? null, confirmedDate: r.confirmedDate ?? null } as ShipmentRow
}
export async function fetchShipmentPage(client: HttpClient, p: ShipmentParams, signal?: AbortSignal) {
    const query = new URLSearchParams({ page: String(p.page), size: String(p.size), sort: p.sort })
    if (p.keyword.trim()) query.set('keyword', p.keyword.trim())
    if (p.status) query.set('status', p.status)
    for (const key of ['salesOrderId', 'customerId', 'itemId'] as const) if (p[key]) query.set(key, String(p[key]))
    const r = await client.get<unknown>(`shipments?${query}`, { signal })
    return normalizeMasterPage(r.data, v => normalize(v, r.status, r.traceId), r.status, r.traceId)
}
export async function fetchShipment(client: HttpClient, shipmentId: number, signal?: AbortSignal) {
    const r = await client.get<unknown>(`shipments/${shipmentId}`, { signal }); return normalize(r.data, r.status, r.traceId)
}
export async function fetchShipmentAllocation(client: HttpClient, salesOrderId: number, excludeId: number | null, signal?: AbortSignal) {
    let allocated = 0
    for (let page = 0; ; page++) {
        const r = await fetchShipmentPage(client, { keyword: '', status: '', salesOrderId, page, size: 100, sort: 'shipmentNo,asc' }, signal)
        allocated += r.rows.filter(s => s.status !== '취소' && s.id !== excludeId).reduce((sum, s) => sum + s.qty, 0)
        if (page + 1 >= r.totalPages) return allocated
    }
}
export async function fetchShipmentOrders(client: HttpClient, signal?: AbortSignal): Promise<SalesOrderRow[]> {
    const rows: SalesOrderRow[] = []
    for (let page = 0; ; page++) {
        const r = await fetchSalesPage(client, 'sales-orders', { keyword: '', status: '', page, size: 100, sort: 'salesOrderNo,asc' }, signal)
        rows.push(...r.rows as SalesOrderRow[])
        if (page + 1 >= r.totalPages) return rows
    }
}
export async function fetchShipmentLots(client: HttpClient, itemId: number, signal?: AbortSignal): Promise<ShipmentLot[]> {
    const r = await client.get<unknown>(`lots?itemId=${itemId}`, { signal })
    if (!Array.isArray(r.data)) return invalidMasterResponse(r.status, r.traceId)
    return r.data.map(value => {
        if (!value || typeof value !== 'object') return invalidMasterResponse(r.status, r.traceId)
        const l = value as Record<string, unknown>
        if (![l.id, l.itemId].every(id) || l.itemId !== itemId || ![l.lotNo, l.warehouse, l.status].every(text)
            || typeof l.qty !== 'number' || !Number.isFinite(l.qty) || l.qty < 0 || !(l.expiry == null || date(l.expiry))) return invalidMasterResponse(r.status, r.traceId)
        return { ...l, expiry: l.expiry ?? null } as unknown as ShipmentLot
    })
}
export async function saveShipment(client: HttpClient, shipmentId: number | null, input: ShipmentInput | ShipmentUpdate) {
    const r = shipmentId === null ? await client.post<unknown>('shipments', input) : await client.patch<unknown>(`shipments/${shipmentId}`, input)
    const row = normalize(r.data, r.status, r.traceId)
    if (!row.lotId || !['지시', '배차'].includes(row.status)) return invalidMasterResponse(r.status, r.traceId)
    return row
}
export async function actOnShipment(client: HttpClient, shipmentId: number, action: ShipmentAction) {
    const r = await client.post<unknown>(`shipments/${shipmentId}/${action}`, {})
    if (action !== 'confirm') {
        const row = normalize(r.data, r.status, r.traceId)
        if (row.status !== { dispatch: '배차', depart: '출발', cancel: '취소' }[action]) return invalidMasterResponse(r.status, r.traceId)
        return `${row.shipmentNo} ${row.status} 처리했습니다.`
    }
    if (!r.data || typeof r.data !== 'object') return invalidMasterResponse(r.status, r.traceId)
    const result = r.data as Record<string, unknown>; const row = normalize(result.shipment, r.status, r.traceId)
    if (row.status !== '출하완료' || !row.lotId || !date(row.confirmedDate) || !text(result.receivableNo) || !text(result.inventoryTxnNo)
        || row.receivableNo !== result.receivableNo || row.inventoryTxnNo !== result.inventoryTxnNo) return invalidMasterResponse(r.status, r.traceId)
    return `출하 확정: ${row.shipmentNo} · 출고 ${row.inventoryTxnNo} · 미수 ${row.receivableNo}`
}
