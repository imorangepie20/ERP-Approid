import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Authorize, hasAnyRole } from './authorization'

describe('authorization', () => {
    it('matches any current role', () => {
        expect(hasAnyRole(['SALES', 'QUALITY'], ['ADMIN', 'QUALITY'])).toBe(true)
        expect(hasAnyRole(['SALES'], ['ADMIN', 'QUALITY'])).toBe(false)
        expect(hasAnyRole(['SALES'], [])).toBe(true)
    })

    it('renders authorized content or an explicit fallback', () => {
        const { rerender } = render(
            <Authorize roles={['SALES']} anyOf={['SALES']} fallback={<span>권한 없음</span>}>
                <button>승인</button>
            </Authorize>,
        )
        expect(screen.getByRole('button', { name: '승인' })).toBeInTheDocument()

        rerender(
            <Authorize roles={['QUALITY']} anyOf={['SALES']} fallback={<span>권한 없음</span>}>
                <button>승인</button>
            </Authorize>,
        )
        expect(screen.queryByRole('button', { name: '승인' })).not.toBeInTheDocument()
        expect(screen.getByText('권한 없음')).toBeInTheDocument()
    })
})
