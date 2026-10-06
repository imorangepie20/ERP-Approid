import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { DataProvider, useData } from './DataContext'

function Probe() {
    const data = useData() as unknown as Record<string, unknown>
    return <>
        <output aria-label="receive-path">{String(data.receivePurchaseOrder)}</output>
        <output aria-label="receivings-state">{String((data as { state?: unknown }).state ?? data.receivings)}</output>
    </>
}

it('no longer exposes the memory purchase-receiving path', () => {
    render(<DataProvider><Probe /></DataProvider>)
    expect(screen.getByLabelText('receive-path')).toHaveTextContent('undefined')
    expect(screen.getByLabelText('receivings-state')).toHaveTextContent('undefined')
})
