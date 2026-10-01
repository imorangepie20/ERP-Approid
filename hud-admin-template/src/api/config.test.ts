import { describe, expect, it } from 'vitest'

import { readApiConfig } from './config'

describe('readApiConfig', () => {
    it('reads and normalizes the two public API base URLs', () => {
        expect(readApiConfig({
            VITE_API_CORE_URL: 'https://core.example.test/api/core/',
            VITE_API_ANALYTICS_URL: 'https://analytics.example.test/api/analytics/',
        })).toEqual({
            coreUrl: 'https://core.example.test/api/core',
            analyticsUrl: 'https://analytics.example.test/api/analytics',
        })
    })

    it.each([
        [{ VITE_API_ANALYTICS_URL: 'https://analytics.example.test' }, 'VITE_API_CORE_URL'],
        [{ VITE_API_CORE_URL: '/api/core', VITE_API_ANALYTICS_URL: 'https://analytics.example.test' }, 'VITE_API_CORE_URL'],
        [{ VITE_API_CORE_URL: 'http://core.example.test/api/core', VITE_API_ANALYTICS_URL: 'https://analytics.example.test' }, 'VITE_API_CORE_URL'],
    ])('rejects missing, relative, or insecure configuration', (env, variable) => {
        expect(() => readApiConfig(env)).toThrow(variable)
    })

    it.each([
        'http://localhost:38080/api/core',
        'http://127.0.0.1:38080/api/core',
        'http://[::1]:38080/api/core',
    ])('allows plain HTTP only for an exact loopback hostname', (coreUrl) => {
        expect(readApiConfig({
            VITE_API_CORE_URL: coreUrl,
            VITE_API_ANALYTICS_URL: 'http://127.0.0.1:38000/api/analytics',
        }).coreUrl).toBe(coreUrl)
    })
})
