import { describe, expect, it, vi } from 'vitest'
import { createHttpClient } from './http'
import { createPartner, deletePartner, fetchPartnerOptions, fetchPartnerPage, updatePartner } from './partners'

const row = { id: 1, partnerNo: 'C-001', name: '거래처', partnerType: '고객사' as const,
    contact: null, contactName: null, paymentTerms: 30, leadTimeDays: 2 }
const baseUrl = 'https://core.example.test/api/core'
const page = { content: [row], number: 0, size: 100, totalElements: 1, totalPages: 1 }

describe('partners API', () => {
    it('encodes filters and preserves authentication and cancellation', async () => {
        const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json(page))
        const client = createHttpClient({ baseUrl, fetch, getAccessToken: () => 'token' })
        const signal = new AbortController().signal
        const result = await fetchPartnerPage(client, { page: 0, size: 100, keyword: '거래처 & 1', partnerType: '고객사' }, signal)
        const [input, init] = fetch.mock.calls[0]
        expect(new URL(String(input)).searchParams.get('keyword')).toBe('거래처 & 1')
        expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer token')
        expect(init?.signal).toBe(signal)
        expect(result.partners[0]).toMatchObject({ contactName: '', contact: '' })
    })

    it('fetches every option page rather than silently truncating at 100', async () => {
        const fetch = vi.fn<typeof globalThis.fetch>()
            .mockResolvedValueOnce(Response.json({ ...page, totalElements: 101, totalPages: 2 }))
            .mockResolvedValueOnce(Response.json({ ...page, number: 1, content: [{ ...row, id: 2 }], totalElements: 101, totalPages: 2 }))
        const result = await fetchPartnerOptions(createHttpClient({ baseUrl, fetch }), '고객사')
        expect(result.map(p => p.id)).toEqual([1, 2])
        expect(new URL(String(fetch.mock.calls[1][0])).searchParams.get('page')).toBe('1')
    })

    it('rejects malformed responses with a trace ID', async () => {
        const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json({ ...page,
            content: [{ ...row, paymentTerms: -1 }] }, { headers: { 'X-Trace-Id': 'partner-invalid' } }))
        await expect(fetchPartnerPage(createHttpClient({ baseUrl, fetch }), { page: 0, size: 10 }))
            .rejects.toMatchObject({ code: 'INVALID_RESPONSE', traceId: 'partner-invalid' })
    })

    it('uses POST, partial PATCH and DELETE and blocks invalid IDs', async () => {
        const fetch = vi.fn<typeof globalThis.fetch>()
            .mockResolvedValueOnce(Response.json(row, { status: 201 }))
            .mockResolvedValueOnce(Response.json({ ...row, paymentTerms: 45 }))
            .mockResolvedValueOnce(new Response(null, { status: 204 }))
        const client = createHttpClient({ baseUrl, fetch })
        await createPartner(client, { ...row, contact: '', contactName: '' })
        await updatePartner(client, 1, { paymentTerms: 45 })
        await deletePartner(client, 1)
        expect(fetch.mock.calls.map(([, init]) => init?.method)).toEqual(['POST', 'PATCH', 'DELETE'])
        expect(JSON.parse(String(fetch.mock.calls[1][1]?.body))).toEqual({ paymentTerms: 45 })
        await expect(deletePartner(client, -1)).rejects.toMatchObject({ code: 'INVALID_PARTNER_ID' })
        expect(fetch).toHaveBeenCalledTimes(3)
    })
})
