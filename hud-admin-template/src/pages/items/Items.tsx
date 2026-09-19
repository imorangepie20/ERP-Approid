import { Plus } from 'lucide-react'
import DataTable, { DataTableColumn } from '../../components/common/DataTable'
import StatusBadge from '../../components/common/StatusBadge'
import Button from '../../components/common/Button'
import RowActions from '../../components/common/RowActions'
import { useData, useCollection, nextId, formatWon } from '../../store/DataContext'
import type { Item } from '../../store/types'
import { useFormModal } from '../../hooks/useFormModal'

const Items = () => {
    const items = useCollection('items')
    const { create, update, remove } = useData()

    const { openCreate, openEdit, modal, confirmDelete } = useFormModal<Item>({
        title: '품목',
        subtitle: '품번·품명·규격·단가·안전재고를 입력하세요.',
        onCreate: values => {
            create('items', {
                id: values.id || nextId('ITEM', items),
                name: values.name,
                spec: values.spec,
                category: values.category,
                unit: values.unit,
                price: Number(values.price) || 0,
                stock: Number(values.stock) || 0,
                safetyStock: Number(values.safetyStock) || 0,
                type: (values.type as Item['type']) || '자재',
                leadTime: Number(values.leadTime) || 0,
            } as Item)
        },
        onUpdate: (id, values) => {
            update('items', id, {
                name: values.name,
                spec: values.spec,
                category: values.category,
                unit: values.unit,
                price: Number(values.price) || 0,
                safetyStock: Number(values.safetyStock) || 0,
                type: (values.type as Item['type']) || '자재',
                leadTime: Number(values.leadTime) || 0,
            })
        },
        onDelete: id => remove('items', id),
        fields: values => [
            { key: 'id', label: '품번', type: 'text', required: true, placeholder: 'P-A001' },
            { key: 'name', label: '품명', type: 'text', required: true },
            { key: 'spec', label: '규격', type: 'text' },
            {
                key: 'type', label: '품목유형', type: 'select', required: true,
                options: [
                    { label: '제품', value: '제품' },
                    { label: '반제품', value: '반제품' },
                    { label: '자재', value: '자재' },
                ],
            },
            { key: 'category', label: '카테고리', type: 'text' },
            {
                key: 'unit', label: '단위', type: 'select', required: true,
                options: ['EA', 'SHT', 'M', 'KG', 'TON'].map(u => ({ label: u, value: u })),
            },
            { key: 'price', label: '단가(원)', type: 'number', required: true, min: 0, step: 100 },
            { key: 'stock', label: '현재고', type: 'number', min: 0, step: 1, readOnly: !!values.id },
            { key: 'safetyStock', label: '안전재고', type: 'number', min: 0, step: 1 },
            { key: 'leadTime', label: '리드타임(일)', type: 'number', min: 0, step: 1 },
        ],
    })

    const columns: DataTableColumn<Item>[] = [
        { key: 'id', label: '품번', render: row => <span className="font-mono text-hud-accent-primary">{row.id}</span> },
        { key: 'name', label: '품목', render: row => <span className="text-hud-text-primary">{row.name}</span> },
        { key: 'spec', label: '규격' },
        { key: 'type', label: '유형', render: row => <StatusBadge tone={row.type === '제품' ? 'primary' : row.type === '반제품' ? 'info' : 'muted'}>{row.type}</StatusBadge> },
        { key: 'unit', label: '단위' },
        { key: 'price', label: '단가', render: row => <span className="font-mono">{formatWon(row.price)}</span> },
        {
            key: 'stock', label: '현재고', sortable: true,
            render: row => <span className={`font-mono ${row.stock < row.safetyStock ? 'text-hud-accent-danger' : 'text-hud-text-primary'}`}>{row.stock.toLocaleString()}</span>
        },
        { key: 'safetyStock', label: '안전재고', render: row => <span className="font-mono text-hud-text-muted">{row.safetyStock.toLocaleString()}</span> },
        {
            key: 'actions', label: '관리', sortable: false,
            render: row => <RowActions onEdit={() => openEdit(row)} onDelete={() => confirmDelete(row)} />
        },
    ]

    return (
        <>
            <DataTable<Item>
                title="품목 마스터"
                subtitle={`총 ${items.length}품목 · 미달 ${items.filter(i => i.stock < i.safetyStock).length}건`}
                columns={columns}
                data={items}
                rowKey="id"
                searchPlaceholder="품번, 품명 검색..."
                toolbar={
                    <Button variant="primary" glow leftIcon={<Plus size={18} />} onClick={openCreate}>
                        품목 등록
                    </Button>
                }
            />
            {modal}
        </>
    )
}

export default Items
