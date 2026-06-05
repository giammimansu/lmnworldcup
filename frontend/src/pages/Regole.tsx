import { Link } from 'react-router-dom'
import { RegoleContent } from '../components/RegoleContent'

// ------------------------------------------------------------- Page
export default function Regole() {
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px 96px' }}>
      <Link
        to="/profile"
        style={{ display: 'inline-block', color: 'var(--lmn-ash-400)', textDecoration: 'none', fontSize: 14, marginBottom: 16 }}
      >
        ← Profilo
      </Link>

      <h1 style={{ fontFamily: 'var(--lmn-font-display)', fontSize: 32, letterSpacing: '0.04em', margin: '0 0 28px', color: 'var(--lmn-ash-100)' }}>
        REGOLAMENTO
      </h1>

      <RegoleContent />
    </div>
  )
}
