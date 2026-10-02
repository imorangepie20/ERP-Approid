import type { components } from './generated/core'
import type { HttpClient } from './http'
import { invalidMasterResponse, masterQuery, normalizeMasterPage, type MasterListParams } from './masterPage'

export type RoutingRow = Required<components['schemas']['RoutingResponse']>
export type CreateRoutingInput = components['schemas']['RoutingRequest']
export type UpdateRoutingInput = components['schemas']['RoutingUpdateRequest']

function normalizeRouting(value: unknown, status: number, traceId?: string): RoutingRow {
    if (!value || typeof value !== 'object') return invalidMasterResponse(status, traceId)
    const r = value as Partial<RoutingRow>
    if (![r.id, r.itemId, r.seq].every(n => typeof n === 'number' && Number.isSafeInteger(n) && n > 0)
        || ![r.routingNo, r.itemNo, r.itemName, r.process, r.workCenter].every(s => typeof s === 'string' && s.trim().length > 0)
        || typeof r.stdTime !== 'number' || !Number.isFinite(r.stdTime) || r.stdTime < 0
        || typeof r.isSubcontract !== 'boolean') return invalidMasterResponse(status, traceId)
    return r as RoutingRow
}
export async function fetchRoutingPage(client: HttpClient, params: MasterListParams, signal?: AbortSignal) {
    const r = await client.get<unknown>(`routings?${masterQuery(params, 'itemId')}`, { signal })
    return normalizeMasterPage(r.data, value => normalizeRouting(value, r.status, r.traceId), r.status, r.traceId)
}
export async function createRouting(client: HttpClient, input: CreateRoutingInput) {
    const r = await client.post<unknown>('routings', input)
    return normalizeRouting(r.data, r.status, r.traceId)
}
export async function updateRouting(client: HttpClient, id: number, input: UpdateRoutingInput) {
    const r = await client.patch<unknown>(`routings/${id}`, input)
    return normalizeRouting(r.data, r.status, r.traceId)
}
export async function deleteRouting(client: HttpClient, id: number) { await client.delete(`routings/${id}`) }
