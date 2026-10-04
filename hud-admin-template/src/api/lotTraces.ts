import type { components } from './generated/core'
import type { HttpClient } from './http'
import { invalidMasterResponse, normalizeMasterPage, type MasterPage } from './masterPage'

export type LotTraceRow = Omit<Required<components['schemas']['LotTraceRow']>, 'expiry'> & { expiry: string | null }
export type LotTraceMovement = Omit<Required<components['schemas']['LotTraceMovement']>, 'refType' | 'refNo' | 'sourceId' | 'sourceNo'> & {
    refType: string | null; refNo: string | null; sourceId: number | null; sourceNo: string | null
}
export interface LotTraceDetail { asOf: string; timeZone: string; lot: LotTraceRow; movements: MasterPage<LotTraceMovement>; notes: string[] }
export const lotStatuses = ['정상', '보류', '유통기한임박', '폐기']
export interface LotTraceFilters { itemId?: number; status: string; warehouse: string; keyword: string; sort: string; page: number; size: number }
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const id = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v > 0
const text = (v: unknown) => typeof v === 'string' && v.trim().length > 0
const qty = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e14
const date = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
    && Number.isFinite(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v
function lot(v: unknown, status: number, trace?: string): LotTraceRow {
    if (!obj(v) || ![v.id, v.itemId].every(id) || ![v.lotNo, v.itemNo, v.itemName, v.unit, v.warehouse].every(text)
        || !qty(v.qty) || !date(v.producedAt) || !date(v.referenceDate) || !(v.expiry === null || date(v.expiry))
        || !lotStatuses.includes(String(v.status)) || ![v.expired, v.expiringSoon, v.invalid].every(x => typeof x === 'boolean')) return invalidMasterResponse(status, trace)
    return v as LotTraceRow
}
function movement(v: unknown, status: number, trace?: string): LotTraceMovement {
    if (!obj(v) || ![v.id, v.itemId].every(id) || ![v.unit, v.txnNo, v.txnType, v.warehouse].every(text) || !qty(v.qty) || !date(v.txnDate)
        || ![v.refType, v.refNo].every(x => x === null || typeof x === 'string')
        || !['RECEIVING', 'WORK_ORDER', 'SHIPMENT', 'UNLINKED'].includes(String(v.sourceType))) return invalidMasterResponse(status, trace)
    if (v.sourceType === 'UNLINKED' ? v.sourceId !== null || v.sourceNo !== null : !id(v.sourceId) || !text(v.sourceNo)) return invalidMasterResponse(status, trace)
    return v as LotTraceMovement
}
export async function fetchLotTracePage(client: HttpClient, filters: LotTraceFilters, signal?: AbortSignal) {
    const q = new URLSearchParams({ status: filters.status, warehouse: filters.warehouse, keyword: filters.keyword, sort: filters.sort, page: String(filters.page), size: String(filters.size) })
    if (filters.itemId) q.set('itemId', String(filters.itemId))
    const r = await client.get<unknown>(`lot-traces?${q}`, { signal })
    return normalizeMasterPage(r.data, v => lot(v, r.status, r.traceId), r.status, r.traceId)
}
export async function fetchLotTrace(client: HttpClient, lotId: number, page: number, signal?: AbortSignal): Promise<LotTraceDetail> {
    const r = await client.get<unknown>(`lot-traces/${lotId}?page=${page}&size=20`, { signal }), d = r.data
    if (!obj(d) || !text(d.asOf) || !Number.isFinite(Date.parse(String(d.asOf))) || d.timeZone !== 'Asia/Seoul'
        || !Array.isArray(d.notes) || !d.notes.length || !d.notes.every(text)) return invalidMasterResponse(r.status, r.traceId)
    const row = lot(d.lot, r.status, r.traceId)
    if (row.id !== lotId) return invalidMasterResponse(r.status, r.traceId)
    return { asOf: String(d.asOf), timeZone: d.timeZone, lot: row,
        movements: normalizeMasterPage(d.movements, v => movement(v, r.status, r.traceId), r.status, r.traceId), notes: d.notes as string[] }
}
