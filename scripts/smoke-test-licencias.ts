import fs from 'node:fs';
import path from 'node:path';
import PizZip from 'pizzip';
import { createClient } from '@supabase/supabase-js';
import { buildUnionLicenseDocumentData } from '../src/features/representacion/services/license-document-dto';
import { getActiveUnionDocumentTemplate } from '../src/features/representacion/services/union-document-template-repository';
import { buildLicenseWordDocument } from '../src/features/representacion/services/license-word';
import { buildLicenseExcelDocument } from '../src/features/representacion/services/license-excel';
import type { Database } from '../src/lib/supabase/types';

async function smokeTest() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  const env = fs.readFileSync(envPath, 'utf8');
  const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)/)![1].trim();
  const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=([^\r\n]+)/)![1].trim();
  const supabase = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const caseId = '4e3bf5c3-b4f1-4e40-8fcb-f05353cd8bc6';
  console.log('=== INICIANDO SMOKE TEST DE PRODUCCIÓN ===');
  console.log('1. Construyendo DTO de caso real en producción:', caseId);
  const docData = await buildUnionLicenseDocumentData(supabase, caseId);
  console.log('   Folio:', docData.folio);
  console.log('   Trabajador:', docData.worker.fullName, `(${docData.worker.employeeNumber})`);
  console.log('   Licencia:', docData.license.payKindLabel, `· ${docData.license.totalDays} días`);
  console.log('   Motivo:', docData.license.reason);

  console.log('\n2. Descargando plantilla Word desde Supabase Storage (union-private)...');
  const wordTemplate = await getActiveUnionDocumentTemplate({
    delegationId: docData.delegationId,
    templateKind: 'license_word',
    supabase,
  });
  console.log(`   ✓ Plantilla Word v${wordTemplate.record.version} (SHA-256: ${wordTemplate.sha256})`);

  console.log('\n3. Generando documento Word a partir de la plantilla...');
  const wordBuf = buildLicenseWordDocument(docData, wordTemplate.buffer);
  console.log(`   ✓ Word generado con éxito. Tamaño: ${wordBuf.length} bytes`);

  // Validaciones Word
  const wordZip = new PizZip(wordBuf);
  const wordXml = wordZip.file('word/document.xml')?.asText() ?? '';
  const hasLogo = wordZip.file('word/media/image1.png') !== null;
  const hasFooter = wordZip.file('word/footer1.xml') !== null;
  const hasWorkerName = wordXml.includes(docData.worker.fullName);
  const hasMatricula = wordXml.includes(docData.worker.employeeNumber);
  const hasDelegacionXXI = wordXml.includes('COMITÉ DELEGACIONAL XXI');
  const hasDelegacionXIV = wordXml.includes('Delegación XIV') || wordXml.includes('Delegacion XIV');

  console.log('   - Logo SNTSS presente:', hasLogo);
  console.log('   - Footer presente:', hasFooter);
  console.log(`   - Nombre del trabajador presente (${docData.worker.fullName}):`, hasWorkerName);
  console.log(`   - Matrícula presente (${docData.worker.employeeNumber}):`, hasMatricula);
  console.log('   - Comité Delegacional XXI presente:', hasDelegacionXXI);
  console.log('   - Delegación XIV erradicado:', !hasDelegacionXIV);

  if (!hasLogo || !hasWorkerName || !hasMatricula || !hasDelegacionXXI || hasDelegacionXIV) {
    throw new Error('FALLO EN VALIDACIÓN WORD');
  }

  console.log('\n4. Descargando plantilla Excel desde Supabase Storage (union-private)...');
  const excelTemplate = await getActiveUnionDocumentTemplate({
    delegationId: docData.delegationId,
    templateKind: 'license_excel',
    supabase,
  });
  console.log(`   ✓ Plantilla Excel v${excelTemplate.record.version} (SHA-256: ${excelTemplate.sha256})`);

  console.log('\n5. Generando documento Excel (.xlsm) a partir de la plantilla...');
  const excelBuf = await buildLicenseExcelDocument(docData, excelTemplate.buffer);
  console.log(`   ✓ Excel generado con éxito. Tamaño: ${excelBuf.length} bytes`);

  // Validaciones Excel
  const excelZip = new PizZip(excelBuf);
  const vba = excelZip.file('xl/vbaProject.bin');
  const s1Xml = excelZip.file('xl/worksheets/sheet1.xml')?.asText() ?? '';
  const s2Xml = excelZip.file('xl/worksheets/sheet2.xml')?.asText() ?? '';

  const hasVba = vba !== null && vba.asNodeBuffer().length === 30720;
  const hasFolioInS1 = s1Xml.includes(docData.folio);
  const hasMatriculaInS1 = s1Xml.includes(docData.worker.employeeNumber);
  const hasWithPayInS2 = s2Xml.includes('r="G8"');

  console.log(`   - Binario VBA (macros) preservado: ${hasVba} (tamaño: ${vba ? vba.asNodeBuffer().length : 0} bytes)`);
  console.log('   - Folio en Sheet 1 (Generador):', hasFolioInS1);
  console.log('   - Matrícula en Sheet 1 (Generador):', hasMatriculaInS1);
  console.log('   - Celda G8 en Sheet 2 (Licencia):', hasWithPayInS2);

  if (!hasVba || !hasFolioInS1 || !hasMatriculaInS1) {
    throw new Error('FALLO EN VALIDACIÓN EXCEL');
  }

  console.log('\n=== SMOKE TEST DE PRODUCCIÓN FINALIZADO EXITOSAMENTE AL 100% ===');
}

smokeTest().catch((err) => {
  console.error('ERROR EN SMOKE TEST:', err);
  process.exit(1);
});
