# Isaac Barbershop — reservas

Booking app for a barbershop: customers book online in five steps and get a receipt with a QR code. The shop runs everything from a mobile-first admin panel.

**Stack:** React + Vite + TypeScript (Netlify) · Supabase (Postgres, Auth, Realtime, Edge Functions) · Resend (email) · WhatsApp Cloud API (Meta).

## What's included

**Customers** (`/`)
- Five steps: service → date → barber (or "anyone available") → time → details.
- Only days and times that are really free are shown. The calendar respects opening hours, the lunch break, closures, barbers' days off, minimum notice and the booking window.
- Receipt with the check-in code and a QR code. Email and WhatsApp confirmation.
- `/reserva/:code` page: see the booking, show the QR, cancel it (asks for the last 4 digits of the WhatsApp number).

**Admin panel** (`/admin`)
- Dashboard with live stats (today, upcoming, pending, confirmed) via Supabase Realtime.
- Booking agenda by day and barber, booking list with filters and search, history.
- Status changes: confirm, start, complete, no-show, cancel; open a WhatsApp chat with the customer.
- **QR check-in**: scan with the camera, from a photo or image, or by typing the code. An appointment can only be started on its day.
- Weekly hours, lunch break, closures (whole shop or one barber, all day or a time range), booking settings.
- Services, barbers, clients (visits, total spent, no-shows), statistics, profile, dark mode.

**Database rules** (`supabase/migrations`)
- An exclusion constraint makes it impossible to double-book a barber, even with two simultaneous bookings.
- Customers never read the tables directly: they use RPC functions (`create_booking`, `get_booking_by_code`, `cancel_booking`, `get_available_slots`, `get_available_dates`). Bookings and clients are only visible to admins (RLS).
- The public lookup by code masks the phone number and email.

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the schema and the starter data. Either:
   - **SQL Editor:** paste and run `supabase/migrations/20261029000000_init.sql`, then `supabase/seed.sql`; or
   - **CLI:**
     ```bash
     npx supabase link --project-ref YOUR_PROJECT_REF
     ```
     ```bash
     npx supabase db push
     ```
     and run `supabase/seed.sql` in the SQL Editor.
3. **Turn off public sign-ups:** Authentication → Sign In / Providers → disable "Allow new users to sign up".
4. **Create the admin:** Authentication → Users → *Add user* (email + password). Then in the SQL Editor:
   ```sql
   update public.profiles set role = 'admin', full_name = 'Administrador del Sistema'
   where email = 'tu-correo@ejemplo.com';
   ```
5. Authentication → URL Configuration: set **Site URL** to the Netlify address (for the password-reset link).

### 2. Website (Netlify)

1. Connect this repo in Netlify. `netlify.toml` already sets the build (`npm run build` → `dist`) and the SPA routes.
2. Site settings → Environment variables:

   | Variable | Value |
   | --- | --- |
   | `VITE_SUPABASE_URL` | Project Settings → API → Project URL |
   | `VITE_SUPABASE_ANON_KEY` | anon / publishable key |
   | `VITE_SHOP_NAME` | `Isaac` (optional) |
   | `VITE_SHOP_WHATSAPP` | the shop's number (optional) |

3. Deploy. The admin panel is at `https://your-site.netlify.app/admin`.

### 3. Email and WhatsApp (Edge Function)

```bash
npx supabase functions deploy send-notification
```

```bash
npx supabase secrets set PUBLIC_SITE_URL=https://your-site.netlify.app SHOP_NAME="Isaac Barbershop" RESEND_API_KEY=re_xxx EMAIL_FROM="Isaac Barbershop <citas@tudominio.com>"
```

```bash
npx supabase secrets set WHATSAPP_TOKEN=EAAG... WHATSAPP_PHONE_NUMBER_ID=1234567890 WHATSAPP_TEMPLATE_CONFIRMATION=cita_confirmada WHATSAPP_TEMPLATE_CANCELLATION=cita_cancelada WHATSAPP_TEMPLATE_LANG=es WHATSAPP_COUNTRY_CODE=506
```

- **Email:** create a [Resend](https://resend.com) account and verify your domain so you can send from `EMAIL_FROM`. The email carries the appointment ticket and the QR code.
- **WhatsApp:** in Meta Business → WhatsApp Manager, create and get approval for two *Utility* templates in Spanish (a business-initiated message must use an approved template):

  `cita_confirmada` (7 variables):
  > Hola {{1}}, tu cita en Isaac Barbershop está reservada ✂️
  > Servicio: {{2}}
  > Fecha: {{3}} a las {{4}}
  > Barbero: {{5}}
  > Código de check-in: {{6}}
  > Ver o cancelar tu cita: {{7}}

  `cita_cancelada` (4 variables):
  > Hola {{1}}, tu cita del {{2}} a las {{3}} fue cancelada. Puedes agendar una nueva aquí: {{4}}

  Use a permanent token (System User) for `WHATSAPP_TOKEN`.

Each channel is optional: if its secrets are missing it is skipped and the booking still goes through. Each notification is sent only once per booking (`confirmation_sent_at` / `cancellation_sent_at` columns). If every channel fails, the mark is cleared so it can be retried.

## Local development

```bash
cp .env.example .env.local
```

```bash
npm install
```

```bash
npm run dev
```

Other scripts: `npm run build`, `npm run lint`, `npm run format`.

## Structure

```
src/
  pages/public/     Booking flow and booking page (/reserva/:code)
  pages/admin/      Admin panel
  components/       Ticket, QR, scanner, modals…
  lib/              Supabase client, API, formatting (CRC, dates in Costa Rica time)
supabase/
  migrations/       Schema, RLS and RPC functions
  seed.sql          Hours, services and starter barbers
  functions/        send-notification (email + WhatsApp)
```

Dates and times are stored in the shop's local time (`settings.timezone`, `America/Costa_Rica` by default).
