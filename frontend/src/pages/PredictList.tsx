import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMatches, type Match } from '../api/matches'
import { getMyPredictions } from '../api/predictions'
import { Badge } from '../components/ui'
import { Icon } from '../components/Icon'
import { groupLabel, localTime, stageLabel, stageMultiplier } from '../lib/stages'

interface Item {
  match: Match
  predicted: boolean
}

export default function PredictList() {
  const navigate = useNavigate()
  const [items, setItems] = useState<Item[]>([])
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')

  useEffect(() => {
    Promise.all([getMatches({}), getMyPredictions()])
      .then(([matches, preds]) => {
        const predIds = new Set(preds.map((p) => p.match_id))
        const upcoming = matches
          .filter(
            (m) =>
              (m.status === 'TIMED' || m.status === 'SCHEDULED') &&
              new Date(m.utc_date).getTime() > Date.now(),
          )
          .map((m) => ({ match: m, predicted: predIds.has(m.id) }))
        setItems(upcoming)
        setState('ok')
      })
      .catch(() => setState('error'))
  }, [])

  const todo = items.filter((i) => !i.predicted)
  const done = items.filter((i) => i.predicted)

  const Row = ({ match, predicted }: Item) => {
    const mult = stageMultiplier(match.stage)
    const d = new Date(match.utc_date)
    return (
      <div
        className="lmn-card lmn-card--hoverable"
        onClick={() => navigate(`/match/${match.id}`)}
        style={{ padding: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'var(--lmn-font-ui)',
              fontWeight: 600,
              fontSize: 14,
              color: 'var(--lmn-ash-100)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              overflow: 'hidden',
            }}
          >
            {match.home_team_crest && (
              <img src={match.home_team_crest} alt="" style={{ width: 20, height: 20, objectFit: 'contain', flexShrink: 0 }} />
            )}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {match.home_team_name ?? 'TBD'}
            </span>
            <span style={{ color: 'var(--lmn-ash-500)', flexShrink: 0 }}>–</span>
            {match.away_team_crest && (
              <img src={match.away_team_crest} alt="" style={{ width: 20, height: 20, objectFit: 'contain', flexShrink: 0 }} />
            )}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {match.away_team_name ?? 'TBD'}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--lmn-ash-500)', marginTop: 3 }}>
            {groupLabel(match.group_name) || stageLabel(match.stage)} ·{' '}
            {d.toLocaleDateString([], { day: 'numeric', month: 'short' })} {localTime(match.utc_date)}
          </div>
        </div>
        {mult > 1 && <Badge variant="points">x{mult}</Badge>}
        {predicted ? (
          <Badge variant="esatto">Fatto</Badge>
        ) : (
          <Badge variant="timed">Da fare</Badge>
        )}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px 96px' }}>
      <h1
        style={{
          fontFamily: 'var(--lmn-font-display)',
          fontSize: 32,
          letterSpacing: '0.04em',
          margin: '0 0 6px',
          color: 'var(--lmn-ash-100)',
        }}
      >
        PRONOSTICA
      </h1>
      <p style={{ color: 'var(--lmn-ash-400)', fontSize: 14, margin: '0 0 20px' }}>
        {todo.length > 0
          ? `Hai ${todo.length} pronostici da inserire.`
          : 'Tutto fatto. Torna più tardi per le prossime partite.'}
      </p>

      {state === 'loading' && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <span className="lmn-spinner" />
        </div>
      )}

      {state === 'error' && (
        <div className="lmn-card" style={{ padding: 24, textAlign: 'center' }}>
          <p style={{ color: 'var(--lmn-danger-400)', margin: 0 }}>Errore nel caricamento.</p>
        </div>
      )}

      {state === 'ok' && items.length === 0 && (
        <div className="lmn-card" style={{ padding: 32, textAlign: 'center' }}>
          <span style={{ color: 'var(--lmn-ash-500)' }}>
            <Icon name="ball" size={32} />
          </span>
          <p style={{ color: 'var(--lmn-ash-400)', marginTop: 12, marginBottom: 0 }}>
            Nessuna partita in arrivo.
          </p>
        </div>
      )}

      {state === 'ok' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {todo.map((i) => (
            <Row key={i.match.id} {...i} />
          ))}
          {done.length > 0 && (
            <>
              <div
                style={{
                  fontFamily: 'var(--lmn-font-ui)',
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--lmn-ash-500)',
                  marginTop: 14,
                }}
              >
                Già pronosticate
              </div>
              {done.map((i) => (
                <Row key={i.match.id} {...i} />
              ))}
            </>
          )}
        </div>
      )}

    </div>
  )
}
