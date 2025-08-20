import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'
import { getServerSession } from 'next-auth'
import { db } from '@/db'
import { users } from '@/db/schema'

vi.mock('next-auth')
vi.mock('@/db')
vi.mock('@auth/drizzle-adapter', () => ({
  DrizzleAdapter: vi.fn().mockImplementation(() => ({}))
}))
vi.mock('@/lib/auth', () => ({
  authOptions: {}
}))

describe('session API route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return session data when authenticated with db user', async () => {
    const mockSession = {
      user: {
        id: '123',
        name: 'Test User',
        email: 'test@example.com'
      }
    }
    vi.mocked(getServerSession).mockResolvedValue(mockSession)
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{
        id: '123',
        onboardingCompleted: true,
        f3Name: 'Test F3',
        hospitalName: 'Test Hospital'
      }])
    } as any)

    const response = await GET()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ...mockSession,
      user: {
        ...mockSession.user,
        onboardingCompleted: true,
        f3Name: 'Test F3',
        hospitalName: 'Test Hospital'
      }
    })
  })

  it('should return basic session when authenticated without db user', async () => {
    const mockSession = {
      user: {
        id: '123',
        name: 'Test User',
        email: 'test@example.com'
      }
    }
    vi.mocked(getServerSession).mockResolvedValue(mockSession)
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([])
    } as any)

    const response = await GET()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(mockSession)
  })

  it('should return null when not authenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const response = await GET()
    expect(response.status).toBe(200)
    expect(await response.json()).toBeNull()
  })
})
