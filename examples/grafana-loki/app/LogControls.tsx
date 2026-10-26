import { useState, type FormEvent } from 'react'
import {
  AlertTriangle,
  Bug,
  CircleAlert,
  Info,
  Layers3,
  Send,
  Skull,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { logPresets } from './log-presets'
import { severities, type SendLog, type Severity } from './types'

type LogControlsProps = {
  onSend: SendLog
  onBurst: () => void
  onException: () => void
  failure?: string
}

const severityIcons: Record<Severity, LucideIcon> = {
  debug: Bug,
  info: Info,
  warn: AlertTriangle,
  error: CircleAlert,
  fatal: Skull,
}

export function LogControls({
  onSend,
  onBurst,
  onException,
  failure,
}: LogControlsProps) {
  const [body, setBody] = useState('')
  const [severity, setSeverity] = useState<Severity>('info')

  const submitCustom = (event: FormEvent) => {
    event.preventDefault()
    const message = body.trim()
    if (!message) return
    void onSend(severity, message, { 'demo.action': 'todo.custom' })
    setBody('')
  }

  return (
    <section className="controls" aria-labelledby="emit-title">
      <h2 id="emit-title">Make a log</h2>
      <div className="actions">
        {logPresets.map((preset) => {
          const Icon = severityIcons[preset.severity]
          return (
            <Button
              key={preset.label}
              type="button"
              variant="outline"
              onClick={() =>
                void onSend(preset.severity, preset.body, preset.attributes)
              }
            >
              <Icon aria-hidden="true" className={`icon-${preset.severity}`} />
              {preset.label}
            </Button>
          )
        })}
        <Button type="button" variant="outline" onClick={onException}>
          <Zap aria-hidden="true" className="icon-error" />
          Corrupt saved todos
        </Button>
        <Button type="button" variant="outline" onClick={onBurst}>
          <Layers3 aria-hidden="true" className="icon-info" />
          Add 10 todos
        </Button>
      </div>

      <form className="custom" onSubmit={submitCustom}>
        <Select
          value={severity}
          onValueChange={(value) => setSeverity(value as Severity)}
        >
          <SelectTrigger aria-label="Severity" className="capitalize">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {severities.map((level) => (
              <SelectItem key={level} value={level} className="capitalize">
                {level}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          aria-label="Custom message"
          placeholder="Describe a todo event"
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
        <Button type="submit" disabled={!body.trim()}>
          <Send aria-hidden="true" />
          Send
        </Button>
      </form>
      {failure && (
        <p className="alert" role="alert">
          <Badge variant="error">
            <AlertTriangle aria-hidden="true" /> Export failed
          </Badge>
          {failure}. Is Alloy running on port 4318?
        </p>
      )}
    </section>
  )
}
