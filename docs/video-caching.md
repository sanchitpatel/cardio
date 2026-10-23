# Video & Asset Caching Guide

This document outlines the exact cache-control headers implemented in `src/worker.js` and instructions for instant asset & video updates.

---

## 1. Complete Caching Header Timings Summary

| Asset Category | Cache-Control Header | Browser Cache (`max-age`) | Cloudflare Edge Cache (`s-maxage`) |
| :--- | :--- | :---: | :---: |
| **Versioned Images** (`<Img />` / `?v=...`) | `public, max-age=604800, s-maxage=2592000, immutable` | **7 Days** (604,800s) | **30 Days / 1 Month** (2,592,000s) |
| **Video Files** (`.mp4`, `.webm`, R2 stream) | `public, max-age=604800, s-maxage=2592000` | **7 Days** (604,800s) | **30 Days / 1 Month** (2,592,000s) |
| **Unversioned Static Images** (raw `<img>`) | `public, max-age=86400, s-maxage=604800` | **1 Day** (86,400s) | **7 Days** (604,800s) |
| **HTML Routes / Entrypoints** | `public, max-age=0, must-revalidate` | **0 Seconds** (Must Revalidate) | **0 Seconds** |

---

## 2. Instructions for Instant Video Updates (No Code Changes Required)

### Case A: Videos Stored in Cloudflare R2 Storage

When updating a video hosted on Cloudflare R2:

#### Method 1: Update Filename or URL String in CMS / JSON Data (Recommended)
1. Upload the new video file to R2 with a distinct filename (e.g., `testimonial_v2.mp4`).
2. Update the video URL field in your CMS or JSON data file to point to the new filename or query parameter (`/video/testimonial?v=2`).
3. **Result**: The React app reads the new URL string dynamically. The browser treats it as a new asset and fetches it instantly without altering React component code.

#### Method 2: Overwriting the Same File in R2 (`testimonial_video.mp4`)
1. Upload the updated video over the existing file in R2.
2. Go to **Cloudflare Dashboard → Caching → Purge Cache → Custom Purge**.
3. Enter the URL: `https://yourdomain.com/video/testimonial` and click **Purge**.
4. **Result**: Cloudflare's CDN edge cache is purged instantly.

---

### Case B: Videos Stored in `public/` Directory (GitHub Repository)

When updating static video assets in your project repository:

1. **Add the new video file** to `public/videos/` with a distinct filename (e.g., `hero_v2.mp4`).
2. **Update the JSON / CMS data file** to reference `/videos/hero_v2.mp4`.
3. Commit and push the changes to GitHub.
4. **Result**: Cloudflare deploys the update. Because the browser sees a new URL path string coming from the JSON data, it downloads the new video immediately.

---

## 3. Instructions for Updating Unversioned Static Images (Manual Cache Purge)

If you overwrite an unversioned static image keeping the exact same URL path (e.g., `/gallery/hero.jpg`), Cloudflare will cache it on edge servers for 7 days (`s-maxage=604800`). To force Cloudflare to update the edge cache immediately:

1. **Log into your Cloudflare Dashboard**.
2. Go to **Caching** → **Configuration** → **Purge Cache**.
3. Select **Custom Purge**, enter the exact image URL (e.g., `https://yourdomain.com/gallery/hero.jpg`), and click **Purge**.
4. **Result**: Cloudflare instantly wipes the 7-day Edge Cache across all global data centers.