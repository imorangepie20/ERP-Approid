import { Plus } from 'lucide-react'
import DataTable, { DataTableColumn } from '../../components/common/DataTable'
import StatusBadge from '../../components/common/StatusBadge'
import Button from '../../components/common/Button'
import RowActions from '../../components/common/RowActions'
import { useData, useCollection, nextId, formatWon, statusTone } from '../../store/DataContext'
import type { PurchaseOrder } from '../../store/types'
import { useFormModal } from '../../hooks/useFormModal'
import { useState } from 'react'
import ReceiveModal from '../../components/purchase/ReceiveModal'
import { usePartnerSelection } from '../../hooks/usePartnerSelection'

const PurchaseOrders = () => {
    const purchaseOrders = useCollection('purchaseOrders')
    const { items, create, update, remove, receivePurchaseOrder } = useData()
    const partnerSelection = usePartnerSelection('발주처')
    const [receiveOpen, setReceiveOpen] = useState(false)
    const [receiveTarget, setReceiveTarget] = useState<PurchaseOrder | null>(null)

    const openReceive = (po: PurchaseOrder) => {
        setReceiveTarget(po)
        setReceiveOpen(true)
    }

    const handleSubmitReceive = (receivedQty: number, defectQty: number) => {
        if (!receiveTarget) return
        const id = receivePurchaseOrder(receiveTarget.id, receivedQty, defectQty)
        setReceiveOpen(false)
        setReceiveTarget(null)
        if (id) window.alert(`입고 완료: ${id}\n자재 재고와 LOT가 갱신되었습니다.`)
    }

    const { openCreate, openEdit, modal, confirmDelete } = useFormModal<PurchaseOrder>({
        title: '발주',
        subtitle: '발주처·품목·수량·단가를 입력하세요.',
        toValues: record => partnerSelection.toValues(record, 'vendorId', record.vendor),
        validate: values => partnerSelection.find(values.vendorId) ? null : '발주처를 다시 선택하세요.',
        onCreate: values => {
            const vendor = partnerSelection.find(values.vendorId)
            if (!vendor) return
            const qty = Number(values.qty) || 0
            const unitPrice = Number(values.unitPrice) || 0
            create('purchaseOrders', {
                id: nextId('PO', purchaseOrders),
                vendor: vendor.name,
                vendorId: vendor.id,
                paymentTerms: vendor.paymentTerms,
                leadTimeDays: vendor.leadTimeDays,
                item: values.item,
                qty,
                unitPrice,
                amount: qty * unitPrice,
                dueDate: values.dueDate,
                status: '발주',
                receivedQty: 0,
            } as PurchaseOrder)
        },
        onUpdate: (id, values) => {
            const vendor = partnerSelection.find(values.vendorId)
            if (!vendor) return
            const qty = Number(values.qty) || 0
            const unitPrice = Number(values.unitPrice) || 0
            update('purchaseOrders', id, {
                vendor: vendor.name,
                vendorId: vendor.id,
                paymentTerms: vendor.paymentTerms,
                leadTimeDays: vendor.leadTimeDays,
                item: values.item,
                qty,
                unitPrice,
                amount: qty * unitPrice,
                dueDate: values.dueDate,
            })
        },
        onDelete: id => remove('purchaseOrders', id),
        fields: () => [
            partnerSelection.field('vendorId', '발주처', true),
            ...partnerSelection.termsFields,
            {
                key: 'item', label: '품목', type: 'select', required: true,
                options: items.filter(i => i.type === '자재').map(i => ({ label: i.name, value: i.name })),
                onChange: (value, setField) => {
                    const item = items.find(i => i.name === value)
                    if (item) setField('unitPrice', item.price)
                },
            },
            { key: 'qty', label: '발주수량', type: 'number', required: true, min: 1, step: 1 },
            { key: 'unitPrice', label: '단가(원)', type: 'number', required: true, min: 0, step: 100 },
            { key: 'dueDate', label: '입고예정일', type: 'date', required: true },
        ],
    })

    const columns: DataTableColumn<PurchaseOrder>[] = [
        { key: 'id', label: '발주번호', render: row => <span className="font-mono text-hud-accent-primary">{row.id}</span> },
        { key: 'vendor', label: '발주처' },
        { key: 'item', label: '품목' },
        { key: 'qty', label: '발주수량', render: row => <span className="font-mono">{row.qty.toLocaleString()}</span> },
        { key: 'amount', label: '금액', render: row => <span className="font-mono text-hud-text-primary">{formatWon(row.amount)}</span> },
        { key: 'dueDate', label: '입고예정' },
        { key: 'status', label: '상태', render: row => <StatusBadge tone={statusTone[row.status] ?? 'muted'}>{row.status}</StatusBadge> },
        {
            key: 'actions', label: '관리', sortable: false,
            render: row => (
                <RowActions onEdit={() => openEdit(row)} onDelete={() => confirmDelete(row)}>
                    {row.status !== '입고완료' && row.status !== '취소' && (
                        <button
                            onClick={() => openReceive(row)}
                            title="입고 등록"
                            className="px-2 py-1 rounded text-xs font-medium text-hud-accent-primary hover:bg-hud-accent-primary/10 transition-hud"
                        >
                            입고
                        </button>
                    )}
                </RowActions>
            )
        },
    ]

    return (
        <>
            {partnerSelection.status}
            <DataTable<PurchaseOrder>
                title="발주 관리"
                subtitle={`총 ${purchaseOrders.length}건`}
                columns={columns}
                data={purchaseOrders}
                rowKey="id"
                searchPlaceholder="발주번호, 발주처, 품목 검색..."
                toolbar={
                    <Button variant="primary" glow leftIcon={<Plus size={18} />} onClick={openCreate} disabled={!partnerSelection.ready}>
                        발주 등록
                    </Button>
                }
            />
            {modal}
            <ReceiveModal
                isOpen={receiveOpen}
                onClose={() => { setReceiveOpen(false); setReceiveTarget(null) }}
                target={receiveTarget}
                onSubmit={handleSubmitReceive}
            />
        </>
    )
}

export default PurchaseOrders
