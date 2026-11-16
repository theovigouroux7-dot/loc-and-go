-- Loc and Go : tables de la base de données en ligne (Supabase).
-- À exécuter une seule fois dans Supabase : SQL Editor > New query > coller ce fichier > Run.

-- Chaque élément de l'application (module, contrat, ligne, demande, événement, paramètres)
-- est enregistré dans cette table, au format JSON.
create table if not exists public.records (
  id text primary key,
  kind text not null,
  data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists records_updated_at_idx on public.records (updated_at);

-- La date de mise à jour est fixée par la base, pour que tous les appareils se synchronisent sur la même horloge.
create or replace function public.records_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

drop trigger if exists records_touch on public.records;
create trigger records_touch
  before insert or update on public.records
  for each row execute function public.records_touch_updated_at();

-- Photos des modules (images réduites, au format texte).
create table if not exists public.photos (
  id text primary key,
  data text not null,
  created_at timestamptz not null default now()
);

-- Accès pour le prototype : toute personne qui a l'adresse de l'application peut lire et écrire.
-- À remplacer par des comptes utilisateurs avant d'y mettre de vraies données clients.
alter table public.records enable row level security;
alter table public.photos enable row level security;

drop policy if exists "prototype records" on public.records;
create policy "prototype records" on public.records for all to anon, authenticated using (true) with check (true);

drop policy if exists "prototype photos" on public.photos;
create policy "prototype photos" on public.photos for all to anon, authenticated using (true) with check (true);
