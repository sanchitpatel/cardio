---
name: astro-islands-hydration
description: Enforces Astro's True Island Hydration architecture, granular component decomposition, 0 KB static HTML defaults, and hydration directives (<Comp />, client:load, client:visible, client:idle, client:only="react").
---

# ⚡ Astro Island Hydration & Architecture Skill

> **Golden Rule:** Write page layouts, headers, static text sections, and footers as pure static components in `.astro` files (0 KB JavaScript). Use React ONLY for interactive widgets (video players, carousels, popups, filters). NEVER wrap an entire page into a single huge client component (`<AboutPage client:load />`).

---

## ⚡ Astro's Hydration Directives Cheat Sheet

| Directive | How it works under the hood | Best Used For |
| :--- | :--- | :--- |
| `<Comp />` *(Default)* | **0 KB JS sent.** Pure static HTML pre-rendered at build time. | Static banners, headers, footers, plain text sections, hero shells without heavy JS. |
| `client:load` | **Downloads JS immediately** when page loads. | Navbars, mobile drawer toggles, top-of-page interactive critical components. |
| `client:visible` | **Waits to download JS** until the user scrolls down to it! | Carousels, video players, heavy interactive widgets down the page. |
| `client:idle` | **Downloads JS** when the browser has finished main tasks. | Search bars, chat widgets, feedback popups, secondary analytics. |
| `client:only="react"` | **Skips server rendering completely**; renders only in browser. | Dashboards needing `localStorage`, `window`, or browser-only APIs. |

---

## 🏗️ Architectural Approach: "True Astro Islands" (Industry Standard)

### ❌ Anti-Pattern (Monolithic Page Hydration)
Do NOT import an entire page as one single React component:
```astro
---
// BAD PRACTICE: Loads JavaScript for the entire page at once
import Layout from '../layouts/Layout.astro';
import AboutPage from '../components/pages/AboutPage.jsx';
---

<Layout title="About Us">
  <AboutPage client:load /> <!-- ❌ Loads full React bundle, ruins performance -->
</Layout>
```

### ✅ Best Practice (Granular Island Decomposition)
Decompose the page inside `.astro` files into smaller static HTML blocks and isolated interactive React islands:

```astro
---
// GOOD PRACTICE: Granular Astro Islands
import Layout from '../layouts/Layout.astro';
import AboutHeader from '../components/AboutHeader.astro';      // 0 KB JS (Static)
import AboutStory from '../components/AboutStory.astro';        // 0 KB JS (Static)
import VideoPlayer from '../components/VideoPlayer.jsx';        // Interactive React Island
import ReviewsCarousel from '../components/ReviewsCarousel.jsx';// Interactive React Island
import Footer from '../components/Footer.astro';                // 0 KB JS (Static)
---

<Layout title="About Us">
  <!-- 1. Pure Static HTML (0 KB JS) -->
  <AboutHeader /> 
  <AboutStory />

  <!-- 2. JS downloads ONLY when user scrolls down to the video! -->
  <VideoPlayer client:visible /> 

  <!-- 3. JS downloads when browser is idle -->
  <ReviewsCarousel client:idle />

  <!-- 4. Pure Static HTML (0 KB JS) -->
  <Footer />
</Layout>
```

---

## 📋 Build & Code Generation Checklist

1. **Static First:** Default to `.astro` components or plain React components without hydration directives (`<MyComponent />`) unless interactivity is explicitly required.
2. **Granular Directives:** Navbars and top bars use `client:load`. Below-the-fold interactive components use `client:visible`. Secondary widgets use `client:idle`.
3. **Isolate Interactive State:** Keep `useState`, `useEffect`, and event handlers isolated to small leaf components (e.g., `<VideoPlayer.jsx>`, `<FilterTabs.jsx>`).
4. **No Empty Server Snapshots:** Never use `if (!mounted) return null;` at the root of a component if it breaks static HTML generation for SEO.
