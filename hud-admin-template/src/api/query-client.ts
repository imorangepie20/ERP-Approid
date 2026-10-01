import { QueryClient } from '@tanstack/react-query'

import { ApiError } from './http'

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
    if (failureCount >= 2) return false
    if (error instanceof ApiError) return error.status === 0 || error.status >= 500
    return false
}

export function createAppQueryClient(): QueryClient {
    return new QueryClient({
        defaultOptions: {
            queries: {
                retry: shouldRetryQuery,
                refetchOnWindowFocus: false,
            },
            mutations: {
                retry: false,
            },
        },
    })
}
