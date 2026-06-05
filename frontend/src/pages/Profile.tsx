import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getMyScorerPredictions, type ScorerPrediction } from '../api/predictions'
import {
  getMyAchievements,
  getMyStats,
  getUserStats,
  type Achievement,
  type UserStats,
} from '../api/stats'
import { useAuth } from '../auth/AuthContext'
import { Avatar, Badge } from '../components/ui'
import { Icon, type IconName } from '../components/Icon'

// ------------------------------------------------------------- Stat card
function StatCard({ label, value, unit, icon }: { label: string; value: number | string; unit?: string; icon: IconName }) {
  return (
    <div className="lmn-card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontFamily: 'var(--lmn-font-ui)', fontSize: 12, color: 'var(--lmn-ash-400)' }}>{label}</span>
        <span style={{ color: 'var(--lmn-gold-500)' }}>
          <Icon name={icon} size={18} />
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontFamily: 'var(--lmn-font-display)', fontSize: 40, color: 'var(--lmn-ash-100)', lineHeight: 1 }}>
          {value}
        </span>
        {unit && (
          <span style={{ fontFamily: 'var(--lmn-font-display)', fontSize: 22, color: 'var(--lmn-ash-400)' }}>{unit}</span>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------- Bar chart (solo div/CSS)
function PointsChart({ data }: { data: { matchday: number; points: number }[] }) {
  if (data.length === 0)
    return (
      <p style={{ color: 'var(--lmn-ash-500)', fontSize: 13 }}>
        Nessun punto ancora: i grafici arrivano con le prime partite giocate.
      </p>
    )
  const max = Math.max(...data.map((d) => d.points), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 140, paddingTop: 8 }}>
      {data.map((d) => (
        <div key={d.matchday} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
          <span style={{ fontFamily: 'var(--lmn-font-mono)', fontSize: 11, color: 'var(--lmn-gold-400)' }}>
            {d.points}
          </span>
          <div
            style={{
              width: '100%',
              maxWidth: 42,
              height: `${(d.points / max) * 100}%`,
              minHeight: 4,
              background: 'linear-gradient(180deg, var(--lmn-gold-500), rgba(212,168,67,0.35))',
              borderRadius: '4px 4px 0 0',
              transition: 'height 400ms var(--lmn-ease-out, ease-out)',
            }}
          />
          <span style={{ fontFamily: 'var(--lmn-font-ui)', fontSize: 10, color: 'var(--lmn-ash-500)' }}>
            G{d.matchday}
          </span>
        </div>
      ))}
    </div>
  )
}

// ------------------------------------------------------------- Achievements
function AchievementGrid({ achievements }: { achievements: Achievement[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
      {achievements.map((a) => (
        <div
          key={a.code}
          className="lmn-card"
          style={{
            padding: 16,
            textAlign: 'center',
            opacity: a.unlocked ? 1 : 0.38,
            border: a.unlocked ? '1px solid var(--lmn-gold-600)' : undefined,
          }}
          title={a.description}
        >
          <span style={{ color: a.unlocked ? 'var(--lmn-gold-400)' : 'var(--lmn-ash-500)' }}>
            <Icon name={(a.icon as IconName) || 'star'} size={30} filled={a.unlocked} />
          </span>
          <div style={{ fontFamily: 'var(--lmn-font-ui)', fontWeight: 600, fontSize: 13, color: 'var(--lmn-ash-100)', marginTop: 8 }}>
            {a.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--lmn-ash-500)', marginTop: 4 }}>{a.description}</div>
        </div>
      ))}
    </div>
  )
}

// ------------------------------------------------------------- History
function History({
  stats,
  scorers,
}: {
  stats: UserStats
  scorers: Map<number, ScorerPrediction>
}) {
  if (stats.history.length === 0)
    return <p style={{ color: 'var(--lmn-ash-500)', fontSize: 13 }}>Nessun pronostico ancora.</p>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {stats.history.map((h) => {
        const sc = scorers.get(h.match_id)
        return (
        <Link
          key={h.match_id}
          to={`/match/${h.match_id}`}
          className="lmn-card lmn-card--hoverable"
          style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--lmn-font-ui)', fontWeight: 600, fontSize: 13, color: 'var(--lmn-ash-100)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {h.home_team_name ?? '—'} · {h.away_team_name ?? '—'}
            </div>
            <div style={{ fontFamily: 'var(--lmn-font-mono)', fontSize: 11, color: 'var(--lmn-ash-500)', marginTop: 2 }}>
              Tuo: {h.pred_home}–{h.pred_away}
              {h.actual_home != null && ` · Reale: ${h.actual_home}–${h.actual_away}`}
            </div>
            {sc && sc.players.length > 0 && (
              <div style={{ fontFamily: 'var(--lmn-font-ui)', fontSize: 11, marginTop: 3, color: 'var(--lmn-ash-500)' }}>
                ⚽ {sc.players.map((pl) => pl.player_name).join(', ')}
                {sc.outcome === 'hit' ? (
                  <span style={{ color: 'var(--lmn-success-400)', fontWeight: 600 }}> · +{sc.points} PT</span>
                ) : sc.outcome === 'miss' ? (
                  <span style={{ color: 'var(--lmn-ash-600)', fontWeight: 600 }}> · 0 PT</span>
                ) : (
                  <span style={{ color: 'var(--lmn-ash-600)' }}> · in attesa</span>
                )}
              </div>
            )}
          </div>
          {h.outcome === 'pending' ? (
            <Badge variant="timed">In attesa</Badge>
          ) : h.outcome === 'exact' ? (
            <Badge variant="esatto">+{h.points} PT</Badge>
          ) : h.outcome === 'sign' ? (
            <Badge variant="parziale">+{h.points} PT</Badge>
          ) : (
            <Badge variant="sbagliato">0 PT</Badge>
          )}
        </Link>
        )
      })}
    </div>
  )
}

