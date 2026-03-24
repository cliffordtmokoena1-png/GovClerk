export type QuickReply = {
  id: string;
  name: string;
  body: string;
  createdAt?: string;
};

export async function listQuickReplies(): Promise<QuickReply[]> {
  const res = await fetch("/api/admin/whatsapp/quick-reply", { method: "GET" });
  if (!res.ok) {
    throw new Error(`Failed to load quick replies: ${res.status}`);
  }
  const data = (await res.json()) as { items: QuickReply[] };
  return data.items ?? [];
}

export async function createQuickReply(input: { name: string; body: string }): Promise<QuickReply> {
  const res = await fetch("/api/admin/whatsapp/quick-reply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`Failed to create quick reply: ${res.status}`);
  }
  return (await res.json()) as QuickReply;
}

export async function updateQuickReply(
  id: string,
  patch: Partial<Pick<QuickReply, "name" | "body">>
): Promise<QuickReply> {
  const url = `/api/admin/whatsapp/quick-reply?id=${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    throw new Error(`Failed to update quick reply: ${res.status}`);
  }
  return (await res.json()) as QuickReply;
}

export async function deleteQuickReply(id: string): Promise<void> {
  const url = `/api/admin/whatsapp/quick-reply?id=${encodeURIComponent(id)}`;
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`Failed to delete quick reply: ${res.status}`);
  }
}
