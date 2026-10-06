import { expect, it, vi } from 'vitest'
import { createHttpClient } from './http'
import { collectReceivable, fetchReceivableDetail, fetchReceivablePage, fetchReceivableSummary, fetchReminderPreview, validReminderRecipient } from './receivables'

const row = () => ({ id: 7, receivableNo: 'RV-LIVE', customerId: 9, customerName: '실제 고객', salesOrderId: 42 as number | null,
    salesOrderNo: 'SO-LIVE' as string | null, amount: 123400, collectedAmount: 0, openingCollectedAmount: 0, remainingAmount: 123400, dueDate: '2026-10-01', overdueDays: 3, status: '미수', overdue: true, referenceDate: '2026-10-04' })
const page = () => ({ content: [row()], number: 0, size: 10, totalElements: 1, totalPages: 1 })
const filters = { customerId: 9, status: '미수', overdue: 'true', keyword: '고객_100%', sort: 'amount,asc', page: 0, size: 10 }
it('uses real read resource, JWT, literal filters and abort signal', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json(page())), signal = new AbortController().signal
    const core = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch, getAccessToken: () => 'jwt' })
    expect((await fetchReceivablePage(core, filters, signal)).rows[0].amount).toBe(123400)
    const [input, init] = fetch.mock.calls[0], url = new URL(String(input))
    expect(url.pathname).toBe('/api/core/receivables'); expect(url.searchParams.get('keyword')).toBe('고객_100%')
    expect(url.searchParams.get('customerId')).toBe('9'); expect(url.searchParams.get('overdue')).toBe('true')
    expect(init?.method).toBe('GET'); expect(init?.signal).toBe(signal); expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer jwt')
})
it('preserves null links and collected principal with zero overdue days', async () => {
    const d = page(); Object.assign(d.content[0], { salesOrderId: null, salesOrderNo: null, status: '수납완료', collectedAmount: 123400, openingCollectedAmount: 123400, remainingAmount: 0, overdue: false, overdueDays: 0 })
    const core = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch: vi.fn().mockResolvedValue(Response.json(d)) })
    const r = (await fetchReceivablePage(core, filters)).rows[0]
    expect(r.salesOrderId).toBeNull(); expect(r.amount).toBe(123400); expect(r.overdueDays).toBe(0)
})
it.each(['bad id', 'missing customer', 'unsafe amount', 'negative amount', 'invalid date', 'missing reference', 'invalid state', 'stale days', 'wrong overdue', 'unpaired link', 'bad page'])('rejects %s without fallback and preserves trace', async reason => {
    const d = page()
    if (reason === 'bad id') d.content[0].id = 0
    if (reason === 'missing customer') d.content[0].customerName = ''
    if (reason === 'unsafe amount') d.content[0].amount = Number.MAX_SAFE_INTEGER + 1
    if (reason === 'negative amount') d.content[0].amount = -1
    if (reason === 'invalid date') d.content[0].dueDate = '2026-02-30'
    if (reason === 'missing reference') Object.assign(d.content[0], { referenceDate: undefined })
    if (reason === 'invalid state') d.content[0].status = '미납'
    if (reason === 'stale days') d.content[0].overdueDays = 999
    if (reason === 'wrong overdue') d.content[0].overdue = false
    if (reason === 'unpaired link') d.content[0].salesOrderId = null
    if (reason === 'bad page') d.size = 0
    const core = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch: vi.fn().mockResolvedValue(Response.json(d, { headers: { 'X-Trace-Id': 'trace-invalid' } })) })
    await expect(fetchReceivablePage(core, filters)).rejects.toMatchObject({ code: 'INVALID_RESPONSE', traceId: 'trace-invalid' })
})
it('reads zero summary and rejects impossible totals with trace', async () => {
    const d = { openCount: 0, openAmount: 0, overdueCount: 0, overdueAmount: 0, openBalance: 0, overdueBalance: 0, referenceDate: '2026-10-04' }
    const fetch = vi.fn().mockResolvedValue(Response.json(d)), core = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch })
    expect(await fetchReceivableSummary(core)).toEqual(d)
    expect(String(fetch.mock.calls[0][0])).toContain('/receivables/summary')
    for (const invalid of [{ overdueCount: 1 }, { overdueAmount: 1 }, { openAmount: '0' }, { referenceDate: 'bad' }, { openCount: -1 }]) {
        fetch.mockResolvedValue(Response.json({ ...d, ...invalid }, { headers: { 'X-Trace-Id': 'trace-summary' } }))
        await expect(fetchReceivableSummary(core)).rejects.toMatchObject({ code: 'INVALID_RESPONSE', traceId: 'trace-summary' })
    }
})

