import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import BoardNotices from './board/BoardNotices'
import BoardNotify from './board/BoardNotify'
import ComingSoon from './ComingSoon'
import EquipmentMaintenance from './equipment/EquipmentMaintenance'
import HumanResources from './hr/HumanResources'
import QualityDefects from './quality/QualityDefects'
import QualityInspections from './quality/QualityInspections'
import Settings from './Settings'
import Subcontract from './subcontract/Subcontract'

const cases: Array<[string, () => JSX.Element, string]> = [
    ['검사 실적', QualityInspections, '검사 등록'],
    ['불량 집계', QualityDefects, '불량 등록'],
    ['설비 점검', EquipmentMaintenance, '점검 등록'],
    ['직원 관리', HumanResources, '직원 등록'],
    ['외주 관리', Subcontract, '외주 발주'],
    ['공지사항', BoardNotices, '공지 등록'],
    ['알림 발송', BoardNotify, '알림 발송'],
]

it.each(cases)('%s: unimplemented register button is disabled with a pending notice', (_label, Page, name) => {
    render(<Page />)
    const button = screen.getByRole('button', { name })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('title', '준비 중')
})

it('notice titles do not pretend to be clickable', () => {
    render(<BoardNotices />)
    const title = screen.getByText('추석 연휴 기간 자재 입출고 중단 안내')
    expect(title.className).not.toContain('cursor-pointer')
})

it('settings: dead save/enable buttons are disabled with a pending notice', () => {
    render(<Settings />)
    const save = screen.getByRole('button', { name: 'Save Changes' })
    expect(save).toBeDisabled()
    expect(save).toHaveAttribute('title', '준비 중')
})

it('settings: dead security button is disabled with a pending notice', async () => {
    render(<Settings />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Security' }))
    const enable = screen.getByRole('button', { name: 'Enable' })
    expect(enable).toBeDisabled()
    expect(enable).toHaveAttribute('title', '준비 중')
})

it('settings: appearance option buttons are disabled with a pending notice', async () => {
    render(<Settings />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Appearance' }))
    const accent = document.querySelectorAll('button[style]')
    expect(accent.length).toBeGreaterThan(0)
    accent.forEach(button => {
        expect(button).toBeDisabled()
        expect(button).toHaveAttribute('title', '준비 중')
    })
    const sizes = within(screen.getByText('Font Size').closest('div')!).getAllByRole('button')
    expect(sizes.map(b => b.textContent)).toEqual(['Small', 'Medium', 'Large'])
    sizes.forEach(button => {
        expect(button).toBeDisabled()
        expect(button).toHaveAttribute('title', '준비 중')
    })
})

it('coming-soon notify button is disabled with a pending notice', () => {
    render(<ComingSoon />)
    const button = screen.getByRole('button', { name: 'Notify Me' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('title', '준비 중')
})
