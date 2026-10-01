import type { PropsWithChildren, ReactNode } from 'react'

import { ApiError } from '../../api/http'

export interface AsyncStateProps extends PropsWithChildren {
    isLoading?: boolean
    isEmpty?: boolean
    error?: unknown
    onRetry?: () => void
    loadingMessage?: string
    emptyMessage?: ReactNode
}

export function AsyncState({
    isLoading = false,
    isEmpty = false,
    error,
    onRetry,
    loadingMessage = '불러오는 중...',
    emptyMessage = '표시할 데이터가 없습니다.',
    children,
}: AsyncStateProps) {
    if (isLoading) {
        return <div role="status" aria-live="polite" className="p-6 text-center text-[var(--hud-text-secondary)]">{loadingMessage}</div>
    }

    if (error) {
        const apiError = error instanceof ApiError ? error : undefined
        const message = apiError?.message ?? '요청을 처리하지 못했습니다.'
        return (
            <div role="alert" className="p-6 text-center text-[var(--hud-accent-danger)]">
                <p>{message}</p>
                {apiError?.traceId && <p className="mt-2 text-xs text-[var(--hud-text-muted)]">Trace ID: {apiError.traceId}</p>}
                {onRetry && (
                    <button type="button" className="mt-4 rounded border px-3 py-2" onClick={onRetry}>
                        다시 시도
                    </button>
                )}
            </div>
        )
    }

    if (isEmpty) {
        return <div className="p-6 text-center text-[var(--hud-text-secondary)]">{emptyMessage}</div>
    }

    return <>{children}</>
}
