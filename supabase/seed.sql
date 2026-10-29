-- Datos iniciales (ajústalos desde el panel de administración)
insert into public.settings (id) values (1) on conflict (id) do nothing;

insert into public.business_hours (weekday, is_open, open_time, close_time, break_start, break_end) values
  (0, false, '09:00', '14:00', null, null),
  (1, true,  '08:00', '19:00', '12:00', '13:00'),
  (2, true,  '08:00', '19:00', '12:00', '13:00'),
  (3, true,  '08:00', '19:00', '12:00', '13:00'),
  (4, true,  '08:00', '19:00', '12:00', '13:00'),
  (5, true,  '08:00', '19:00', '12:00', '13:00'),
  (6, true,  '08:00', '17:00', null, null)
on conflict (weekday) do nothing;

insert into public.services (name, category, price, duration_min, icon, sort) values
  ('Barba + Fade', 'Servicio de barbería', 10000, 30, 'beard', 1),
  ('Corte', 'Servicio de barbería', 15000, 45, 'scissors', 2),
  ('Corte + Barba', 'Servicio de barbería', 22000, 45, 'combo', 3),
  ('Cut Flow', 'Enjuagado de pelo', 2000, 20, 'flow', 4);

insert into public.barbers (name, sort) values
  ('Isaac', 1),
  ('Juank', 2);
