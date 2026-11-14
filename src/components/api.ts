export async function send(url: string, body: BodyInit, method = 'POST') {
  const isForm = body instanceof FormData;
  const r = await fetch(url, { method, body: isForm ? body : body, headers: isForm ? undefined : { 'Content-Type': 'application/json' } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Something went wrong. Try again.');
  return j;
}
