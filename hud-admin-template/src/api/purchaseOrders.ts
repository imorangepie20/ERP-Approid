import type { components } from './generated/core'
import type { HttpClient } from './http'
import { ApiError } from './http'
import { invalidMasterResponse, normalizeMasterPage, type MasterPage } from './masterPage'

export const purchaseOrderStatuses = ['발주', '부분입고', '입고완료', '취소'] as const
export type PurchaseOrderRow = Required<components['schemas']['PurchaseOrderResponse']>
export type PurchaseOrderInput = components['schemas']['PurchaseOrderRequest']
export interface PurchaseOrderListParams { status?: string; vendorId?: number; page: number; size: number; sort: string }

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const id = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && (v as number) > 0
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && (v as number) >= 0
const pageNum = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && (v as number) >= 0
const text = (v: unknown) => typeof v === 'string' && v.trim().length > 0
const date = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
function invalidInput(message: string): never {
    throw new ApiError({ status: 400, code: 'INVALID_INPUT', message })
}

export function purchaseOrder(value: unknown, status: number, trace?: string): PurchaseOrderRow {
    if (!object(value) || ![value.id, value.vendorId, value.itemId].every(id)
        || ![value.purchaseOrderNo, value.vendorName, value.itemNo, value.itemName].every(text)
        || ![value.qty, value.receivedQty, value.unitPrice, value.amount].every(num)
        || !date(value.dueDate) || typeof value.status !== 'string' || !purchaseOrderStatuses.includes(value.status as typeof purchaseOrderStatuses[number])
        || (value.receivedQty as number) > (value.qty as number)) return invalidMasterResponse(status, trace)
    return value as PurchaseOrderRow
}

function orderInput(value: unknown): asserts value is PurchaseOrderInput {
    if (!object(value) || !text(value.purchaseOrderNo) || (value.purchaseOrderNo as string).length > 32
        || !id(value.vendorId) || !id(value.itemId)
        || typeof value.qty !== 'number' || !Number.isFinite(value.qty) || value.qty <= 0
        || typeof value.unitPrice !== 'number' || !Number.isFinite(value.unitPrice) || value.unitPrice <= 0
        || !date(value.dueDate)) invalidInput('발주 입력이 올바르지 않습니다.')
}

export async function fetchPurchaseOrderPage(client: HttpClient, params: PurchaseOrderListParams, signal?: AbortSignal): Promise<MasterPage<PurchaseOrderRow>> {
    if (!object(params) || !(params.status === undefined || params.status === '' || purchaseOrderStatuses.includes(params.status as typeof purchaseOrderStatuses[number]))
        || !(params.vendorId === undefined || id(params.vendorId)) || !pageNum(params.page)
        || !pageNum(params.size) || params.size < 1 || typeof params.sort !== 'string' || !params.sort) invalidInput('발주 조회 입력이 올바르지 않습니다.')
    const query = new URLSearchParams({ page: String(params.page), size: String(params.size), sort: params.sort })
    if (params.status) query.set('status', params.status)
    if (params.vendorId) query.set('vendorId', String(params.vendorId))
    const r = await client.get<unknown>(`purchase-orders?${query}`, { signal })
    return normalizeMasterPage(r.data, v => purchaseOrder(v, r.status, r.traceId), r.status, r.traceId)
}

export async function fetchPurchaseOrder(client: HttpClient, orderId: number, signal?: AbortSignal): Promise<PurchaseOrderRow> {
    if (!id(orderId)) invalidInput('발주 ID가 올바르지 않습니다.')
    const r = await client.get<unknown>(`purchase-orders/${orderId}`, { signal })
    return purchaseOrder(r.data, r.status, r.traceId)
}

export async function createPurchaseOrder(client: HttpClient, input: PurchaseOrderInput): Promise<PurchaseOrderRow> {
    orderInput(input)
    const r = await client.post<unknown>('purchase-orders', input)
    return purchaseOrder(r.data, r.status, r.traceId)
}

export async function updatePurchaseOrder(client: HttpClient, orderId: number, input: PurchaseOrderInput): Promise<PurchaseOrderRow> {
    if (!id(orderId)) invalidInput('발주 ID가 올바르지 않습니다.')
    orderInput(input)
    const r = await client.patch<unknown>(`purchase-orders/${orderId}`, input)
    return purchaseOrder(r.data, r.status, r.traceId)
}

export async function deletePurchaseOrder(client: HttpClient, orderId: number): Promise<void> {
    if (!id(orderId)) invalidInput('발주 ID가 올바르지 않습니다.')
    await client.delete(`purchase-orders/${orderId}`)
}

export async function cancelPurchaseOrder(client: HttpClient, orderId: number): Promise<PurchaseOrderRow> {
    if (!id(orderId)) invalidInput('발주 ID가 올바르지 않습니다.')
    const r = await client.post<unknown>(`purchase-orders/${orderId}/cancel`, {})
    const row = purchaseOrder(r.data, r.status, r.traceId)
    if (row.id !== orderId || row.status !== '취소') return invalidMasterResponse(r.status, r.traceId)
    return row
}
