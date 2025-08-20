import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'
import { getServerSession } from 'next-auth'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

vi.mock('next-auth')
vi.mock('@/db')
vi.mock('@auth/drizzle-adapter', () => ({
  DrizzleAdapter: vi.fn().mockImplementation(() => ({}))
}))
vi.mock('@/lib/auth', () => ({
  authOptions: {}
}))

describe('onboarding API route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should complete onboarding for authenticated user', async () => {
    const mockSession = {
      user: {
        id: '123',
        name: 'Test User',
        email: 'test@example.com'
      }
    }
    vi.mocked(getServerSession).mockResolvedValue(mockSession)
    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{
        id: '123',
        onboardingCompleted: true,
        f3Name: 'Test F3',
        hospitalName: 'Test Hospital'
      }])
    } as any)

    const mockRequest = {
      json: vi.fn().mockResolvedValue({
        f3Name: 'Test F3',
        hospitalName: 'Test Hospital'
      })
    } as unknown as NextRequest

    const response = await POST(mockRequest)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true
    })
  })

  it('should reject unauthenticated requests', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const mockRequest = {
      json: vi.fn().mockResolvedValue({})
    } as unknown as NextRequest

    const response = await POST(mockRequest)
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({
      error: 'Unauthorized'
    })
  })

  it('should validate F3 name is required', async () => {
    const mockSession = {
      user: {
        id: '123',
        name: 'Test User',
        email: 'test@example.com'
      }
    }
    vi.mocked(getServerSession).mockResolvedValue(mockSession)

    const mockRequest = {
      json: vi.fn().mockResolvedValue({ hospitalName: 'Test Hospital' })
    } as unknown as NextRequest

    const response = await POST(mockRequest)
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'F3 name is required'
    })
  })

  it('should validate hospital name is required', async () => {
    const mockSession = {
      user: {
        id: '123',
        name: 'Test User',
        email: 'test@example.com'
      }
    }
    vi.mocked(getServerSession).mockResolvedValue(mockSession)

    const mockRequest = {
      json: vi.fn().mockResolvedValue({ f3Name: 'Test F3' })
    } as unknown as NextRequest

    const response = await POST(mockRequest)
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Hospital name is required'
    })
  })
})
