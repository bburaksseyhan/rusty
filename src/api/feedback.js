const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

/**
 * Anket cevaplarını API'ye gönderir. Hata veya 429 oyun akışını kesmez.
 * @param {Record<string, string | number | boolean>} answers
 */
export async function submitFeedback(answers) {
  const url = `${API_BASE}/api/feedback`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(answers),
      keepalive: true,
    });

    if (res.status === 429) {
      console.warn("[Rusty] Geri bildirim rate limit (429)");
      return { ok: false, rateLimited: true };
    }

    if (!res.ok) {
      console.warn("[Rusty] Geri bildirim API hatası:", res.status);
      return { ok: false };
    }

    return { ok: true, ...(await res.json()) };
  } catch (err) {
    console.warn("[Rusty] Geri bildirim gönderilemedi:", err);
    return { ok: false };
  }
}
