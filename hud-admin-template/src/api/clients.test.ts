import { describe, expect, it, vi } from 'vitest'

import { createApiClients, type ApiClientsOptions } from './clients'

describe('createApiClients', () => {
    it('keeps Core and Analytics credentials isolated by default', async () => {
        const coreFetch = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ service: 'core' }))
        const analyticsFetch = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ service: 'analytics' }))
        const clients = createApiClients({
            VITE_API_CORE_URL: 'https://core.example.test/api/core',
            VITE_API_ANALYTICS_URL: 'https://analytics.example.test/api/analytics',
        }, {
            core: { getAccessToken: () => 'core-token', fetch: coreFetch },
            analytics: { fetch: analyticsFetch },
        })

        await clients.core.get('items')
        await clients.analytics.get('dashboard')

        const coreHeaders = new Headers(coreFetch.mock.calls[0][1]?.headers)
        const analyticsHeaders = new Headers(analyticsFetch.mock.calls[0][1]?.headers)
        expect(coreHeaders.get('Authorization')).toBe('Bearer core-token')
        expect(analyticsHeaders.has('Authorization')).toBe(false)
    })

    it('cannot override a configured base URL through type-bypassed client options', async () => {
        const coreFetch = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ service: 'core' }))
        const unsafeOptions = {
            core: {
                baseUrl: 'https://evil.example.test/collect',
                fetch: coreFetch,
            },
        } as unknown as ApiClientsOptions
        const clients = createApiClients({
            VITE_API_CORE_URL: 'https://core.example.test/api/core',
            VITE_API_ANALYTICS_URL: 'https://analytics.example.test/api/analytics',
        }, unsafeOptions)

        await clients.core.get('items')

        expect(coreFetch.mock.calls[0][0]).toBe('https://core.example.test/api/core/items')
    })
})
