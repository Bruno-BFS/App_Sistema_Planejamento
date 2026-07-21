import { describe, expect, it } from 'vitest'
import { validateAvatarFile } from './profileAvatar'

describe('validateAvatarFile', () => {
  it('aceita imagens compatíveis dentro do limite', () => {
    expect(() => validateAvatarFile(new File(['imagem'], 'foto.png', { type: 'image/png' }))).not.toThrow()
  })

  it('rejeita formatos que não podem ser processados com segurança', () => {
    expect(() => validateAvatarFile(new File(['arquivo'], 'foto.svg', { type: 'image/svg+xml' }))).toThrow('JPG, PNG ou WebP')
  })

  it('rejeita imagens maiores que oito megabytes', () => {
    const oversized = new File([new Uint8Array(8 * 1024 * 1024 + 1)], 'foto.jpg', { type: 'image/jpeg' })
    expect(() => validateAvatarFile(oversized)).toThrow('8 MB')
  })
})
