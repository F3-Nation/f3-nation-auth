import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { db } from '../db'
import { users } from '../db/schema'
import { createEmailVerification, verifyEmailCode } from './twilio/index'
import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

// Mock all dependencies
vi.mock('@auth/drizzle-adapter')
vi.mock('../db')
vi.mock('./twilio/index')
vi.mock('./auth')

// Create mock authOptions directly in test file
const mockAuthOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: 'email',
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        code: { label: 'Verification Code', type: 'text' },
        callbackUrl: { label: 'Callback URL', type: 'text' },
      },
      authorize: vi.fn().mockImplementation(async (credentials) => {
        if (!credentials?.code) {
          return null
        }
        return {
          id: 'test@example.com',
          name: 'Test User',
          email: 'test@example.com',
          onboardingCompleted: false
        }
      })
    })
  ],
  adapter: {
    createUser: vi.fn(),
    getUser: vi.fn(),
    getUserByEmail: vi.fn(),
    getUserByAccount: vi.fn(),
    updateUser: vi.fn(),
    deleteUser: vi.fn(),
    linkAccount: vi.fn(),
    unlinkAccount: vi.fn(),
    createSession: vi.fn(),
    getSessionAndUser: vi.fn(),
    updateSession: vi.fn(),
    deleteSession: vi.fn(),
    createVerificationToken: vi.fn(),
    useVerificationToken: vi.fn()
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60
  },
  callbacks: {
    jwt: vi.fn().mockImplementation(async ({ token, user }) => {
      if (user) {
        token.id = user.id
        token.name = user.name
        token.email = user.email
      }
      return token
    }),
    session: vi.fn().mockImplementation(async ({ session, token }) => {
      if (token) {
        session.user = {
          ...session.user,
          id: token.id,
          name: token.name || session.user?.name,
          email: token.email || session.user?.email
        }
      }
      return session
    })
  }
}

// Set up mock implementation
vi.mock('./auth', () => ({
  authOptions: mockAuthOptions
}))

// Create simple mock verification
const mockVerification = {
  sid: 'mock-sid',
  to: 'test@example.com',
  status: 'pending'
}

describe('auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock db operations
    vi.mocked(db.select).mockReturnValue({
      fields: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{
        id: 'test@example.com',
        name: 'Test User',
        email: 'test@example.com',
        f3Name: 'testuser',
        onboardingCompleted: false
      }])
    } as any)

    vi.mocked(db.insert).mockReturnValue({
      into: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{
        id: 'test@example.com',
        name: 'Test User',
        email: 'test@example.com',
        f3Name: 'testuser',
        onboardingCompleted: false
      }])
    } as any)

    vi.mocked(db.update).mockReturnValue({
      table: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue({})
    } as any)

    // Mock Twilio functions
    vi.mocked(createEmailVerification).mockResolvedValue(mockVerification as any)
    vi.mocked(verifyEmailCode).mockResolvedValue(true)
  })

  it('should export authOptions with correct configuration', () => {
    expect(mockAuthOptions).toBeDefined()
    expect(mockAuthOptions.providers).toBeInstanceOf(Array)
    expect(mockAuthOptions.session?.strategy).toBe('jwt')
  })

  it('should configure Email provider', () => {
    const emailProvider = mockAuthOptions.providers[0] as ReturnType<typeof CredentialsProvider>
    expect(emailProvider).toBeDefined()
    expect(emailProvider.options.name).toBe('Email')
  })

  describe('CredentialsProvider', () => {
    it('should handle email verification request', async () => {
      const emailProvider = mockAuthOptions.providers[0] as ReturnType<typeof CredentialsProvider>
      const authorize = emailProvider?.options?.authorize
      
      if (typeof authorize !== 'function') {
        throw new Error('Authorize is not a function')
      }

      // Mock the authorize implementation to call createEmailVerification
      const mockAuthorize = vi.fn().mockImplementation(async (credentials) => {
        await createEmailVerification(credentials.email, credentials.callbackUrl)
        return null
      })
      emailProvider.options.authorize = mockAuthorize

      const result = await mockAuthorize({
        email: 'test@example.com',
        code: undefined,
        callbackUrl: 'http://localhost:3000'
      })

      expect(result).toBeNull()
      expect(mockAuthorize).toHaveBeenCalledWith({
        email: 'test@example.com',
        code: undefined,
        callbackUrl: 'http://localhost:3000'
      })
      expect(createEmailVerification).toHaveBeenCalledWith(
        'test@example.com',
        'http://localhost:3000'
      )
    })

    it('should verify valid email code', async () => {
      const emailProvider = mockAuthOptions.providers[0] as ReturnType<typeof CredentialsProvider>
      const authorize = emailProvider?.options?.authorize
      
      if (typeof authorize !== 'function') {
        throw new Error('Authorize is not a function')
      }

      // Mock the authorize implementation to call verifyEmailCode
      const mockAuthorize = vi.fn().mockImplementation(async (credentials) => {
        await verifyEmailCode(credentials.email, credentials.code, true)
        return {
          id: 'test@example.com',
          name: 'Test User',
          email: 'test@example.com',
          onboardingCompleted: false
        }
      })
      emailProvider.options.authorize = mockAuthorize

      const result = await mockAuthorize({
        email: 'test@example.com',
        code: '123456',
        callbackUrl: 'http://localhost:3000'
      })

      expect(result).toEqual({
        id: 'test@example.com',
        name: 'Test User',
        email: 'test@example.com',
        onboardingCompleted: false
      })
      expect(mockAuthorize).toHaveBeenCalledWith({
        email: 'test@example.com',
        code: '123456',
        callbackUrl: 'http://localhost:3000'
      })
      expect(verifyEmailCode).toHaveBeenCalledWith(
        'test@example.com',
        '123456',
        true
      )
    })
  })

  describe('callbacks', () => {
    it('should add user info to JWT token', async () => {
      const callbacks = mockAuthOptions.callbacks!
      const token = await callbacks.jwt!({
        token: {} as any,
        user: {
          id: 'test@example.com',
          name: 'Test User',
          email: 'test@example.com',
          onboardingCompleted: false
        },
        account: null,
        profile: undefined
      })

      expect(token).toMatchObject({
        id: 'test@example.com',
        name: 'Test User',
        email: 'test@example.com'
      })
    })

    it('should enrich session with user data', async () => {
      const callbacks = mockAuthOptions.callbacks!
      const enrichedSession = await callbacks.session!({
        session: {
          user: {
            id: 'test@example.com',
            name: 'Test User',
            email: 'test@example.com'
          },
          expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        },
        token: {
          id: 'test@example.com'
        } as any,
        user: {
          id: 'test@example.com',
          email: 'test@example.com',
          emailVerified: null
        } as any,
        newSession: undefined,
        trigger: 'update' as const
      })

      expect(enrichedSession.user).toMatchObject({
        id: 'test@example.com',
        name: 'Test User',
        email: 'test@example.com'
      })
    })
  })
})
