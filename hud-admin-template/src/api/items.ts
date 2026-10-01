import type { components } from './generated/core'
import { ApiError, type HttpClient } from './http'

type GeneratedItemResponse = components['schemas']['ItemResponse']
type GeneratedItemPageResponse = components['schemas']['PageItemResponse']

export type ItemSortColumn = 'itemNo' | 'name' | 'spec' | 'itemType' | 'unit' | 'price' | 'stock' | 'safetyStock'
export type SortDirection = 'asc' | 'desc'
export type ItemType = '제품' | '반제품' | '자재'

export interface ItemRow {
    id: number
    itemNo: string
    name: string
    spec: string
    category: string
    itemType: ItemType
    unit: string
    price: number
    stock: number
    safetyStock: number
    leadTimeDays: number
}

export interface ItemPage {
    items: ItemRow[]
    page: number
    size: number
    totalElements: number
    totalPages: number
}

export interface ItemListParams {
    keyword?: string
    itemType?: ItemType
    page: number
    size: number
    sortColumn: ItemSortColumn
    sortDirection: SortDirection
}

const itemSortColumns = new Set<ItemSortColumn>([
    'itemNo',
    'name',
    'spec',
    'itemType',
    'unit',
    'price',
    'stock',
    'safetyStock',
])
const itemTypes = new Set<ItemType>(['제품', '반제품', '자재'])

export function isItemSortColumn(value: string): value is ItemSortColumn {
    return itemSortColumns.has(value as ItemSortColumn)
}

export function isItemType(value: string): value is ItemType {
    return itemTypes.has(value as ItemType)
}

function invalidResponse(status: number, traceId?: string): ApiError {
    return new ApiError({
        status,
        code: 'INVALID_RESPONSE',
        message: '서버 응답 형식이 올바르지 않습니다.',
        traceId,
    })
}

function isFiniteNonNegativeNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isNonNegativeInteger(value: unknown): value is number {
    return isFiniteNonNegativeNumber(value) && Number.isInteger(value)
}

function requiredString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0
}

function optionalString(value: unknown): value is string | null | undefined {
    return value === undefined || value === null || typeof value === 'string'
}

function normalizeItem(value: unknown, status: number, traceId?: string): ItemRow {
    if (!value || typeof value !== 'object') throw invalidResponse(status, traceId)
    const item = value as Partial<GeneratedItemResponse>
    if (
        !isNonNegativeInteger(item.id)
        || !requiredString(item.itemNo)
        || !requiredString(item.name)
        || !optionalString(item.spec)
        || !optionalString(item.category)
        || typeof item.itemType !== 'string'
        || !isItemType(item.itemType)
        || !requiredString(item.unit)
        || !isFiniteNonNegativeNumber(item.price)
        || !isFiniteNonNegativeNumber(item.stock)
        || !isFiniteNonNegativeNumber(item.safetyStock)
        || !isNonNegativeInteger(item.leadTimeDays)
    ) {
        throw invalidResponse(status, traceId)
    }

    return {
        id: item.id,
        itemNo: item.itemNo,
        name: item.name,
        spec: item.spec ?? '',
        category: item.category ?? '',
        itemType: item.itemType,
        unit: item.unit,
        price: item.price,
        stock: item.stock,
        safetyStock: item.safetyStock,
        leadTimeDays: item.leadTimeDays,
    }
}

function normalizePage(
    value: unknown,
    status: number,
    traceId?: string,
): ItemPage {
    if (!value || typeof value !== 'object') throw invalidResponse(status, traceId)
    const page = value as Partial<GeneratedItemPageResponse>
    if (
        !Array.isArray(page.content)
        || !isNonNegativeInteger(page.number)
        || !isNonNegativeInteger(page.size)
        || page.size === 0
        || !isNonNegativeInteger(page.totalElements)
        || !isNonNegativeInteger(page.totalPages)
    ) {
        throw invalidResponse(status, traceId)
    }

    const items = page.content.map(item => normalizeItem(item, status, traceId))
    const nonEmptyPageOutsideRange = items.length > 0
        && (page.totalPages === 0 || page.number >= page.totalPages)
    if (items.length > page.size || nonEmptyPageOutsideRange) {
        throw invalidResponse(status, traceId)
    }

    return {
        items,
        page: page.number,
        size: page.size,
        totalElements: page.totalElements,
        totalPages: page.totalPages,
    }
}

export async function fetchItemPage(
    client: HttpClient,
    params: ItemListParams,
    signal?: AbortSignal,
): Promise<ItemPage> {
    if (!isItemSortColumn(params.sortColumn)) {
        throw new ApiError({
            status: 0,
            code: 'INVALID_ITEM_SORT',
            message: '지원하지 않는 품목 정렬 기준입니다.',
        })
    }
    if (params.itemType !== undefined && !isItemType(params.itemType)) {
        throw new ApiError({
            status: 0,
            code: 'INVALID_ITEM_TYPE',
            message: '지원하지 않는 품목 유형입니다.',
        })
    }

    const query = new URLSearchParams({
        page: String(params.page),
        size: String(params.size),
        sort: `${params.sortColumn},${params.sortDirection}`,
    })
    const keyword = params.keyword?.trim()
    if (keyword) query.set('keyword', keyword)
    if (params.itemType) query.set('itemType', params.itemType)

    const result = await client.get<GeneratedItemPageResponse>(`items?${query.toString()}`, { signal })
    return normalizePage(result.data, result.status, result.traceId)
}
