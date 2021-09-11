import React from 'react'
import Card from '../../common/components/Card'
import { useAppSelector, useAppShallowEqualSelector } from '../../app/hooks'
import { selectMemoryData } from './memorySlice'
import { selectCpuPointerRegisters } from '../cpu/cpuSlice'
import { decToHex, splitArrayPerChunk } from '../../common/utils'

interface Props {
  className?: string
}

// TODO: add view option
const Memory = ({ className }: Props): JSX.Element => {
  const memoryData = useAppSelector(selectMemoryData)
  const machineCodesMatrix = splitArrayPerChunk(memoryData, 0x10)

  let address = 0
  const { ip, sp } = useAppShallowEqualSelector(selectCpuPointerRegisters)

  return (
    <Card className={className} title="Memory">
      <table className="text-sm w-full">
        <tbody className="divide-y">
          <tr className="divide-x bg-gray-50 text-gray-400">
            <td />
            {machineCodesMatrix[0].map((_, colIndex) => (
              <td key={colIndex} className="text-center">
                {decToHex(colIndex)[1]}
              </td>
            ))}
          </tr>
          {machineCodesMatrix.map((row, rowIndex) => (
            <tr key={rowIndex} className="divide-x">
              <td className="bg-gray-50 text-center text-gray-400">
                <span className="px-1">{decToHex(rowIndex)[1]}</span>
              </td>
              {row.map((machineCode, colIndex) => {
                const valueClassName =
                  address === ip
                    ? 'rounded bg-green-100'
                    : address === sp
                    ? 'rounded bg-blue-100'
                    : ''
                address += 1
                return (
                  <td key={colIndex} className="text-center">
                    <span className={`px-1 ${valueClassName}`}>{decToHex(machineCode)}</span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

export default Memory
