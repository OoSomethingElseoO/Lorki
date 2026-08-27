"use client";

import { useCallback, useId, useRef, useState } from "react";

export type FileWithPreview = {
  id: string;
  file: File;
  preview: string | null;
};

type UseFileUploadOptions = {
  accept?: string;
  maxSize?: number;
  maxFiles: number;
  onUpload?: (file: File) => Promise<unknown> | void;
};

// Not part of the 21st.dev pull — that component imports this hook from a
// path (components/ui/file-dropzone-utils/use-file-upload) the retrieved
// registry payload didn't actually include a source file for, so this is a
// from-scratch implementation matching the exact interface FileDropzone.tsx
// expects (files/isDragging/errors + the drag/input handlers below).
function isAccepted(file: File, accept?: string) {
  if (!accept) return true;
  return accept
    .split(",")
    .map((pattern) => pattern.trim())
    .some((pattern) => {
      if (pattern === "*/*") return true;
      if (pattern.endsWith("/*")) return file.type.startsWith(pattern.slice(0, -1));
      if (pattern.startsWith(".")) return file.name.toLowerCase().endsWith(pattern.toLowerCase());
      return file.type === pattern;
    });
}

export function useFileUpload({ accept, maxSize, maxFiles, onUpload }: UseFileUploadOptions) {
  const inputId = useId();
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  // Drag-enter/leave fire for every child element the pointer crosses, not
  // just the drop zone's own boundary — a counter (not a boolean) is the
  // standard fix, otherwise dragging over a child briefly reads as "left".
  const dragDepth = useRef(0);

  const addFiles = useCallback(
    (list: FileList | File[]) => {
      const incoming = Array.from(list);
      const nextErrors: string[] = [];
      const accepted: FileWithPreview[] = [];

      for (const file of incoming) {
        if (!isAccepted(file, accept)) {
          nextErrors.push(`${file.name} isn't an accepted file type.`);
          continue;
        }
        if (maxSize && file.size > maxSize) {
          nextErrors.push(`${file.name} is larger than ${(maxSize / 1024 / 1024).toFixed(0)}MB.`);
          continue;
        }
        accepted.push({
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
        });
      }

      setErrors(nextErrors);
      setFiles((prev) => {
        if (maxFiles === 1) {
          prev.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
          return accepted.slice(0, 1);
        }
        return [...prev, ...accepted].slice(0, maxFiles);
      });

      for (const item of accepted) {
        onUpload?.(item.file);
      }
    },
    [accept, maxFiles, maxSize, onUpload],
  );

  const handleDragEnter = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      dragDepth.current = 0;
      setIsDragging(false);
      if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files);
    },
    [addFiles],
  );

  const openFileDialog = useCallback(() => {
    document.getElementById(inputId)?.click();
  }, [inputId]);

  const removeFile = useCallback((id?: string) => {
    setFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const getInputProps = useCallback(
    () => ({
      id: inputId,
      type: "file" as const,
      accept,
      multiple: maxFiles > 1,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files?.length) addFiles(event.target.files);
        event.target.value = "";
      },
    }),
    [accept, inputId, maxFiles, addFiles],
  );

  return {
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
  };
}
