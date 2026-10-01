import { readApiConfig, type ApiEnvironment } from './config'
import { createHttpClient, type ApiError } from './http'

export interface ApiClientAuthOptions {
    getAccessToken?: () => string | null | undefined
    getAuthGeneration?: () => number | undefined
    onUnauthorized?: (error: ApiError, authGeneration?: number) => void | Promise<void>
}

export interface ApiClientOptions extends ApiClientAuthOptions {
    fetch?: typeof globalThis.fetch
}

export interface ApiClientsOptions {
    core?: ApiClientOptions
    analytics?: ApiClientOptions
}

export function createApiClients(
    env: ApiEnvironment = import.meta.env,
    options: ApiClientsOptions = {},
) {
    const config = readApiConfig(env)
    const coreOptions = options.core
    const analyticsOptions = options.analytics
    return {
        core: createHttpClient({
            baseUrl: config.coreUrl,
            fetch: coreOptions?.fetch,
            getAccessToken: coreOptions?.getAccessToken,
            getAuthGeneration: coreOptions?.getAuthGeneration,
            onUnauthorized: coreOptions?.onUnauthorized,
        }),
        analytics: createHttpClient({
            baseUrl: config.analyticsUrl,
            fetch: analyticsOptions?.fetch,
            getAccessToken: analyticsOptions?.getAccessToken,
            getAuthGeneration: analyticsOptions?.getAuthGeneration,
            onUnauthorized: analyticsOptions?.onUnauthorized,
        }),
    }
}
