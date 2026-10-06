import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import DataTable, { type DataTableColumn } from './DataTable'

interface Row extends Record<string, unknown> {
    id: number
    name: string
}

const columns: DataTableColumn<Row>[] = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: '이름' },
]

describe('DataTable', () => {
    it('labels the search and allows a page to omit unsupported export actions', () => {
        const view = render(<DataTable columns={columns} data={[]} rowKey="id" />)
        expect(screen.getByRole('textbox', { name: '검색...' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '내보내기' })).toBeInTheDocument()
        view.rerender(<DataTable columns={columns} data={[]} rowKey="id" exportAction={null} />)
        expect(screen.queryByRole('button', { name: '내보내기' })).not.toBeInTheDocument()
    })

    it('keeps the existing client-side search and pagination behavior by default', () => {
        const data = Array.from({ length: 6 }, (_, index) => ({
            id: index + 1,
            name: `행 ${index + 1}`,
        }))

        render(<DataTable columns={columns} data={data} rowKey="id" initialPageSize={5} />)

        expect(screen.getByText('행 1')).toBeInTheDocument()
        expect(screen.queryByText('행 6')).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }))
        expect(screen.getByText('행 6')).toBeInTheDocument()

        fireEvent.change(screen.getByPlaceholderText('검색...'), { target: { value: '행 2' } })
        expect(screen.getByText('행 2')).toBeInTheDocument()
        expect(screen.queryByText('행 6')).not.toBeInTheDocument()
    })

    it('delegates remote search, pagination, page size, and sorting without slicing data again', () => {
        const onSearchQueryChange = vi.fn()
        const onPageChange = vi.fn()
        const onRowsPerPageChange = vi.fn()
        const onSortChange = vi.fn()

        render(
            <DataTable
                columns={columns}
                data={[{ id: 3, name: '서버 행 3' }, { id: 4, name: '서버 행 4' }]}
                rowKey="id"
                remote={{
                    searchQuery: '서버에만 존재하는 검색어',
                    currentPage: 2,
                    rowsPerPage: 2,
                    totalElements: 12,
                    totalPages: 6,
                    sortColumn: 'id',
                    sortDirection: 'asc',
                    onSearchQueryChange,
                    onPageChange,
                    onRowsPerPageChange,
                    onSortChange,
                }}
            />,
        )

        expect(screen.getByText('서버 행 3')).toBeInTheDocument()
        expect(screen.getByText('서버 행 4')).toBeInTheDocument()
        expect(screen.getByText('3~4 / 총 12건')).toBeInTheDocument()

        fireEvent.change(screen.getByPlaceholderText('검색...'), { target: { value: '새 검색' } })
        expect(onSearchQueryChange).toHaveBeenCalledWith('새 검색')
        fireEvent.click(screen.getByRole('button', { name: '3' }))
        expect(onPageChange).toHaveBeenCalledWith(3)
        fireEvent.change(screen.getByRole('combobox'), { target: { value: '5' } })
        expect(onRowsPerPageChange).toHaveBeenCalledWith(5)
        expect(screen.getByRole('columnheader', { name: /ID/ })).toHaveAttribute('aria-sort', 'ascending')
        fireEvent.click(screen.getByRole('button', { name: 'ID 정렬' }))
        expect(onSortChange).toHaveBeenCalledWith('id', 'desc')
    })

    it('renders sortable headers as keyboard-operable buttons with aria-sort', () => {
        render(<DataTable columns={columns} data={[{ id: 1, name: '행 1' }]} rowKey="id" />)

        const header = screen.getByRole('columnheader', { name: /ID/ })
        const sortButton = screen.getByRole('button', { name: 'ID 정렬' })
        expect(header).toHaveAttribute('aria-sort', 'none')
        expect(sortButton.tagName).toBe('BUTTON')

        fireEvent.click(sortButton)
        expect(header).toHaveAttribute('aria-sort', 'ascending')
        fireEvent.click(sortButton)
        expect(header).toHaveAttribute('aria-sort', 'descending')
    })

    it('uses a supplied filter slot instead of the inert default filter button', () => {
        render(
            <DataTable
                columns={columns}
                data={[]}
                rowKey="id"
                filter={<select aria-label="유형 필터"><option>전체</option></select>}
            />,
        )

        expect(screen.getByRole('combobox', { name: '유형 필터' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '필터' })).not.toBeInTheDocument()
    })
})
