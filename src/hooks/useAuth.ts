import { useState, useEffect } from 'react'
import type { User } from '../types'
import * as api from '../api'

type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; user: User }

export function useAuth() {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  useEffect(() => {
    api.fetchMe()
      .then(user => setState({ status: 'authenticated', user }))
      .catch(() => setState({ status: 'unauthenticated' }))
  }, [])

  async function login(email: string, password: string) {
    const user = await api.login(email, password)
    setState({ status: 'authenticated', user })
  }

  async function register(email: string, password: string, name: string) {
    const user = await api.register(email, password, name)
    setState({ status: 'authenticated', user })
  }

  async function logout() {
    await api.logout()
    setState({ status: 'unauthenticated' })
  }

  return { state, login, register, logout }
}
