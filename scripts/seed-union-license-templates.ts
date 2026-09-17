import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/lib/supabase/types';

// Leer .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('.env.local no existe');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)/);
const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=([^\r\n]+)/);

if (!urlMatch || !keyMatch) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}

const supabaseUrl = urlMatch[1].trim();
const supabaseServiceKey = keyMatch[1].trim();

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const DELEGATION_XXI_ID = '25c737ef-7475-4515-a4b5-347a5dcf7c15';
const BUCKET = 'union-private';

interface TemplateSeedConfig {
  kind: 'license_word' | 'license_excel' | 'license_word_print' | 'license_excel_print';
  version: string;
  localPath: string;
  storagePath: string;
  mimeType: string;
  expectedMinSize: number;
}

const TEMPLATES: TemplateSeedConfig[] = [
  {
    kind: 'license_word',
    version: '2026.09.17-v1',
    localPath: 'assets/templates/union/licencias/oficio-licencia-delegacion-xxi.docx',
    storagePath: 'templates/licencias/oficio/2026.09.17-v1/oficio-licencia-delegacion-xxi.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    expectedMinSize: 50000,
  },
  {
    kind: 'license_word_print',
    version: '2026.09.17-v1',
    localPath: 'assets/templates/union/licencias/oficio-licencia-delegacion-xxi.pdf',
    storagePath: 'templates/licencias/oficio/2026.09.17-v1/print-master.pdf',
    mimeType: 'application/pdf',
    expectedMinSize: 100000,
  },
  {
    kind: 'license_excel',
    version: '2026.09.17-v2',
    localPath: 'assets/templates/union/licencias/formato-licencia-1A74-009-036-v2.xlsm',
    storagePath: 'templates/licencias/formato-1A74-009-036/2026.09.17-v2/formato-licencia-1A74-009-036.xlsm',
    mimeType: 'application/vnd.ms-excel.sheet.macroEnabled.12',
    expectedMinSize: 30000,
  },
  {
    kind: 'license_excel_print',
    version: '2026.09.17-v2',
    localPath: 'assets/templates/union/licencias/formato-licencia-1A74-009-036-v2.pdf',
    storagePath: 'templates/licencias/formato-1A74-009-036/2026.09.17-v2/print-master.pdf',
    mimeType: 'application/pdf',
    expectedMinSize: 100000,
  }
];

async function seedTemplates() {
  console.log('--- Sembrando plantillas documentales para Delegación XXI ---');
  console.log(`Delegación ID: ${DELEGATION_XXI_ID}`);
  console.log(`Bucket: ${BUCKET}\n`);

  for (const config of TEMPLATES) {
    const absPath = path.resolve(process.cwd(), config.localPath);
    if (!fs.existsSync(absPath)) {
      throw new Error(`Archivo local no encontrado: ${absPath}`);
    }

    const fileBuffer = fs.readFileSync(absPath);
    const fileSize = fileBuffer.length;
    const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    console.log(`[${config.kind}] (v${config.version})`);
    console.log(`  Archivo local: ${config.localPath}`);
    console.log(`  Tamaño: ${fileSize} bytes`);
    console.log(`  SHA-256: ${sha256}`);

    if (fileSize < config.expectedMinSize) {
      throw new Error(`El archivo ${config.localPath} es anormalmente pequeño (${fileSize} bytes)`);
    }

    // 1. Subir a Supabase Storage privado
    console.log(`  Subiendo a storage: ${config.storagePath}...`);
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(config.storagePath, fileBuffer, {
        contentType: config.mimeType,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Error al subir a storage: ${uploadError.message}`);
    }
    console.log(`  ✓ Subido correctamente a storage.`);

    // 2. Desactivar plantillas previas activas para este tipo y delegación
    const { error: deactivateError } = await supabase
      .from('union_document_templates')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('delegation_id', DELEGATION_XXI_ID)
      .eq('template_kind', config.kind)
      .eq('is_active', true);

    if (deactivateError) {
      throw new Error(`Error al desactivar plantillas previas: ${deactivateError.message}`);
    }

    // 3. Upsert registro de metadatos en union_document_templates
    console.log(`  Registrando metadatos en union_document_templates...`);
    const { data: record, error: dbError } = await supabase
      .from('union_document_templates')
      .upsert(
        {
          delegation_id: DELEGATION_XXI_ID,
          template_kind: config.kind,
          version: config.version,
          storage_bucket: BUCKET,
          storage_path: config.storagePath,
          mime_type: config.mimeType,
          sha256: sha256,
          file_size: fileSize,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'delegation_id,template_kind,version' }
      )
      .select()
      .single();

    if (dbError) {
      throw new Error(`Error al registrar en BD: ${dbError.message}`);
    }

    console.log(`  ✓ Registrado ID: ${record.id} (activo: ${record.is_active})`);

    // 4. Verificación roundtrip de descarga e integridad hash
    console.log(`  Verificando roundtrip de descarga y hash...`);
    const { data: downloadedBlob, error: downloadError } = await supabase.storage
      .from(BUCKET)
      .download(config.storagePath);

    if (downloadError || !downloadedBlob) {
      throw new Error(`Error al descargar de vuelta: ${downloadError?.message}`);
    }

    const downloadedArrayBuffer = await downloadedBlob.arrayBuffer();
    const downloadedBuffer = Buffer.from(downloadedArrayBuffer);
    const downloadedSha256 = crypto.createHash('sha256').update(downloadedBuffer).digest('hex');

    if (downloadedSha256 !== sha256) {
      throw new Error(`MISMATCH DE INTEGRIDAD: local ${sha256} vs descargado ${downloadedSha256}`);
    }
    console.log(`  ✓ Integridad verificada al 100%: SHA-256 coincide.\n`);
  }

  console.log('--- Siembra de plantillas finalizada con ÉXITO ---');
}

seedTemplates().catch((err) => {
  console.error('ERROR EN SIEMBRA:', err);
  process.exit(1);
});