const input = { amount: 30, collectedOn: '2026-10-04', requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }
const collection = () => ({ id: 1, ...input, remainingAmount: 123370, actorId: 1, traceId: 'trace-write', recordedAt: '2026-10-04T01:00:00Z' })
const result = () => ({ receivable: { ...row(), collectedAmount: 30, remainingAmount: 123370 }, collection: collection(), replayed: false })
it('posts the exact request key and preserves the original balance snapshot on a later replay', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json(result()))
    const core = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch, getAccessToken: () => 'jwt' })
    expect((await collectReceivable(core, 7, input)).collection.remainingAmount).toBe(123370)
    const [url, init] = fetch.mock.calls[0]
    expect(String(url)).toBe('https://core.test/api/core/receivables/7/collect')
    expect(init?.method).toBe('POST'); expect(JSON.parse(String(init?.body))).toEqual(input)
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer jwt')
    const replay = result(); replay.replayed = true; replay.receivable.collectedAmount = 50; replay.receivable.remainingAmount = 123350
    fetch.mockResolvedValue(Response.json(replay))
    const saved = await collectReceivable(core, 7, input)
    expect(saved.collection.remainingAmount).toBe(123370); expect(saved.receivable.remainingAmount).toBe(123350)
})
it.each(['different key', 'impossible balance', 'fabricated opening history', 'missing actor'])('rejects collection response with %s and keeps the trace', async reason => {
    const d = result()
    if (reason === 'different key') d.collection.requestId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    if (reason === 'impossible balance') d.collection.remainingAmount = 0
    if (reason === 'fabricated opening history') d.receivable.openingCollectedAmount = 30
    if (reason === 'missing actor') d.collection.actorId = 0
    const core = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch: vi.fn().mockResolvedValue(Response.json(d, { headers: { 'X-Trace-Id': 'trace-result' } })) })
    await expect(collectReceivable(core, 7, input)).rejects.toMatchObject({ code: 'INVALID_RESPONSE', traceId: 'trace-result' })
})
it('reads paged real history and rejects a history amount greater than the recorded new collections', async () => {
    const d = { receivable: result().receivable, collections: { content: [collection()], number: 1, size: 20, totalElements: 21, totalPages: 2 } }
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json(d)), signal = new AbortController().signal
    const core = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch })
    expect((await fetchReceivableDetail(core, 7, 1, signal)).collections.rows[0].amount).toBe(30)
    expect(String(fetch.mock.calls[0][0])).toContain('/receivables/7?page=1&size=20'); expect(fetch.mock.calls[0][1]?.signal).toBe(signal)
    d.receivable.openingCollectedAmount = 30
    fetch.mockResolvedValue(Response.json(d, { headers: { 'X-Trace-Id': 'trace-detail' } }))
    await expect(fetchReceivableDetail(core, 7, 1)).rejects.toMatchObject({ code: 'INVALID_RESPONSE', traceId: 'trace-detail' })
})

it('reads real nullable contact preview with JWT/abort and rejects malformed or mismatched data', async () => {
    const d = { receivable: row(), contactName: null, contact: null }
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json(d)), signal = new AbortController().signal
    const core = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch, getAccessToken: () => 'jwt' })
    expect((await fetchReminderPreview(core, 7, signal)).contact).toBeNull()
    const [url, init] = fetch.mock.calls[0]
    expect(String(url)).toContain('/receivables/7/reminder-preview'); expect(init?.signal).toBe(signal)
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer jwt')
    for (const bad of [{ ...d, contact: 123 }, { ...d, contactName: undefined }, { ...d, receivable: { ...row(), id: 8 } }]) {
        fetch.mockResolvedValue(Response.json(bad, { headers: { 'X-Trace-Id': 'trace-preview' } }))
        await expect(fetchReminderPreview(core, 7)).rejects.toMatchObject({ code: 'INVALID_RESPONSE', traceId: 'trace-preview' })
    }
})
it('validates review-only email/mobile syntax without treating a generic contact as consent', () => {
    for (const address of ['a@example.test', ' a@example.test ']) expect(validReminderRecipient('EMAIL', address)).toBe(true)
    for (const address of ['', 'bad', 'a@b', 'a@example.test\nb@example.test', '<a@example.test>', 'x'.repeat(255) + '@a.test']) expect(validReminderRecipient('EMAIL', address)).toBe(false)
    for (const phone of ['010-1234-5678', '010 1234 5678', '0111234567']) expect(validReminderRecipient('SMS', phone)).toBe(true)
    for (const phone of ['', '0212345678', '0101234abcd', '0101234567890']) expect(validReminderRecipient('SMS', phone)).toBe(false)
})
