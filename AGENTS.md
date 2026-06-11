# RR Cafe POS

Cloud POS & QR Table Ordering System for RR Downtown Arcade.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + `tw-animate-css` |
| UI Kit | shadcn + custom glass-morphism components |
| Auth | Supabase Auth (SSR) |
| Database | Supabase PostgreSQL |
| Realtime | Supabase Realtime (Postgres changes) |
| State | Zustand 5 |
| Icons | Lucide React |
| Charts | Recharts |
| Toasts | react-hot-toast |
| Dates | date-fns |
| QR Codes | qrcode.react |

## Design System

- **Theme**: Dark glass-morphism
- **Primary**: `#36a3ff` (oklch 0.66 0.19 258.5)
- **Secondary**: `#b27eff` (oklch 0.63 0.18 290)
- **Accent**: `#00b5bd` (oklch 0.58 0.12 195)
- **Glass cards**: `backdrop-blur bg-card/50 border border-border`
- **Neon glow**: `box-shadow` with primary color

## Setup

```bash
npm install
npm run dev        # Start dev server on localhost:3000
npm run build      # Production build
npm run lint       # Run ESLint
```

### Environment Variables

Create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Database

Schema is in `supabase/`. Run migrations via Supabase CLI.

## Project Structure

```
src/
├── app/
│   ├── admin/          # Super admin pages
│   │   ├── cafes/      # Manage cafes
│   │   ├── dashboard/  # Super admin dashboard
│   │   └── royalty/    # Royalty reports
│   ├── cafe/           # Cafe admin pages
│   │   ├── analytics/  # Analytics & charts
│   │   ├── dashboard/  # Cafe dashboard
│   │   ├── inventory/  # Inventory management
│   │   ├── menu/       # Menu & items
│   │   ├── orders/     # Order management
│   │   ├── pos/        # POS counter
│   │   └── tables/     # Tables & QR codes
│   ├── counter/        # Cashier POS
│   ├── kds/            # Kitchen Display System
│   ├── customer/       # Customer-facing pages
│   ├── auth/           # Login, signup, callback
│   ├── menu/[slug]/   # Public menu (QR ordering)
│   ├── globals.css     # Global styles & animations
│   ├── layout.tsx      # Root layout
│   └── page.tsx        # Landing page
├── components/
│   ├── layout/         # Header, Sidebar
│   ├── ui/             # Reusable UI components
│   │   ├── badge.tsx
│   │   ├── button.tsx
│   │   ├── empty-state.tsx
│   │   ├── error-boundary.tsx
│   │   ├── glass-card.tsx
│   │   ├── skeleton.tsx
│   │   └── index.ts
│   └── pos/            # POS-specific components
├── lib/
│   ├── store/          # Zustand stores
│   │   ├── auth-store.ts
│   │   ├── order-store.ts
│   │   └── ui-store.ts
│   ├── supabase/       # Supabase clients
│   │   ├── client.ts   # Browser client
│   │   └── server.ts   # Server client
│   ├── notification.ts # Web Audio API sounds
│   └── utils.ts        # cn() utility
├── types/
│   └── database.ts     # TypeScript types
└── middleware.ts        # Auth middleware
```

## Roles

| Role | Access |
|---|---|
| `super_admin` | All cafes, royalty reports, manage cafes |
| `cafe_admin` | Own cafe: dashboard, POS, menu, orders, tables, analytics, inventory |
| `cashier` | POS counter, orders, KDS |
| `customer` | QR ordering, order tracking |

## Key Patterns

- **Client Components**: All pages use `"use client"` directive
- **Data Fetching**: Supabase client directly in components via `useEffect`
- **Realtime**: Supabase channels with `postgres_changes` subscriptions
- **State**: Zustand stores for auth, orders (cart), UI (sidebar)
- **Styling**: Tailwind with `cn()` utility, glass-card class, CSS animations

## Animations

Available animation classes in `globals.css`:
- `animate-slide-in-left` / `animate-slide-in-right`
- `animate-slide-in-up` / `animate-slide-in-down`
- `animate-fade-in` / `animate-scale-in` / `animate-bounce-in`
- `animate-pulse-glow` (notification pulse)
- Shimmer keyframe (for skeleton loaders)
