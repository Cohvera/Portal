export async function inspectionRequest<T>(
  url: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method,
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    let message = "De aanvraag is niet gelukt.";
    try {
      const data = await response.json();
      message = Array.isArray(data.message)
        ? data.message.join(" ")
        : data.message || message;
    } catch {}
    throw new Error(message);
  }
  return response.json();
}
export const dateLabel = (value: string) =>
  value
    ? new Intl.DateTimeFormat("nl-BE", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(`${value.slice(0, 10)}T12:00:00`))
    : "Niet ingevuld";
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Brussels",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
