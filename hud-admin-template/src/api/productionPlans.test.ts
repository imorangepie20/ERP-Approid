import { beforeEach, expect, it, vi } from 'vitest'
import { createHttpClient } from './http'
import {
    closeProductionPlan, confirmProductionPlan, createProductionPlan,
    fetchProductionPlanPage, updateProductionPlan,
} from './productionPlans'

const row = (overrides = {}) => ({ id: 7, planNo: 'PL-2611-001', itemId: 9, itemNo: 'FG-001',
    itemName: '프레임 가조립품', planMonth: '2026-11', planQty: 400, orderQty: 320,
    stockQty: 60, gapQty: 20, status: '계획', ...overrides })
const input = () => ({ planNo: 'PL-2611-001', itemId: 9, planMonth: '2026-11', planQty: 400 })
const json = (data: unknown, status: number) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

beforeEach(() => { vi.unstubAllGlobals() })

it('reads a server-paged plan list with month and status filters', async () => {
    const page = { content: [row()], number: 0, size: 20, totalElements: 1, totalPages: 1 }
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json(page))
    const core = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch, getAccessToken: () => 'jwt' })
    const result = await fetchProductionPlanPage(core, { planMonth: '2026-11', status: '계획', page: 0, size: 20, sort: 'planNo,asc' })
    expect(result.rows[0].planNo).toBe('PL-2611-001')
    const url = String(fetch.mock.calls[0][0])
    expect(url).toContain('production-plans?page=0')
    expect(url).toContain('planMonth=2026-11')
    expect(url).toContain('status=')
    await expect(fetchProductionPlanPage(core, { status: 'UNKNOWN', page: 0, size: 20, sort: 'planNo,asc' })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(fetchProductionPlanPage(core, { planMonth: '2026/11', page: 0, size: 20, sort: 'planNo,asc' })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(fetchProductionPlanPage(core, { page: -1, size: 20, sort: 'planNo,asc' })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
})

it('rejects malformed plan rows', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json({ content: [row()], number: 0, size: 20, totalElements: 1, totalPages: 1 }))
    const core = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch, getAccessToken: () => 'jwt' })
    expect((await fetchProductionPlanPage(core, { page: 0, size: 20, sort: 'planNo,asc' })).rows[0].gapQty).toBe(20)
    fetch.mockResolvedValue(Response.json({ content: [{ ...row(), status: 'UNKNOWN' }], number: 0, size: 20, totalElements: 1, totalPages: 1 }, { headers: { 'X-Trace-Id': 'trace-plan' } }))
    await expect(fetchProductionPlanPage(core, { page: 0, size: 20, sort: 'planNo,asc' })).rejects.toMatchObject({ code: 'INVALID_RESPONSE', traceId: 'trace-plan' })
})

it('creates a plan and validates client input before sending', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(json(row(), 201))
    const core = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch, getAccessToken: () => 'jwt' })
    expect((await createProductionPlan(core, input())).planNo).toBe('PL-2611-001')
    expect(fetch.mock.calls[0][1]?.method).toBe('POST')
    for (const bad of [{ ...input(), planNo: '' }, { ...input(), itemId: 0 }, { ...input(), planMonth: '' },
        { ...input(), planMonth: '2026/11' }, { ...input(), planQty: 0 }, { ...input(), planQty: -5 }]) {
        await expect(createProductionPlan(core, bad as never)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    }
    expect(fetch.mock.calls.filter(([, init]) => init?.method === 'POST').length).toBe(1)
})

it('updates quantities with PATCH and validates the id', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json(row({ gapQty: 50 })))
    const core = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch, getAccessToken: () => 'jwt' })
    expect((await updateProductionPlan(core, 7, input())).gapQty).toBe(50)
    expect(fetch.mock.calls[0][1]?.method).toBe('PATCH')
    await expect(updateProductionPlan(core, 0, input())).rejects.toMatchObject({ code: 'INVALID_INPUT' })
})

it('confirms a draft plan and closes a confirmed plan', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json(row({ status: '확정' })))
    const core = createHttpClient({ baseUrl: 'https://core.test/api/core', fetch, getAccessToken: () => 'jwt' })
    expect((await confirmProductionPlan(core, 7)).status).toBe('확정')
    expect(fetch.mock.calls[0][1]?.method).toBe('POST')
    expect(String(fetch.mock.calls[0][0])).toContain('/production-plans/7/confirm')
    fetch.mockResolvedValue(Response.json(row({ status: '종결' })))
    expect((await closeProductionPlan(core, 7)).status).toBe('종결')
    expect(String(fetch.mock.calls[1][0])).toContain('/production-plans/7/close')
    await expect(confirmProductionPlan(core, 0)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(closeProductionPlan(core, 0)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
})
