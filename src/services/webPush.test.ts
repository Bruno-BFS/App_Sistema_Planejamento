import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabase', () => ({ supabase: null }))

import { urlBase64ToUint8Array } from './webPush'

describe('webPush', () => {
  it('converte a chave VAPID base64url para bytes', () => {
    expect([...urlBase64ToUint8Array('AQID-v8')]).toEqual([1, 2, 3, 250, 255])
  })
})
