import fs from 'fs'
import path from 'path'
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner'

const BUCKET_NAME = process.env.S3_BUCKET || 'myprint-documents'
const LOCAL_STORAGE_DIR = path.join(process.cwd(), '.storage', 'documents')

let s3Available: boolean | null = null

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || 'myprint_minio',
    secretAccessKey: process.env.S3_SECRET_KEY || 'myprint_minio_secret',
  },
  forcePathStyle: true,
})

function ensureLocalDir(filepath: string) {
  const dir = path.dirname(filepath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function getLocalPath(key: string): string {
  // Prevent directory traversal
  const sanitized = key.replace(/\.\./g, '')
  return path.join(LOCAL_STORAGE_DIR, sanitized)
}

/** Check and ensure S3 bucket exists, or fall back to local disk if S3 is unreachable */
async function checkStorageMode(): Promise<boolean> {
  if (s3Available !== null) return s3Available

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: '.keep' }), {
      abortSignal: controller.signal,
    })
    clearTimeout(timeout)
    s3Available = true
    return true
  } catch (err: any) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      s3Available = true
      return true
    }
    try {
      await s3.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }))
      s3Available = true
      return true
    } catch (createErr: any) {
      if (createErr.name === 'BucketAlreadyOwnedByYou') {
        s3Available = true
        return true
      }
      console.warn('[Storage] S3/MinIO unreachable, falling back to secure local file storage.')
      s3Available = false
      return false
    }
  }
}

/**
 * Upload a file buffer to object storage or local fallback.
 * Returns the storage key.
 */
export async function uploadFile(
  key: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const useS3 = await checkStorageMode()

  if (useS3) {
    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
          ServerSideEncryption: 'AES256',
        })
      )
      return key
    } catch (err) {
      console.warn('[Storage] S3 upload failed, falling back to local storage:', err)
      s3Available = false
    }
  }

  // Local storage fallback
  const localFile = getLocalPath(key)
  ensureLocalDir(localFile)
  await fs.promises.writeFile(localFile, buffer)
  return key
}

/**
 * Generate a download URL.
 * S3 returns pre-signed URL.
 * Local fallback returns internal secure API route.
 */
export async function getSignedUrl(key: string, expiresInSeconds = 900): Promise<string> {
  const useS3 = await checkStorageMode()

  if (useS3) {
    try {
      const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key })
      return await awsGetSignedUrl(s3, command, { expiresIn: expiresInSeconds })
    } catch {
      // Fallback
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${baseUrl}/api/files/download?key=${encodeURIComponent(key)}`
}

/**
 * Delete a file from storage.
 */
export async function deleteFile(key: string): Promise<void> {
  const useS3 = await checkStorageMode()

  if (useS3) {
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }))
      return
    } catch {
      // Continue to local check
    }
  }

  const localFile = getLocalPath(key)
  if (fs.existsSync(localFile)) {
    await fs.promises.unlink(localFile)
  }
}

/**
 * Check if a file exists.
 */
export async function fileExists(key: string): Promise<boolean> {
  const useS3 = await checkStorageMode()

  if (useS3) {
    try {
      await s3.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }))
      return true
    } catch {
      // Check local
    }
  }

  const localFile = getLocalPath(key)
  return fs.existsSync(localFile)
}

/**
 * Read file buffer directly (useful for local download endpoint).
 */
export async function readFileBuffer(key: string): Promise<Buffer | null> {
  const localFile = getLocalPath(key)
  if (fs.existsSync(localFile)) {
    return fs.promises.readFile(localFile)
  }
  return null
}
