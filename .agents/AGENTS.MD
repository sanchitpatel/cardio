## 🎨 Frontend Tasks — Skill Delegation

> For **any frontend-related task**, Agent MUST first check the `.agents/skills/` folder for a matching skill file before writing code.

### How It Works

1. When the user asks for frontend work (UI components, pages, styling, animations, layout), **read the relevant skill file** from `.agents/skills/` first.
2. The skill file contains the design system, tech stack constraints, component patterns, and quality standards specific to that area.


| Skill | Primary Purpose | Use When... |
| --- | --- | --- |
| **emil-design-eng** | UI implementation and frontend engineering best practices | Building React.js components, layouts, responsive UIs, translating designs into production-quality React.js/Tailwind code |
| **astro-islands-hydration** | Astro True Island Hydration architecture & 0 KB JS defaults | Creating/modifying Astro pages, setting hydration directives (<Comp />, client:load, client:visible, client:idle, client:only="react"), and decomposing React components into granular islands |
| **animation-vocabulary** | Motion design terminology and animation planning— Helps describe motion and animation using proper terminology | Designing or describing animations, transitions, easing, timing, motion systems |
| **review-animations** | Reviews animations for smoothness, timing, easing, UX | Reviewing existing animations for smoothness, timing, consistency and UX |
| **impeccable** | Code quality, UI review, polish, accessibility, consistency, production-level frontend reviews | Reviewing existing frontend code, improving accessibility, maintainability, consistency and quality |
| **design-taste-frontend** | High-quality frontend UI design decisions | Building new React/Next.js pages, components, dashboards, landing pages with premium aesthetics |
| **high-end-visual-design** | Luxury / premium visual design direction | Creating interfaces inspired by Apple, Linear, Stripe, Arc, Vercel, Notion, etc. |
| **redesign-existing-projects** | Improve existing websites/apps without rebuilding from scratch | User already has a project and wants a redesign, facelift or modernization |
| **stitch-design-taste** | Design system consistency and component composition | Maintaining consistent UI patterns across a large application or design system |
| **full-output-enforcement** | Forces complete, production-ready responses | When the user wants a finished implementation instead of partial snippets or placeholders |
| **gpt-taste** | General visual and UX design critique | Comparing layouts, improving hierarchy, spacing, typography, colors, premium feel |
| **image-to-code** | Convert UI screenshots/mockups into code | User provides a design image, Figma screenshot, Dribbble shot, or wireframe to implement |
| **imagegen-frontend-mobile** | Generate AI prompts for mobile app UI images | Creating image-generation prompts for Android/iOS UI concepts |
| **imagegen-frontend-web** | Generate AI prompts for website UI images | Creating Midjourney/Flux/OpenAI prompts for website mockups |
| **minimalist-ui** | Minimal and clean interface design | User explicitly wants extremely simple, distraction-free interfaces |
| **supabase** | Supabase database, auth, realtime, RLS, edge functions, storage, and API integration | Building, modifying, or debugging Supabase features, queries, auth flows, realtime listeners, or RPC functions |
| **supabase-postgres-best-practices** | Postgres best practices maintained by Supabase for schema, query optimization, and RLS | Writing/altering database tables, column types, SQL migrations, stored procedures, indexes, triggers, and RLS security policies |

## ⚡ Backend & Database Tasks — Supabase Skill Delegation

> For **any database or Supabase-related task**, Agent MUST first check and read the `.agents/skills/supabase` and `.agents/skills/supabase-postgres-best-practices` skill files before writing database code or making schema modifications.

### How It Works

1. When working on Supabase integrations (client libraries, auth sessions, RPC calls, realtime subscriptions, schema migrations, RLS policies, Edge Functions), **read the relevant Supabase skill files** from `.agents/skills/`.
2. Follow Supabase official best practices for schema design, type safety, query optimization, security definer settings, search paths, and Row Level Security.

## 🌌 Astro Tasks
Before writing ANY Astro code (pages, layouts, config, collections, actions, middleware, adapters, view transitions, server islands, env, i18n):
1. Read `.agents/skills/astro-framework/SKILL.md`, then only the `references/` file for the current topic.
2. Query the `astro-docs` MCP (`search_astro_docs`) to verify APIs and config. Don't rely on memory.
3. For hydration directives or splitting React components into islands, also read `.agents/skills/astro-islands-hydration`.