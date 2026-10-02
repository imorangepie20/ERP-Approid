import { ApiError } from './http'

export interface MasterPage<T> {
    rows: T[]
    page: number
    size: number
    totalElements: number
    totalPages: number
}
export interface MasterListParams {
    keyword: string
    page: number
    size: number
    sort: string
    itemId?: number
}
export function invalidMasterResponse(status: number, traceId?: string): never {
    throw new ApiError({ status, traceId, code: 'INVALID_RESPONSE', message: '서버 응답 형식이 올바르지 않습니다.' })
}
export function normalizeMasterPage<T>(value: unknown, row: (value: unknown) => T, status: number, traceId?: string): MasterPage<T> {
    if (!value || typeof value !== 'object') return invalidMasterResponse(status, traceId)
    const p = value as Record<string, unknown>
    if (!Array.isArray(p.content)
        || ![p.number, p.size, p.totalElements, p.totalPages].every(n => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0)
        || (p.size as number) < 1 || p.content.length > (p.size as number)
        || (p.content.length > 0 && (p.number as number) >= (p.totalPages as number))) {
        return invalidMasterResponse(status, traceId)
    }
    return { rows: p.content.map(row), page: p.number as number, size: p.size as number,
        totalElements: p.totalElements as number, totalPages: p.totalPages as number }
}
export function masterQuery(params: MasterListParams, filter: string): string {
    const query = new URLSearchParams({ page: String(params.page), size: String(params.size), sort: params.sort })
    if (params.keyword.trim()) query.set('keyword', params.keyword.trim())
    if (params.itemId) query.set(filter, String(params.itemId))
    return query.toString()
}
