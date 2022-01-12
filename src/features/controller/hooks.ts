import { useState, useEffect } from 'react'
// TODO: remove batch from React 18
import { batch } from 'react-redux'
import { RootState, getState, dispatch, listenAction, watch } from '../../app/store'
import {
  selectRuntimeConfiguration,
  selectIsRunning,
  selectIsSuspended,
  setRunning,
  setSuspended
} from './controllerSlice'
import {
  selectEditorBreakpoints,
  setEditorActiveRange,
  clearEditorActiveRange
} from '../editor/editorSlice'
import { lineRangesOverlap } from '../editor/codemirror/line'
import { assembleInputFromState } from '../assembler/assemble'
import {
  selectAddressToStatementMap,
  setAssemblerState,
  resetAssembler
} from '../assembler/assemblerSlice'
import { setMemoryData, resetMemory, selectMemoryData } from '../memory/memorySlice'
import { StepResult, RuntimeError, step as __step } from '../cpu/core'
import {
  selectCpuStatus,
  selectCpuRegisters,
  setCpuFault,
  setCpuHalted,
  setCpuRegisters,
  resetCpu
} from '../cpu/cpuSlice'
import { InputPort, OutputPort } from '../io/core'
import {
  selectInputSignals,
  selectIsWaitingForInput,
  clearInputData,
  setInterrupt,
  setWaitingForInput,
  setWaitingForKeyboardInput,
  setTrafficLightsData,
  resetIo
} from '../io/ioSlice'

class Controller {
  // they must have been assigned in `setMainLoop` when they are read in `cancelMainLoop`
  private stepIntervalId!: number
  private interruptIntervalId!: number

  private lastStep: Promise<StepResult | undefined> = Promise.resolve(undefined)

  private dispatchChangesTimeoutId: number | undefined

  // it must have been assigned in `step` when it is called in `restoreIfSuspended`
  private unsubscribeSetSuspended!: () => void

  public readonly assemble = assembleInputFromState

  public readonly runOrStop = async (): Promise<void> => {
    const state = getState()
    if (this.stopIfRunning(state)) {
      this.restoreIfSuspended(state)
      return
    }
    if (selectIsSuspended(state)) {
      return
    }
    await this.run()
  }

  public async stopAndRun(): Promise<void> {
    this.cancelMainLoop()
    await this.lastStep
    this.setMainLoop()
    await this.step()
  }

  /**
   * @returns true if was running
   */
  private stopIfRunning(state: RootState): boolean {
    const isRunning = selectIsRunning(state)
    if (isRunning) {
      this.stop()
    }
    return isRunning
  }

  private stop(): void {
    this.cancelMainLoop()
    dispatch(setRunning(false))
  }

  private cancelMainLoop(): void {
    window.clearInterval(this.stepIntervalId)
    window.clearInterval(this.interruptIntervalId)
  }

  /**
   * @returns true if was suspended
   */
  private restoreIfSuspended(state: RootState): boolean {
    const isSuspended = selectIsSuspended(state)
    if (isSuspended) {
      this.unsubscribeSetSuspended()
      dispatch(setSuspended(false))
    }
    return isSuspended
  }

  private async run(): Promise<void> {
    dispatch(setRunning(true))
    this.setMainLoop()
    await this.step()
  }

  private setMainLoop(): void {
    const { clockSpeed, timerInterval } = selectRuntimeConfiguration(getState())
    this.stepIntervalId = window.setInterval(this.step, 1000 / clockSpeed)
    this.interruptIntervalId = window.setInterval(() => {
      dispatch(setInterrupt(true))
    }, timerInterval)
  }

