import type { components } from './generated/core'
import type { HttpClient } from './http'
import { invalidMasterResponse } from './masterPage'

export type SalesAnalysisSummary = Required<components['schemas']['SalesAnalysisSummary']>
export type SalesAnalysisRow = Omit<Required<components['schemas']['SalesAnalysisRow']>, 'currentBacklogKrw'> & { currentBacklogKrw: number | null }
export type SalesAnalysisResult = Omit<Required<components['schemas']['SalesAnalysisResponse']>, 'itemId' | 'customerId' | 'rows' | 'summary'> & { itemId: number | null; customerId: number | null; rows: SalesAnalysisRow[]; summary: SalesAnalysisSummary }
export interface SalesAnalysisFilters { from: string; to: string; itemId?: number; customerId?: number; keyword: string; scope: string; sort: string; page: number; size: number }
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const count = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
const id = (v: unknown) => count(v) && v > 0
const text = (v: unknown) => typeof v === 'string' && !!v.trim()
const qty = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1e14
const date = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
    && Number.isFinite(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v
const scopes = ['ordered', 'backlog', 'receivables']
export async function fetchSalesAnalysis(client: HttpClient, filters: SalesAnalysisFilters, signal?: AbortSignal): Promise<SalesAnalysisResult> {
    const q = new URLSearchParams({ from: filters.from, to: filters.to, keyword: filters.keyword, scope: filters.scope, sort: filters.sort, page: String(filters.page), size: String(filters.size) })
    if (filters.itemId) q.set('itemId', String(filters.itemId))
    if (filters.customerId) q.set('customerId', String(filters.customerId))
    const r = await client.get<unknown>(`analytics/sales/summary?${q}`, { signal }), d = r.data
    const fail = () => invalidMasterResponse(r.status, r.traceId)
    if (!obj(d) || !text(d.asOf) || !Number.isFinite(Date.parse(String(d.asOf))) || d.timeZone !== 'Asia/Seoul'
        || !date(d.from) || !date(d.to) || d.from > d.to || ![d.itemId, d.customerId].every(v => v === null || id(v))
        || typeof d.keyword !== 'string' || !scopes.includes(String(d.scope)) || !text(d.sort)
        || ![d.page, d.size, d.totalElements, d.totalPages].every(count) || (d.size as number) < 1 || (d.size as number) > 100
        || d.totalPages !== Math.ceil((d.totalElements as number) / (d.size as number)) || !Array.isArray(d.rows) || d.rows.length > (d.size as number)
        || !Array.isArray(d.notes) || !d.notes.length || !d.notes.every(text) || !obj(d.summary)) return fail()
    const s = d.summary
    if (![s.periodOrders, s.periodCancelledOrders, s.periodConfirmedShipments, s.currentBacklogOrders, s.unknownBacklogOrders,
        s.currentOpenReceivables, s.currentOverdueReceivables, s.excludedHistoricalShipments, s.excludedUnlinkedReceivables,
        s.periodOrderKrw, s.periodRevenueKrw, s.knownCurrentBacklogKrw, s.currentOpenReceivableKrw, s.currentOverdueReceivableKrw].every(count)
        || (s.periodCancelledOrders as number) > (s.periodOrders as number) || (s.unknownBacklogOrders as number) > (s.currentBacklogOrders as number)
        || (s.currentOverdueReceivables as number) > (s.currentOpenReceivables as number)
        || (s.currentOverdueReceivableKrw as number) > (s.currentOpenReceivableKrw as number)) return fail()
    for (const row of d.rows) {
        if (!obj(row) || ![row.id, row.itemId, row.customerId].every(id)
            || ![row.salesOrderNo, row.customerNo, row.customerName, row.itemNo, row.itemName, row.unit].every(text)
            || ![row.qty, row.knownShippedQty].every(qty) || (row.qty as number) <= 0
            || ![row.amountKrw, row.knownShippedAmountKrw, row.periodRevenueKrw, row.currentOpenReceivableKrw, row.currentOverdueReceivableKrw].every(count)
            || !(row.currentBacklogKrw === null || count(row.currentBacklogKrw))
            || !date(row.orderedAt) || !date(row.dueDate) || !['대기', '확정', '생산중', '출하완료', '취소'].includes(String(row.status))
            || typeof row.historyUnknown !== 'boolean' || typeof row.delayed !== 'boolean'
            || (row.historyUnknown !== (row.currentBacklogKrw === null))
            || (row.delayed && !['확정', '생산중'].includes(String(row.status)))
            || (row.currentOverdueReceivableKrw as number) > (row.currentOpenReceivableKrw as number)) return fail()
    }
    return d as SalesAnalysisResult
}
