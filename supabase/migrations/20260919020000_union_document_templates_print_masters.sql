-- ============================================================
-- Migración: union_document_templates_print_masters
-- Módulo: Representación Sindical
-- Propósito: Ampliar template_kind para permitir plantillas PDF de
--            impresión conjunta (license_word_print, license_excel_print).
-- ============================================================

alter table public.union_document_templates
  drop constraint if exists union_document_templates_kind_check;

alter table public.union_document_templates
  add constraint union_document_templates_kind_check check (
    template_kind in (
      'license_word',
      'license_excel',
      'license_word_print',
      'license_excel_print',
      'passage_026',
      'passage_027'
    )
  );
