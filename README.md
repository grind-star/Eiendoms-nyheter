# 🏠 Eiendom Nyheter – Deploy-guide

Komplett Next.js-app med automatisk nyhetshenting fra eiendomswatch.no, estatenyheter.no, E24, DN og Finansavisen.

---

## Steg 1: Supabase (database) – ca. 5 min

1. Gå til [supabase.com](https://supabase.com) og opprett gratis konto
2. Klikk **"New project"**, gi den et navn (f.eks. `eiendom-nyheter`)
3. Når prosjektet er klart, gå til **SQL Editor** og kjør dette:

```sql
create table articles (
  id uuid default gen_random_uuid() primary key,
  headline text not null unique,
  summary text,
  source text,
  source_url text,
  category text,
  sentiment text,
  read_time integer default 2,
  fetched_at timestamptz default now()
);

-- Indeks for raskere spørringer
create index on articles (fetched_at desc);
create index on articles (category);

-- Tillat offentlig lesing (appen trenger ikke innlogging)
alter table articles enable row level security;
create policy "Public read" on articles for select using (true);
```

4. Gå til **Project Settings → API** og noter deg:
   - `Project URL` (f.eks. `https://abcdefgh.supabase.co`)
   - `anon public` key
   - `service_role` key (hemmelig – ikke del denne)

---

## Steg 2: Anthropic API-nøkkel

1. Gå til [console.anthropic.com](https://console.anthropic.com)
2. Gå til **API Keys** og opprett en ny nøkkel
3. Kopier nøkkelen (starter med `sk-ant-...`)

---

## Steg 3: Deploy til Vercel – ca. 5 min

### Alternativ A: Via GitHub (anbefalt)

1. Last opp prosjektmappen til et nytt GitHub-repo
2. Gå til [vercel.com](https://vercel.com) → **Add New Project**
3. Velg ditt repo og klikk **Deploy**

### Alternativ B: Via Vercel CLI

```bash
npm install -g vercel
cd eiendom-app
vercel
```

---

## Steg 4: Legg inn miljøvariabler i Vercel

Gå til Vercel-dashboardet → ditt prosjekt → **Settings → Environment Variables**

Legg inn disse (alle miljøer: Production, Preview, Development):

| Navn | Verdi |
|------|-------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` (anon key) |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (service role key) |
| `CRON_SECRET` | Lag en tilfeldig streng, f.eks. kjør: `openssl rand -hex 32` |

Etter å ha lagt inn variablene: **Redeploy** prosjektet.

---

## Steg 5: Første nyhetshenting

Når appen er live, trigger første henting manuelt:

```bash
curl -H "Authorization: Bearer DIN_CRON_SECRET" \
  https://ditt-prosjekt.vercel.app/api/fetch-news
```

Eller bare åpne appen – den har en "Hent nyheter nå"-knapp hvis databasen er tom.

---

## Automatisk oppdatering (cron)

`vercel.json` er allerede konfigurert til å kjøre henting kl:
- **07:00** UTC (= 08:00/09:00 norsk tid)
- **11:00** UTC (= 12:00/13:00 norsk tid)  
- **16:00** UTC (= 17:00/18:00 norsk tid)
- **20:00** UTC (= 21:00/22:00 norsk tid)

> **Merk:** Vercel Cron krever **Pro-plan** ($20/mnd) for automatisk kjøring.
> På gratis Hobby-plan kan du bruke [cron-job.org](https://cron-job.org) (gratis):
> - Lag 4 jobber som kaller `https://ditt-prosjekt.vercel.app/api/fetch-news`
> - Legg til header: `Authorization: Bearer DIN_CRON_SECRET`

---

## Prosjektstruktur

```
eiendom-app/
├── app/
│   ├── api/
│   │   ├── fetch-news/route.ts   ← Cron-endepunkt (henter + lagrer)
│   │   └── news/route.ts         ← Les artikler fra Supabase
│   ├── components/
│   │   └── EiendomApp.tsx        ← iPhone-appen (React)
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── fetcher.ts                ← Anthropic API-kall med web search
│   └── supabase.ts               ← Supabase-klienter
├── vercel.json                   ← Cron-konfigurasjon
├── .env.local.example            ← Mal for miljøvariabler
└── package.json
```

---

## Kostnader (estimat)

| Tjeneste | Kostnad |
|----------|---------|
| Vercel Hobby | Gratis (manuell trigger) |
| Vercel Pro (med cron) | $20/mnd |
| Supabase Free | Gratis |
| Anthropic API | ~$0.05–0.20 per henting |
| cron-job.org | Gratis (alternativ til Vercel cron) |

**Totalt med gratis-tiers:** kun Anthropic API-kostnad (~$6–25/mnd ved 4 hentinger/dag)
