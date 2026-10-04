import type { components } from './generated/core'
import type { HttpClient } from './http'
import { invalidMasterResponse, normalizeMasterPage } from './masterPage'

export type ReceivingRow = Omit<Required<components['schemas']['ReceivingResponse']>, 'lotNo' | 'inventoryTxnNo' | 'reversalTxnNo' | 'cancelledDate'> & {
    lotNo: string | null; inventoryTxnNo: string | null; reversalTxnNo: string | null; cancelledDate: string | null
}
export type ReceivingInput = components['schemas']['ReceivingRequest']
export type PurchaseOrderOption = Required<components['schemas']['PurchaseOrderResponse']>
export const receivingStatuses = ['검수중', '합격', '부분합격', '불합격', '반품', '취소']
export interface ReceivingListParams { keyword: string; status: string; purchaseOrderId?: number; vendorId?: number; itemId?: number; page: number; size: number; sort: string }
const id = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v > 0
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0
const text = (v: unknown) => typeof v === 'string' && v.trim().length > 0
const date = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const nullableText = (v: unknown) => v == null || text(v)
function receipt(value: unknown, status: number, trace?: string): ReceivingRow {
    if (!value || typeof value !== 'object') return invalidMasterResponse(status, trace)
    const r = value as Record<string, unknown>
    if (![r.id, r.purchaseOrderId, r.vendorId, r.itemId].every(id)
        || ![r.receivingNo, r.purchaseOrderNo, r.vendorName, r.itemNo, r.itemName].every(text)
        || ![r.orderQty, r.receivedQty, r.defectQty, r.goodQty].every(num)
        || !date(r.receivedDate) || typeof r.status !== 'string' || !receivingStatuses.includes(r.status)
        || typeof r.stockApplied !== 'boolean' || ![r.lotNo, r.inventoryTxnNo, r.reversalTxnNo].every(nullableText)
        || !(r.cancelledDate == null || date(r.cancelledDate))) return invalidMasterResponse(status, trace)
    if (r.stockApplied && ((r.receivedQty as number) <= 0 || (r.defectQty as number) > (r.receivedQty as number)
        || Math.abs((r.receivedQty as number) - (r.defectQty as number) - (r.goodQty as number))
            > Math.max(0.00001, Number.EPSILON * (r.receivedQty as number) * 4)
        || ((r.goodQty as number) > 0 && (!text(r.lotNo) || !text(r.inventoryTxnNo))))) return invalidMasterResponse(status, trace)
    return { ...r, lotNo: r.lotNo ?? null, inventoryTxnNo: r.inventoryTxnNo ?? null,
        reversalTxnNo: r.reversalTxnNo ?? null, cancelledDate: r.cancelledDate ?? null } as ReceivingRow
}
export async function fetchReceivingPage(client: HttpClient, params: ReceivingListParams, signal?: AbortSignal) {
    const query = new URLSearchParams({ page: String(params.page), size: String(params.size), sort: params.sort })
    if (params.keyword.trim()) query.set('keyword', params.keyword.trim())
    if (params.status) query.set('status', params.status)
    for (const field of ['purchaseOrderId', 'vendorId', 'itemId'] as const) if (params[field]) query.set(field, String(params[field]))
    const r = await client.get<unknown>(`receivings?${query}`, { signal })
    return normalizeMasterPage(r.data, row => receipt(row, r.status, r.traceId), r.status, r.traceId)
}
export async function fetchReceiving(client: HttpClient, receivingId: number, signal?: AbortSignal) {
    const r = await client.get<unknown>(`receivings/${receivingId}`, { signal }); return receipt(r.data, r.status, r.traceId)
}
export async function fetchReceivingOrders(client: HttpClient, signal?: AbortSignal): Promise<PurchaseOrderOption[]> {
    const rows: PurchaseOrderOption[] = []
    for (let page = 0; ; page++) {
        const r = await client.get<unknown>(`purchase-orders?page=${page}&size=100&sort=purchaseOrderNo,asc`, { signal })
        const result = normalizeMasterPage(r.data, value => {
            if (!value || typeof value !== 'object') return invalidMasterResponse(r.status, r.traceId)
            const p = value as Record<string, unknown>
            if (![p.id, p.vendorId, p.itemId].every(id) || ![p.purchaseOrderNo, p.vendorName, p.itemNo, p.itemName].every(text)
                || ![p.qty, p.receivedQty, p.unitPrice, p.amount].every(num) || !date(p.dueDate)
                || typeof p.status !== 'string' || !['발주', '부분입고', '입고완료', '취소'].includes(p.status)) return invalidMasterResponse(r.status, r.traceId)
            return p as PurchaseOrderOption
        }, r.status, r.traceId)
        rows.push(...result.rows)
        if (page + 1 >= result.totalPages) return rows
    }
}
export async function saveReceiving(client: HttpClient, input: ReceivingInput) {
    const r = await client.post<unknown>('receivings', input); return result(r.data, r.status, r.traceId, false)
}
export async function cancelReceiving(client: HttpClient, receivingId: number) {
    const r = await client.post<unknown>(`receivings/${receivingId}/cancel`, {}); return result(r.data, r.status, r.traceId, true)
}
function result(value: unknown, status: number, trace: string | undefined, cancelling: boolean) {
    if (!value || typeof value !== 'object') return invalidMasterResponse(status, trace)
    const r = value as Record<string, unknown>
    const row = receipt(r.receiving, status, trace)
    if (![r.lotNo, r.inventoryTxnNo].every(nullableText) || (row.goodQty > 0 && (!text(r.lotNo) || !text(r.inventoryTxnNo)))
        || !row.stockApplied || (cancelling ? row.status !== '취소' : !['합격', '부분합격', '불합격'].includes(row.status))) return invalidMasterResponse(status, trace)
    return { row, message: cancelling ? `입고를 취소했습니다.${r.inventoryTxnNo ? ` 역출고 ${r.inventoryTxnNo}` : ' 재고 이동 없음'}`
        : `입고를 등록했습니다.${r.lotNo ? ` Lot ${r.lotNo} · 입고 ${r.inventoryTxnNo}` : ' 전량 불량 · 재고 이동 없음'}` }
}
