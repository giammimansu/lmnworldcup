import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import BackButton from '../components/BackButton'
import {
  getMyAchievements,
  getMyStats,
  getUserStats,
  type Achievement,
  type SpecialStat,
  type UserStats,
} from '../api/stats'
import { useAuth } from '../auth/AuthContext'
import { Avatar, Badge } from '../components/ui'
import { Icon, type IconName } from '../components/Icon'

// ------------------------------------------------------------- Stat card
function StatCard({ label, value, unit, icon, sub }: { label: string; value: number | string; unit?: string; icon: IconName; sub?: string }) {
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
      {sub && (
        <div style={{ fontFamily: 'var(--lmn-font-ui)', fontSize: 11, color: 'var(--lmn-ash-500)', marginTop: 6 }}>
          {sub}
        </div>
      )}
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

// Colore chip "Risultato": verde esatto, oro segno, grigio sbagliato.
function resultBadgeStyle(outcome: string): React.CSSProperties {
  if (outcome === 'exact')
    return { background: 'rgba(34,168,95,0.18)', color: 'var(--lmn-success-400)' }
  if (outcome === 'sign')
    return { background: 'rgba(212,168,67,0.18)', color: 'var(--lmn-gold-400)' }
  return { background: 'var(--lmn-pitch-500, #182038)', color: 'var(--lmn-ash-500)' }
}

// ------------------------------------------------------------- History
function History({
  stats,
  isMe,
}: {
  stats: UserStats
  isMe: boolean
}) {
  if (stats.history.length === 0)
    return (
      <p style={{ color: 'var(--lmn-ash-500)', fontSize: 13 }}>
        {isMe ? 'Nessun pronostico ancora.' : 'Nessuna partita conclusa ancora.'}
      </p>
    )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {stats.history.map((h) => {
        const hasResult = h.actual_home != null && h.actual_away != null
        const pending = h.outcome === 'pending'
        const resultPts = h.points ?? 0
        const scorerPts = h.scorer_points ?? 0
        const hasScorer = !!h.scorer_names && h.scorer_names.length > 0
        const total = resultPts + scorerPts
        return (
        <Link
          key={h.match_id}
          to={`/match/${h.match_id}`}
          className="lmn-card lmn-card--hoverable"
          style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Squadre con crest */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--lmn-font-ui)', fontWeight: 600, fontSize: 13, color: 'var(--lmn-ash-100)', overflow: 'hidden' }}>
              {h.home_team_crest && <img src={h.home_team_crest} alt="" style={{ width: 18, height: 18, objectFit: 'contain', flexShrink: 0 }} />}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.home_team_name ?? '—'}</span>
              <span style={{ color: 'var(--lmn-ash-500)', flexShrink: 0 }}>–</span>
              {h.away_team_crest && <img src={h.away_team_crest} alt="" style={{ width: 18, height: 18, objectFit: 'contain', flexShrink: 0 }} />}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.away_team_name ?? '—'}</span>
            </div>
            {/* Pronostico vs risultato reale */}
            <div style={{ fontFamily: 'var(--lmn-font-mono)', fontSize: 11, color: 'var(--lmn-ash-500)', marginTop: 3 }}>
              Pronostico <span style={{ color: 'var(--lmn-ash-300)' }}>{h.pred_home}–{h.pred_away}</span>
              {hasResult && (
                <>
                  {' · '}Reale <span style={{ color: 'var(--lmn-ash-100)' }}>{h.actual_home}–{h.actual_away}</span>
                </>
              )}
            </div>
            {/* Nomi marcatori previsti */}
            {hasScorer && (
              <div style={{ fontFamily: 'var(--lmn-font-ui)', fontSize: 11, marginTop: 3, color: 'var(--lmn-ash-500)' }}>
                ⚽ {h.scorer_names!.join(', ')}
              </div>
            )}
            {/* Dettaglio punti: risultato + marcatori, etichettati */}
            {!pending && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                <span
                  style={{
                    fontFamily: 'var(--lmn-font-ui)',
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 6,
                    ...resultBadgeStyle(h.outcome),
                  }}
                >
                  Risultato {resultPts > 0 ? `+${resultPts}` : '0'}
                </span>
                {hasScorer && (
                  <span
                    style={{
                      fontFamily: 'var(--lmn-font-ui)',
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: scorerPts > 0 ? 'rgba(34,168,95,0.18)' : 'var(--lmn-pitch-500, #182038)',
                      color: scorerPts > 0 ? 'var(--lmn-success-400)' : 'var(--lmn-ash-500)',
                    }}
                  >
                    ⚽ Marcatori {scorerPts > 0 ? `+${scorerPts}` : '0'}
                  </span>
                )}
              </div>
            )}
          </div>
          {/* Totale punti del pronostico (risultato + marcatori) */}
          {pending ? (
            <Badge variant="timed">In attesa</Badge>
          ) : (
            <div style={{ textAlign: 'right', minWidth: 46 }}>
              <div
                style={{
                  fontFamily: 'var(--lmn-font-display)',
                  fontSize: 22,
                  lineHeight: 1,
                  color: total > 0 ? 'var(--lmn-gold-400)' : 'var(--lmn-ash-500)',
                }}
              >
                {total}
              </div>
              <div style={{ fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--lmn-ash-500)' }}>
                punti
              </div>
            </div>
          )}
        </Link>
        )
      })}
    </div>
  )
}

