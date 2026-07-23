begin;

create extension if not exists pgcrypto;

create table if not exists public.free_resources (
  id uuid primary key default gen_random_uuid(),
  brand_slug text not null,
  slug text not null,
  title text not null,
  short_description text not null,
  category text not null default 'free_resources',
  creator_slug text not null,
  landing_path text not null,
  pdf_path text not null,
  cover_image_path text not null,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_slug, slug)
);

create table if not exists public.free_resource_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  first_name text not null,
  resource_slug text not null,
  brand_slug text not null,
  creator_slug text not null,
  acquisition_source text not null,
  video_id text,
  campaign text not null,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  page_path text,
  referrer text,
  consent_at timestamptz not null,
  first_captured_at timestamptz not null default now(),
  last_requested_at timestamptz not null default now(),
  capture_status text not null default 'received'
    check (capture_status in ('received','subscribed','failed')),
  delivery_status text not null default 'pending'
    check (delivery_status in ('pending','queued','delivered','failed')),
  kit_subscriber_id text,
  kit_queued_at timestamptz,
  delivered_at timestamptz,
  last_error text,
  user_agent text,
  unique (email, brand_slug, resource_slug),
  foreign key (brand_slug, resource_slug)
    references public.free_resources (brand_slug, slug)
    on update cascade
    on delete restrict
);

alter table public.free_resources enable row level security;
alter table public.free_resource_leads enable row level security;

revoke all on public.free_resources from anon, authenticated;
revoke all on public.free_resource_leads from anon, authenticated;

grant select on public.free_resources to anon, authenticated;

drop policy if exists "Public can read active free resources" on public.free_resources;
create policy "Public can read active free resources"
  on public.free_resources
  for select
  to anon, authenticated
  using (active = true);

insert into public.free_resources (
  brand_slug,
  slug,
  title,
  short_description,
  category,
  creator_slug,
  landing_path,
  pdf_path,
  cover_image_path,
  active,
  updated_at
) values (
  'gp73',
  'foundation-audit',
  'The Foundation Audit',
  'A ten-minute, four-law diagnostic for what your Bible study and your week are really built on.',
  'free_resources',
  'sedrick-davis',
  '/free/foundation-audit',
  '/assets/free/foundation-audit.pdf',
  '/assets/free/foundation-audit-cover.png',
  true,
  now()
)
on conflict (brand_slug, slug) do update set
  title = excluded.title,
  short_description = excluded.short_description,
  category = excluded.category,
  creator_slug = excluded.creator_slug,
  landing_path = excluded.landing_path,
  pdf_path = excluded.pdf_path,
  cover_image_path = excluded.cover_image_path,
  active = excluded.active,
  updated_at = now();

commit;
