import { FunctionalComponent, h } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import { usePrecoilState } from 'precoil'
import './web-font.css'
import { codeState, tokenState, addressState } from './app'
import Card from './card'
import { tokenize } from '../utils/tokenize'
import { assemble } from '../utils/assembler'

const CodeArea: FunctionalComponent = () => {
  const [code, setCode] = usePrecoilState(codeState)
  const setTokens = usePrecoilState(tokenState)[1]
  const setAdress = usePrecoilState(addressState)[1]

  const textArea = useRef<HTMLTextAreaElement>()

  // TODO fix this workaround
  useEffect(() => {
    textArea.current.spellcheck = false
  }, [])

  useEffect(() => {
    const timeoutID = setTimeout(() => {
      const tokens = tokenize(code)
      const { statements, labelTuples } = tokens
      setTokens({ statements, labelTuples })
      const address = assemble(tokens)
      setAdress(address)
    }, 500)

    return () => clearTimeout(timeoutID)
  }, [code])

  return (
    <Card title="Code">
      <textarea
        ref={textArea}
        className="textarea"
        rows={20}
        style={{ fontFamily: "'Jetbrains Mono', monospace" }}
        value={code}
        onChange={event => {
          const { value } = event.target as HTMLTextAreaElement
          setCode(value)
        }}
        onKeyDown={event => {
          if (event.keyCode === 9) {
            event.preventDefault()
            const { current } = textArea
            const { selectionStart, selectionEnd, value } = current
            current.value =
              value.substring(0, selectionStart) +
              '\t' +
              value.substring(selectionEnd)
            current.selectionStart = current.selectionEnd = selectionStart + 1
          }
        }}
      />
    </Card>
  )
}

export default CodeArea