// ------------------------------------------------------------- Page
export default function Profile() {
  const { userId } = useParams()
  const { user } = useAuth()
  const isMe = !userId || userId === user?.id

  const [stats, setStats] = useState<UserStats | null>(null)
  const [scorers, setScorers] = useState<Map<number, ScorerPrediction>>(new Map())
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [error, setError] = useState(false)

  useEffect(() => {
    const load = isMe ? getMyStats() : getUserStats(userId!)
    load.then(setStats).catch(() => setError(true))
    if (isMe) {
      getMyAchievements()
        .then((r) => setAchievements(r.achievements))
        .catch(() => {})
      getMyScorerPredictions()
        .then((sps) => setScorers(new Map(sps.map((s) => [s.match_id, s]))))
        .catch(() => {})
    }
  }, [userId, isMe, user?.id])

  if (error)
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px 96px' }}>
        <div className="lmn-card" style={{ padding: 24, textAlign: 'center' }}>
          <p style={{ color: 'var(--lmn-danger-400)', margin: 0 }}>Errore nel caricamento del profilo.</p>
        </div>
      </div>
    )

  if (!stats)
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <span className="lmn-spinner" />
      </div>
    )

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px 96px' }}>
      {!isMe && (
        <Link
          to="/"
          style={{ display: 'inline-block', color: 'var(--lmn-ash-400)', textDecoration: 'none', fontSize: 14, marginBottom: 16 }}
        >
          ← Classifica
        </Link>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 28 }}>
        <Avatar name={stats.display_name} size="xl" />
        <div>
          <h1 style={{ fontFamily: 'var(--lmn-font-display)', fontSize: 32, letterSpacing: '0.04em', margin: 0, color: 'var(--lmn-ash-100)' }}>
            {stats.display_name.toUpperCase()}
          </h1>
        </div>
      </div>

      {/* Le mie leghe (solo profilo proprio) */}
      {isMe && (
        <Link
          to="/leagues"
          className="lmn-card lmn-card--hoverable"
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', marginBottom: 20, textDecoration: 'none' }}
        >
          <span style={{ color: 'var(--lmn-gold-500)' }}>
            <Icon name="shield" size={22} />
          </span>
          <span style={{ flex: 1, fontFamily: 'var(--lmn-font-ui)', fontWeight: 600, fontSize: 14, color: 'var(--lmn-ash-100)' }}>
            Le mie leghe
          </span>
          <span style={{ color: 'var(--lmn-ash-500)', fontSize: 18 }}>›</span>
        </Link>
      )}

      {/* Regolamento (solo profilo proprio) */}
      {isMe && (
        <Link
          to="/regole"
          className="lmn-card lmn-card--hoverable"
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', marginBottom: 20, textDecoration: 'none' }}
        >
          <span style={{ color: 'var(--lmn-gold-500)' }}>
            <Icon name="whistle" size={22} />
          </span>
          <span style={{ flex: 1, fontFamily: 'var(--lmn-font-ui)', fontWeight: 600, fontSize: 14, color: 'var(--lmn-ash-100)' }}>
            Regolamento
          </span>
          <span style={{ color: 'var(--lmn-ash-500)', fontSize: 18 }}>›</span>
        </Link>
      )}

      {/* Stat grid 2x2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 }}>
        <StatCard label="Punti totali" value={stats.total_points} icon="trophy" />
        <StatCard label="Risultati esatti" value={stats.exact_count} icon="goal" />
        <StatCard label="Precisione" value={stats.accuracy} unit="%" icon="prediction-arrow" />
        <StatCard label="Partite mancate" value={stats.missed_count} icon="whistle" />
      </div>

      {/* Grafico punti per giornata */}
      <h2 style={{ fontFamily: 'var(--lmn-font-display)', fontSize: 22, letterSpacing: '0.04em', margin: '0 0 12px', color: 'var(--lmn-ash-100)' }}>
        PUNTI PER GIORNATA
      </h2>
      <div className="lmn-card" style={{ padding: 20, marginBottom: 28 }}>
        <PointsChart data={stats.points_by_matchday} />
      </div>

      {/* Achievements (solo profilo proprio) */}
      {isMe && (
        <>
          <h2 style={{ fontFamily: 'var(--lmn-font-display)', fontSize: 22, letterSpacing: '0.04em', margin: '0 0 12px', color: 'var(--lmn-ash-100)' }}>
            ACHIEVEMENT
          </h2>
          <div style={{ marginBottom: 28 }}>
            {achievements.length > 0 ? (
              <AchievementGrid achievements={achievements} />
            ) : (
              <p style={{ color: 'var(--lmn-ash-500)', fontSize: 13 }}>Caricamento…</p>
            )}
          </div>
        </>
      )}

      {/* Storico */}
      <h2 style={{ fontFamily: 'var(--lmn-font-display)', fontSize: 22, letterSpacing: '0.04em', margin: '0 0 12px', color: 'var(--lmn-ash-100)' }}>
        ULTIMI PRONOSTICI
      </h2>
      <History stats={stats} scorers={scorers} />

    </div>
  )
}
