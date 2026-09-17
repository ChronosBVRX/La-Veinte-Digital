"use client";

import { useState, useRef, type DragEvent, type ChangeEvent } from "react";
import { Button } from "@/shared/components/ui/Button";

interface ImportDropzoneProps {
  onFileSelected: (file: File) => void;
  isLoading: boolean;
}

export function ImportDropzone({ onFileSelected, isLoading }: ImportDropzoneProps): React.JSX.Element {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null): void {
    if (!files || files.length === 0) return;
    const file = files[0];
    setValidationError(null);

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setValidationError("El archivo debe estar en formato Excel estándar (.xlsx). No se admiten archivos .xlsm ni .xls.");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setValidationError(`El archivo es demasiado grande (${(file.size / (1024 * 1024)).toFixed(2)} MB). El límite máximo es de 15 MB.`);
      return;
    }

    setSelectedFile(file);
  }

  function onDragOver(e: DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    setDragOver(true);
  }

  function onDragLeave(e: DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    setDragOver(false);
  }

  function onDrop(e: DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>): void {
    handleFiles(e.target.files);
  }

  function handleSubmit(): void {
    if (selectedFile) {
      onFileSelected(selectedFile);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? "var(--primary)" : "var(--border)"}`,
          borderRadius: "0.5rem",
          padding: "2.5rem 1.5rem",
          textAlign: "center",
          cursor: "pointer",
          backgroundColor: dragOver ? "var(--accent)" : "var(--card)",
          transition: "all 0.2s ease",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          style={{ display: "none" }}
          onChange={onInputChange}
          disabled={isLoading}
        />
        <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📊</div>
        <p style={{ margin: "0 0 0.25rem", fontWeight: 600, fontSize: "0.9375rem" }}>
          {selectedFile ? selectedFile.name : "Arrastra tu archivo de plantilla Excel aquí o haz clic para examinar"}
        </p>
        <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>
          {selectedFile
            ? `Tamaño: ${(selectedFile.size / 1024).toFixed(1)} KB · Formato .xlsx válido`
            : "Formato Excel (.xlsx) · Máximo 15 MB · Las macros (.xlsm) están bloqueadas"}
        </p>
      </div>

      {validationError ? (
        <p role="alert" style={{ color: "var(--error, #dc2626)", fontSize: "0.8125rem", margin: 0 }}>
          {validationError}
        </p>
      ) : null}

      {selectedFile ? (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedFile(null);
              setValidationError(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            disabled={isLoading}
          >
            Quitar archivo
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            loading={isLoading}
          >
            Analizar y previsualizar cambios
          </Button>
        </div>
      ) : null}
    </div>
  );
}
