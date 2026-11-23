import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface TarjetonCredentials {
  matricula: string;
  delegacion: string;
  password: string;
  curp?: string;
}

export interface TuPerfilCredentials {
  matricula: string;
  password: string;
  ooad?: string;
}

export interface VaultPayload {
  tarjeton?: TarjetonCredentials;
  tuperfil?: TuPerfilCredentials;
  preferences?: Record<string, unknown>;
}

interface StoredVaultFile {
  version: number;
  salt: string; // hex
  verifier: string; // hex (hash para verificar PIN rápidamente)
  iv: string; // hex
  authTag: string; // hex
  ciphertext: string; // hex
}

export class SecurityVault {
  private vaultFilePath: string;
  private locked: boolean = true;
  private decryptedPayload: VaultPayload | null = null;
  private currentPin: string | null = null;

  constructor(securityDir: string) {
    this.vaultFilePath = path.join(securityDir, 'boveda.dat');
  }

  /** Indica si el usuario ya configuró un PIN inicial */
  public isConfigured(): boolean {
    return fs.existsSync(this.vaultFilePath);
  }

  /** Indica si la bóveda se encuentra bloqueada */
  public isLocked(): boolean {
    return this.locked;
  }

  /**
   * Configura por primera vez el PIN maestro y crea la bóveda cifrada.
   */
  public setupPin(pin: string): boolean {
    if (!pin || pin.length < 4) {
      throw new Error('El PIN debe tener al menos 4 caracteres.');
    }

    const salt = crypto.randomBytes(16);
    const key = crypto.pbkdf2Sync(pin, salt, 100000, 32, 'sha256');
    const verifier = crypto.createHash('sha256').update(key).digest('hex');

    const emptyPayload: VaultPayload = {
      preferences: {
        createdAt: new Date().toISOString(),
      },
    };

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let ciphertext = cipher.update(JSON.stringify(emptyPayload), 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    const storedFile: StoredVaultFile = {
      version: 1,
      salt: salt.toString('hex'),
      verifier,
      iv: iv.toString('hex'),
      authTag,
      ciphertext,
    };

    const dir = path.dirname(this.vaultFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.vaultFilePath, JSON.stringify(storedFile, null, 2), 'utf8');

    this.locked = false;
    this.currentPin = pin;
    this.decryptedPayload = emptyPayload;
    return true;
  }

  /**
   * Desbloquea la bóveda con el PIN ingresado por el usuario.
   */
  public unlock(pin: string): boolean {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      const raw = fs.readFileSync(this.vaultFilePath, 'utf8');
      const stored: StoredVaultFile = JSON.parse(raw);

      const salt = Buffer.from(stored.salt, 'hex');
      const key = crypto.pbkdf2Sync(pin, salt, 100000, 32, 'sha256');
      const calculatedVerifier = crypto.createHash('sha256').update(key).digest('hex');

      if (calculatedVerifier !== stored.verifier) {
        return false;
      }

      // Descifrar payload
      const iv = Buffer.from(stored.iv, 'hex');
      const authTag = Buffer.from(stored.authTag, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(stored.ciphertext, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      this.decryptedPayload = JSON.parse(decrypted);
      this.currentPin = pin;
      this.locked = false;
      return true;
    } catch (err) {
      console.error('Error al desbloquear bóveda:', err);
      return false;
    }
  }

  /**
   * Bloquea la bóveda y borra de memoria los datos descifrados.
   */
  public lock(): void {
    this.locked = true;
    this.decryptedPayload = null;
    this.currentPin = null;
  }

  /**
   * Cambia el PIN maestro actual por uno nuevo.
   */
  public changePin(oldPin: string, newPin: string): boolean {
    if (this.locked) {
      const ok = this.unlock(oldPin);
      if (!ok) return false;
    }

    if (!newPin || newPin.length < 4) {
      throw new Error('El nuevo PIN debe tener al menos 4 caracteres.');
    }

    const payload = this.decryptedPayload || {};
    this.currentPin = newPin;

    const salt = crypto.randomBytes(16);
    const key = crypto.pbkdf2Sync(newPin, salt, 100000, 32, 'sha256');
    const verifier = crypto.createHash('sha256').update(key).digest('hex');

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let ciphertext = cipher.update(JSON.stringify(payload), 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    const storedFile: StoredVaultFile = {
      version: 1,
      salt: salt.toString('hex'),
      verifier,
      iv: iv.toString('hex'),
      authTag,
      ciphertext,
    };

    const dir = path.dirname(this.vaultFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.vaultFilePath, JSON.stringify(storedFile, null, 2), 'utf8');
    return true;
  }

  /**
   * Guarda o actualiza credenciales para un portal (tarjeton o tuperfil)
   */
  public saveCredentials(portal: 'tarjeton' | 'tuperfil', credentials: TarjetonCredentials | TuPerfilCredentials): boolean {
    if (this.locked || !this.currentPin || !this.decryptedPayload) {
      throw new Error('La bóveda debe estar desbloqueada para guardar credenciales.');
    }

    if (portal === 'tarjeton') {
      this.decryptedPayload.tarjeton = credentials as TarjetonCredentials;
    } else {
      this.decryptedPayload.tuperfil = credentials as TuPerfilCredentials;
    }

    this.persistCurrentPayload();
    return true;
  }

  /**
   * Obtiene las credenciales descifradas del portal solicitado.
   */
  public getCredentials<T extends TarjetonCredentials | TuPerfilCredentials>(portal: 'tarjeton' | 'tuperfil'): T | null {
    if (this.locked || !this.decryptedPayload) {
      return null;
    }
    return (this.decryptedPayload[portal] as T) || null;
  }

  /**
   * Verifica si existen credenciales guardadas para un portal sin exponerlas.
   */
  public hasCredentials(portal: 'tarjeton' | 'tuperfil'): boolean {
    if (this.locked || !this.decryptedPayload) {
      return false;
    }
    return Boolean(this.decryptedPayload[portal]);
  }

  /**
   * Elimina credenciales de un portal específico.
   */
  public removeCredentials(portal: 'tarjeton' | 'tuperfil'): boolean {
    if (this.locked || !this.currentPin || !this.decryptedPayload) {
      throw new Error('La bóveda debe estar desbloqueada para eliminar credenciales.');
    }

    if (portal === 'tarjeton') {
      delete this.decryptedPayload.tarjeton;
    } else {
      delete this.decryptedPayload.tuperfil;
    }

    this.persistCurrentPayload();
    return true;
  }

  private persistCurrentPayload(): void {
    if (!this.currentPin || !this.decryptedPayload) return;

    const raw = fs.readFileSync(this.vaultFilePath, 'utf8');
    const stored: StoredVaultFile = JSON.parse(raw);

    const salt = Buffer.from(stored.salt, 'hex');
    const key = crypto.pbkdf2Sync(this.currentPin, salt, 100000, 32, 'sha256');

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let ciphertext = cipher.update(JSON.stringify(this.decryptedPayload), 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    stored.iv = iv.toString('hex');
    stored.authTag = authTag;
    stored.ciphertext = ciphertext;

    fs.writeFileSync(this.vaultFilePath, JSON.stringify(stored, null, 2), 'utf8');
  }
}
