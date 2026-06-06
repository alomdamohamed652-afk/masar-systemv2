import { createServiceClient } from '@/lib/supabase/server'

export type StorageBucket =
  | 'product-images'
  | 'expense-invoices'
  | 'task-attachments'
  | 'logos'
  | 'backups'

/**
 * Upload a file to Supabase Storage
 * Returns the public URL or throws
 */
export async function uploadFile(
  bucket: StorageBucket,
  path: string,
  file: Buffer | Blob | File,
  contentType?: string
): Promise<string> {
  const supabase = createServiceClient()

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType,
    upsert: true,
  })

  if (error) throw new Error(`Storage upload failed: ${error.message}`)

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

/**
 * Delete a file from Supabase Storage
 */
export async function deleteFile(
  bucket: StorageBucket,
  path: string
): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase.storage.from(bucket).remove([path])
  if (error) throw new Error(`Storage delete failed: ${error.message}`)
}

/**
 * Extract storage path from a public URL
 * Used before deleting (extract path from full URL)
 */
export function extractStoragePath(publicUrl: string): string {
  // URL format: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
  const match = publicUrl.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/)
  return match ? match[1] : publicUrl
}

/**
 * Generate a unique file path for uploads
 * Format: <prefix>/<timestamp>-<random>.<ext>
 */
export function generateFilePath(
  prefix: string,
  fileName: string
): string {
  const ext = fileName.split('.').pop() ?? 'bin'
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8)
  return `${prefix}/${timestamp}-${random}.${ext}`
}
