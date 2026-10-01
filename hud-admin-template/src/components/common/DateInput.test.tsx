import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import DateInput from './DateInput'
import FormModal from './FormModal'

describe('DateInput', () => {
    it('opens the native calendar without submitting the surrounding form', async () => {
        const submit = vi.fn()
        render(<form onSubmit={submit}><DateInput aria-label="납기" /></form>)
        const input = screen.getByLabelText('납기')
        const showPicker = vi.fn()
        Object.defineProperty(input, 'showPicker', { value: showPicker })

        await userEvent.click(screen.getByRole('button', { name: '납기 달력 열기' }))

        expect(showPicker).toHaveBeenCalledOnce()
        expect(input).toHaveFocus()
        expect(submit).not.toHaveBeenCalled()
    })

    it.each([{ disabled: true }, { readOnly: true }])('disables the calendar for %o', props => {
        render(<DateInput aria-label="납기" {...props} />)
        expect(screen.getByRole('button', { name: '납기 달력 열기' })).toBeDisabled()
    })

    it('keeps manual entry available when the browser blocks the picker', async () => {
        const change = vi.fn()
        render(<DateInput aria-label="납기" onChange={change} />)
        const input = screen.getByLabelText('납기')
        Object.defineProperty(input, 'showPicker', { value: () => { throw new Error('blocked') } })

        await userEvent.click(screen.getByRole('button', { name: '납기 달력 열기' }))
        fireEvent.change(input, { target: { value: '2026-10-12' } })

        expect(input).toHaveValue('2026-10-12')
        expect(change).toHaveBeenCalledOnce()
    })

    it('passes the selected ISO date through the common business form', () => {
        const change = vi.fn()
        render(<FormModal isOpen onClose={vi.fn()} title="수주 등록"
            fields={[{ key: 'dueDate', label: '납기', type: 'date', required: true }]}
            values={{ dueDate: '' }} onChange={change} onSubmit={vi.fn()} />)

        fireEvent.change(screen.getByLabelText('납기 *'), { target: { value: '2026-10-12' } })

        expect(change).toHaveBeenCalledWith('dueDate', '2026-10-12')
        expect(screen.getByRole('button', { name: '납기 달력 열기' })).toBeEnabled()
    })
})
