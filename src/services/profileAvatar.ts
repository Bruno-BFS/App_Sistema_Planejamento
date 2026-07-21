import { supabase } from '../lib/supabase'

const AVATAR_BUCKET = 'avatars'
const AVATAR_MAX_BYTES = 8 * 1024 * 1024
const AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function requireClient() {
  if (!supabase) throw new Error('Supabase não configurado.')
  return supabase
}

export function validateAvatarFile(file: File) {
  if (!AVATAR_TYPES.has(file.type)) throw new Error('Escolha uma imagem JPG, PNG ou WebP.')
  if (file.size > AVATAR_MAX_BYTES) throw new Error('A imagem deve ter no máximo 8 MB.')
  if (file.size === 0) throw new Error('A imagem selecionada está vazia.')
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => { URL.revokeObjectURL(url); resolve(image) }
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível abrir esta imagem.')) }
    image.src = url
  })
}

export async function prepareAvatarImage(file: File) {
  validateAvatarFile(file)
  const image = await loadImage(file)
  const cropSize = Math.min(image.naturalWidth, image.naturalHeight)
  if (!cropSize) throw new Error('A imagem não possui dimensões válidas.')
  const outputSize = Math.min(512, cropSize)
  const canvas = document.createElement('canvas')
  canvas.width = outputSize
  canvas.height = outputSize
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Seu navegador não conseguiu preparar a imagem.')
  const sourceX = (image.naturalWidth - cropSize) / 2
  const sourceY = (image.naturalHeight - cropSize) / 2
  context.drawImage(image, sourceX, sourceY, cropSize, cropSize, 0, 0, outputSize, outputSize)
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error('Não foi possível converter a imagem.')),
    'image/webp',
    .86,
  ))
}

export async function uploadProfileAvatar(userId: string, file: File) {
  const client = requireClient()
  const avatar = await prepareAvatarImage(file)
  const path = `${userId}/avatar.webp`
  const { error: uploadError } = await client.storage.from(AVATAR_BUCKET).upload(path, avatar, {
    cacheControl: '3600',
    contentType: 'image/webp',
    upsert: true,
  })
  if (uploadError) {
    if (/row-level security|unauthorized|forbidden/i.test(uploadError.message)) {
      throw new Error('Não foi possível salvar a foto com segurança. Atualize a página e tente novamente.')
    }
    throw uploadError
  }
  const { data } = client.storage.from(AVATAR_BUCKET).getPublicUrl(path)
  const publicUrl = `${data.publicUrl}?v=${Date.now()}`
  const { error: profileError } = await client.auth.updateUser({ data: {
    avatar_url: publicUrl,
    custom_avatar_path: path,
  } })
  if (profileError) throw profileError
  return publicUrl
}

export async function removeProfileAvatar(userId: string, fallbackUrl: string | null) {
  const client = requireClient()
  const path = `${userId}/avatar.webp`
  const { error: profileError } = await client.auth.updateUser({ data: {
    avatar_url: fallbackUrl,
    custom_avatar_path: null,
  } })
  if (profileError) throw profileError
  await client.storage.from(AVATAR_BUCKET).remove([path])
}
