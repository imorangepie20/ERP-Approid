import type { components } from './generated/core'
import type { HttpClient } from './http'
import { invalidMasterResponse, normalizeMasterPage } from './masterPage'

export type WorkOrderRow = Omit<Required<components['schemas']['WorkOrderResponse']>, 'salesOrderId' | 'salesOrderNo'> & {
    salesOrderId: number | null
    salesOrderNo: string | null
}
export type WorkOrderInput = components['schemas']['WorkOrderRequest']
export type WorkOrderUpdate = components['schemas']['WorkOrderUpdateRequest']
export type WorkOrderActuals = components['schemas']['WorkOrderCompleteRequest']
export const workOrderStatuses = ['지시', '진행중', '완료', '마감', '취소']
export const workOrderPriorities: Record<number, string> = { 1: '일반', 2: '높음', 3: '긴급' }
export interface WorkOrderListParams { keyword: string; status: string; itemId?: number; salesOrderId?: number; page: number; size: number; sort: string }
const positiveId = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n > 0
const number = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0
const text = (s: unknown) => typeof s === 'string' && s.trim().length > 0
const date = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)

function normalize(value: unknown, status: number, traceId?: string): WorkOrderRow {
    if (!value || typeof value !== 'object') return invalidMasterResponse(status, traceId)
    const r = value as Record<string, unknown>
    if (![r.id, r.itemId].every(positiveId) || ![r.workOrderNo, r.itemNo, r.itemName].every(text)
        || ![r.qty, r.goodQty, r.defectQty, r.progress, r.plannedTimeHours, r.subcontractTimeHours].every(number)
        || (r.qty as number) <= 0 || (r.progress as number) > 100 || typeof r.delayed !== 'boolean'
        || !date(r.startDate) || !date(r.dueDate) || typeof r.status !== 'string' || !workOrderStatuses.includes(r.status)
        || !(r.salesOrderId == null || positiveId(r.salesOrderId)) || !(r.salesOrderNo == null || text(r.salesOrderNo))
        || typeof r.assignee !== 'string' || !positiveId(r.priority) || (r.priority as number) > 3
        || !Array.isArray(r.routingSteps)) return invalidMasterResponse(status, traceId)
    for (const value of r.routingSteps) {
        if (!value || typeof value !== 'object') return invalidMasterResponse(status, traceId)
        const step = value as Record<string, unknown>
        if (![step.routingId, step.seq].every(positiveId) || ![step.routingNo, step.process, step.workCenter].every(text)
            || !number(step.stdTime) || typeof step.isSubcontract !== 'boolean') return invalidMasterResponse(status, traceId)
    }
    return { ...r, salesOrderId: r.salesOrderId ?? null, salesOrderNo: r.salesOrderNo ?? null } as WorkOrderRow
}
export async function fetchWorkOrderPage(client: HttpClient, params: WorkOrderListParams, signal?: AbortSignal) {
    const query = new URLSearchParams({ page: String(params.page), size: String(params.size), sort: params.sort })
    if (params.keyword.trim()) query.set('keyword', params.keyword.trim())
    if (params.status) query.set('status', params.status)
    if (params.itemId) query.set('itemId', String(params.itemId))
    if (params.salesOrderId) query.set('salesOrderId', String(params.salesOrderId))
    const r = await client.get<unknown>(`work-orders?${query}`, { signal })
    return normalizeMasterPage(r.data, v => normalize(v, r.status, r.traceId), r.status, r.traceId)
}
export async function fetchWorkOrder(client: HttpClient, id: number, signal?: AbortSignal) {
    const r = await client.get<unknown>(`work-orders/${id}`, { signal })
    return normalize(r.data, r.status, r.traceId)
}
export async function saveWorkOrder(client: HttpClient, id: number | null, input: WorkOrderInput | WorkOrderUpdate) {
    const r = id === null ? await client.post<unknown>('work-orders', input) : await client.patch<unknown>(`work-orders/${id}`, input)
    return normalize(r.data, r.status, r.traceId)
}
export type WorkOrderAction = 'progress' | 'complete' | 'close' | 'cancel' | 'delete'
export async function actOnWorkOrder(client: HttpClient, id: number, action: WorkOrderAction, actuals?: WorkOrderActuals): Promise<string> {
    if (action === 'delete') { await client.delete(`work-orders/${id}`); return '작업오더를 삭제했습니다.' }
    const r = await client.post<unknown>(`work-orders/${id}/${action}`, actuals ?? {})
    if (action === 'complete') {
        if (!r.data || typeof r.data !== 'object') return invalidMasterResponse(r.status, r.traceId)
        const result = r.data as Partial<components['schemas']['WorkOrderCompleteResult']>
        normalize(result.workOrder, r.status, r.traceId)
        if (!text(result.lotNo) || !text(result.inventoryTxnNo)) return invalidMasterResponse(r.status, r.traceId)
        return `생산완료 · Lot ${result.lotNo} · 입고 ${result.inventoryTxnNo}`
    }
    normalize(r.data, r.status, r.traceId)
    return action === 'progress' ? '누적 실적을 저장했습니다.' : action === 'close' ? '작업오더를 마감했습니다.' : '작업오더를 취소했습니다.'
}
