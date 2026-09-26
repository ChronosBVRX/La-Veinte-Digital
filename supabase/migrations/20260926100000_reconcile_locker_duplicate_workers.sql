
-- 1. Asegurar protección del respaldo preventivo
alter table if exists public.backup_union_workers_20260926 enable row level security;
revoke all on table public.backup_union_workers_20260926 from anon, authenticated;

-- 2. Tabla temporal de mapeo para los 72 duplicados confirmados
create temp table if not exists _locker_siap_worker_mapping (
  locker_worker_id uuid primary key,
  siap_worker_id uuid not null
) on commit drop;

truncate _locker_siap_worker_mapping;

insert into _locker_siap_worker_mapping (locker_worker_id, siap_worker_id)
values
    ('4916ac11-15be-4f32-9557-a0451bd2e843'::uuid, 'cdf5b717-7ca2-4798-ba71-9b560c948b0b'::uuid),
    ('0aa2e7a3-22f2-4a5c-abaa-767c57e9edac'::uuid, 'de122b9d-5743-42c9-a871-eacdc3116aca'::uuid),
    ('75f84ecf-8642-45a8-bbbe-fa78bee04bda'::uuid, '99b98ccc-3e10-40c6-a010-0d39451e1b58'::uuid),
    ('ddafdd8d-b84b-4769-967a-9431aacd0b36'::uuid, '2034767b-a586-45a8-b593-36a3505a8029'::uuid),
    ('ba811d18-cecc-4194-a926-5187935ee1aa'::uuid, '106dbc58-7e81-4662-8b2e-e595d169b4d5'::uuid),
    ('eacd4945-bb76-41a4-9916-77446e793390'::uuid, 'fecd4046-03d2-43ae-a4b9-a8e66d2b570e'::uuid),
    ('f89e31f5-1b8a-4198-bb12-d35cc637484c'::uuid, 'bc9020bb-12c0-49f2-8155-608b5a5c92d2'::uuid),
    ('9290b35b-613b-425c-8844-94f55df923e5'::uuid, '58346082-bb0d-4bda-8b57-d6e5e5117a96'::uuid),
    ('9dba7fa9-56c2-4ffe-958b-bf64352f6dee'::uuid, '0cc2868c-45b1-4ed0-b705-4ed1e76a3981'::uuid),
    ('67285d52-4ddf-490e-a71e-16091740bb08'::uuid, '2409bf47-f64e-4743-a1fe-c1195f19df86'::uuid),
    ('406dcd2f-fd31-4abb-b1fa-8c2e9f8411f7'::uuid, 'c067e286-e189-46cf-9c60-81ba555fc283'::uuid),
    ('9ece2521-6b5d-4c30-b6df-df84e5492098'::uuid, 'e8e90842-2489-4876-9cbe-7cf02fb1c68f'::uuid),
    ('403021ac-9f09-4823-8033-b2c46af641a7'::uuid, 'b310dbcc-1795-4282-9bab-972b85b8939c'::uuid),
    ('38fb2a23-8f24-4488-93ea-4faa4819fc97'::uuid, 'e903d5b3-21d3-4acb-9c47-b1ee3ea0410a'::uuid),
    ('edbbdccc-c36f-44b0-886b-da0d72e3ca07'::uuid, '839c2548-0483-4e05-95c6-89b758a73154'::uuid),
    ('2fcc3676-8627-46b0-9405-9e6234d958fb'::uuid, 'badf895f-6467-4b99-8a66-71f67eb2e064'::uuid),
    ('2ef77259-0555-41cf-844d-56d8d9fe9532'::uuid, '563948e4-9d7e-4a7e-9cf0-52c44b01225d'::uuid),
    ('1ad9f056-ebd6-4449-a3c8-71bfca47a541'::uuid, '6a3d51a3-c1e2-4ce4-854d-2daa1096798c'::uuid),
    ('0b2100ff-04b0-4271-8500-6801b020de59'::uuid, '02f02639-4844-4eeb-8597-f3ea7923a92b'::uuid),
    ('6c97b7cc-d104-438b-9caf-9130450b969c'::uuid, '8df23041-ae3b-470e-b8e9-80db4813f4a0'::uuid),
    ('afc93be7-9592-4ebf-a026-eed7d1190775'::uuid, '4d516bb0-d7f6-422a-8bae-f3f7af1d3ab4'::uuid),
    ('6213e340-e758-4b0b-bea3-e0ed60f37940'::uuid, '31217b99-97d1-4d49-a3c4-fc2f146d4375'::uuid),
    ('3045a58c-8f54-44b1-bf92-0281905fe36f'::uuid, 'd34137c5-0c0d-4d3e-bf88-913e86e8be86'::uuid),
    ('a0c91680-b282-42fc-abb8-59f6604ba311'::uuid, 'b129c8ef-b4ba-4724-b8b9-f89305067d8d'::uuid),
    ('81d3ffa1-0cd7-4cfd-a468-0cbf69aa4435'::uuid, '39cafb33-939b-4c8a-acd1-8450c5ae948d'::uuid),
    ('487c9977-4762-446b-ad79-2c4b43882cbe'::uuid, '924fc22f-f238-4ddc-ada5-1d9426e43014'::uuid),
    ('328c1d6d-1a67-4536-ba58-1d48831a6dce'::uuid, '9fadb40f-ccb7-4b07-8709-7281547accaa'::uuid),
    ('5dd1a1b5-0db2-4d4f-82d8-56cae18a1594'::uuid, '6a31660f-a0c0-438c-8d78-15a4a8821e44'::uuid),
    ('1678c5e5-21c0-4aaf-8a6d-49f12f946bd6'::uuid, 'd1e4a93d-306f-4f28-b19c-ac6375ebc25f'::uuid),
    ('b44f3825-7e2a-4554-a31c-3b0463ff1ed3'::uuid, '30d0c5ac-2b96-40f0-9cd0-489a33dba7f8'::uuid),
    ('827ad887-c6af-4a43-8283-42d3fa5dc37b'::uuid, '34489c32-10f7-4217-8542-9a1c9bdd4e11'::uuid),
    ('5c4dc94e-25be-4202-900e-f319c277a29d'::uuid, '4edbf16c-0b12-4564-8322-3d069126f523'::uuid),
    ('99998a64-6262-496c-821b-93f59f4a6998'::uuid, '8752f9f8-d33d-46f0-8554-d87690f3d96c'::uuid),
    ('fe0e2fee-73e0-442a-b79d-d49e6e7220c2'::uuid, '0ba3172c-d0a9-42ae-ac28-9578796a90ac'::uuid),
    ('8808a3f9-1be0-42db-9295-7fe2c7f703db'::uuid, 'f33ba910-e108-4a89-ba8a-b1ab126926d3'::uuid),
    ('7e1286d1-ca05-43b9-a45f-ef9d9f2012fb'::uuid, '34a991db-5bdc-4bd6-8e5f-6460c4c3ef90'::uuid),
    ('84249ed1-7f49-484d-b080-32c4416eb155'::uuid, '3d4b2cdc-d02f-4649-959f-5af57faf7de1'::uuid),
    ('c038117b-838f-4d11-b719-8acb085ca885'::uuid, '0da405ca-c9df-4be9-9f52-c2746d10cd9f'::uuid),
    ('35408004-bffe-4dac-84a7-901c86563efc'::uuid, '899c4881-8d70-4ebd-9e4d-faea2586037f'::uuid),
    ('d01e4f05-ff9b-4500-b14d-4b0e58c25876'::uuid, '5a9c7a47-83c8-495e-8e92-66df85e61a5f'::uuid),
    ('712cd3ee-bffe-454a-9778-73bde35dd7b5'::uuid, '07910e8f-de26-46b6-a7c1-270d74132c40'::uuid),
    ('08379730-8770-4cf4-b14b-b3e78f77af34'::uuid, 'f3867f1d-96b5-400c-ae32-03fa97a6585e'::uuid),
    ('4fcbb92e-9da5-4070-ad51-b033e0c059c2'::uuid, '5f41d972-f2d2-49cf-ac64-2c646f17f9ed'::uuid),
    ('f7c94032-80ab-400b-b868-33a8c4ca1ddb'::uuid, '499abaa7-96ea-4fb3-957e-b967182ac5da'::uuid),
    ('64603303-cc52-4034-a1cb-17d965380baf'::uuid, '78ec6229-006e-43c7-97cd-2e96275409db'::uuid),
    ('2316abc1-e9a9-43e6-b495-e4e904ef74d0'::uuid, 'd974f455-dbcd-4428-8725-7a6132a86ebe'::uuid),
    ('b757d352-4617-46de-9887-216b345d83a2'::uuid, 'ef25ba4b-9740-45a8-b1a6-91890362a5dc'::uuid),
    ('6a8c0f5d-5c35-4440-9f64-f395fb30018b'::uuid, '79ce1f04-a7c1-49e3-8e7f-55f14297f109'::uuid),
    ('291d9dd8-fea3-428b-bc92-42e2b2b93f8b'::uuid, '0bd595d8-da4e-47f4-8cc8-53eae8953fc2'::uuid),
    ('5f632c8b-adb6-4eed-aef0-f90209531be5'::uuid, 'eae04ddd-f048-4086-be89-83e65ab5eb42'::uuid),
    ('050f14e2-9f64-458c-b171-0d9551fbb9d2'::uuid, 'd89e4dd9-9902-4c77-b456-f9f387a59e1f'::uuid),
    ('56d90443-5094-418a-9e42-60da2e8de9f0'::uuid, '834365da-1984-40aa-b514-51aa9e013be2'::uuid),
    ('d9234a64-5e8d-46e9-872a-52c9fd600fc4'::uuid, '816c6db9-5635-4834-8bfd-cf1bd7c16bf1'::uuid),
    ('db363ead-50a1-4520-8bda-1e42ecbed2bd'::uuid, 'a2d06559-981e-47dc-a86e-0f50d31b1d82'::uuid),
    ('ade1dedf-194e-4d12-b96b-38f989b7d10a'::uuid, '573d78c2-8b6a-459e-9360-1988b06d302e'::uuid),
    ('6ca1354b-d8cd-4f11-b821-50cf96a9dcba'::uuid, 'f8986133-9a24-4ae2-a0aa-53ad000a1a4d'::uuid),
    ('56a13e76-28c1-4b64-b16f-17edaf43ea8f'::uuid, '8f07e857-0864-4401-bd67-707e14d67734'::uuid),
    ('86c76c86-01ea-43b0-84ed-5686b5f07501'::uuid, '4bda31fb-6a63-4740-863b-a7f50e047b71'::uuid),
    ('70e01ade-884e-4f29-8632-932ed391f8f6'::uuid, '4bda31fb-6a63-4740-863b-a7f50e047b71'::uuid),
    ('2778cc1a-0fa9-4fbe-a85f-fa9841530b5e'::uuid, 'b8475fe0-b4c2-4621-972d-295e8749e03c'::uuid),
    ('ea65c45a-c058-4f72-a9cb-7a7949c462ca'::uuid, '999c6020-6dfc-4fbd-ad81-52008df29786'::uuid),
    ('bf88fb58-80bb-47ac-b8ca-195b72e032fb'::uuid, '806de754-743e-4dcd-89ac-cc6d0dec2966'::uuid),
    ('678f2fd9-1fe1-4e7b-a7ca-76dfe9e59d09'::uuid, '8a133660-f717-4a5f-9c53-15cc4aab95db'::uuid),
    ('31508788-5a90-43b6-8596-e630c7f0dc8e'::uuid, '01038ad6-0e14-4ca7-ad8b-a44aaee91dce'::uuid),
    ('e1e807a1-376f-4a25-a0c5-4b9276e57849'::uuid, '140a17cd-eca2-4cd2-add8-47d324ec9fd2'::uuid),
    ('5331a4e3-6053-4b2a-ba93-2c482612245b'::uuid, 'ec347a9b-1ccd-43ea-a818-0431f7288b3b'::uuid),
    ('0c83b6fa-4a87-4b74-bc69-870f04b60f84'::uuid, 'ab438419-9500-419f-bf1b-da67dea94a47'::uuid),
    ('e02dda37-bd28-4161-912e-ee52f4e72405'::uuid, '66421664-4060-43c5-9139-dbc524bee798'::uuid),
    ('5efe08df-e5b1-43b6-b486-e63e19806fca'::uuid, '223b88ee-367e-42be-b50e-db0e9198ba1a'::uuid),
    ('133b75c6-d4b9-42c7-aa06-6c13f4d52cd3'::uuid, 'c4647441-5744-4987-a7e3-236826f4672e'::uuid),
    ('fab1a408-77b6-4aa3-b10c-d09ee7f638c1'::uuid, 'c419a955-44bb-45ce-8047-ecd173af62f7'::uuid),
    ('23340ab1-6e4d-4505-b9fc-3fa04beaa91d'::uuid, 'b7845233-b9fc-47ca-b6a7-0442bab0f03a'::uuid);

