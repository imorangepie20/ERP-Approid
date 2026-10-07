import type { components } from './generated/core'
import type { HttpClient } from './http'
import { ApiError } from './http'
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

export interface MaterialRequirement {
    bomId: number
    childItemId: number
    childItemNo: string
    childName: string
    unit: string
    bomQty: number
    lossRate: number
    requiredQty: number
    issuedQty: number
    returnedQty: number
    netIssuedQty: number
    remainingQty: number
}
export interface MaterialListResponse {
    workOrderId: number
    workOrderNo: string
    qty: number
    requirements: MaterialRequirement[]
    notes: string[]
}
export interface MaterialMoveInput { childItemId: number; lotId: number; qty: number }
export interface MaterialMoveResult {
    workOrderId: number
    workOrderNo: string
    childItemId: number
    childItemNo: string
    lotId: number
    lotNo: string
    qty: number
    txnNo: string
    netIssuedQty: number
    remainingQty: number
}

function normalizeRequirement(value: unknown, status: number, traceId?: string): MaterialRequirement {
    if (!value || typeof value !== 'object') return invalidMasterResponse(status, traceId)
    const r = value as Record<string, unknown>
    if (![r.bomId, r.childItemId].every(positiveId) || ![r.childItemNo, r.childName, r.unit].every(text)
        || ![r.bomQty, r.lossRate, r.requiredQty, r.issuedQty, r.returnedQty, r.netIssuedQty, r.remainingQty].every(number)
        || (r.bomQty as number) <= 0 || (r.lossRate as number) < 0 || (r.requiredQty as number) < 0
        || (r.issuedQty as number) < 0 || (r.returnedQty as number) < 0 || (r.netIssuedQty as number) < 0
        || (r.remainingQty as number) < 0) return invalidMasterResponse(status, traceId)
    return r as unknown as MaterialRequirement
}

function normalizeMaterials(value: unknown, status: number, traceId?: string): MaterialListResponse {
    if (!value || typeof value !== 'object') return invalidMasterResponse(status, traceId)
    const r = value as Record<string, unknown>
    if (!positiveId(r.workOrderId) || !text(r.workOrderNo) || !number(r.qty) || (r.qty as number) <= 0
        || !Array.isArray(r.requirements) || !Array.isArray(r.notes) || !r.notes.every(n => typeof n === 'string')) {
        return invalidMasterResponse(status, traceId)
    }
    return { workOrderId: r.workOrderId, workOrderNo: r.workOrderNo, qty: r.qty,
        requirements: (r.requirements as unknown[]).map(v => normalizeRequirement(v, status, traceId)),
        notes: r.notes as string[] } as MaterialListResponse
}

function normalizeMove(value: unknown, status: number, traceId?: string): MaterialMoveResult {
    if (!value || typeof value !== 'object') return invalidMasterResponse(status, traceId)
    const r = value as Record<string, unknown>
    if (!positiveId(r.workOrderId) || !text(r.workOrderNo) || !positiveId(r.childItemId) || !text(r.childItemNo)
        || !positiveId(r.lotId) || !text(r.lotNo) || !number(r.qty) || (r.qty as number) <= 0
        || !text(r.txnNo) || !number(r.netIssuedQty) || (r.netIssuedQty as number) < 0
        || !number(r.remainingQty) || (r.remainingQty as number) < 0) return invalidMasterResponse(status, traceId)
    return r as unknown as MaterialMoveResult
}

function moveInput(input: unknown): asserts input is MaterialMoveInput {
    if (!input || typeof input !== 'object') throw new ApiError({ status: 400, code: 'INVALID_INPUT', message: '불출 입력이 올바르지 않습니다.' })
    const r = input as Record<string, unknown>
    if (!positiveId(r.childItemId) || !positiveId(r.lotId) || !number(r.qty) || (r.qty as number) <= 0) {
        throw new ApiError({ status: 400, code: 'INVALID_INPUT', message: '불출 입력이 올바르지 않습니다.' })
    }
}

export async function fetchWorkOrderMaterials(client: HttpClient, id: number, signal?: AbortSignal) {
    if (!positiveId(id)) throw new ApiError({ status: 400, code: 'INVALID_INPUT', message: '작업오더 ID가 올바르지 않습니다.' })
    const r = await client.get<unknown>(`work-orders/${id}/materials`, { signal })
    return normalizeMaterials(r.data, r.status, r.traceId)
}

async function moveMaterials(client: HttpClient, id: number, action: 'material-issues' | 'material-returns', input: MaterialMoveInput) {
    if (!positiveId(id)) throw new ApiError({ status: 400, code: 'INVALID_INPUT', message: '작업오더 ID가 올바르지 않습니다.' })
    moveInput(input)
    const r = await client.post<unknown>(`work-orders/${id}/${action}`, input)
    return normalizeMove(r.data, r.status, r.traceId)
}

