
do $$ begin
  create type public.app_role as enum ('admin','user');
exception when duplicate_object then null; end $$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

drop policy if exists "users read own roles" on public.user_roles;
create policy "users read own roles" on public.user_roles
  for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id=_user_id and role=_role)
$$;

create or replace function public.grant_admin_for_known_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if lower(new.email) = 'admin@admin.com' then
    insert into public.user_roles(user_id, role) values (new.id, 'admin'::public.app_role)
    on conflict do nothing;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created_admin on auth.users;
create trigger on_auth_user_created_admin after insert on auth.users
for each row execute function public.grant_admin_for_known_email();

drop trigger if exists on_auth_user_updated_admin on auth.users;
create trigger on_auth_user_updated_admin after update of email on auth.users
for each row execute function public.grant_admin_for_known_email();

insert into public.user_roles(user_id, role)
select id, 'admin'::public.app_role from auth.users where lower(email)='admin@admin.com'
on conflict do nothing;

create or replace function public.admin_list_users(_limit int default 100, _offset int default 0, _search text default null)
returns table(id uuid, email text, username text, balance numeric, level int, xp int,
  created_at timestamptz, last_sign_in timestamptz, is_admin boolean)
language sql stable security definer set search_path = public as $$
  select p.id, u.email::text, p.username, p.balance, p.level, p.xp,
         p.created_at, u.last_sign_in_at,
         public.has_role(p.id,'admin'::public.app_role) as is_admin
  from public.profiles p join auth.users u on u.id = p.id
  where public.has_role(auth.uid(),'admin'::public.app_role)
    and (_search is null or _search = '' or u.email ilike '%'||_search||'%' or p.username ilike '%'||_search||'%')
  order by p.created_at desc limit _limit offset _offset
$$;
revoke all on function public.admin_list_users(int,int,text) from public, anon;
grant execute on function public.admin_list_users(int,int,text) to authenticated;

create or replace function public.admin_stats()
returns json language sql stable security definer set search_path = public as $$
  select case when public.has_role(auth.uid(),'admin'::public.app_role) then json_build_object(
    'users_total', (select count(*) from public.profiles),
    'users_today', (select count(*) from public.profiles where created_at > now() - interval '24 hours'),
    'matches_total', (select count(*) from public.matches),
    'matches_today', (select count(*) from public.matches where created_at > now() - interval '24 hours'),
    'balance_total', (select coalesce(sum(balance),0) from public.profiles),
    'deposits_today', (select coalesce(sum(amount),0) from public.wallet_transactions where type='deposit' and created_at > now() - interval '24 hours'),
    'withdrawals_today', (select coalesce(sum(amount),0) from public.wallet_transactions where type='withdraw' and created_at > now() - interval '24 hours')
  ) else null end
$$;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;

create or replace function public.admin_adjust_balance(_user uuid, _delta numeric, _note text default 'admin adjustment')
returns numeric language plpgsql security definer set search_path = public as $$
declare new_bal numeric;
begin
  if not public.has_role(auth.uid(),'admin'::public.app_role) then raise exception 'forbidden'; end if;
  update public.profiles set balance = balance + _delta, updated_at = now() where id = _user returning balance into new_bal;
  insert into public.wallet_transactions(user_id, amount, type, balance_after, description)
    values (_user, _delta, case when _delta >= 0 then 'admin_credit' else 'admin_debit' end, new_bal, _note);
  return new_bal;
end $$;
revoke all on function public.admin_adjust_balance(uuid,numeric,text) from public, anon;
grant execute on function public.admin_adjust_balance(uuid,numeric,text) to authenticated;

create or replace function public.admin_set_role(_user uuid, _role public.app_role, _grant boolean)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin'::public.app_role) then raise exception 'forbidden'; end if;
  if _grant then
    insert into public.user_roles(user_id, role) values (_user, _role) on conflict do nothing;
  else
    delete from public.user_roles where user_id=_user and role=_role;
  end if;
  return true;
end $$;
revoke all on function public.admin_set_role(uuid,public.app_role,boolean) from public, anon;
grant execute on function public.admin_set_role(uuid,public.app_role,boolean) to authenticated;
