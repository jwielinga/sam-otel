import { OTelSeverityNumber } from 'som-otel'
import { useRef, useState } from 'react'
import { logger } from './logger'
import { useLokiTail } from './loki'
import { LogControls } from './LogControls'
import { LogFeeds } from './LogFeeds'
import { LoggerExample } from './LoggerExample'
import { todoTitles } from './log-presets'
import type { SendLog, SentLog } from './types'

const GRAFANA = 'http://localhost:3000/d'

export function App() {
  const [sent, setSent] = useState<SentLog[]>([])
  const nextId = useRef(0)
  const loki = useLokiTail()

  const send: SendLog = async (severity, body, attributes = {}) => {
    const id = ++nextId.current
    const message = body instanceof Error ? body.message : body
    setSent((items) =>
      [
        {
          id,
          severity,
          body: message,
          at: new Date(),
          state: 'sending' as const,
        },
        ...items,
      ].slice(0, 8),
    )

    try {
      if (severity === 'fatal') {
        // Som has no logger.fatal(); logRecord() takes the OTel FATAL severity number.
        await logger.logRecord({
          severityNumber: OTelSeverityNumber.FATAL,
          severityText: 'FATAL',
          timeUnixNano: BigInt(Date.now()) * 1_000_000n,
          body: message,
          attributes,
        })
      } else {
        await logger[severity](body, attributes)
      }
      setSent((items) =>
        items.map((item) =>
          item.id === id ? { ...item, state: 'sent' } : item,
        ),
      )
    } catch (error) {
      setSent((items) =>
        items.map((item) =>
          item.id === id
            ? {
                ...item,
                state: 'failed',
                detail: error instanceof Error ? error.message : String(error),
              }
            : item,
        ),
      )
    }
  }

  const sendBurst = () => {
    todoTitles.forEach((title, index) => {
      void send('info', `Todo added: ${title}`, {
        'demo.action': 'todo.add',
        'todo.title': title,
        'todo.count': index + 1,
      })
    })
  }

  const sendException = () => {
    try {
      JSON.parse('[{ "id": 1, "title": ')
    } catch (error) {
      // An Error body makes Som add exception.type, exception.message and the stack trace.
      void send(
        'error',
        error instanceof Error ? error : new Error(String(error)),
        { 'demo.action': 'todo.load' },
      )
    }
  }

  const failedMessage = sent.find((item) => item.state === 'failed')?.detail

  return (
    <>
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="Som home">
          som<span>/</span>
        </a>
        <span className="topbar-note">LOCAL TELEMETRY LAB</span>
        <span className="topbar-end">
          OTLP/HTTP <i /> LOKI
        </span>
      </header>

      <main>
        <section className="intro">
          <p className="eyebrow">
            <span>01</span> BROWSER TO BACKEND
          </p>
          <h1>
            Press a button.
            <br />
            <em>Watch it land.</em>
          </h1>
          <p className="lede">
            Each button sends a real OpenTelemetry log with Som to Alloy. The
            right column polls Loki, so you see the log after it has been
            stored.
          </p>
          <nav className="dashboard-links" aria-label="Grafana dashboards">
            <a
              href={`${GRAFANA}/som-browser-logs/browser-logs`}
              target="_blank"
              rel="noreferrer"
            >
              Browser Logs <span aria-hidden="true">↗</span>
            </a>
            <a
              href={`${GRAFANA}/som-error-overview/error-overview`}
              target="_blank"
              rel="noreferrer"
            >
              Error Overview <span aria-hidden="true">↗</span>
            </a>
          </nav>
        </section>

        <LogControls
          onSend={send}
          onBurst={sendBurst}
          onException={sendException}
          failure={failedMessage}
        />
        <LogFeeds
          sent={sent}
          lokiEntries={loki.entries}
          lokiError={loki.error}
          lokiUpdatedAt={loki.updatedAt}
        />
        <LoggerExample />
      </main>

      <footer className="footer">
        <span>SOM OTEL EXAMPLE</span>
        <span>
          APP <b>→</b> ALLOY <b>→</b> LOKI
        </span>
      </footer>
    </>
  )
}
