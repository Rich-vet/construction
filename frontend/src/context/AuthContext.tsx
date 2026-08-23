import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  fetchCsrf,
  getMe,
  login as apiLogin,
  logout as apiLogout,
  type AuthUser,
} from '../api/auth'

type AuthState = {
  user: AuthUser | null
  navigation: string[]
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [navigation, setNavigation] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    await fetchCsrf()
    const me = await getMe()
    if (me.authenticated && me.user) {
      setUser(me.user)
      setNavigation(me.navigation ?? [])
    } else {
      setUser(null)
      setNavigation([])
    }
  }, [])

  useEffect(() => {
    refresh()
      .catch(() => {
        setUser(null)
        setNavigation([])
      })
      .finally(() => setLoading(false))
  }, [refresh])

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiLogin(email, password)
    setUser(result.user)
    setNavigation(result.navigation)
  }, [])

  const logout = useCallback(async () => {
    await apiLogout()
    setUser(null)
    setNavigation([])
    await fetchCsrf()
  }, [])

  const value = useMemo(
    () => ({ user, navigation, loading, login, logout, refresh }),
    [user, navigation, loading, login, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
