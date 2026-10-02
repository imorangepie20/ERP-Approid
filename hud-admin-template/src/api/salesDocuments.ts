import type { components } from './generated/core'
import type { HttpClient } from './http'
import { invalidMasterResponse, normalizeMasterPage } from './masterPage'

export type QuotationRow = Required<components['schemas']['QuotationResponse']>
export type SalesOrderRow = Omit<Required<components['schemas']['SalesOrderResponse']>, 'quotationId' | 'quotationNo'> & {
    quotationId: number | null
    quotationNo: string | null
}
export type SalesDocumentRow = QuotationRow | SalesOrderRow
export type SalesResource = 'quotations' | 'sales-orders'
export type QuotationInput = components['schemas']['QuotationRequest']
export type QuotationUpdate = components['schemas']['QuotationUpdateRequest']
export type SalesOrderInput = components['schemas']['SalesOrderRequest']
export type SalesOrderUpdate = components['schemas']['SalesOrderUpdateRequest']
export interface SalesListParams { keyword: string; status: string; customerId?: number; page: number; size: number; sort: string }
export const salesStatuses = { quotations: ['작성중', '발송완료', '수주완료', '만료'], 'sales-orders': ['대기', '확정', '생산중', '출하완료', '취소'] }
const positiveId = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n > 0
const nonNegativeInteger = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0
const text = (s: unknown) => typeof s === 'string' && s.trim().length > 0
const date = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)

function normalize(value: unknown, resource: SalesResource, status: number, traceId?: string): SalesDocumentRow {
    if (!value || typeof value !== 'object') return invalidMasterResponse(status, traceId)
    const r = value as Record<string, unknown>
    if (![r.id, r.customerId, r.itemId].every(positiveId) || ![r.customerName, r.itemNo, r.itemName].every(text)
        || typeof r.qty !== 'number' || !Number.isFinite(r.qty) || r.qty <= 0
        || ![r.unitPrice, r.amount, r.paymentTerms, r.leadTimeDays].every(nonNegativeInteger)
        || !date(r.dueDate) || typeof r.status !== 'string' || !salesStatuses[resource].includes(r.status)) {
        return invalidMasterResponse(status, traceId)
    }
    if (resource === 'quotations') {
        if (!text(r.quotationNo) || !date(r.validUntil)) return invalidMasterResponse(status, traceId)
        return r as unknown as QuotationRow
    }
    if (!text(r.salesOrderNo) || !date(r.orderedAt) || !(r.quotationId == null || positiveId(r.quotationId))
        || !(r.quotationNo == null || text(r.quotationNo)) || !Array.isArray(r.workOrderNos) || !r.workOrderNos.every(text)) {
        return invalidMasterResponse(status, traceId)
    }
    return { ...r, quotationId: r.quotationId ?? null, quotationNo: r.quotationNo ?? null } as SalesOrderRow
}
export async function fetchSalesPage(client: HttpClient, resource: SalesResource, params: SalesListParams, signal?: AbortSignal) {
    const query = new URLSearchParams({ page: String(params.page), size: String(params.size), sort: params.sort })
    if (params.keyword.trim()) query.set('keyword', params.keyword.trim())
    if (params.status) query.set('status', params.status)
    if (params.customerId) query.set('customerId', String(params.customerId))
    const r = await client.get<unknown>(`${resource}?${query}`, { signal })
    return normalizeMasterPage(r.data, v => normalize(v, resource, r.status, r.traceId), r.status, r.traceId)
}
export async function saveSalesDocument(client: HttpClient, resource: SalesResource, id: number | null,
    input: QuotationInput | QuotationUpdate | SalesOrderInput | SalesOrderUpdate) {
    const r = id === null ? await client.post<unknown>(resource, input) : await client.patch<unknown>(`${resource}/${id}`, input)
    return normalize(r.data, resource, r.status, r.traceId)
}
export type SalesAction = 'send' | 'convert' | 'confirm' | 'cancel' | 'delete'
export async function actOnSalesDocument(client: HttpClient, resource: SalesResource, id: number, action: SalesAction): Promise<string> {
    if (action === 'delete') { await client.delete(`${resource}/${id}`); return '삭제했습니다.' }
    if (action === 'convert') {
        const r = await client.post<unknown>(`sales-orders/from-quotation/${id}`, {})
        const order = normalize(r.data, 'sales-orders', r.status, r.traceId) as SalesOrderRow
        return `수주를 생성했습니다: ${order.salesOrderNo}`
    }
    const r = await client.post<unknown>(`${resource}/${id}/${action}`, {})
    if (action === 'confirm') {
        if (!r.data || typeof r.data !== 'object') return invalidMasterResponse(r.status, r.traceId)
        const result = r.data as Partial<components['schemas']['SalesOrderConfirmResult']>
        normalize(result.salesOrder, 'sales-orders', r.status, r.traceId)
        if (!text(result.workOrderNo) || !positiveId(result.workOrderId)) return invalidMasterResponse(r.status, r.traceId)
        return `작업오더를 생성했습니다: ${result.workOrderNo}`
    }
    normalize(r.data, resource, r.status, r.traceId)
    return action === 'send' ? '견적을 발송완료 상태로 변경했습니다.' : '수주를 취소했습니다.'
}
