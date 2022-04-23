import { memo } from 'react'
import CardHeader from '@/common/components/CardHeader'
import { useSelector } from '@/app/hooks'
import {
  MemoryView,
  selectMemoryDataRowsLazily,
  selectMemorySourceRowsLazily,
  selectMemoryView
} from './memorySlice'
import { MAX_SP } from '@/features/cpu/core'
import { selectCpuPointerRegisters } from '@/features/cpu/cpuSlice'
import { decToHex, range } from '@/common/utils'

const ColumIndicatorTableRow = memo(() => (
  <tr className="divide-x bg-gray-50 text-gray-400">
    <td />
    {range(0x10).map(colIndex => (
      <td key={colIndex} className="text-center">
        {decToHex(colIndex)[1] /* ignore padded 0 */}
      </td>
    ))}
  </tr>
))

if (import.meta.env.DEV) {
  ColumIndicatorTableRow.displayName = 'ColumIndicatorTableRow'
}

const Memory = (): JSX.Element => {
  const memoryView = useSelector(selectMemoryView)

  const getDataRows = useSelector(selectMemoryDataRowsLazily)
  const getSourceRows = useSelector(selectMemorySourceRowsLazily)

  const rows = memoryView === MemoryView.Source ? getSourceRows() : getDataRows()

  let address = 0
  const { ip, sp } = useSelector(selectCpuPointerRegisters)

  return (
    <div>
      <CardHeader title="Memory" />
      <table className="text-sm w-full">
        <tbody className="divide-y">
          <ColumIndicatorTableRow />
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="divide-x">
              <td className="bg-gray-50 text-center text-gray-400">
                <span className="px-1">{decToHex(rowIndex)[1] /* ignore padded 0 */}</span>
              </td>
              {row.map((value, colIndex) => {
                const tdClassName = sp < address && address <= MAX_SP ? 'bg-blue-50' : ''
                const spanClassName =
                  address === ip
                    ? 'rounded bg-green-100'
                    : address === sp
                    ? 'rounded bg-blue-100'
                    : ''
                address += 1
                return (
                  <td key={colIndex} className={`text-center ${tdClassName}`}>
                    <span className={`px-1 ${spanClassName}`}>
                      {memoryView === MemoryView.Hexadecimal ? decToHex(value as number) : value}
                    </span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default Memory
