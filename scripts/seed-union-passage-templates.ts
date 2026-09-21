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
  kind: 'passage_026' | 'passage_027';
  version: string;
  localPath: string;
  storagePath: string;
  mimeType: string;
  expectedMinSize: number;
}

const TEMPLATES: TemplateSeedConfig[] = [
  {
    kind: 'passage_026',
    version: '2026.09-v1',
    localPath: 'assets/templates/union/pasajes/formato-concepto-026.pdf',
    storagePath: 'templates/pasajes/026/2026.09-v1/formato-concepto-026.pdf',
    mimeType: 'application/pdf',
    expectedMinSize: 100000,
  },
  {
    kind: 'passage_027',
    version: '2026.09-v1',
    localPath: 'assets/templates/union/pasajes/formato-concepto-027.pdf',
    storagePath: 'templates/pasajes/027/2026.09-v1/formato-concepto-027.pdf',
    mimeType: 'application/pdf',
    expectedMinSize: 100000,
  }
];

async function seedTemplates() {
  console.log('--- Sembrando plantillas oficiales de pasajes para Delegación XXI ---');
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
      throw new Error(`Error al descargar de storage: ${downloadError?.message ?? 'blob vacío'}`);
    }

    const downloadedArrayBuffer = await downloadedBlob.arrayBuffer();
    const downloadedBuffer = Buffer.from(downloadedArrayBuffer);
    const downloadedSha256 = crypto.createHash('sha256').update(downloadedBuffer).digest('hex');

    if (downloadedSha256 !== sha256) {
      throw new Error(`FALLO DE INTEGRIDAD: SHA-256 descargado (${downloadedSha256}) !== esperado (${sha256})`);
    }

    console.log(`  ✓ Integridad SHA-256 verificada roundtrip.\n`);
  }

  console.log('✓ Sembrado completado exitosamente.');
}

seedTemplates().catch((err) => {
  console.error('\n❌ ERROR DURANTE EL SEMBRADO:');
  console.error(err);
  process.exit(1);
});
