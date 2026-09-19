import { useState } from 'react'
import FormModal, { ModalField } from '../common/FormModal'
import type { PurchaseOrder } from '../../store/types'

interface ReceiveModalProps {
    isOpen: boolean
    onClose: () => void
    target: PurchaseOrder | null
    onSubmit: (receivedQty: number, defectQty: number) => void
}

const ReceiveModal = ({ isOpen, onClose, target, onSubmit }: ReceiveModalProps) => {
    const [receivedQty, setReceivedQty] = useState('')
    const [defectQty, setDefectQty] = useState('0')

    const fields: ModalField[] = [
        {
            key: 'receivedQty', label: '입고 수량', type: 'number', required: true, min: 0, step: 1,
            placeholder: target ? `발주 수량 ${target.qty}` : '',
        },
        { key: 'defectQty', label: '불량 수량', type: 'number', min: 0, step: 1, placeholder: '0' },
    ]

    const values = { receivedQty, defectQty }

    const handleSubmit = () => {
        const rcv = Number(receivedQty) || 0
        const def = Number(defectQty) || 0
        if (rcv <= 0) return
        onSubmit(rcv, def)
        setReceivedQty('')
        setDefectQty('0')
    }

    return (
        <FormModal
            isOpen={isOpen}
            onClose={() => {
                setReceivedQty('')
                setDefectQty('0')
                onClose()
            }}
            title="입고 등록"
            subtitle={target ? `${target.id} · ${target.vendor} · ${target.item}` : ''}
            fields={fields}
            values={values}
            onChange={(key, value) => {
                if (key === 'receivedQty') setReceivedQty(value)
                if (key === 'defectQty') setDefectQty(value)
            }}
            onSubmit={handleSubmit}
            submitLabel="입고 확정"
        />
    )
}

export default ReceiveModal