-- 3. Reasignar union_locker_assignments
-- Si el trabajador SIAP ya cuenta con una asignación activa, o si se reasignan múltiples casilleros,
-- se marca admin_override = true para respetar el índice condicional union_locker_one_active_per_worker.
update public.union_locker_assignments a
set
  worker_id = m.siap_worker_id,
  admin_override = case
    when a.status = 'active' then true
    else a.admin_override
  end,
  admin_override_reason = case
    when a.status = 'active' then coalesce(nullif(a.admin_override_reason, ''), 'Reconciliación padrón SIAP: Asignación consolidada desde inventario histórico')
    else a.admin_override_reason
  end
from _locker_siap_worker_mapping m
where a.worker_id = m.locker_worker_id;

-- 4. Reasignar union_locker_import_source_rows
update public.union_locker_import_source_rows r
set matched_worker_id = m.siap_worker_id
from _locker_siap_worker_mapping m
where r.matched_worker_id = m.locker_worker_id;

-- 5. Reasignar union_worker_import_rows
update public.union_worker_import_rows r
set target_worker_id = m.siap_worker_id
from _locker_siap_worker_mapping m
where r.target_worker_id = m.locker_worker_id;

-- 6. Reasignar otras tablas dependientes (por salvaguarda)
update public.union_cases c
set worker_id = m.siap_worker_id
from _locker_siap_worker_mapping m
where c.worker_id = m.locker_worker_id;

