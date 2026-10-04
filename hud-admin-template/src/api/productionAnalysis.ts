import type { components } from './generated/core'
import type { HttpClient } from './http'
import { invalidMasterResponse } from './masterPage'

export type ProductionAnalysisRow = Omit<Required<components['schemas']['ProductionProgressRow']>, 'progressPercent' | 'yieldPercent'> & { progressPercent: number | null; yieldPercent: number | null }
export type ProductionAnalysisSummary = Omit<Required<components['schemas']['ProductionProgressSummary']>, 'meanActiveProgressPercent' | 'meanReportedYieldPercent'> & { meanActiveProgressPercent: number | null; meanReportedYieldPercent: number | null }
export type ProductionAnalysisResult = Omit<Required<components['schemas']['ProductionProgressResponse']>, 'rows' | 'summary' | 'itemId'> & { rows: ProductionAnalysisRow[]; summary: ProductionAnalysisSummary; itemId: number | null }
export interface ProductionAnalysisFilters { from: string; to: string; itemId?: number; status: string; keyword: string; sort: string; page: number; size: number }
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const count = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
const id = (v: unknown) => count(v) && v > 0
const qty = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1e14
const text = (v: unknown) => typeof v === 'string' && v.trim().length > 0
const date = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
    && Number.isFinite(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v
const rate = (v: unknown) => v === null || typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100
const statuses = ['지시', '진행중', '완료', '마감', '취소']
export async function fetchProductionAnalysis(client: HttpClient, filters: ProductionAnalysisFilters, signal?: AbortSignal): Promise<ProductionAnalysisResult> {
    const query = new URLSearchParams({ from: filters.from, to: filters.to, status: filters.status, keyword: filters.keyword,
        sort: filters.sort, page: String(filters.page), size: String(filters.size) })
    if (filters.itemId) query.set('itemId', String(filters.itemId))
    const r = await client.get<unknown>(`analytics/production/progress?${query}`, { signal }), d = r.data
    const fail = () => invalidMasterResponse(r.status, r.traceId)
    if (!obj(d) || !text(d.asOf) || !Number.isFinite(Date.parse(String(d.asOf))) || d.timeZone !== 'Asia/Seoul'
        || !date(d.from) || !date(d.to) || d.from > d.to || !(d.itemId === null || id(d.itemId))
        || !['active', 'all', ...statuses].includes(String(d.status)) || typeof d.keyword !== 'string' || !text(d.sort)
        || ![d.page, d.size, d.totalElements, d.totalPages].every(count) || (d.size as number) < 1 || (d.size as number) > 100
        || d.totalPages !== Math.ceil((d.totalElements as number) / (d.size as number)) || !Array.isArray(d.rows) || d.rows.length > (d.size as number)
        || !Array.isArray(d.notes) || !d.notes.length || !d.notes.every(text) || !obj(d.summary)) return fail()
    const s = d.summary
    if (![s.totalOrders, s.activeOrders, s.completedOrders, s.cancelledOrders, s.delayedOrders, s.unassignedActiveOrders,
        s.overActualOrders, s.eligibleActiveOrders, s.eligibleYieldOrders].every(count)
        || s.totalOrders !== d.totalElements || s.totalOrders !== (s.activeOrders as number) + (s.completedOrders as number) + (s.cancelledOrders as number)
        || (s.delayedOrders as number) > (s.activeOrders as number) || (s.unassignedActiveOrders as number) > (s.activeOrders as number)
        || (s.overActualOrders as number) > (s.totalOrders as number) || (s.eligibleActiveOrders as number) > (s.activeOrders as number)
        || (s.eligibleYieldOrders as number) > (s.totalOrders as number) - (s.cancelledOrders as number)
        || !rate(s.meanActiveProgressPercent) || !rate(s.meanReportedYieldPercent)
        || ((s.eligibleActiveOrders === 0) !== (s.meanActiveProgressPercent === null))
        || ((s.eligibleYieldOrders === 0) !== (s.meanReportedYieldPercent === null))) return fail()
    for (const row of d.rows) {
        if (!obj(row) || ![row.id, row.itemId].every(id) || ![row.workOrderNo, row.itemNo, row.itemName, row.unit].every(text)
            || ![row.qty, row.goodQty, row.defectQty, row.remainingQty].every(qty) || (row.qty as number) <= 0
            || !rate(row.progressPercent) || !rate(row.yieldPercent) || !date(row.startDate) || !date(row.dueDate)
            || !statuses.includes(String(row.status)) || typeof row.assignee !== 'string' || !id(row.priority) || (row.priority as number) > 3
            || typeof row.delayed !== 'boolean' || typeof row.overActual !== 'boolean'
            || (row.overActual && (row.progressPercent !== null || row.yieldPercent !== null))
            || (!row.overActual && row.progressPercent === null)
            || (row.delayed && !['지시', '진행중'].includes(String(row.status)))) return fail()
    }
    return d as ProductionAnalysisResult
}
