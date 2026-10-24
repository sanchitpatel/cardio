// In-Memory IP Tracking Map (Guaranteed 1 request / 60s per IP)
const ipRateMap = new Map();

function checkLocalRateLimit(ip, limit = 1, windowMs = 60000) {
  const now = Date.now();
  const timestamps = (ipRateMap.get(ip) || []).filter((t) => now - t < windowMs);

  if (timestamps.length >= limit) {
    return true; // Exceeded limit
  }

  timestamps.push(now);
  ipRateMap.set(ip, timestamps);
  return false;
}

// Safely fetch static asset from env.ASSETS, automatically following any internal redirect
async function fetchAssetSafe(env, request, pathname) {
  const targetUrl = new URL(pathname, request.url);
  let res = await env.ASSETS.fetch(new Request(targetUrl.toString(), request));

  // If Cloudflare static asset engine returns a 3xx redirect (e.g. trailing slash normalization)
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get("location");
    if (location) {
      const followUrl = new URL(location, request.url);
      res = await env.ASSETS.fetch(new Request(followUrl.toString(), request));
    }
  }
  return res;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // =========================================================
    // CONTACT FORM SUBMISSION ENDPOINT (/api/contact)
    // =========================================================
    if (url.pathname === "/api/contact") {
      if (request.method !== "POST") {
        return new Response(
          JSON.stringify({ error: "Method Not Allowed" }),
          { status: 405, headers: { "Content-Type": "application/json" } }
        );
      }

      try {
        const body = await request.json();
        const { name, email, phone, message } = body || {};

        // Server-side input validation
        const trimmedName = typeof name === "string" ? name.trim() : "";
        const trimmedEmail = typeof email === "string" ? email.trim() : "";
        const trimmedPhone = typeof phone === "string" ? phone.replace(/\D/g, "") : "";
        const trimmedMessage = typeof message === "string" ? message.trim() : "";

        if (!trimmedName || trimmedName.length < 2) {
          return new Response(
            JSON.stringify({ error: "Invalid Name" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
          return new Response(
            JSON.stringify({ error: "Invalid Email" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        if (!trimmedPhone || trimmedPhone.length !== 10) {
          return new Response(
            JSON.stringify({ error: "Invalid 10-digit Phone Number" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        if (!trimmedMessage) {
          return new Response(
            JSON.stringify({ error: "Message is required" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        // ---------------------------------------------------------
        // DUAL-LAYER RATE LIMITING (1 request / 60s per IP)
        // ---------------------------------------------------------
        const clientIp = request.headers.get("cf-connecting-ip") || "127.0.0.1";
        
        // Layer 1: Instant In-Memory Check
        let isBlocked = checkLocalRateLimit(clientIp, 1, 60000);

        // Layer 2: Cloudflare Distributed Binding Check
        const limiter = env?.RATE_LIMITER || env?.CONTACT_LIMITER;
        if (!isBlocked && limiter) {
          try {
            const res = await limiter.limit({ key: clientIp });
            if (res && res.success === false) isBlocked = true;
          } catch (rErr) {
            // Log binding error gracefully if local workerd emulator or free plan rejects RPC call
            console.warn("Cloudflare Rate Limiter binding unavailable:", rErr?.message || rErr);
          }
        }

        if (isBlocked) {
          console.log(`[RATE LIMITER] BLOCKED submission for IP: ${clientIp}`);
          // Silent Security: return 200 OK to the bot, but DO NOT dispatch to Telegram or Google Sheets!
          return new Response(
            JSON.stringify({ success: true, message: "Inquiry received successfully." }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        // ---------------------------------------------------------
        // ASYNCHRONOUS DISPATCH TO TELEGRAM & GOOGLE SHEETS
        // ---------------------------------------------------------
        ctx.waitUntil(
          (async () => {
            const payload = {
              name: trimmedName,
              email: trimmedEmail,
              phone: trimmedPhone,
              message: trimmedMessage,
            };

            // 1. Dispatch to Telegram Group/Chat if secret variables are present
            if (env?.TELEGRAM_BOT_TOKEN && env?.TELEGRAM_CHAT_ID) {
              try {
                // Ensure international 91 prefix for 10-digit phone numbers
                const rawPhone = payload.phone.replace(/\D/g, "");
                const formattedPhone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
                const waDirectUrl = `https://wa.me/${formattedPhone}`;

                const telegramText = `🔔 *New Patient Inquiry — dHealth*\n\n👤 *Name:* ${payload.name}\n📧 *Email:* ${payload.email}\n📞 *Phone:* [${payload.phone}](${waDirectUrl})\n\n💬 *Message:*\n${payload.message}`;

                const tgRes = await fetch(
                  `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: env.TELEGRAM_CHAT_ID,
                      text: telegramText,
                      parse_mode: "Markdown",
                      disable_web_page_preview: true,
                      reply_markup: {
                        inline_keyboard: [
                          [
                            {
                              text: "🌍 WhatsApp Chat",
                              url: waDirectUrl,
                            },
                            {
                              text: "⚪ Mark as Done",
                              callback_data: `mark_done:${formattedPhone}`,
                            },
                          ],
                        ],
                      },
                    }),
                  }
                );

                if (tgRes.ok) {
                  const tgJson = await tgRes.json();
                  if (tgJson?.result?.message_id) {
                    payload.telegram_message_id = tgJson.result.message_id;
                  }
                }
              } catch (tErr) {
                console.error("Telegram dispatch error:", tErr);
              }
            }

            // 2. Dispatch to Google Sheets Webhook if secret variable is present
            if (env?.GOOGLE_SHEET_WEBHOOK_URL) {
              try {
                await fetch(env.GOOGLE_SHEET_WEBHOOK_URL, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                });
              } catch (gErr) {
                console.error("Google Sheets dispatch error:", gErr);
              }
            }
          })()
        );

        // Response acknowledging successful reception
        return new Response(
          JSON.stringify({ success: true, message: "Inquiry received successfully." }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      } catch (err) {
        return new Response(
          JSON.stringify({ error: "Invalid JSON payload" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // =========================================================
    // TELEGRAM WEBHOOK CALLBACK ENDPOINT (/api/telegram-webhook)
    // =========================================================
    if (url.pathname === "/api/telegram-webhook") {
      if (request.method === "POST") {
        try {
          const update = await request.json();
          const callbackQuery = update?.callback_query;

          if (callbackQuery && env?.TELEGRAM_BOT_TOKEN) {
            const callbackId = callbackQuery.id;
            const message = callbackQuery.message;
            const chatId = message?.chat?.id;
            const messageId = message?.message_id;
            const text = message?.text || "";
            const callbackData = callbackQuery.data || "";

            if (callbackData.startsWith("mark_done")) {
              const [, phoneNum] = callbackData.split(":");
              const waDirectUrl = phoneNum ? `https://wa.me/${phoneNum}` : "";

              // 1. Answer Callback Query to dismiss Telegram loading indicator
              await fetch(
                `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    callback_query_id: callbackId,
                    text: "✅ Lead marked as HANDLED!",
                  }),
                }
              );

              // 2. Update Telegram Message text and buttons live
              const updatedText = text
                .replace(/^🔔\s*New Patient Inquiry — Dr\. Pragya Mishra Dental Care/i, "✅ *HANDLED — Dr. Pragya Mishra Dental Care*")
                .replace(/^🔔\s*New BIU Admissions Inquiry/i, "✅ *HANDLED — Patient Inquiry*")
                .replace(/^New BIU Admissions Inquiry/i, "✅ *HANDLED — Patient Inquiry*");

              const newKeyboard = [
                [
                  ...(waDirectUrl
                    ? [{ text: "🌍 WhatsApp Chat", url: waDirectUrl }]
                    : []),
                  { text: "✅ Marked Done", callback_data: "already_done" },
                ],
              ];

              await fetch(
                `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/editMessageText`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    message_id: messageId,
                    text: updatedText.startsWith("✅") ? updatedText : `✅ *HANDLED / DONE*\n\n${text}`,
                    parse_mode: "Markdown",
                    disable_web_page_preview: true,
                    reply_markup: {
                      inline_keyboard: newKeyboard,
                    },
                  }),
                }
              );

              // 3. Notify Google Sheets to check the Status box for this lead
              if (env?.GOOGLE_SHEET_WEBHOOK_URL) {
                try {
                  await fetch(env.GOOGLE_SHEET_WEBHOOK_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "mark_done",
                      phone: phoneNum,
                      telegram_message_id: messageId,
                    }),
                  });
                } catch (gErr) {
                  console.error("Google Sheets mark_done error:", gErr);
                }
              }
            } else if (callbackData === "already_done") {
              await fetch(
                `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    callback_query_id: callbackId,
                    text: "This lead is already marked as DONE! ✅",
                  }),
                }
              );
            }
          }
        } catch (err) {
          console.error("Telegram webhook error:", err);
        }
      }
      return new Response("OK", { status: 200 });
    }

    // =========================================================
    // SHEET STATUS UPDATE ENDPOINT (/api/mark-done-sheet)
    // =========================================================
    if (url.pathname === "/api/mark-done-sheet") {
      if (request.method === "POST") {
        try {
          const body = await request.json();
          const { telegram_message_id, name, email, phone, message } = body || {};

          if (telegram_message_id && env?.TELEGRAM_BOT_TOKEN && env?.TELEGRAM_CHAT_ID) {
            const rawPhone = String(phone || "").replace(/\D/g, "");
            const formattedPhone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
            const waDirectUrl = formattedPhone ? `https://wa.me/${formattedPhone}` : "";

            const updatedText = `✅ *HANDLED via Google Sheets*\n\n👤 *Name:* ${name || ""}\n📧 *Email:* ${email || ""}\n📞 *Phone:* [${phone || ""}](${waDirectUrl})\n\n💬 *Message:*\n${message || ""}`;

            const newKeyboard = [
              [
                ...(waDirectUrl ? [{ text: "🌍 WhatsApp Chat", url: waDirectUrl }] : []),
                { text: "✅ Marked Done", callback_data: "already_done" },
              ],
            ];

            await fetch(
              `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/editMessageText`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: env.TELEGRAM_CHAT_ID,
                  message_id: telegram_message_id,
                  text: updatedText,
                  parse_mode: "Markdown",
                  disable_web_page_preview: true,
                  reply_markup: {
                    inline_keyboard: newKeyboard,
                  },
                }),
              }
            );
          }
        } catch (err) {
          console.error("Mark done sheet error:", err);
        }
      }
      return new Response("OK", { status: 200 });
    }

    // =========================================================
    // TESTIMONIAL VIDEO ENDPOINT (/video/testimonial)
    // =========================================================
    if (url.pathname === "/video/testimonial") {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("Method Not Allowed", { status: 405 });
      }

      // ---------------------------------------------------------
      // 1. TRY STATIC ASSET FIRST (/testimonials/testimonial_video.mp4)
      // ---------------------------------------------------------
      if (env?.ASSETS) {
        try {
          const staticVideoUrl = new URL("/testimonials/testimonial_video.mp4", request.url);
          const staticResponse = await env.ASSETS.fetch(new Request(staticVideoUrl, request));

          const contentType = staticResponse.headers.get("content-type") || "";

          // Check if static video exists and is NOT the SPA index.html fallback
          if (staticResponse.ok && !contentType.includes("text/html")) {
            return staticResponse;
          }
        } catch (err) {
          // Fallthrough to R2 if static asset fetch fails
        }
      }

      // ---------------------------------------------------------
      // 2. FALLBACK TO R2 STORAGE (STREAMING SUPPORT)
      // ---------------------------------------------------------
      if (env?.TESTIMONIALS) {

        const options = {
          range: request.headers,
          onlyIf: request.headers,
        };

        const object = await env.TESTIMONIALS.get("testimonial_video.mp4", options);

        if (object) {
          const headers = new Headers();
          object.writeHttpMetadata(headers);

          headers.set("Content-Type", headers.get("Content-Type") || "video/mp4");
          headers.set("Accept-Ranges", "bytes");
          headers.set("Cache-Control", "public, max-age=604800, s-maxage=2592000");
          headers.set("ETag", object.httpEtag);
          headers.set("Access-Control-Allow-Origin", "*");

          if (object.status === 304) {
            return new Response(null, { status: 304, headers });
          }

          let status = 200;

          if (object.range) {
            status = 206;
            const offset = object.range.offset;
            const length = object.range.length;
            headers.set("Content-Range", `bytes ${offset}-${offset + length - 1}/${object.size}`);
            headers.set("Content-Length", length.toString());
          } else {
            headers.set("Content-Length", object.size.toString());
          }

          let response;
          if (request.method === "HEAD") {
            response = new Response(null, { status, headers });
          } else {
            response = new Response(object.body, { status, headers });
          }

          return response;
        }
      }

      // ---------------------------------------------------------
      // 3. NEITHER STATIC NOR R2 VIDEO FOUND
      // ---------------------------------------------------------
      return new Response("Video Not Found", { status: 404 });
    }

    // =========================================================
    // SUBDOMAIN ROUTING & ASSETS SERVING
    // =========================================================
    if (env?.ASSETS) {
      const hostname = url.hostname.toLowerCase();
      const isDashboardSubdomain =
        hostname === "dash.ip360.in" ||
        hostname.startsWith("dash.") ||
        hostname.includes("dash-");

      // CASE 1: DASHBOARD SUBDOMAIN (dash.ip360.in)
      if (isDashboardSubdomain) {
        // If user accesses /dashboard or /dashboard/ on the subdomain, redirect to root /
        if (url.pathname === "/dashboard" || url.pathname === "/dashboard/") {
          return Response.redirect(`${url.origin}/`, 301);
        }

        const isStaticFile =
          url.pathname.includes(".") ||
          url.pathname.startsWith("/_astro/") ||
          url.pathname.startsWith("/assets/") ||
          url.pathname.startsWith("/images/");

        // For root / and clean SPA paths, serve the dashboard HTML directly without redirects
        if (!isStaticFile) {
          let dashboardRes = await fetchAssetSafe(env, request, "/dashboard/");
          if (!dashboardRes.ok) {
            dashboardRes = await fetchAssetSafe(env, request, "/dashboard");
          }

          const headers = new Headers(dashboardRes.headers);
          headers.delete("location");
          headers.set("Content-Type", "text/html; charset=utf-8");
          headers.set("Cache-Control", "public, max-age=0, must-revalidate");

          return new Response(dashboardRes.body, {
            status: 200,
            headers,
          });
        }
      } else {
        // CASE 2: MAIN DOMAIN (ip360.in)
        // Block /dashboard and /dashboard/* -> serve our custom 404 page with status 404
        if (
          url.pathname === "/dashboard" ||
          url.pathname.startsWith("/dashboard/") ||
          url.pathname === "/dashboard.html"
        ) {
          let notFoundRes = await fetchAssetSafe(env, request, "/404");
          if (!notFoundRes.ok) {
            notFoundRes = await fetchAssetSafe(env, request, "/404.html");
          }

          const notFoundHeaders = new Headers(notFoundRes.headers);
          notFoundHeaders.delete("location");
          notFoundHeaders.set("Content-Type", "text/html; charset=utf-8");
          notFoundHeaders.set("Cache-Control", "no-cache, no-store, must-revalidate");

          return new Response(notFoundRes.body, {
            status: 404,
            statusText: "Not Found",
            headers: notFoundHeaders,
          });
        }
      }

      // Default static asset fetching for main website and static resources
      const response = await env.ASSETS.fetch(request);
      if (!response.ok) return response;

      const headers = new Headers(response.headers);
      const pathname = url.pathname;
      const hasVersionQuery = url.searchParams.has("v");

      // Hashed Vite JS/CSS (/assets/*, /_astro/*), video files, & versioned URLs (?v=...) get 7-day browser / 30-day edge cache
      if (
        pathname.startsWith("/assets/") ||
        pathname.startsWith("/_astro/") ||
        hasVersionQuery ||
        pathname.match(/\.(mp4|webm|mov|m4v)$/i)
      ) {
        headers.set("Cache-Control", "public, max-age=604800, s-maxage=2592000, immutable");
      } else if (pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|ico|woff2?|mp3)$/i)) {
        // Unversioned static images/fonts get 1-day browser / 7-day edge cache
        headers.set("Cache-Control", "public, max-age=86400, s-maxage=604800");
      } else {
        // HTML routes & index.html revalidate instantly for fresh deployment updates
        headers.set("Cache-Control", "public, max-age=0, must-revalidate");
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};