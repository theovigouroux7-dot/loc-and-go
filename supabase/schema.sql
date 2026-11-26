-- Loc and Go : tables de la base de données en ligne (Supabase).
-- À exécuter dans Supabase : SQL Editor > New query > coller ce fichier > Run. Il peut être relancé sans risque.

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

-- Photos et documents (images réduites ou PDF, au format texte).
create table if not exists public.photos (
  id text primary key,
  data text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------
-- Espaces (un par loueur) : chaque espace ne voit que ses propres données.
-- Ce script peut être relancé sans risque : il ne supprime aucune donnée.
-- ---------------------------------------------------------------------------------------

create table if not exists public.espaces (
  slug text primary key,
  nom text not null default '',
  code text not null,
  plan text not null default 'essai' check (plan in ('essai', 'complet')),
  cree_le timestamptz not null default now(),
  derniere_connexion timestamptz
);

-- Demandes de démo (page de présentation et espaces d'essai).
create table if not exists public.demos (
  id text primary key,
  cree_le timestamptz not null default now(),
  nom text not null default '',
  societe text not null default '',
  telephone text not null default '',
  email text not null default '',
  message text not null default '',
  espace text not null default '',
  traitee boolean not null default false
);

-- Les données existantes sont rattachées à l'espace « principal » (votre espace, en version complète).
alter table public.records add column if not exists espace_id text not null default 'principal';
alter table public.photos add column if not exists espace_id text not null default 'principal';

do $$
begin
  if not exists (
    select 1 from information_schema.key_column_usage
    where table_schema = 'public' and table_name = 'records' and constraint_name = 'records_pkey' and column_name = 'espace_id'
  ) then
    alter table public.records drop constraint if exists records_pkey;
    alter table public.records add primary key (espace_id, id);
  end if;
  if not exists (
    select 1 from information_schema.key_column_usage
    where table_schema = 'public' and table_name = 'photos' and constraint_name = 'photos_pkey' and column_name = 'espace_id'
  ) then
    alter table public.photos drop constraint if exists photos_pkey;
    alter table public.photos add primary key (espace_id, id);
  end if;
end $$;

create index if not exists records_espace_updated_idx on public.records (espace_id, updated_at);

insert into public.espaces (slug, nom, code, plan)
values ('principal', 'Mon espace', lpad((floor(random() * 1000000))::int::text, 6, '0'), 'complet')
on conflict (slug) do nothing;

-- Sécurité : plus aucun accès direct depuis le navigateur. Seul le serveur (clé « service_role »,
-- gardée dans Vercel) lit et écrit, en filtrant toujours par espace.
alter table public.records enable row level security;
alter table public.photos enable row level security;
alter table public.espaces enable row level security;
alter table public.demos enable row level security;

drop policy if exists "prototype records" on public.records;
drop policy if exists "prototype photos" on public.photos;