export async function issueWorkOrderMaterials(client: HttpClient, id: number, input: MaterialMoveInput) {
    return moveMaterials(client, id, 'material-issues', input)
}

export async function returnWorkOrderMaterials(client: HttpClient, id: number, input: MaterialMoveInput) {
    return moveMaterials(client, id, 'material-returns', input)
}

export interface OperationStep {
    seq: number
    routingNo: string
    process: string
    workCenter: string
    stdTime: number
    subcontract: boolean
    opStatus: string
    startedAt: string | null
    completedAt: string | null
    actualGoodQty: number | null
    actualDefectQty: number | null
}
export interface OperationsResponse {
    workOrderId: number
    workOrderNo: string
    qty: number
    goodQty: number
    defectQty: number
    status: string
    steps: OperationStep[]
    sumGoodQty: number
    sumDefectQty: number
    matched: boolean
    notes: string[]
}
export interface OperationActualsInput { goodQty: number; defectQty: number }

const opStatuses = ['대기', '진행중', '완료']

function normalizeOperationStep(value: unknown, status: number, traceId?: string): OperationStep {
    if (!value || typeof value !== 'object') return invalidMasterResponse(status, traceId)
    const r = value as Record<string, unknown>
    if (!positiveId(r.seq) || ![r.routingNo, r.process, r.workCenter].every(text)
        || !number(r.stdTime) || typeof r.subcontract !== 'boolean' || !opStatuses.includes(r.opStatus as string)
        || !(r.startedAt === null || date(r.startedAt)) || !(r.completedAt === null || date(r.completedAt))
        || !(r.actualGoodQty === null || (number(r.actualGoodQty) && (r.actualGoodQty as number) >= 0))
        || !(r.actualDefectQty === null || (number(r.actualDefectQty) && (r.actualDefectQty as number) >= 0))) {
        return invalidMasterResponse(status, traceId)
    }
    return r as unknown as OperationStep
}

function normalizeOperations(value: unknown, status: number, traceId?: string): OperationsResponse {
    if (!value || typeof value !== 'object') return invalidMasterResponse(status, traceId)
    const r = value as Record<string, unknown>
    if (!positiveId(r.workOrderId) || !text(r.workOrderNo) || ![r.qty, r.goodQty, r.defectQty].every(number)
        || (r.qty as number) <= 0 || !text(r.status) || !Array.isArray(r.steps)
        || ![r.sumGoodQty, r.sumDefectQty].every(number) || typeof r.matched !== 'boolean'
        || !Array.isArray(r.notes) || !(r.notes as unknown[]).every(n => typeof n === 'string')) {
        return invalidMasterResponse(status, traceId)
    }
    return { workOrderId: r.workOrderId, workOrderNo: r.workOrderNo, qty: r.qty, goodQty: r.goodQty,
        defectQty: r.defectQty, status: r.status,
        steps: (r.steps as unknown[]).map(v => normalizeOperationStep(v, status, traceId)),
        sumGoodQty: r.sumGoodQty, sumDefectQty: r.sumDefectQty, matched: r.matched, notes: r.notes } as OperationsResponse
}

export async function fetchWorkOrderOperations(client: HttpClient, id: number, signal?: AbortSignal) {
    if (!positiveId(id)) throw new ApiError({ status: 400, code: 'INVALID_INPUT', message: '작업오더 ID가 올바르지 않습니다.' })
    const r = await client.get<unknown>(`work-orders/${id}/operations`, { signal })
    return normalizeOperations(r.data, r.status, r.traceId)
}

export async function startWorkOrderOperation(client: HttpClient, id: number, seq: number) {
    if (!positiveId(id) || !positiveId(seq)) throw new ApiError({ status: 400, code: 'INVALID_INPUT', message: '공정 식별자가 올바르지 않습니다.' })
    const r = await client.post<unknown>(`work-orders/${id}/operations/${seq}/start`, {})
    return normalizeOperationStep(r.data, r.status, r.traceId)
}

export async function completeWorkOrderOperation(client: HttpClient, id: number, seq: number, input: OperationActualsInput) {
    if (!positiveId(id) || !positiveId(seq)) throw new ApiError({ status: 400, code: 'INVALID_INPUT', message: '공정 식별자가 올바르지 않습니다.' })
    const qty = (input ?? {}) as unknown as Record<string, unknown>
    if (!number(qty.goodQty) || (qty.goodQty as number) < 0 || !number(qty.defectQty) || (qty.defectQty as number) < 0) {
        throw new ApiError({ status: 400, code: 'INVALID_INPUT', message: '공정 실적 입력이 올바르지 않습니다.' })
    }
    const r = await client.post<unknown>(`work-orders/${id}/operations/${seq}/complete`, input)
    return normalizeOperationStep(r.data, r.status, r.traceId)
}
