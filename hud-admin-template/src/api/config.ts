export type ApiEnvironment = Record<string, string | boolean | undefined>

export interface ApiConfig {
    coreUrl: string
    analyticsUrl: string
}

const loopbackHostnames = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

export function normalizeApiBaseUrl(value: unknown, name = 'API baseUrl'): string {
    if (typeof value !== 'string' || value.trim() === '') throw new Error(`${name} 환경 변수가 필요합니다.`)

    let url: URL
    try {
        url = new URL(value)
    } catch {
        throw new Error(`${name}에는 HTTP(S) 절대 URL을 지정해야 합니다.`)
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error(`${name}에는 HTTP(S) 절대 URL을 지정해야 합니다.`)
    }
    if (url.protocol === 'http:' && !loopbackHostnames.has(url.hostname)) {
        throw new Error(`${name}는 loopback 외부에서 HTTPS를 사용해야 합니다.`)
    }
    if (url.username || url.password) {
        throw new Error(`${name}에 사용자 정보나 비밀번호를 포함할 수 없습니다.`)
    }

    return url.toString().replace(/\/$/, '')
}

export function readApiConfig(env: ApiEnvironment): ApiConfig {
    return {
        coreUrl: normalizeApiBaseUrl(env.VITE_API_CORE_URL, 'VITE_API_CORE_URL'),
        analyticsUrl: normalizeApiBaseUrl(env.VITE_API_ANALYTICS_URL, 'VITE_API_ANALYTICS_URL'),
    }
}
