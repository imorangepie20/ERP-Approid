import { describe, expect, it, vi } from 'vitest'

import { createHttpClient } from './http'
import { createItem, deleteItem, fetchItemPage, updateItem } from './items'

const validPage = {
    content: [{
        id: 7,
        itemNo: 'M-S002',
        name: '파이프 Ø48.6',
        spec: 'STKR-400 t2.0',
        category: '소재',
        itemType: '자재',
        unit: 'M',
        price: 9200,
        stock: 1450,
        safetyStock: 500,
        leadTimeDays: 7,
    }],
    number: 1,
    size: 5,
    totalElements: 8,
    totalPages: 2,
}

describe('items API', () => {
    it('requests the generated item page contract with encoded server controls', async () => {
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json(validPage))
        const client = createHttpClient({
            baseUrl: 'https://core.example.test/api/core',
            getAccessToken: () => 'access-token',
            fetch: fetchMock,
        })
        const controller = new AbortController()

        const page = await fetchItemPage(client, {
            keyword: ' 파이프 & 소재 ',
            itemType: '자재',
            page: 1,
            size: 5,
            sortColumn: 'itemNo',
            sortDirection: 'asc',
        }, controller.signal)

        const [requestUrl, requestInit] = fetchMock.mock.calls[0]
        const url = new URL(String(requestUrl))
        expect(url.pathname).toBe('/api/core/items')
        expect(url.searchParams.get('keyword')).toBe('파이프 & 소재')
        expect(url.searchParams.get('itemType')).toBe('자재')
        expect(url.searchParams.get('page')).toBe('1')
        expect(url.searchParams.get('size')).toBe('5')
        expect(url.searchParams.get('sort')).toBe('itemNo,asc')
        expect(new Headers(requestInit?.headers).get('Authorization')).toBe('Bearer access-token')
        expect(requestInit?.signal).toBe(controller.signal)
        expect(page.items[0]).toMatchObject({ id: 7, itemNo: 'M-S002', leadTimeDays: 7 })
        expect(page).toMatchObject({ page: 1, size: 5, totalElements: 8, totalPages: 2 })
    })

    it('omits itemType when the all-types filter is selected', async () => {
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json(validPage))
        const client = createHttpClient({ baseUrl: 'https://core.example.test/api/core', fetch: fetchMock })

        await fetchItemPage(client, {
            page: 1,
            size: 5,
            sortColumn: 'itemNo',
            sortDirection: 'asc',
        })

        const url = new URL(String(fetchMock.mock.calls[0][0]))
        expect(url.searchParams.has('itemType')).toBe(false)
    })

    it('keeps numeric database ids separate from business item numbers', async () => {
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json(validPage))
        const client = createHttpClient({ baseUrl: 'https://core.example.test/api/core', fetch: fetchMock })

        const page = await fetchItemPage(client, {
            page: 0,
            size: 10,
            sortColumn: 'itemNo',
            sortDirection: 'asc',
        })

        expect(page.items[0].id).toBe(7)
        expect(page.items[0].itemNo).toBe('M-S002')
    })

    it('rejects malformed successful responses instead of rendering partial data', async () => {
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
            ...validPage,
            content: [{ ...validPage.content[0], id: 'M-S002', itemNo: undefined }],
        }, { headers: { 'X-Trace-Id': 'items-contract-1' } }))
        const client = createHttpClient({ baseUrl: 'https://core.example.test/api/core', fetch: fetchMock })

        await expect(fetchItemPage(client, {
            page: 0,
            size: 10,
            sortColumn: 'itemNo',
            sortDirection: 'asc',
        })).rejects.toMatchObject({
            code: 'INVALID_RESPONSE',
            traceId: 'items-contract-1',
        })
    })

    it('rejects item types outside the generated domain contract', async () => {
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
            ...validPage,
            content: [{ ...validPage.content[0], itemType: '서비스' }],
        }))
        const client = createHttpClient({ baseUrl: 'https://core.example.test/api/core', fetch: fetchMock })

        await expect(fetchItemPage(client, {
            page: 0,
            size: 10,
            sortColumn: 'itemNo',
            sortDirection: 'asc',
        })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
    })

    it('accepts an empty Spring page that became out of range after the result set shrank', async () => {
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
            content: [],
            number: 2,
            size: 10,
            totalElements: 11,
            totalPages: 2,
        }))
        const client = createHttpClient({ baseUrl: 'https://core.example.test/api/core', fetch: fetchMock })

        await expect(fetchItemPage(client, {
            page: 2,
            size: 10,
            sortColumn: 'itemNo',
            sortDirection: 'asc',
        })).resolves.toMatchObject({
            items: [],
            page: 2,
            totalElements: 11,
            totalPages: 2,
        })
    })
})

describe('item mutations', () => {
    it('creates an item with the documented request body and normalizes the response', async () => {
        const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
            expect(init?.method).toBe('POST')
            expect(JSON.parse(String(init?.body))).toEqual({
                itemNo: 'T-001',
                name: '테스트 품목',
                spec: 'SPEC',
                category: '테스트',
                itemType: '자재',
                unit: 'EA',
                price: 1000,
                safetyStock: 5,
                leadTimeDays: 2,
            })
            return Response.json({
                id: 91,
                itemNo: 'T-001',
                name: '테스트 품목',
                spec: 'SPEC',
                category: '테스트',
                itemType: '자재',
                unit: 'EA',
                price: 1000,
                stock: 0,
                safetyStock: 5,
                leadTimeDays: 2,
            }, { status: 201 })
        })
        const client = createHttpClient({ baseUrl: 'https://core.example.test/api/core', fetch: fetchMock })

        const result = await createItem(client, {
            itemNo: 'T-001',
            name: '테스트 품목',
            spec: 'SPEC',
            category: '테스트',
            itemType: '자재',
            unit: 'EA',
            price: 1000,
            safetyStock: 5,
            leadTimeDays: 2,
        })

        expect(new URL(String(fetchMock.mock.calls[0][0])).pathname).toBe('/api/core/items')
        expect(result).toMatchObject({ id: 91, itemNo: 'T-001', stock: 0 })
    })

    it('partially updates an item without sending its immutable item number', async () => {
        const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
            expect(init?.method).toBe('PATCH')
            expect(JSON.parse(String(init?.body))).toEqual({ price: 2000, safetyStock: 8 })
            return Response.json({
                id: 91,
                itemNo: 'T-001',
                name: '테스트 품목',
                spec: '',
                category: '',
                itemType: '자재',
                unit: 'EA',
                price: 2000,
                stock: 0,
                safetyStock: 8,
                leadTimeDays: 2,
            })
        })
        const client = createHttpClient({ baseUrl: 'https://core.example.test/api/core', fetch: fetchMock })

        const result = await updateItem(client, 91, { price: 2000, safetyStock: 8 })

        expect(new URL(String(fetchMock.mock.calls[0][0])).pathname).toBe('/api/core/items/91')
        expect(result.price).toBe(2000)
    })

    it('deletes an item by numeric database id', async () => {
        const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
            expect(init?.method).toBe('DELETE')
            return new Response(null, { status: 204 })
        })
        const client = createHttpClient({ baseUrl: 'https://core.example.test/api/core', fetch: fetchMock })

        await deleteItem(client, 91)

        expect(new URL(String(fetchMock.mock.calls[0][0])).pathname).toBe('/api/core/items/91')
    })
})
