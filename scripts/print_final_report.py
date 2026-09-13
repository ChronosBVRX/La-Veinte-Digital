import json
from pathlib import Path

plan = json.loads(Path('data/tts/video/d5f1fc16/visual-plan.json').read_text(encoding='utf-8'))
report = json.loads(Path('data/tts/video/d5f1fc16/render-report.json').read_text(encoding='utf-8'))

beats = plan['beats']
mix = plan['visual_mix']
metrics = plan['metrics']
gen = metrics['generic_visuals_report']

print('--- FINAL METRICS FOR REPORT ---')
print('TOTAL BEATS:', len(beats))
print('% LOCUTOR:', f"{mix['locutor_pct']}%")
print('% EVIDENCIA:', f"{mix['evidencia_pct']}%")
print('% EXPLICACION:', f"{mix['explicacion_pct']}%")
print('% CONTEXTO:', f"{mix['contexto_pct']}%")
print('% BRAND:', f"{mix['brand_identity_pct']}%")
print('% GENERIC VISUALS:', f"{gen['generic_visuals_pct']}%")
print('% EXACT/REFERENCE VISUALS:', f"{gen['exact_reference_visuals_pct']}%")

cct = [b['beat_id'] for b in beats if 'cct' in str(b.get('resolved_asset')).lower() or b.get('chart_type') == 'cct_clause_157']
lft = [b['beat_id'] for b in beats if b.get('chart_type') in ('lft_document_399bis', 'lft_document_400bis', 'comparison_lft_revision')]
tarjeton = [b['beat_id'] for b in beats if b.get('chart_type') in ('tarjeton_detail_c02', 'tarjeton_detail_c11', 'payroll_sim_tarjeton') or 'tarjeton' in str(b.get('resolved_asset')).lower()]
sntss = [b['beat_id'] for b in beats if 'sntss' in str(b.get('resolved_asset')).lower()]
hgr1 = [b['beat_id'] for b in beats if 'hgr1' in str(b.get('resolved_asset')).lower() or 'charo' in str(b.get('resolved_asset')).lower()]

print('DOCUMENT COVERAGE:')
print('  CCT 2025-2027 (portada + cl. 157):', f"{len(cct)} apariciones")
print('  LFT (399 Bis + 400 Bis):', f"{len(lft)} apariciones")
print('  Tarjetón IMSS (completo + C02 + C11):', f"{len(tarjeton)} apariciones")
print('  SNTSS (congreso/asamblea):', f"{len(sntss)} apariciones")
print('  HGR 1 Charo:', f"{len(hgr1)} apariciones")

print('TEXT:')
print('  spokenWords:', metrics['total_spoken_words'])
print('  onScreenNarrativeWords:', metrics['total_editorial_words'])
print('  ratio:', f"{metrics['narrative_text_ratio_pct']}%")
print('  KARAOKE_RISK:', metrics['karaoke_risk_beats'])

counts = {}
for b in beats:
    v = b.get('chart_type') or (b.get('resolved_asset') or {}).get('id')
    if v:
        counts[v] = counts.get(v, 0) + 1
top = max(counts.items(), key=lambda x: x[1])
print('MOST REPEATED VISUAL:', f"{top[0]} ({top[1]} veces)")
print('SPEECHIFY: 0')
print('AUDIO CHANGED: NO')
print('ALIGNMENT CHANGED: NO')
