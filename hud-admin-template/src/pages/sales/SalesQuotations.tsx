import { Plus, FileText, CheckCircle } from 'lucide-react'
import DataTable, { DataTableColumn } from '../../components/common/DataTable'
import StatusBadge from '../../components/common/StatusBadge'
import Button from '../../components/common/Button'
import RowActions from '../../components/common/RowActions'
import { useData, useCollection, nextId, formatWon, statusTone } from '../../store/DataContext'
import type { Quotation } from '../../store/types'
import { useFormModal } from '../../hooks/useFormModal'
import { useNavigate } from 'react-router-dom'

const SalesQuotations = () => {
    const quotations = useCollection('quotations')
    const { items, partners, create, update, remove, quotationToOrder } = useData()
    const navigate = useNavigate()

    const { openCreate, openEdit, modal, confirmDelete } = useFormModal<Quotation>({
        title: '견적',
        subtitle: '고객사·품목·단가·유효기간을 입력하세요.',
        onCreate: values => {
            const qty = Number(values.qty) || 0
            const unitPrice = Number(values.unitPrice) || 0
            create('quotations', {
                id: nextId('QT', quotations),
                customer: values.customer,
                item: values.item,
                qty,
                unitPrice,
                amount: qty * unitPrice,
                dueDate: values.dueDate,
                validUntil: values.validUntil,
                status: '작성중',
            } as Quotation)
        },
        onUpdate: (id, values) => {
            const qty = Number(values.qty) || 0
            const unitPrice = Number(values.unitPrice) || 0
            update('quotations', id, {
                customer: values.customer,
                item: values.item,
                qty,
                unitPrice,
                amount: qty * unitPrice,
                dueDate: values.dueDate,
                validUntil: values.validUntil,
            })
        },
        onDelete: id => remove('quotations', id),
        fields: () => [
            {
                key: 'customer', label: '고객사', type: 'select', required: true,
                options: partners.filter(p => p.type === '고객사').map(p => ({ label: p.name, value: p.name })),
            },
            {
                key: 'item', label: '품목', type: 'select', required: true,
                options: items.filter(i => i.type === '제품').map(i => ({ label: i.name, value: i.name })),
                onChange: (value, setField) => {
                    const item = items.find(i => i.name === value)
                    if (item) setField('unitPrice', item.price)
                },
            },
            { key: 'qty', label: '수량', type: 'number', required: true, min: 1, step: 1 },
            { key: 'unitPrice', label: '단가(원)', type: 'number', required: true, min: 0, step: 100 },
            { key: 'dueDate', label: '납기', type: 'date', required: true },
            { key: 'validUntil', label: '유효기간', type: 'date', required: true },
        ],
    })

    const handleToOrder = (q: Quotation) => {
        const newId = quotationToOrder(q.id)
        if (newId) {
            window.alert(`수주가 생성되었습니다: ${newId}`)
            navigate('/sales/orders')
        }
    }

    const columns: DataTableColumn<Quotation>[] = [
        { key: 'id', label: '견적번호', render: row => <span className="font-mono text-hud-accent-primary">{row.id}</span> },
        { key: 'customer', label: '고객사' },
        { key: 'item', label: '품목' },
        { key: 'qty', label: '수량', render: row => <span className="font-mono">{row.qty.toLocaleString()}</span> },
        { key: 'unitPrice', label: '단가', render: row => <span className="font-mono">{formatWon(row.unitPrice)}</span> },
        { key: 'amount', label: '금액', render: row => <span className="font-mono text-hud-text-primary">{formatWon(row.amount)}</span> },
        { key: 'validUntil', label: '유효기간' },
        { key: 'status', label: '상태', render: row => <StatusBadge tone={statusTone[row.status] ?? 'muted'}>{row.status}</StatusBadge> },
        {
            key: 'actions', label: '관리', sortable: false,
            render: row => (
                <RowActions onEdit={() => openEdit(row)} onDelete={() => confirmDelete(row)}>
                    {row.status !== '수주완료' && (
                        <button
                            onClick={() => handleToOrder(row)}
                            title="수주로 전환"
                            className="p-1.5 rounded hover:bg-hud-bg-hover text-hud-text-muted hover:text-hud-accent-success transition-hud"
                        >
                            <CheckCircle size={14} />
                        </button>
                    )}
                </RowActions>
            )
        },
    ]

    const totalAmount = quotations.reduce((acc, q) => acc + q.amount, 0)

    return (
        <>
            <DataTable<Quotation>
                title="견적 관리"
                subtitle={`총 ${quotations.length}건 · 합계 ${formatWon(totalAmount)}`}
                columns={columns}
                data={quotations}
                rowKey="id"
                searchPlaceholder="견적번호, 고객사, 품목 검색..."
                toolbar={
                    <Button variant="primary" glow leftIcon={<Plus size={18} />} onClick={openCreate}>
                        견적 등록
                    </Button>
                }
            />
            {modal}
        </>
    )
}

export default SalesQuotations
