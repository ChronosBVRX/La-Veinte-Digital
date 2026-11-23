import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { shell } from 'electron';
import { PortablePaths } from './paths';

export interface SavedDocumentRecord {
  id: string;
  name: string;
  localPath: string;
  source: 'TARJETON' | 'ESCRITO' | 'DOCUMENT_SCAN' | 'INE_SCAN' | 'NORMATIVA' | 'BIOMETRICO';
  fileSize: number;
  downloadedAt: number;
  mimeType: string;
  escritoId?: string;
}

interface DocumentIndex {
  documents: Record<string, SavedDocumentRecord>;
}

export class DocumentManager {
  private paths: PortablePaths;
  private indexPath: string;
  private index: DocumentIndex = { documents: {} };

  constructor(paths: PortablePaths) {
    this.paths = paths;
    this.indexPath = path.join(paths.documentsDir, 'indice.json');
    this.loadIndex();
    this.reconcileDisk();
  }

  private loadIndex(): void {
    if (fs.existsSync(this.indexPath)) {
      try {
        const raw = fs.readFileSync(this.indexPath, 'utf8');
        this.index = JSON.parse(raw);
      } catch (e) {
        console.warn('Error leyendo indice.json, regenerando...', e);
        this.index = { documents: {} };
      }
    }
  }

  private saveIndex(): void {
    try {
      fs.writeFileSync(this.indexPath, JSON.stringify(this.index, null, 2), 'utf8');
    } catch (e) {
      console.error('Error guardando indice.json:', e);
    }
  }

  /**
   * Sincroniza los archivos que físicamente están en la memoria USB con el índice
   */
  public reconcileDisk(): void {
    const subdirs: Array<{ dir: string; source: SavedDocumentRecord['source'] }> = [
      { dir: this.paths.tarjetonesDir, source: 'TARJETON' },
      { dir: this.paths.escritosDir, source: 'ESCRITO' },
      { dir: this.paths.biometricosDir, source: 'BIOMETRICO' },
    ];

    for (const { dir, source } of subdirs) {
      if (!fs.existsSync(dir)) continue;

      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (!stat.isFile()) continue;

        // Si ya está indexado con la misma ruta, verificar tamaño
        const existingKey = Object.keys(this.index.documents).find(
          (k) => this.index.documents[k].localPath === fullPath
        );

        if (!existingKey) {
          const id = crypto.createHash('md5').update(fullPath).digest('hex');
          const ext = path.extname(file).toLowerCase();
          const mimeType = ext === '.pdf' ? 'application/pdf' : 'application/octet-stream';

          this.index.documents[id] = {
            id,
            name: file,
            localPath: fullPath,
            source,
            fileSize: stat.size,
            downloadedAt: stat.mtimeMs,
            mimeType,
          };
        }
      }
    }

    // Limpiar entradas cuyos archivos ya no existan en disco
    for (const id of Object.keys(this.index.documents)) {
      const doc = this.index.documents[id];
      if (!fs.existsSync(doc.localPath)) {
        delete this.index.documents[id];
      }
    }

    this.saveIndex();
  }

  /**
   * Lista todos los documentos guardados (compatible con window.LaVeinteApp.listNativeDocuments)
   */
  public list(sourceFilter?: string): SavedDocumentRecord[] {
    this.reconcileDisk();
    const all = Object.values(this.index.documents);
    if (!sourceFilter) {
      return all.sort((a, b) => b.downloadedAt - a.downloadedAt);
    }
    return all
      .filter((d) => d.source.toLowerCase() === sourceFilter.toLowerCase())
      .sort((a, b) => b.downloadedAt - a.downloadedAt);
  }

  /**
   * Lee un documento en base64 (compatible con window.LaVeinteApp.readNativeDocument)
   */
  public read(localPath: string): { name: string; data: string; mimeType: string } | null {
    if (!fs.existsSync(localPath)) return null;

    try {
      const buffer = fs.readFileSync(localPath);
      const name = path.basename(localPath);
      const ext = path.extname(localPath).toLowerCase();
      const mimeType = ext === '.pdf' ? 'application/pdf' : 'application/octet-stream';

      return {
        name,
        data: buffer.toString('base64'),
        mimeType,
      };
    } catch (e) {
      console.error('Error leyendo documento local:', e);
      return null;
    }
  }

  /**
   * Guarda un documento en la memoria USB (compatible con window.LaVeinteApp.saveBlobToDownloads)
   */
  public save(
    base64Data: string,
    filename: string,
    source: SavedDocumentRecord['source'] = 'ESCRITO',
    mimeType: string = 'application/pdf',
    escritoId?: string
  ): SavedDocumentRecord {
    let targetDir = this.paths.escritosDir;
    if (source === 'TARJETON') targetDir = this.paths.tarjetonesDir;
    if (source === 'BIOMETRICO') targetDir = this.paths.biometricosDir;

    // Sanitizar nombre de archivo
    const safeName = filename.replace(/[^a-zA-Z0-9_\-. ]/g, '_');
    const finalPath = path.join(targetDir, safeName);

    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(finalPath, buffer);

    const id = crypto.createHash('md5').update(finalPath + Date.now()).digest('hex');
    const stat = fs.statSync(finalPath);

    const record: SavedDocumentRecord = {
      id,
      name: safeName,
      localPath: finalPath,
      source,
      fileSize: stat.size,
      downloadedAt: Date.now(),
      mimeType,
      escritoId,
    };

    this.index.documents[id] = record;
    this.saveIndex();

    return record;
  }

  /**
   * Elimina un documento por su ruta local
   */
  public delete(localPath: string): boolean {
    if (!fs.existsSync(localPath)) return false;

    try {
      fs.unlinkSync(localPath);
      for (const id of Object.keys(this.index.documents)) {
        if (this.index.documents[id].localPath === localPath) {
          delete this.index.documents[id];
        }
      }
      this.saveIndex();
      return true;
    } catch (e) {
      console.error('Error eliminando archivo:', e);
      return false;
    }
  }

  /**
   * Elimina un documento por su ID
   */
  public deleteById(id: string, expectedPath?: string): { ok: boolean; reason?: string } {
    const doc = this.index.documents[id];
    const targetPath = expectedPath || (doc ? doc.localPath : null);

    if (!targetPath || !fs.existsSync(targetPath)) {
      if (doc) {
        delete this.index.documents[id];
        this.saveIndex();
      }
      return { ok: true };
    }

    try {
      fs.unlinkSync(targetPath);
      delete this.index.documents[id];
      this.saveIndex();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, reason: err?.message || 'Error eliminando archivo' };
    }
  }

  /**
   * Abre el archivo en el visor nativo de Windows (Edge / Acrobat)
   */
  public async open(localPath: string): Promise<boolean> {
    if (!fs.existsSync(localPath)) return false;
    try {
      await shell.openPath(localPath);
      return true;
    } catch (e) {
      console.error('Error abriendo documento con visor de Windows:', e);
      return false;
    }
  }
}
