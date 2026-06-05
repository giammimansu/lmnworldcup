import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getBracket, type BracketMatch, type BracketStage } from '../api/bracket'
import { Icon } from '../components/Icon'
import { stageLabel, stageMultiplier } from '../lib/stages'

function TeamSlot({
  name,
  crest,
  score,
  isWinner,
}: {
  name: string | null
  crest: string | null
  score: number | null
  isWinner: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 10px',
        background: isWinner ? 'rgba(212,168,67,0.14)' : 'transparent',
        borderRadius: 6,
      }}
    >
      {crest ? (
        <img src={crest} alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />
      ) : (
        <span
          style={{
            width: 18,
            height: 18,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            color: 'var(--lmn-ash-600)',
            border: '1px dashed var(--lmn-ash-700)',
            borderRadius: '50%',
            flexShrink: 0,
          }}
        >
          ?
        </span>
      )}
      <span
        style={{
          flex: 1,
          fontFamily: 'var(--lmn-font-ui)',
          fontWeight: isWinner ? 700 : 500,
          fontSize: 13,
          color: isWinner ? 'var(--lmn-gold-400)' : name ? 'var(--lmn-ash-200)' : 'var(--lmn-ash-600)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {name ?? 'Da definire'}
      </span>
      {score != null && (
        <span
          style={{
            fontFamily: 'var(--lmn-font-display)',
            fontSize: 18,
            color: isWinner ? 'var(--lmn-gold-400)' : 'var(--lmn-ash-400)',
          }}
        >
          {score}
        </span>
      )}
    </div>
  )
}

function MatchBox({ match, isFinal }: { match: BracketMatch; isFinal: boolean }) {
  const navigate = useNavigate()
  return (
    <div
      className="lmn-card lmn-card--hoverable"
      onClick={() => navigate(`/match/${match.match_id}`)}
      style={{
        padding: 6,
        width: 210,
        cursor: 'pointer',
        border: isFinal ? '1px solid var(--lmn-gold-600)' : undefined,
        boxShadow: isFinal ? '0 0 16px rgba(212,168,67,0.18)' : undefined,
      }}
    >
      <TeamSlot
        name={match.home_team_name}
        crest={match.home_team_crest}
        score={match.home_score}
        isWinner={match.winner === 'home'}
      />
      <div style={{ height: 1, background: 'var(--lmn-ash-800, #283044)', margin: '2px 8px' }} />
      <TeamSlot
        name={match.away_team_name}
        crest={match.away_team_crest}
        score={match.away_score}
        isWinner={match.winner === 'away'}
      />
    </div>
  )
}

// Colonna fase con connettori CSS verso destra
function StageColumn({ stage, isLast }: { stage: BracketStage; isLast: boolean }) {
  const isFinal = stage.stage === 'FINAL'
  const mult = stageMultiplier(stage.stage)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 14,
          justifyContent: 'center',
        }}
      >
        {isFinal && (
          <span style={{ color: 'var(--lmn-gold-400)' }}>
            <Icon name="trophy" size={20} filled />
          </span>
        )}
        <span
          style={{
            fontFamily: 'var(--lmn-font-display)',
            fontSize: 18,
            letterSpacing: '0.06em',
            color: isFinal ? 'var(--lmn-gold-400)' : 'var(--lmn-ash-300)',
          }}
        >
          {stageLabel(stage.stage).toUpperCase()}
        </span>
        <span
          style={{
            fontFamily: 'var(--lmn-font-mono)',
            fontSize: 11,
            color: 'var(--lmn-electric-400, #38bdf8)',
          }}
        >
          x{mult}
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-around',
          gap: 14,
          flex: 1,
        }}
      >
        {stage.matches.map((m) => (
          <div key={m.match_id} style={{ display: 'flex', alignItems: 'center' }}>
            <MatchBox match={m} isFinal={isFinal} />
            {/* connettore orizzontale verso il turno successivo */}
            {!isLast && stage.stage !== 'THIRD_PLACE' && (
              <div style={{ width: 22, height: 1, background: 'var(--lmn-ash-700, #38415a)' }} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Bracket() {
  const [stages, setStages] = useState<BracketStage[]>([])
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')

  useEffect(() => {
    getBracket()
      .then((r) => {
        setStages(r.stages)
        setState('ok')
      })
      .catch(() => setState('error'))
  }, [])

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px 96px' }}>
      <h1
        style={{
          fontFamily: 'var(--lmn-font-display)',
          fontSize: 32,
          letterSpacing: '0.04em',
          margin: '0 0 20px',
          color: 'var(--lmn-ash-100)',
        }}
      >
        TABELLONE
      </h1>

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

      {state === 'ok' && stages.length === 0 && (
        <div className="lmn-card" style={{ padding: 32, textAlign: 'center' }}>
          <span style={{ color: 'var(--lmn-ash-500)' }}>
            <Icon name="bracket" size={32} />
          </span>
          <p style={{ color: 'var(--lmn-ash-400)', marginTop: 12, marginBottom: 0 }}>
            Il tabellone si popola al termine della fase a gironi.
          </p>
        </div>
      )}

      {state === 'ok' && stages.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 22,
            overflowX: 'auto',
            paddingBottom: 16,
            alignItems: 'stretch',
          }}
        >
          {stages.map((s, i) => (
            <StageColumn key={s.stage} stage={s} isLast={i === stages.length - 1} />
          ))}
        </div>
      )}

    </div>
  )
}
