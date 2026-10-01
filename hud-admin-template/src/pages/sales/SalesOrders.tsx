import { Plus, Factory } from 'lucide-react'
import DataTable, { DataTableColumn } from '../../components/common/DataTable'
import StatusBadge from '../../components/common/StatusBadge'
import Button from '../../components/common/Button'
import RowActions from '../../components/common/RowActions'
import { useData, useCollection, nextId, formatWon, statusTone } from '../../store/DataContext'
import type { SalesOrder } from '../../store/types'
import { useFormModal } from '../../hooks/useFormModal'
import { usePartnerSelection } from '../../hooks/usePartnerSelection'

const SalesOrders = () => {
    const orders = useCollection('salesOrders')
    const { items, create, update, remove, confirmSalesOrder } = useData()
    const partnerSelection = usePartnerSelection('고객사')

    const { openCreate, openEdit, modal, confirmDelete } = useFormModal<SalesOrder>({
        title: '수주',
        subtitle: '고객사·품목·수량·납기를 입력하세요.',
        toValues: record => partnerSelection.toValues(record, 'customerId', record.customer),
        validate: values => partnerSelection.find(values.customerId) ? null : '고객사를 다시 선택하세요.',
        onCreate: values => {
            const customer = partnerSelection.find(values.customerId)
            if (!customer) return
            const qty = Number(values.qty) || 0
            const unitPrice = Number(values.unitPrice) || 0
            create('salesOrders', {
                id: nextId('SO', orders),
                customer: customer.name,
                customerId: customer.id,
                paymentTerms: customer.paymentTerms,
                leadTimeDays: customer.leadTimeDays,
                item: values.item,
                qty,
                unitPrice,
                amount: qty * unitPrice,
                dueDate: values.dueDate,
                status: '대기',
                createdAt: new Date().toISOString().slice(0, 10),
            } as SalesOrder)
        },
        onUpdate: (id, values) => {
            const customer = partnerSelection.find(values.customerId)
            if (!customer) return
            const qty = Number(values.qty) || 0
            const unitPrice = Number(values.unitPrice) || 0
            update('salesOrders', id, {
                customer: customer.name,
                customerId: customer.id,
                paymentTerms: customer.paymentTerms,
                leadTimeDays: customer.leadTimeDays,
                item: values.item,
                qty,
                unitPrice,
                amount: qty * unitPrice,
                dueDate: values.dueDate,
            })
        },
        onDelete: id => remove('salesOrders', id),
        fields: () => [
            partnerSelection.field('customerId', '고객사'),
            ...partnerSelection.termsFields,
            {
                key: 'item', label: '품목', type: 'select', required: true,
                options: items.filter(i => i.type === '제품').map(i => ({ label: i.name, value: i.name })),
                onChange: (value, setField) => {
                    const item = items.find(i => i.name === value)
                    if (item) setField('unitPrice', item.price)
                },
            },
            { key: 'unitPrice', label: '단가(원)', type: 'number', required: true, min: 0, step: 100 },
            { key: 'qty', label: '수량', type: 'number', required: true, min: 1, step: 1 },
            { key: 'dueDate', label: '납기', type: 'date', required: true },
        ],
    })

    const handleConfirm = (so: SalesOrder) => {
        const newId = confirmSalesOrder(so.id)
        if (newId) {
            window.alert(`작업오더가 생성되었습니다: ${newId}\n생산관리 → 작업오더에서 확인하세요.`)
        } else {
            window.alert('대기 상태인 수주만 확정할 수 있습니다.')
        }
    }

    const columns: DataTableColumn<SalesOrder>[] = [
        { key: 'id', label: '수주번호', render: row => <span className="font-mono text-hud-accent-primary">{row.id}</span> },
        { key: 'customer', label: '고객사' },
        { key: 'item', label: '품목' },
        { key: 'qty', label: '수량', render: row => <span className="font-mono">{row.qty.toLocaleString()}</span> },
        { key: 'amount', label: '금액', render: row => <span className="font-mono text-hud-text-primary">{formatWon(row.amount)}</span> },
        { key: 'dueDate', label: '납기' },
        { key: 'status', label: '상태', render: row => <StatusBadge tone={statusTone[row.status] ?? 'muted'}>{row.status}</StatusBadge> },
        {
            key: 'actions', label: '관리', sortable: false,
            render: row => (
                <RowActions onEdit={() => openEdit(row)} onDelete={() => confirmDelete(row)}>
                    {row.status === '대기' && (
                        <button
                            onClick={() => handleConfirm(row)}
                            title="확정 → 작업오더 생성"
                            className="p-1.5 rounded hover:bg-hud-bg-hover text-hud-text-muted hover:text-hud-accent-success transition-hud"
                        >
                            <Factory size={14} />
                        </button>
                    )}
                </RowActions>
            )
        },
    ]

    const totalAmount = orders.reduce((acc, o) => (o.status !== '취소' ? acc + o.amount : acc), 0)

    return (
        <>
            {partnerSelection.status}
            <DataTable<SalesOrder>
                title="수주 현황"
                subtitle={`총 ${orders.length}건 · 유효 금액 ${formatWon(totalAmount)}`}
                columns={columns}
                data={orders}
                rowKey="id"
                searchPlaceholder="수주번호, 고객사, 품목 검색..."
                toolbar={
                    <Button variant="primary" glow leftIcon={<Plus size={18} />} onClick={openCreate} disabled={!partnerSelection.ready}>
                        수주 등록
                    </Button>
                }
            />
            {modal}
        </>
    )
}

export default SalesOrders