  public readonly step = async (): Promise<void> => {
    const lastStepResult = await this.lastStep
    const state = getState()
    const { fault, halted } = selectCpuStatus(state)
    if (fault !== null || halted) {
      this.stopIfRunning(state)
      if (fault === null && halted) {
        // trigger EditorStatus re-render
        dispatch(setCpuHalted())
      }
      return
    }
    if (selectIsSuspended(state)) {
      return
    }
    this.lastStep = new Promise(resolve => {
      let stepResultWithSignals: ReturnType<typeof __step>
      try {
        stepResultWithSignals = __step(
          ...(lastStepResult ?? [selectMemoryData(state), selectCpuRegisters(state)]),
          {
            input: selectInputSignals(state),
            output: {}
          }
        )
      } catch (err) {
        this.stopIfRunning(state)
        if (err instanceof RuntimeError) {
          dispatch(setCpuFault(err.message))
          resolve(undefined)
          return
        }
        resolve(undefined)
        // TODO: handle unexpected runtime errors
        throw err
      }
      const [memoryData, registers, signals] = stepResultWithSignals
      const instructionAdress = registers.ip
      const statement = selectAddressToStatementMap(state)[instructionAdress]
      const hasStatement = statement?.machineCode.every(
        (machineCode, index) => machineCode === memoryData[instructionAdress + index]
      )
      const dispatchChanges = (): void => {
        this.dispatchChangesTimeoutId = window.setTimeout(() => {
          batch(() => {
            dispatch(setMemoryData(memoryData))
            dispatch(setCpuRegisters(registers))
            dispatch(hasStatement ? setEditorActiveRange(statement) : clearEditorActiveRange())
          })
          this.dispatchChangesTimeoutId = undefined
        })
      }
      let willDispatchChanges = false
      if (this.dispatchChangesTimeoutId === undefined) {
        willDispatchChanges = true
        dispatchChanges()
      }
      const { data: inputData, interrupt } = signals.input
      const { requiredInputDataPort, data: outputData, halted: shouldHalt = false } = signals.output
      if (interrupt) {
        dispatch(setInterrupt(false))
      }
      if (shouldHalt) {
        this.stopIfRunning(state)
        dispatch(setCpuHalted())
        resolve(undefined)
        return
      }
      const isRunning = selectIsRunning(state)
      let willSuspend = false
      if (requiredInputDataPort !== undefined) {
        dispatch(setWaitingForInput(true))
        if (inputData.content === null) {
          willSuspend = true
          if (isRunning) {
            this.cancelMainLoop()
          }
          batch(() => {
            dispatch(setSuspended(true))
            switch (requiredInputDataPort) {
              case InputPort.SimulatedKeyboard:
                dispatch(setWaitingForKeyboardInput(true))
            }
          })
          // TODO: add option `once`
          this.unsubscribeSetSuspended = listenAction(setSuspended, () => {
            this.unsubscribeSetSuspended()
            if (isRunning) {
              this.setMainLoop()
            }
            void this.step()
          })
        } else {
          // wrong port
          dispatch(clearInputData())
        }
      } else if (selectIsWaitingForInput(state)) {
        // step() called from actionListener
        dispatch(setWaitingForInput(false))
        dispatch(clearInputData())
      }
      if (outputData?.content !== undefined) {
        const { content: outputDataContent, port: outputDataPort } = outputData
        switch (outputDataPort) {
          case OutputPort.TrafficLights:
            dispatch(setTrafficLightsData(outputDataContent))
        }
      }
      const breakpoints = selectEditorBreakpoints(state)
      if (breakpoints.length > 0 && hasStatement && isRunning && !willSuspend) {
        const { label, range: rangeWithoutLabel } = statement
        const statementRange = {
          from: label === null ? rangeWithoutLabel.from : label.range.from,
          to: rangeWithoutLabel.to
        }
        const willBreak = breakpoints.some(lineRange =>
          lineRangesOverlap(lineRange, statementRange)
        )
        if (willBreak) {
          if (!willDispatchChanges) {
            dispatchChanges()
          }
          // isRunning is already checked
          this.stop()
        }
      }
      resolve([memoryData, registers])
    })
  }

  public readonly reset = async (): Promise<void> => {
    await this.fullyStop()
    batch(() => {
      dispatch(resetMemory())
      dispatch(resetCpu())
      dispatch(resetAssembler())
      dispatch(clearEditorActiveRange())
      dispatch(resetIo())
    })
  }

  public readonly fullyStop = async (): Promise<void> => {
    const state = getState()
    this.stopIfRunning(state)
    this.restoreIfSuspended(state)
    await this.lastStep
    this.lastStep = Promise.resolve(undefined)
    this.cancelDispatchChanges()
  }

  private cancelDispatchChanges(): void {
    window.clearTimeout(this.dispatchChangesTimeoutId)
    this.dispatchChangesTimeoutId = undefined
  }
}

export const useController = (): Controller => {
  const [controller] = useState(() => new Controller())

  useEffect(() => {
    return watch(selectRuntimeConfiguration, async () => {
      const state = getState()
      // `setSuspended` action listener will reset the main loop
      if (!selectIsSuspended(state) && selectIsRunning(state)) {
        await controller.stopAndRun()
      }
    })
  }, [])

  useEffect(() => {
    return listenAction(setAssemblerState, controller.fullyStop)
  }, [])

  return controller
}
