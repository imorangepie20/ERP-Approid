import type { components } from './generated/core'
import type { HttpClient } from './http'
import { invalidMasterResponse } from './masterPage'

export type InventoryAnalysisRow = Required<components['schemas']['InventoryAnalysisRow']>
export type InventoryAnalysisSummary = Omit<Required<components['schemas']['InventoryAnalysisSummary']>, 'inventoryTurnover'> & { inventoryTurnover: null }
export type InventoryAnalysisResult = Omit<Required<components['schemas']['InventoryAnalysisResponse']>, 'rows' | 'summary' | 'itemId'> & { rows: InventoryAnalysisRow[]; summary: InventoryAnalysisSummary; itemId: number | null }
export interface InventoryAnalysisFilters { from: string; to: string; ageDays: number; itemId?: number; itemType: string; risk: string; keyword: string; sort: string; page: number; size: number }
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const count = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
const id = (v: unknown) => count(v) && v > 0
const qty = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e14
const positiveQty = (v: unknown) => qty(v) && v >= 0
const text = (v: unknown) => typeof v === 'string' && v.trim().length > 0
const date = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
    && Number.isFinite(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v
export async function fetchInventoryAnalysis(client: HttpClient, filters: InventoryAnalysisFilters, signal?: AbortSignal): Promise<InventoryAnalysisResult> {
    const query = new URLSearchParams({ from: filters.from, to: filters.to, ageDays: String(filters.ageDays), itemType: filters.itemType,
        risk: filters.risk, keyword: filters.keyword, sort: filters.sort, page: String(filters.page), size: String(filters.size) })
    if (filters.itemId) query.set('itemId', String(filters.itemId))
    const r = await client.get<unknown>(`analytics/inventory/summary?${query}`, { signal }), d = r.data
    const fail = () => invalidMasterResponse(r.status, r.traceId)
    if (!obj(d) || !text(d.asOf) || !Number.isFinite(Date.parse(String(d.asOf))) || d.timeZone !== 'Asia/Seoul'
        || !date(d.from) || !date(d.to) || d.from > d.to || !id(d.ageDays) || (d.ageDays as number) > 3650
        || !(d.itemId === null || id(d.itemId)) || !['all', '제품', '반제품', '자재'].includes(String(d.itemType))
        || !['all', 'low', 'ledger', 'lots', 'aged'].includes(String(d.risk)) || typeof d.keyword !== 'string'
        || typeof d.sort !== 'string' || !/^(itemNo|currentStock|stockLedgerDelta|agedLotQty),(asc|desc)$/i.test(d.sort)
        || ![d.page, d.size, d.totalElements, d.totalPages].every(count) || (d.page as number) > 10000 || (d.size as number) < 1 || (d.size as number) > 100
        || d.totalPages !== Math.ceil((d.totalElements as number) / (d.size as number)) || !Array.isArray(d.rows) || d.rows.length > (d.size as number)
        || !Array.isArray(d.notes) || !d.notes.length || !d.notes.every(text) || !obj(d.summary)) return fail()
    const s = d.summary
    if (![s.totalItems, s.lowStockItems, s.ledgerMismatchItems, s.lotMismatchItems, s.agedItems, s.heldItems, s.expiredItems, s.invalidLots, s.futureTransactions].every(count)
        || s.totalItems !== d.totalElements || s.inventoryTurnover !== null
        || [s.lowStockItems, s.ledgerMismatchItems, s.lotMismatchItems, s.agedItems, s.heldItems, s.expiredItems].some(v => (v as number) > (s.totalItems as number))) return fail()
    for (const row of d.rows) {
        if (!obj(row) || !id(row.itemId) || ![row.itemNo, row.itemName, row.unit].every(text) || !['제품', '반제품', '자재'].includes(String(row.itemType))
            || ![row.currentStock, row.ledgerBalance, row.stockLedgerDelta, row.periodNetQty].every(qty)
            || ![row.safetyStock, row.recordedLotQty, row.knownUsableLotQty, row.heldLotQty, row.expiredLotQty, row.agedLotQty, row.periodIncreaseQty, row.periodDecreaseQty].every(positiveQty)
            || ![row.lotCount, row.invalidLots, row.futureTransactions].every(count) || (row.invalidLots as number) > (row.lotCount as number)
            || ![row.lowStock, row.ledgerMismatch, row.lotMismatch].every(v => typeof v === 'boolean')
            || (row.knownUsableLotQty as number) > (row.recordedLotQty as number) || (row.heldLotQty as number) > (row.recordedLotQty as number)
            || (row.expiredLotQty as number) > (row.recordedLotQty as number) || (row.agedLotQty as number) > (row.recordedLotQty as number)) return fail()
    }
    return d as InventoryAnalysisResult
}