// ------------------------------------------------------------- Special list
function SpecialList({
  items,
  isMe,
  style,
}: {
  items: SpecialStat[]
  isMe: boolean
  style?: React.CSSProperties
}) {
  if (!items || items.length === 0)
    return (
      <p style={{ color: 'var(--lmn-ash-500)', fontSize: 13, ...style }}>
        {isMe
          ? 'Nessun pronostico di torneo ancora.'
          : 'I pronostici di torneo si vedono dopo la scadenza.'}
      </p>
    )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, ...style }}>
      {items.map((q) => (
        <div key={q.code} className="lmn-card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--lmn-font-ui)', fontWeight: 600, fontSize: 13, color: 'var(--lmn-ash-100)' }}>
              {q.title}
            </div>
            <div style={{ fontFamily: 'var(--lmn-font-ui)', fontSize: 12, marginTop: 3, color: 'var(--lmn-ash-300)' }}>
              {q.answer_label ?? <span style={{ color: 'var(--lmn-ash-600)' }}>Nessuna risposta</span>}
            </div>
            {q.resolved && q.correct_label && (
              <div style={{ fontSize: 11, marginTop: 2, color: 'var(--lmn-ash-500)' }}>
                Corretta: <span style={{ color: 'var(--lmn-success-400)' }}>{q.correct_label}</span>
              </div>
            )}
          </div>
          {q.resolved ? (
            <Badge variant={(q.my_points ?? 0) > 0 ? 'esatto' : 'sbagliato'}>
              {q.my_points ?? 0} PT
            </Badge>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <Badge variant="live" live>
                In corso
              </Badge>
              <span style={{ fontSize: 10, color: 'var(--lmn-ash-500)' }}>vale {q.points} pt</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ------------------------------------------------------------- Page
export default function Profile() {
  const { userId } = useParams()
  const { user } = useAuth()
  const isMe = !userId || userId === user?.id

  const [stats, setStats] = useState<UserStats | null>(null)
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [error, setError] = useState(false)

  useEffect(() => {
    const load = isMe ? getMyStats() : getUserStats(userId!)
    load.then(setStats).catch(() => setError(true))
    if (isMe) {
      getMyAchievements()
        .then((r) => setAchievements(r.achievements))
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
      {!isMe && <BackButton to="/" label="Classifica" />}

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
        <StatCard
          label="Marcatori indovinati"
          value={stats.scorers_guessed}
          icon="ball"
          sub={`${stats.scorers_predicted} previsti · ${stats.scorers_accuracy}%`}
        />
        <StatCard label="Partite mancate" value={stats.missed_count} icon="whistle" />
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

      {/* Pronostici di torneo */}
      <h2 style={{ fontFamily: 'var(--lmn-font-display)', fontSize: 22, letterSpacing: '0.04em', margin: '0 0 12px', color: 'var(--lmn-ash-100)' }}>
        PRONOSTICI TORNEO
      </h2>
      <SpecialList items={stats.special} isMe={isMe} style={{ marginBottom: 28 }} />

      {/* Storico partite concluse */}
      <h2 style={{ fontFamily: 'var(--lmn-font-display)', fontSize: 22, letterSpacing: '0.04em', margin: '0 0 12px', color: 'var(--lmn-ash-100)' }}>
        {isMe ? 'ULTIMI PRONOSTICI' : 'PARTITE CONCLUSE'}
      </h2>
      <History stats={stats} isMe={isMe} />

    </div>
  )
}
