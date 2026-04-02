import { useState } from "react";
import type { PublicComment } from "@/types/liveSession";

type AgendaItem = {
  id: number;
  title: string;
};

type Props = {
  slug: string;
  meetingId: number;
  agendaItems?: AgendaItem[];
  approvedComments: PublicComment[];
};

type FormState = {
  speakerName: string;
  speakerEmail: string;
  topic: string;
  commentText: string;
  agendaItemId: string;
};

export function PublicCommentForm({ slug, meetingId, agendaItems = [], approvedComments }: Props) {
  const [form, setForm] = useState<FormState>({
    speakerName: "",
    speakerEmail: "",
    topic: "",
    commentText: "",
    agendaItemId: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.speakerName.trim() || !form.topic.trim()) {
      setError("Speaker name and topic are required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/public/portal/${slug}/meetings/${meetingId}/public-comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          speakerName: form.speakerName.trim(),
          speakerEmail: form.speakerEmail.trim() || undefined,
          topic: form.topic.trim(),
          commentText: form.commentText.trim() || undefined,
          agendaItemId: form.agendaItemId ? Number(form.agendaItemId) : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Submission failed");
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message ?? "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {submitted ? (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-center">
          <div className="text-3xl mb-2">✅</div>
          <p className="font-semibold text-green-800 mb-1">Request Submitted</p>
          <p className="text-sm text-green-700">
            Your request to speak has been submitted. The clerk will review and add you to the
            queue.
          </p>
          <button
            onClick={() => {
              setSubmitted(false);
              setForm({
                speakerName: "",
                speakerEmail: "",
                topic: "",
                commentText: "",
                agendaItemId: "",
              });
            }}
            className="mt-3 text-xs text-green-600 underline"
          >
            Submit another request
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.speakerName}
              onChange={(e) => handleChange("speakerName", e.target.value)}
              placeholder="Full name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-gray-400 text-xs">(optional)</span>
            </label>
            <input
              type="email"
              value={form.speakerEmail}
              onChange={(e) => handleChange("speakerEmail", e.target.value)}
              placeholder="your@email.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Topic <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.topic}
              onChange={(e) => handleChange("topic", e.target.value)}
              placeholder="What would you like to speak about?"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              maxLength={500}
            />
          </div>

          {agendaItems.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Agenda Item <span className="text-gray-400 text-xs">(optional)</span>
              </label>
              <select
                value={form.agendaItemId}
                onChange={(e) => handleChange("agendaItemId", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Select an agenda item —</option>
                {agendaItems.map((agendaItem) => (
                  <option key={agendaItem.id} value={agendaItem.id}>
                    {agendaItem.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Written Comment <span className="text-gray-400 text-xs">(optional)</span>
            </label>
            <textarea
              value={form.commentText}
              onChange={(e) => handleChange("commentText", e.target.value)}
              placeholder="Add any written comments you would like on record..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? "Submitting..." : "Request to Speak"}
          </button>
        </form>
      )}

      {approvedComments.length > 0 && (
        <div className="border-t border-gray-200 pt-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Approved Speakers Queue</h3>
          <div className="space-y-2">
            {approvedComments.map((comment, index) => (
              <div key={comment.id} className="flex items-center gap-3 p-2.5 bg-blue-50 rounded-lg">
                <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-700 text-xs flex items-center justify-center font-bold shrink-0">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {comment.speakerName}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{comment.topic}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