update public.union_lockers l
set reserved_for_worker_id = m.siap_worker_id
from _locker_siap_worker_mapping m
where l.reserved_for_worker_id = m.locker_worker_id;

update public.union_locker_waitlist w
set worker_id = m.siap_worker_id
from _locker_siap_worker_mapping m
where w.worker_id = m.locker_worker_id;

update public.union_locker_audit_items a
set observed_worker_id = m.siap_worker_id
from _locker_siap_worker_mapping m
where a.observed_worker_id = m.locker_worker_id;

update public.union_worker_change_history h
set worker_id = m.siap_worker_id
from _locker_siap_worker_mapping m
where h.worker_id = m.locker_worker_id;

-- 7. Validar que no quede NINGUNA referencia residual
do $$
declare
  v_remaining_refs integer;
begin
  select count(*) into v_remaining_refs
  from (
    select worker_id as w_id from public.union_locker_assignments where worker_id in (select locker_worker_id from _locker_siap_worker_mapping)
    union all
    select matched_worker_id as w_id from public.union_locker_import_source_rows where matched_worker_id in (select locker_worker_id from _locker_siap_worker_mapping)
    union all
    select target_worker_id as w_id from public.union_worker_import_rows where target_worker_id in (select locker_worker_id from _locker_siap_worker_mapping)
    union all
    select worker_id as w_id from public.union_cases where worker_id in (select locker_worker_id from _locker_siap_worker_mapping)
    union all
    select reserved_for_worker_id as w_id from public.union_lockers where reserved_for_worker_id in (select locker_worker_id from _locker_siap_worker_mapping)
    union all
    select worker_id as w_id from public.union_locker_waitlist where worker_id in (select locker_worker_id from _locker_siap_worker_mapping)
    union all
    select observed_worker_id as w_id from public.union_locker_audit_items where observed_worker_id in (select locker_worker_id from _locker_siap_worker_mapping)
    union all
    select worker_id as w_id from public.union_worker_change_history where worker_id in (select locker_worker_id from _locker_siap_worker_mapping)
  ) t;

  if v_remaining_refs > 0 then
    raise exception 'REMAINING_REFERENCES_DETECTED: Aún existen % referencias activas apuntando a los trabajadores sintéticos.', v_remaining_refs;
  end if;
end $$;

-- 8. Eliminar los 72 trabajadores sintéticos duplicados
delete from public.union_workers
where id in (select locker_worker_id from _locker_siap_worker_mapping);
  