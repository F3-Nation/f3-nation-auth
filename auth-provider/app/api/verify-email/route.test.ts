import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'
import { db } from '../../../db'
import { verifyEmailCode } from '../../../lib/twilio'

vi.mock('../../../db')
vi.mock('../../../lib/twilio')

describe('verify-email API route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should verify valid email code', async () => {
    const mockRequest = {
      headers: new Headers({
        'content-length': '100'
      }),
      json: vi.fn().mockResolvedValue({
        email: 'test@example.com',
        code: '123456'
      })
    } as unknown as NextRequest

    vi.mocked(verifyEmailCode).mockResolvedValue(true)

    const response = await POST(mockRequest)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      canSignIn: true
    })
  })

  it('should reject invalid email code', async () => {
    const mockRequest = {
      headers: new Headers({
        'content-length': '100'
      }),
      json: vi.fn().mockResolvedValue({
        email: 'test@example.com',
        code: 'wrong'
      })
    } as unknown as NextRequest

    vi.mocked(verifyEmailCode).mockResolvedValue(false)

    const response = await POST(mockRequest)
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Invalid verification code'
    })
  })
})
