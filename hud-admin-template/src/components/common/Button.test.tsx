import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import Button from './Button'

describe('Button', () => {
    it('renders with an accessible name and handles a click', async () => {
        const user = userEvent.setup()
        const handleClick = vi.fn()

        render(<Button onClick={handleClick}>Save</Button>)

        const button = screen.getByRole('button', { name: 'Save' })
        await user.click(button)

        expect(button).toBeInTheDocument()
        expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('does not handle a click when disabled', async () => {
        const user = userEvent.setup()
        const handleClick = vi.fn()

        render(
            <Button disabled onClick={handleClick}>
                Save
            </Button>,
        )

        const button = screen.getByRole('button', { name: 'Save' })
        await user.click(button)

        expect(button).toBeDisabled()
        expect(handleClick).not.toHaveBeenCalled()
    })
})
