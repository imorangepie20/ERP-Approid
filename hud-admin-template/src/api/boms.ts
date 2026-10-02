import type { components } from './generated/core'
import type { HttpClient } from './http'
import { invalidMasterResponse, masterQuery, normalizeMasterPage, type MasterListParams } from './masterPage'

export type BomRow = Required<Omit<components['schemas']['BomResponse'], 'substituteNo'>> & { substituteNo: string }
export type CreateBomInput = components['schemas']['BomRequest']
export type UpdateBomInput = components['schemas']['BomUpdateRequest']

function normalizeBom(value: unknown, status: number, traceId?: string): BomRow {
    if (!value || typeof value !== 'object') return invalidMasterResponse(status, traceId)
    const b = value as Partial<BomRow>
    if (![b.id, b.parentId, b.childId].every(n => typeof n === 'number' && Number.isSafeInteger(n) && n > 0)
        || ![b.bomNo, b.parentItemNo, b.parentName, b.childItemNo, b.childName, b.childType, b.childUnit]
            .every(s => typeof s === 'string' && s.length > 0)
        || typeof b.qty !== 'number' || !Number.isFinite(b.qty) || b.qty <= 0
        || typeof b.lossRate !== 'number' || !Number.isFinite(b.lossRate) || b.lossRate < 0 || b.lossRate > 100
        || (b.substituteNo != null && typeof b.substituteNo !== 'string')) return invalidMasterResponse(status, traceId)
    return { ...b, substituteNo: b.substituteNo ?? '' } as BomRow
}
export async function fetchBomPage(client: HttpClient, params: MasterListParams, signal?: AbortSignal) {
    const r = await client.get<unknown>(`boms?${masterQuery(params, 'parentId')}`, { signal })
    return normalizeMasterPage(r.data, value => normalizeBom(value, r.status, r.traceId), r.status, r.traceId)
}
export async function createBom(client: HttpClient, input: CreateBomInput) {
    const r = await client.post<unknown>('boms', input)
    return normalizeBom(r.data, r.status, r.traceId)
}
export async function updateBom(client: HttpClient, id: number, input: UpdateBomInput) {
    const r = await client.patch<unknown>(`boms/${id}`, input)
    return normalizeBom(r.data, r.status, r.traceId)
}
export async function deleteBom(client: HttpClient, id: number) { await client.delete(`boms/${id}`) }
