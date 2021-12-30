import { PayloadAction, createSlice } from '@reduxjs/toolkit'
import { Registers, initRegisters } from './core'
import type { RootState } from '../../app/store'

interface Status {
  fault: string | null
  halted: boolean
}

interface CpuState {
  status: Status
  registers: Registers
}

const initialState: CpuState = {
  status: {
    fault: null,
    halted: false
  },
  registers: initRegisters()
}

export const cpuSlice = createSlice({
  name: 'cpu',
  initialState,
  reducers: {
    setFault: (state, action: PayloadAction<string>) => {
      state.status.fault = action.payload
    },
    setHalted: (state, action: PayloadAction<boolean>) => {
      state.status.halted = action.payload
    },
    setRegisters: (state, action: PayloadAction<Registers>) => {
      state.registers = action.payload
    },
    reset: () => initialState
  }
})

export const selectCpuStatus = (state: RootState): Status => state.cpu.status

export const selectCpuFault = (state: RootState): string | null => state.cpu.status.fault

export const selectCpuRegisters = (state: RootState): Registers => state.cpu.registers

export const selectCpuPointerRegisters = (state: RootState): Pick<Registers, 'ip' | 'sp'> =>
  (({ ip, sp }) => ({ ip, sp }))(state.cpu.registers)

export const {
  setFault: setCpuFault,
  setHalted: setCpuHalted,
  setRegisters: setCpuRegisters,
  reset: resetCpu
} = cpuSlice.actions

export default cpuSlice.reducer
