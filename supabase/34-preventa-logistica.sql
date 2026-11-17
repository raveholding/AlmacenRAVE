-- =====================================================================
-- 34-preventa-logistica.sql · V27.16 · Sistema Vincular Business
-- Preventa y logística en la calle (Sprints 1 a 5):
--  1) Colecciones nuevas en sincronizar():
--       cambio (cambios y averías) · evid (fichas de fotos y firmas, sólo alta) · clog (auditoría de campo, sólo alta)
--       devt (devoluciones en tránsito) · aviso (avisos al preventista)
--  2) Permisos de escritura por rol (rave_puede_escribir).
--  3) Bucket privado «evidencias» en Storage: cada comercio sube y ve sólo lo suyo; nadie puede reemplazar ni borrar una foto.
--  4) auditoria_campo: copia inmutable de cada evento de campo (check-in, pedido, cambio, rechazo, entrega, cobro).
--  5) vb_version() = 34: el sistema la consulta antes de subir estas colecciones y las fotos.
-- Aditivo e idempotente: no borra ni cambia datos. Requiere 01 a 33.
-- =====================================================================

-- ---------- 1) sincronización: colecciones nuevas ----------
do $mig$
declare
  d text;
  ot constant text := $o$'acop','plog','lblq','hold','vale','deal'];$o$;
  nt constant text := $n$'acop','plog','lblq','hold','vale','deal','cambio','evid','clog','devt','aviso'];$n$;
  ou constant text := $o$'finiva','visit','gps','plog'];$o$;
  nu constant text := $n$'finiva','visit','gps','plog','evid','clog'];$n$;
begin
  select pg_get_functiondef('public.sincronizar(uuid,text,jsonb)'::regprocedure) into d;
  if position('''clog''' in d) = 0 then
    if position(ot in d) = 0 or position(ou in d) = 0 then raise exception '34: no encontré las listas de sincronizar (¿falta correr 30 a 33?)'; end if;
    d := replace(d, ot, nt);
    d := replace(d, ou, nu);
    execute d;
  end if;
end
$mig$;

-- ---------- 2) permisos de escritura por rol ----------
do $mig$
declare
  d text;
  os constant text := $o$'lblq','hold','vale','deal')$o$;
  ns constant text := $n$'lblq','hold','vale','deal','cambio','evid','clog','devt','aviso')$n$;
  om constant text := $o$'acop','plog','lblq','hold','deal')$o$;
  nm constant text := $n$'acop','plog','lblq','hold','deal','cambio','evid','clog','devt','aviso')$n$;
  orp constant text := $o$('envio','ruta','audit','fich','gps')$o$;
  nrp constant text := $n$('envio','ruta','audit','fich','gps','evid','clog','devt')$n$;
  opv constant text := $o$('pedv','visit','cobrr','gps','audit','fich')$o$;
  npv constant text := $n$('pedv','visit','cobrr','gps','audit','fich','cambio','evid','clog','aviso')$n$;
  odp constant text := $o$'plog','lblq','audit','fich')$o$;
  ndp constant text := $n$'plog','lblq','audit','fich','devt','evid','clog')$n$;
begin
  select pg_get_functiondef('public.rave_puede_escribir(text,text,text)'::regprocedure) into d;
  if position('''clog''' in d) = 0 then
    if position(os in d) = 0 or position(om in d) = 0 or position(orp in d) = 0 or position(opv in d) = 0 or position(odp in d) = 0 then
      raise exception '34: no encontré las listas de rave_puede_escribir (¿falta correr 30?)';
    end if;
    d := replace(d, os, ns);
    d := replace(d, om, nm);
    d := replace(d, orp, nrp);
    d := replace(d, opv, npv);
    d := replace(d, odp, ndp);
    execute d;
  end if;
end
$mig$;

-- ---------- 3) Storage: bucket privado «evidencias» (ruta: <comercio>/<AAAA-MM>/<id>.<ext>) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidencias', 'evidencias', false, 614400, array['image/webp','image/jpeg','image/png'])
on conflict (id) do update set public = false, file_size_limit = 614400, allowed_mime_types = array['image/webp','image/jpeg','image/png'];

drop policy if exists "evidencias: subir a mi comercio" on storage.objects;
create policy "evidencias: subir a mi comercio" on storage.objects for insert to authenticated
  with check (bucket_id = 'evidencias' and (storage.foldername(name))[1] in (select c::text from public.mis_comercios() c));
drop policy if exists "evidencias: ver las de mi comercio" on storage.objects;
create policy "evidencias: ver las de mi comercio" on storage.objects for select to authenticated
  using (bucket_id = 'evidencias' and (storage.foldername(name))[1] in (select c::text from public.mis_comercios() c));
-- sin políticas de update ni delete: una evidencia subida no se reemplaza ni se borra

-- ---------- 4) auditoría de campo inmutable ----------
create table if not exists public.auditoria_campo (
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  id          text not null,
  datos       jsonb not null,
  usuario_id  uuid,
  recibido    timestamptz not null default clock_timestamp(),
  primary key (comercio_id, id)
);
alter table public.auditoria_campo enable row level security;
drop policy if exists "leer auditoria de campo de mi comercio" on public.auditoria_campo;
create policy "leer auditoria de campo de mi comercio" on public.auditoria_campo for select to authenticated
  using (comercio_id in (select public.mis_comercios()));
revoke all on public.auditoria_campo from anon;
revoke insert, update, delete, truncate on public.auditoria_campo from authenticated;

create or replace function public.auditoria_campo_copiar()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.coleccion = 'clog' and not new.borrado then
    insert into public.auditoria_campo (comercio_id, id, datos, usuario_id)
    values (new.comercio_id, new.id, new.datos, new.usuario_id)
    on conflict (comercio_id, id) do nothing;   -- la primera versión queda para siempre
  end if;
  return new;
end $$;
revoke all on function public.auditoria_campo_copiar() from public, anon, authenticated;
drop trigger if exists auditoria_campo_copiar on public.registros;
create trigger auditoria_campo_copiar after insert or update on public.registros
  for each row when (new.coleccion = 'clog') execute function public.auditoria_campo_copiar();

-- ---------- 5) versión del esquema ----------
create or replace function public.vb_version()
returns int language sql stable set search_path = public as $$ select 34 $$;
revoke all on function public.vb_version() from public, anon;
grant execute on function public.vb_version() to authenticated;
