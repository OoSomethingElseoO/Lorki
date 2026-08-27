"use client";

// Adapted from a 21st.dev community component ("File Dropzone" by joyco,
// id 19201) — token classes swapped for this project's real Tailwind theme
// (see coverflow-carousel.tsx/card-stack.tsx for the same vocabulary; the
// shadcn defaults this shipped with — bg-background, text-muted-foreground,
// border-input, ring-ring, text-destructive — aren't defined here). Corners
// use rounded-md, not the public site's rounded-none: this sits inside
// admin/seller/cause forms specifically, where the existing Button "form"
// variant already establishes rounded-md as the deliberate form-control
// look (see components/ui/button.tsx's comment on that variant).
import { AlertCircleIcon, FileIcon, ImageIcon, UploadIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useFileUpload } from "@/components/ui/file-dropzone-utils/use-file-upload";

export interface FileDropzoneProps {
  accept?: string;
  maxSizeMB?: number;
  maxFiles?: number;
  multiple?: boolean;
  onUpload?: (file: File) => Promise<unknown> | void;
}

export function FileDropzone({ accept, maxSizeMB = 2, maxFiles, multiple = false, onUpload }: FileDropzoneProps) {
  const maxSize = maxSizeMB * 1024 * 1024;
  const finalMaxFiles = maxFiles ?? (multiple ? 5 : 1);

  const {
    files,
    isDragging,
    errors,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    openFileDialog,
    removeFile,
    getInputProps,
  } = useFileUpload({ accept, maxSize, maxFiles: finalMaxFiles, onUpload });

  const previewUrl = files[0]?.preview || null;
  const uploadedFile = files[0]?.file || null;
  const hasFiles = files.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <div
          className="has-[input:focus]:border-focus has-[input:focus]:ring-focus/50 data-[dragging=true]:bg-sand-deep/30 relative flex min-h-52 flex-col items-center justify-center overflow-hidden rounded-md border border-dashed border-line p-4 transition-colors has-[input:focus]:ring-[3px]"
          data-dragging={isDragging || undefined}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <input {...getInputProps()} aria-label="Upload file" className="sr-only" />
          {!multiple && uploadedFile ? (
            <div className="absolute inset-0 flex items-center justify-center p-4">
              {previewUrl ? (
                <img alt={uploadedFile.name || "Uploaded file"} className="mx-auto max-h-full rounded object-contain" src={previewUrl} />
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 text-center">
                  <div aria-hidden="true" className="bg-panel flex size-16 shrink-0 items-center justify-center rounded-full border border-line">
                    <FileIcon className="size-8 opacity-60" />
                  </div>
                  <p className="text-sm font-medium text-ink">{uploadedFile.name}</p>
                  <p className="text-xs text-muted">
                    {uploadedFile.size < 1024 * 1024
                      ? `${(uploadedFile.size / 1024).toFixed(0)} KB`
                      : `${(uploadedFile.size / 1024 / 1024).toFixed(2)} MB`}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center px-4 py-3 text-center">
              <div aria-hidden="true" className="bg-panel mb-2 flex size-11 shrink-0 items-center justify-center rounded-full border border-line">
                <ImageIcon className="size-4 opacity-60" />
              </div>
              <p className="mb-1.5 text-sm font-medium text-ink">Drop your {multiple ? "files" : "image"} here</p>
              <p className="text-xs text-muted">
                {accept ? `${accept.split(",").join(", ")} ` : "Any file type "}
                (max. {maxSizeMB}MB)
                {multiple && finalMaxFiles > 1 && ` · Up to ${finalMaxFiles} files`}
              </p>
              <Button className="mt-4" onClick={openFileDialog} type="button" variant="outline" size="sm">
                <UploadIcon aria-hidden="true" className="-ms-1 size-4 opacity-60" />
                Select {multiple ? "files" : "file"}
              </Button>
            </div>
          )}
        </div>

        {!multiple && uploadedFile && (
          <div className="absolute right-4 top-4">
            <button
              aria-label="Remove file"
              className="focus-visible:border-focus focus-visible:ring-focus/50 z-50 flex size-8 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white outline-none transition-[color,box-shadow] hover:bg-black/80 focus-visible:ring-[3px]"
              onClick={() => removeFile(files[0]?.id)}
              type="button"
            >
              <XIcon aria-hidden="true" className="size-4" />
            </button>
          </div>
        )}
      </div>

      {errors.length > 0 && (
        <div className="flex items-center gap-1 text-xs text-error-accent" role="alert">
          <AlertCircleIcon className="size-3 shrink-0" />
          <span>{errors[0]}</span>
        </div>
      )}

      {multiple && hasFiles && (
        <div className="space-y-2">
          {files.map(({ id, file, preview }) => (
            <div key={id} className="bg-panel border-line relative flex items-center gap-3 rounded-md border p-3">
              {preview ? (
                <img src={preview} alt={file.name} className="size-10 shrink-0 rounded object-cover" />
              ) : (
                <div className="bg-panel flex size-10 shrink-0 items-center justify-center rounded border border-line">
                  <FileIcon className="size-4 opacity-60" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{file.name}</p>
                <p className="text-xs text-muted">
                  {file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(0)} KB` : `${(file.size / 1024 / 1024).toFixed(2)} MB`}
                </p>
              </div>
              <button
                onClick={() => removeFile(id)}
                aria-label={`Remove ${file.name}`}
                className="text-muted hover:text-error-accent shrink-0 transition-colors"
                type="button"
              >
                <XIcon className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default FileDropzone;
