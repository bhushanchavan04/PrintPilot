'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, FileText, Image, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { formatFileSize } from '@/lib/utils'
import type { UploadedFile } from '@/types'

interface UploadApiResponse {
  fileId: string
  originalName: string
  pageCount: number
  sizeBytes: number
  mimeType: string
  format: string
}

interface UploadStepProps {
  shopId: string
  files: UploadedFile[]
  onFilesChange: React.Dispatch<React.SetStateAction<UploadedFile[]>>
  onNext: () => void
}

const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
}

export function UploadStep({ shopId, files, onFilesChange, onNext }: UploadStepProps) {
  const [isDragActive, setIsDragActive] = useState(false)

  const uploadFile = useCallback(
    async (file: File, localId: string) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('shopId', shopId)

      return new Promise<UploadApiResponse>((resolve, reject) => {
        const xhr = new XMLHttpRequest()

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100)
            onFilesChange((prev) =>
              prev.map((f) => (f.localId === localId ? { ...f, progress } : f))
            )
          }
        })

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const data: UploadApiResponse = JSON.parse(xhr.responseText)
            resolve(data)
          } else {
            let errMsg = 'Upload failed'
            try {
              errMsg = JSON.parse(xhr.responseText).error ?? errMsg
            } catch {}
            reject(new Error(errMsg))
          }
        })

        xhr.addEventListener('error', () => reject(new Error('Network error during upload')))
        xhr.open('POST', '/api/files/upload')
        xhr.send(formData)
      })
    },
    [shopId, onFilesChange]
  )

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const newFiles: UploadedFile[] = acceptedFiles.map((file) => ({
        id: '',
        localId: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        originalName: file.name,
        sizeBytes: file.size,
        mimeType: file.type,
        pageCount: 0,
        status: 'uploading',
        progress: 0,
      }))

      onFilesChange((prev) => [...prev, ...newFiles])

      for (const [index, file] of acceptedFiles.entries()) {
        const localId = newFiles[index].localId
        try {
          const result = await uploadFile(file, localId)
          onFilesChange((prev) =>
            prev.map((f) =>
              f.localId === localId
                ? {
                    ...f,
                    id: result.fileId ?? '',
                    pageCount: result.pageCount ?? 1,
                    status: 'uploaded' as const,
                    progress: 100,
                  }
                : f
            )
          )
        } catch (err: any) {
          onFilesChange((prev) =>
            prev.map((f) =>
              f.localId === localId
                ? { ...f, status: 'error' as const, error: err.message }
                : f
            )
          )
        }
      }
    },
    [onFilesChange, uploadFile]
  )

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: 50 * 1024 * 1024,
    maxFiles: 10,
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false),
    onDropAccepted: () => setIsDragActive(false),
    onDropRejected: (rejections) => {
      setIsDragActive(false)
      const msg = rejections[0]?.errors[0]?.message ?? 'File rejected'
      alert(msg)
    },
  })

  const removeFile = (localId: string) => {
    onFilesChange(files.filter((f) => f.localId !== localId))
  }

  const uploadedCount = files.filter((f) => f.status === 'uploaded').length
  const hasErrors = files.some((f) => f.status === 'error')
  const isUploading = files.some((f) => f.status === 'uploading')

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-200 hover:border-blue-400 hover:bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center">
            <Upload className="w-7 h-7 text-blue-500" />
          </div>
          <div>
            <p className="text-base font-medium text-gray-900">
              {isDragActive ? 'Drop files here' : 'Tap to upload or drag & drop'}
            </p>
            <p className="text-sm text-gray-500 mt-1">PDF, DOCX, JPG, PNG — up to 50MB each</p>
          </div>
          <Button variant="outline" size="sm" type="button">
            Browse files
          </Button>
        </div>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-3">
          {files.map((file) => (
            <div key={file.localId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <div className="w-10 h-10 bg-white border border-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                {file.mimeType.startsWith('image/') ? (
                  <Image className="w-5 h-5 text-blue-500" />
                ) : (
                  <FileText className="w-5 h-5 text-blue-500" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{file.originalName}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-500">{formatFileSize(file.sizeBytes)}</span>
                  {file.status === 'uploaded' && file.pageCount > 0 && (
                    <span className="text-xs text-gray-500">• {file.pageCount} pages</span>
                  )}
                  {file.status === 'uploading' && (
                    <span className="text-xs text-blue-600">{file.progress}%</span>
                  )}
                  {file.status === 'error' && (
                    <span className="text-xs text-red-600">{file.error}</span>
                  )}
                </div>
                {file.status === 'uploading' && (
                  <Progress value={file.progress} className="h-1 mt-1" />
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {file.status === 'uploading' && (
                  <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                )}
                {file.status === 'uploaded' && (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                )}
                {file.status === 'error' && (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                )}
                <button
                  onClick={() => removeFile(file.localId)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  disabled={file.status === 'uploading'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action */}
      <div className="flex flex-col gap-3">
        {hasErrors && (
          <p className="text-sm text-red-600 text-center">Some files failed to upload. Remove them and try again.</p>
        )}
        <Button
          onClick={onNext}
          disabled={uploadedCount === 0 || isUploading}
          size="lg"
          className="w-full"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            `Continue with ${uploadedCount} file${uploadedCount !== 1 ? 's' : ''}`
          )}
        </Button>
      </div>
    </div>
  )
}

