-- Isaac Barbershop: esquema inicial
-- Fechas y horas de las citas se guardan en hora local de la barbería (settings.timezone).

create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.settings (
  id smallint primary key default 1 check (id = 1),
  shop_name text not null default 'Isaac Barbershop',
  timezone text not null default 'America/Costa_Rica',
  slot_interval_min int not null default 15 check (slot_interval_min between 5 and 120),
  min_notice_min int not null default 60 check (min_notice_min >= 0),
  booking_window_days int not null default 60 check (booking_window_days between 1 and 365),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'pendiente' check (role in ('admin', 'pendiente')),
  created_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Servicio de barbería',
  price int not null check (price >= 0),
  duration_min int not null check (duration_min between 5 and 480),
  icon text not null default 'scissors',
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table public.barbers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  photo_url text,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- 0 = domingo ... 6 = sábado
create table public.business_hours (
  weekday smallint primary key check (weekday between 0 and 6),
  is_open boolean not null default true,
  open_time time not null default '08:00',
  close_time time not null default '19:00',
  break_start time,
  break_end time,
  check (close_time > open_time),
  check ((break_start is null) = (break_end is null)),
  check (break_end is null or break_end > break_start)
);

-- Cierre de toda la barbería (barber_id null) o de un barbero; día completo (horas null) o un rango.
create table public.closures (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  barber_id uuid references public.barbers (id) on delete cascade,
  start_time time,
  end_time time,
  reason text,
  created_at timestamptz not null default now(),
  check ((start_time is null) = (end_time is null)),
  check (end_time is null or end_time > start_time)
);
create index closures_date_idx on public.closures (date);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,
  email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  client_id uuid references public.clients (id) on delete set null,
  client_name text not null,
  phone text not null,
  email text,
  notes text,
  service_id uuid references public.services (id) on delete set null,
  service_name text not null,
  barber_id uuid references public.barbers (id) on delete set null,
  barber_name text not null,
  date date not null,
  start_time time not null,
  end_time time not null,
  duration_min int not null,
  price int not null,
  status text not null default 'nueva'
    check (status in ('nueva', 'confirmada', 'en_curso', 'completada', 'cancelada', 'no_asistio')),
  created_by text not null default 'cliente' check (created_by in ('cliente', 'admin')),
  cancelled_by text check (cancelled_by in ('cliente', 'admin')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  checked_in_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  confirmation_sent_at timestamptz,
  cancellation_sent_at timestamptz,
  -- Un barbero no puede tener dos citas activas que se traslapen.
  constraint bookings_no_overlap exclude using gist (
    barber_id with =,
    tsrange(date + start_time, date + end_time) with &&
  ) where (status not in ('cancelada', 'no_asistio'))
);
create index bookings_date_idx on public.bookings (date, start_time);
create index bookings_status_idx on public.bookings (status);
create index bookings_phone_idx on public.bookings (phone);

-- ---------------------------------------------------------------------------
-- Funciones auxiliares
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.shop_now()
returns timestamp
language sql stable security definer set search_path = public
as $$
  select now() at time zone (select timezone from settings where id = 1);
$$;

create or replace function public.gen_booking_code()
returns text
language plpgsql volatile
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(6);
  result text := '';
begin
  for i in 0..5 loop
    result := result || substr(alphabet, 1 + (get_byte(bytes, i) % 32), 1);
  end loop;
  return result;
end $$;

create or replace function public.bookings_before_write()
returns trigger
language plpgsql
as $$
begin
  new.end_time := new.start_time + make_interval(mins => new.duration_min);
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    case new.status
      when 'confirmada' then new.confirmed_at := coalesce(new.confirmed_at, now());
      when 'en_curso' then new.checked_in_at := coalesce(new.checked_in_at, now());
      when 'completada' then new.completed_at := coalesce(new.completed_at, now());
      when 'cancelada' then
        new.cancelled_at := coalesce(new.cancelled_at, now());
        new.cancelled_by := coalesce(new.cancelled_by, case when public.is_admin() then 'admin' else 'cliente' end);
      else null;
    end case;
  end if;
  return new;
end $$;

create trigger bookings_before_write
before insert or update on public.bookings
for each row execute function public.bookings_before_write();

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Disponibilidad
-- ---------------------------------------------------------------------------

create or replace function public.get_available_slots(
  p_service_id uuid,
  p_date date,
  p_barber_id uuid default null
)
returns table (barber_id uuid, start_time time)
language plpgsql stable security definer set search_path = public
as $$
#variable_conflict use_column
declare
  v_dur int;
  v_s settings;
  v_h business_hours;
  v_now timestamp;
  v_len interval;
begin
  select duration_min into v_dur from services where id = p_service_id and active;
  if v_dur is null then
    return;
  end if;
  v_len := make_interval(mins => v_dur);

  select * into v_s from settings where id = 1;
  v_now := now() at time zone v_s.timezone;
  if p_date < v_now::date or p_date > v_now::date + v_s.booking_window_days then
    return;
  end if;

  select * into v_h from business_hours where weekday = extract(dow from p_date)::int;
  if not found or not v_h.is_open then
    return;
  end if;

  if exists (select 1 from closures c where c.date = p_date and c.barber_id is null and c.start_time is null) then
    return;
  end if;

  return query
  select b.id, g.t::time
  from barbers b
  cross join generate_series(
    p_date + v_h.open_time,
    p_date + v_h.close_time - v_len,
    make_interval(mins => v_s.slot_interval_min)
  ) as g(t)
  where b.active
    and (p_barber_id is null or b.id = p_barber_id)
    and g.t >= v_now + make_interval(mins => v_s.min_notice_min)
    and (
      v_h.break_start is null
      or not tsrange(p_date + v_h.break_start, p_date + v_h.break_end) && tsrange(g.t, g.t + v_len)
    )
    and not exists (
      select 1 from bookings k
      where k.barber_id = b.id
        and k.date = p_date
        and k.status not in ('cancelada', 'no_asistio')
        and tsrange(k.date + k.start_time, k.date + k.end_time) && tsrange(g.t, g.t + v_len)
    )
    and not exists (
      select 1 from closures c
      where c.date = p_date
        and (c.barber_id is null or c.barber_id = b.id)
        and (
          c.start_time is null
          or tsrange(p_date + c.start_time, p_date + c.end_time) && tsrange(g.t, g.t + v_len)
        )
    )
  order by g.t, b.sort, b.name;
end $$;

create or replace function public.get_available_dates(
  p_service_id uuid,
  p_from date,
  p_to date,
  p_barber_id uuid default null
)
returns setof date
language sql stable security definer set search_path = public
as $$
  select d::date
  from generate_series(p_from, least(p_to, p_from + 120), interval '1 day') as d
  where exists (select 1 from get_available_slots(p_service_id, d::date, p_barber_id));
$$;

-- ---------------------------------------------------------------------------
-- Reservas (API pública mediante RPC)
-- ---------------------------------------------------------------------------

create or replace function public.booking_public_json(b bookings, p_full boolean default false)
returns json
language sql stable
as $$
  select json_build_object(
    'code', b.code,
    'client_name', b.client_name,
    -- Los últimos 4 dígitos sirven para cancelar, así que no se muestran en la consulta pública.
    'phone', case when p_full then b.phone else left(b.phone, 2) || repeat('•', greatest(length(b.phone) - 2, 0)) end,
    'email', case when p_full or b.email is null then b.email
                  else left(b.email, 2) || '•••@' || split_part(b.email, '@', 2) end,
    'service_name', b.service_name,
    'barber_name', b.barber_name,
    'date', b.date,
    'start_time', to_char(b.start_time, 'HH24:MI'),
    'end_time', to_char(b.end_time, 'HH24:MI'),
    'duration_min', b.duration_min,
    'price', b.price,
    'status', b.status,
    'created_at', b.created_at
  );
$$;

create or replace function public.create_booking(
  p_service_id uuid,
  p_barber_id uuid,
  p_date date,
  p_time time,
  p_name text,
  p_phone text,
  p_email text default null,
  p_notes text default null
)
returns json
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_svc services;
  v_barber barbers;
  v_barber_id uuid;
  v_client uuid;
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_name text := trim(coalesce(p_name, ''));
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_row bookings;
begin
  if length(v_name) < 2 or length(v_name) > 80 then
    raise exception 'Escribe tu nombre.' using errcode = 'P0001';
  end if;
  if length(v_phone) < 8 or length(v_phone) > 15 then
    raise exception 'El número de WhatsApp no es válido.' using errcode = 'P0001';
  end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'El correo no es válido.' using errcode = 'P0001';
  end if;

  select * into v_svc from services where id = p_service_id and active;
  if not found then
    raise exception 'El servicio ya no está disponible.' using errcode = 'P0001';
  end if;

  select s.barber_id into v_barber_id
  from get_available_slots(p_service_id, p_date, p_barber_id) s
  where s.start_time = p_time
  limit 1;
  if v_barber_id is null then
    raise exception 'Ese horario ya no está disponible. Elige otro.' using errcode = 'P0001';
  end if;
  select * into v_barber from barbers where id = v_barber_id;

  insert into clients (name, phone, email)
  values (v_name, v_phone, v_email)
  on conflict (phone) do update
    set name = excluded.name,
        email = coalesce(excluded.email, clients.email),
        updated_at = now()
  returning id into v_client;

  loop
    begin
      insert into bookings (
        code, client_id, client_name, phone, email, notes,
        service_id, service_name, barber_id, barber_name,
        date, start_time, end_time, duration_min, price, created_by
      ) values (
        gen_booking_code(), v_client, v_name, v_phone, v_email, nullif(trim(coalesce(p_notes, '')), ''),
        v_svc.id, v_svc.name, v_barber.id, v_barber.name,
        p_date, p_time, p_time, v_svc.duration_min, v_svc.price,
        case when is_admin() then 'admin' else 'cliente' end
      )
      returning * into v_row;
      exit;
    exception
      when unique_violation then
        null; -- código repetido: se genera otro
      when exclusion_violation then
        raise exception 'Ese horario ya no está disponible. Elige otro.' using errcode = 'P0001';
    end;
  end loop;

  return booking_public_json(v_row, true);
end $$;

create or replace function public.get_booking_by_code(p_code text)
returns json
language sql stable security definer set search_path = public
as $$
  select booking_public_json(b, false) from bookings b where b.code = upper(trim(p_code));
$$;

create or replace function public.cancel_booking(p_code text, p_phone_last4 text)
returns json
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_row bookings;
begin
  select * into v_row from bookings where code = upper(trim(p_code)) for update;
  if not found or right(v_row.phone, 4) <> regexp_replace(coalesce(p_phone_last4, ''), '\D', '', 'g') then
    raise exception 'Los datos no coinciden con la reserva.' using errcode = 'P0001';
  end if;
  if v_row.status not in ('nueva', 'confirmada') then
    raise exception 'Esta reserva ya no se puede cancelar.' using errcode = 'P0001';
  end if;
  if v_row.date + v_row.start_time <= shop_now() then
    raise exception 'La cita ya pasó; no se puede cancelar.' using errcode = 'P0001';
  end if;

  update bookings set status = 'cancelada', cancelled_by = 'cliente'
  where id = v_row.id
  returning * into v_row;
  return booking_public_json(v_row, false);
end $$;

-- Check-in con el QR: solo administradores y solo el día de la cita.
create or replace function public.check_in_booking(p_code text)
returns bookings
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_row bookings;
begin
  if not is_admin() then
    raise exception 'No autorizado.' using errcode = '42501';
  end if;
  select * into v_row from bookings where code = upper(trim(p_code)) for update;
  if not found then
    raise exception 'No existe una reserva con ese código.' using errcode = 'P0001';
  end if;
  if v_row.status not in ('nueva', 'confirmada') then
    raise exception 'Esta reserva no se puede iniciar (estado: %).', v_row.status using errcode = 'P0001';
  end if;
  if v_row.date <> shop_now()::date then
    raise exception 'La cita solo se puede iniciar el día de la cita.' using errcode = 'P0001';
  end if;

  update bookings set status = 'en_curso' where id = v_row.id returning * into v_row;
  return v_row;
end $$;

-- ---------------------------------------------------------------------------
-- Vistas
-- ---------------------------------------------------------------------------

create or replace view public.client_stats
with (security_invoker = true)
as
select
  c.id, c.name, c.phone, c.email, c.notes, c.created_at,
  count(b.id) filter (where b.status <> 'cancelada') as bookings_count,
  count(b.id) filter (where b.status = 'completada') as completed_count,
  count(b.id) filter (where b.status = 'no_asistio') as no_show_count,
  coalesce(sum(b.price) filter (where b.status = 'completada'), 0) as total_spent,
  max(b.date) filter (where b.status = 'completada') as last_visit,
  min(b.date + b.start_time) filter (
    where b.status in ('nueva', 'confirmada') and b.date >= current_date
  ) as next_booking
from clients c
left join bookings b on b.client_id = c.id
group by c.id;

-- ---------------------------------------------------------------------------
-- Seguridad (RLS)
-- ---------------------------------------------------------------------------

alter table public.settings enable row level security;
alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.barbers enable row level security;
alter table public.business_hours enable row level security;
alter table public.closures enable row level security;
alter table public.clients enable row level security;
alter table public.bookings enable row level security;

-- Catálogo público de solo lectura
create policy "lectura pública" on public.settings for select using (true);
create policy "lectura pública" on public.services for select using (active or is_admin());
create policy "lectura pública" on public.barbers for select using (active or is_admin());
create policy "lectura pública" on public.business_hours for select using (true);
create policy "lectura pública" on public.closures for select using (true);

create policy "admin escribe" on public.settings for update using (is_admin()) with check (is_admin());
create policy "admin escribe" on public.services for all using (is_admin()) with check (is_admin());
create policy "admin escribe" on public.barbers for all using (is_admin()) with check (is_admin());
create policy "admin escribe" on public.business_hours for all using (is_admin()) with check (is_admin());
create policy "admin escribe" on public.closures for all using (is_admin()) with check (is_admin());

-- Datos personales: solo administradores (los clientes usan las funciones RPC)
create policy "solo admin" on public.clients for all using (is_admin()) with check (is_admin());
create policy "solo admin" on public.bookings for all using (is_admin()) with check (is_admin());

create policy "ver mi perfil" on public.profiles for select using (id = auth.uid() or is_admin());
create policy "editar mi perfil" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
-- El rol solo se cambia desde el panel de Supabase o con SQL.
revoke update on public.profiles from anon, authenticated;
grant update (full_name) on public.profiles to authenticated;

revoke execute on function public.check_in_booking(text) from anon;
revoke execute on function public.gen_booking_code() from anon, authenticated;
revoke execute on function public.booking_public_json(bookings, boolean) from anon, authenticated;

-- Reservas en tiempo real para el panel
alter publication supabase_realtime add table public.bookings;
