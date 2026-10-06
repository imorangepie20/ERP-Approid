import { beforeEach, expect, it, vi } from 'vitest'
import { createHttpClient } from './http'
import {
    fetchMessageContact, fetchMessageDetail, fetchReminderHistory, requestMessageReminder,
    retryMessage, saveMessageContact,
} from './messages'

const contact = () => ({ id: 3, partnerId: 9, email: 'billing@example.test', permission: 'ALLOWED', version: 1 })
const message = () => ({
    id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', receivableId: 7, state: 'QUEUED', recipient: 'billing@example.test',
    subject: 'Subject', body: 'Body', remainingAmount: 70, requestedAt: '2026-10-04T14:00:00Z',
    expiresAt: '2026-10-04T14:15:00Z', nextAttemptAt: null, attemptCount: 0, acceptedAt: null, errorCode: null, attempts: [],
})
const uuid = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const json = (data: unknown, status: number) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

beforeEach(() => { vi.unstubAllGlobals() })

it('reads the registered message contact and rejects malformed contact data', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json({ contact: contact() }))
    const core = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch, getAccessToken: () => 'jwt' })
    expect((await fetchMessageContact(core, 9)).contact?.email).toBe('billing@example.test')
    expect(String(fetch.mock.calls[0][0])).toContain('/partners/9/message-contacts/receivable-reminder')
    fetch.mockResolvedValue(Response.json({ contact: null }))
    expect((await fetchMessageContact(core, 9)).contact).toBeNull()
    for (const bad of [{ contact: { ...contact(), version: -1 } }, { contact: { ...contact(), permission: 'UNKNOWN' } }, {}]) {
        fetch.mockResolvedValue(Response.json(bad, { headers: { 'X-Trace-Id': 'trace-contact' } }))
        await expect(fetchMessageContact(core, 9)).rejects.toMatchObject({ code: 'INVALID_RESPONSE', traceId: 'trace-contact' })
    }
})

it('saves the contact with version guard and reports creation', async () => {
    const input = { email: 'billing@example.test', permission: 'ALLOWED', expectedVersion: null, confirmationNote: '확인 근거', acknowledged: true } as const
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(json({ contact: contact() }, 201))
    const core = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch, getAccessToken: () => 'jwt' })
    const created = await saveMessageContact(core, 9, { ...input })
    expect(created.created).toBe(true)
    expect(fetch.mock.calls[0][1]?.method).toBe('PUT')
    fetch.mockResolvedValue(Response.json({ contact: contact() }))
    expect((await saveMessageContact(core, 9, { ...input, expectedVersion: 1 })).created).toBe(false)
    for (const bad of [{ ...input, email: 'not-an-address' }, { ...input, acknowledged: false }, { ...input, confirmationNote: '' }]) {
        await expect(saveMessageContact(core, 9, bad as never)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    }
})

it('requests a reminder with the reviewed snapshot and replays the same key', async () => {
    const input = { requestId: uuid, contactId: 3, expectedSnapshotHash: 'a'.repeat(64), note: '', acknowledged: true }
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(json({ message: message(), replayed: false }, 202))
    const core = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch, getAccessToken: () => 'jwt' })
    const first = await requestMessageReminder(core, 7, input)
    expect(first.replayed).toBe(false)
    expect(fetch.mock.calls[0][1]?.method).toBe('POST')
    fetch.mockResolvedValue(Response.json({ message: message(), replayed: true }))
    expect((await requestMessageReminder(core, 7, input)).replayed).toBe(true)
    for (const bad of [{ ...input, requestId: 'nope' }, { ...input, expectedSnapshotHash: 'xyz' }, { ...input, acknowledged: 'yes' }]) {
        await expect(requestMessageReminder(core, 7, bad as never)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    }
})

it('reads message detail with attempts and rejects malformed messages', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json(message()))
    const core = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch, getAccessToken: () => 'jwt' })
    expect((await fetchMessageDetail(core, message().id)).state).toBe('QUEUED')
    expect(String(fetch.mock.calls[0][0])).toContain(`/messages/${message().id}`)
    fetch.mockResolvedValue(Response.json({ ...message(), id: 'nope' }, { headers: { 'X-Trace-Id': 'trace-message' } }))
    await expect(fetchMessageDetail(core, message().id)).rejects.toMatchObject({ code: 'INVALID_RESPONSE', traceId: 'trace-message' })
})

it('reads paged message history for a receivable', async () => {
    const d = { content: [message()], number: 0, size: 20, totalElements: 1, totalPages: 1 }
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json(d))
    const core = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch, getAccessToken: () => 'jwt' })
    expect((await fetchReminderHistory(core, 7, 0)).rows[0].id).toBe(message().id)
    expect(String(fetch.mock.calls[0][0])).toContain('/receivables/7/reminders')
})

it('retries a failed message with a retry key and replays it', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(json({ message: { ...message(), state: 'QUEUED' }, replayed: false }, 202))
    const core = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch, getAccessToken: () => 'jwt' })
    expect((await retryMessage(core, message().id, uuid)).replayed).toBe(false)
    expect(fetch.mock.calls[0][1]?.method).toBe('POST')
    fetch.mockResolvedValue(Response.json({ message: message(), replayed: true }))
    expect((await retryMessage(core, message().id, uuid)).replayed).toBe(true)
    await expect(retryMessage(core, message().id, 'nope')).rejects.toMatchObject({ code: 'INVALID_INPUT' })
})
