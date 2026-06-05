import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { LeagueProvider } from './leagues/LeagueContext'
import { BottomNav } from './components/BottomNav'
import AddToHome from './components/AddToHome'
import { ErrorBoundary } from './components/ErrorBoundary'
import Admin from './pages/Admin'
import Bracket from './pages/Bracket'
import Home from './pages/Home'
import Leagues from './pages/Leagues'
import Login from './pages/Login'
import Matches from './pages/Matches'
import Predict from './pages/Predict'
import PredictList from './pages/PredictList'
import Profile from './pages/Profile'
import Regole from './pages/Regole'
import SetPassword from './pages/SetPassword'
import Special from './pages/Special'
import Welcome from './pages/Welcome'

function guard(el: React.ReactNode) {
  return <ProtectedRoute>{el}</ProtectedRoute>
}

// Rotte senza barra: auth e schermata pronostico full-screen.
function hideNav(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname === '/password' ||
    pathname === '/welcome' ||
    pathname.startsWith('/match/')
  )
}

// Shell renderizzata dentro il Router: la BottomNav vive qui (una sola volta)
// così resta sempre presente anche durante loading/errori delle pagine.
function Shell() {
  const { pathname } = useLocation()
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={guard(<Home />)} />
        <Route path="/matches" element={guard(<Matches />)} />
        <Route path="/predict" element={guard(<PredictList />)} />
        <Route path="/match/:matchId" element={guard(<Predict />)} />
        <Route path="/bracket" element={guard(<Bracket />)} />
        <Route path="/special" element={guard(<Special />)} />
        <Route path="/leagues" element={guard(<Leagues />)} />
        <Route path="/profile" element={guard(<Profile />)} />
        <Route path="/profile/:userId" element={guard(<Profile />)} />
        <Route path="/regole" element={guard(<Regole />)} />
        <Route path="/admin" element={guard(<Admin />)} />
        <Route path="/password" element={guard(<SetPassword />)} />
        <Route path="/welcome" element={guard(<Welcome />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!hideNav(pathname) && <BottomNav />}
      {!hideNav(pathname) && <AddToHome />}
    </>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <LeagueProvider>
          <BrowserRouter>
            <Shell />
          </BrowserRouter>
        </LeagueProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
