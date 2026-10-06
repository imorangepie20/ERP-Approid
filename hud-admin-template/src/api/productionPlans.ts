import type { components } from './generated/core'
import type { HttpClient } from './http'
import { ApiError } from './http'
import { invalidMasterResponse, normalizeMasterPage, type MasterPage } from './masterPage'

export const productionPlanStatuses = ['계획', '확정', '종결'] as const
export type ProductionPlanRow = Required<components['schemas']['ProductionPlanResponse']>
export type ProductionPlanInput = components['schemas']['ProductionPlanRequest']
export interface ProductionPlanListParams {
    planMonth?: string
    status?: string
    page: number
    size: number
    sort: string
}

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const id = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && (v as number) > 0
const qty = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
const pageNum = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && (v as number) >= 0
const text = (v: unknown) => typeof v === 'string' && v.trim().length > 0
const month = (v: unknown) => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v)
function invalidInput(message: string): never {
    throw new ApiError({ status: 400, code: 'INVALID_INPUT', message })
}

export function productionPlan(value: unknown, status: number, trace?: string): ProductionPlanRow {
    if (!object(value) || !id(value.id) || !id(value.itemId)
        || ![value.planNo, value.itemNo, value.itemName, value.planMonth].every(text)
        || !month(value.planMonth) || ![value.planQty, value.orderQty, value.stockQty, value.gapQty].every(qty)
        || typeof value.status !== 'string' || !productionPlanStatuses.includes(value.status as typeof productionPlanStatuses[number])) {
        return invalidMasterResponse(status, trace)
    }
    return value as ProductionPlanRow
}

function planInput(value: unknown): asserts value is ProductionPlanInput {
    if (!object(value) || !text(value.planNo) || (value.planNo as string).length > 32
        || !id(value.itemId) || !month(value.planMonth)
        || typeof value.planQty !== 'number' || !Number.isFinite(value.planQty) || value.planQty <= 0
        || (value.orderQty !== undefined && !qty(value.orderQty))
        || (value.stockQty !== undefined && !qty(value.stockQty))
        || (value.gapQty !== undefined && !qty(value.gapQty))
        || (value.basisNote !== undefined && !(typeof value.basisNote === 'string' && value.basisNote.length <= 1000))) invalidInput('생산계획 입력이 올바르지 않습니다.')
}

export async function fetchProductionPlanPage(client: HttpClient, params: ProductionPlanListParams, signal?: AbortSignal): Promise<MasterPage<ProductionPlanRow>> {

    if (!object(params) || !(params.planMonth === undefined || month(params.planMonth))
        || !(params.status === undefined || params.status === '' || productionPlanStatuses.includes(params.status as typeof productionPlanStatuses[number]))
        || !pageNum(params.page) || !pageNum(params.size) || params.size < 1
        || typeof params.sort !== 'string' || !params.sort) invalidInput('생산계획 조회 입력이 올바르지 않습니다.')
    const query = new URLSearchParams({ page: String(params.page), size: String(params.size), sort: params.sort })
    if (params.planMonth) query.set('planMonth', params.planMonth)
    if (params.status) query.set('status', params.status)
    const r = await client.get<unknown>(`production-plans?${query}`, { signal })
    return normalizeMasterPage(r.data, v => productionPlan(v, r.status, r.traceId), r.status, r.traceId)
}

export async function createProductionPlan(client: HttpClient, input: ProductionPlanInput): Promise<ProductionPlanRow> {
    planInput(input)
    const r = await client.post<unknown>('production-plans', input)
    return productionPlan(r.data, r.status, r.traceId)
}

export async function updateProductionPlan(client: HttpClient, planId: number, input: ProductionPlanInput): Promise<ProductionPlanRow> {
    if (!id(planId)) invalidInput('생산계획 ID가 올바르지 않습니다.')
    planInput(input)
    const r = await client.patch<unknown>(`production-plans/${planId}`, input)
    return productionPlan(r.data, r.status, r.traceId)
}

async function transition(client: HttpClient, planId: number, action: 'confirm' | 'close', expected: string): Promise<ProductionPlanRow> {
    if (!id(planId)) invalidInput('생산계획 ID가 올바르지 않습니다.')
    const r = await client.post<unknown>(`production-plans/${planId}/${action}`, {})
    const row = productionPlan(r.data, r.status, r.traceId)
    if (row.id !== planId || row.status !== expected) return invalidMasterResponse(r.status, r.traceId)
    return row
}

export async function confirmProductionPlan(client: HttpClient, planId: number): Promise<ProductionPlanRow> {
    return transition(client, planId, 'confirm', '확정')
}

export interface ProductionPlanSuggestionParams { itemId: number; planMonth: string }
export type ProductionPlanSuggestionOrder = Required<components['schemas']['ProductionPlanSuggestionOrder']>
export interface ProductionPlanSuggestion extends Omit<Required<components['schemas']['ProductionPlanSuggestion']>, 'orders'> {
    orders: ProductionPlanSuggestionOrder[]
}

const date = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)

export function productionPlanSuggestion(value: unknown, status: number, trace?: string): ProductionPlanSuggestion {
    const order = (o: unknown): o is ProductionPlanSuggestionOrder => object(o) && id(o.orderId)
        && text(o.salesOrderNo) && date(o.dueDate) && [o.orderQty, o.shippedQty, o.remainingQty].every(qty)
        && (o.shippedQty as number) >= 0 && (o.remainingQty as number) >= 0
        && (o.remainingQty as number) <= (o.orderQty as number)
    if (!object(value) || !id(value.itemId) || ![value.itemNo, value.itemName, value.planMonth].every(text)
        || !month(value.planMonth) || !date(value.dueCutoff)
        || ![value.orderBacklogQty, value.currentStock, value.safetyStock, value.suggestedPlanQty, value.suggestedGapQty].every(qty)
        || typeof value.openOrderCount !== 'number' || !Number.isSafeInteger(value.openOrderCount) || value.openOrderCount < 0
        || !Array.isArray(value.orders) || !value.orders.every(order)
        || value.orders.length !== value.openOrderCount
        || !Array.isArray(value.notes) || !value.notes.every(n => typeof n === 'string')) {
        return invalidMasterResponse(status, trace)
    }
    return value as unknown as ProductionPlanSuggestion
}

export async function fetchProductionPlanSuggestion(client: HttpClient, params: ProductionPlanSuggestionParams, signal?: AbortSignal): Promise<ProductionPlanSuggestion> {
    if (!object(params) || !id(params.itemId) || !month(params.planMonth)) invalidInput('산출 조회 입력이 올바르지 않습니다.')
    const query = new URLSearchParams({ itemId: String(params.itemId), planMonth: params.planMonth })
    const r = await client.get<unknown>(`production-plans/suggest?${query}`, { signal })
    return productionPlanSuggestion(r.data, r.status, r.traceId)
}

export async function closeProductionPlan(client: HttpClient, planId: number): Promise<ProductionPlanRow> {
    return transition(client, planId, 'close', '종결')
}
