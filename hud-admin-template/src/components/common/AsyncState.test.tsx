import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../api/http'
import { AsyncState } from './AsyncState'

describe('AsyncState', () => {
    it('announces loading and empty states', () => {
        const { rerender } = render(<AsyncState isLoading>content</AsyncState>)
        expect(screen.getByRole('status')).toHaveTextContent('불러오는 중')

        rerender(<AsyncState isEmpty>content</AsyncState>)
        expect(screen.getByText('표시할 데이터가 없습니다.')).toBeInTheDocument()
    })

    it('shows a retry action and trace ID for API errors', async () => {
        const user = userEvent.setup()
        const onRetry = vi.fn()
        render(
            <AsyncState
                error={new ApiError({
                    status: 500,
                    code: 'SERVER_ERROR',
                    message: '처리 중 오류가 발생했습니다.',
                    traceId: 'trace-500',
                })}
                onRetry={onRetry}
            >
                content
            </AsyncState>,
        )

        expect(screen.getByRole('alert')).toHaveTextContent('처리 중 오류가 발생했습니다.')
        expect(screen.getByText(/trace-500/)).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: '다시 시도' }))
        expect(onRetry).toHaveBeenCalledOnce()
    })

    it('renders its children after the request succeeds', () => {
        render(<AsyncState><p>완료된 데이터</p></AsyncState>)
        expect(screen.getByText('완료된 데이터')).toBeInTheDocument()
    })

    it('does not expose arbitrary messages from non-API errors', () => {
        render(<AsyncState error={new Error('database-password=secret')}>content</AsyncState>)

        expect(screen.getByRole('alert')).toHaveTextContent('요청을 처리하지 못했습니다.')
        expect(screen.queryByText(/database-password/)).not.toBeInTheDocument()
    })
})
