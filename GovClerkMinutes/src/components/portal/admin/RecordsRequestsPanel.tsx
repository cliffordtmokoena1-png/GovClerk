import { useState, useCallback, useEffect } from "react";
import type { PublicRecordsRequest, RecordsRequestStatus } from "@/types/publicRecords";

type Props = {
  orgId?: string;
};

const STATUS_LABELS: Record<RecordsRequestStatus, string> = {
  received: "Received",
  acknowledged: "Acknowledged",
  in_review: "In Review",
  fulfilled: "Fulfilled",
  partially_fulfilled: "Partially Fulfilled",
  denied: "Denied",
  withdrawn: "Withdrawn",
};

const STATUS_CLASSES: Record<RecordsRequestStatus, string> = {
  received: "bg-blue-100 text-blue-800",
  acknowledged: "bg-indigo-100 text-indigo-800",
  in_review: "bg-yellow-100 text-yellow-800",
  fulfilled: "bg-green-100 text-green-800",
  partially_fulfilled: "bg-teal-100 text-teal-800",
  denied: "bg-red-100 text-red-800",
  withdrawn: "bg-gray-100 text-gray-700",
};

function StatusBadge({ status }: { status: RecordsRequestStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASSES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

type RowData = PublicRecordsRequest & { _isExpanded?: boolean; _isSaving?: boolean; _saveError?: string };

export function RecordsRequestsPanel({}: Props) {
  const [requests, setRequests] = useState<RowData[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editState, setEditState] = useState<Record<number, { status?: string; responseNotes?: string; denialReason?: string }>>({});

  const pageSize = 20;

  const fetchRequests = useCallback(async (p: number, status: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: String(pageSize) });
      if (status) params.set("status", status);
      const res = await fetch(`/api/portal/admin/records-requests?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
        setTotal(data.total || 0);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests(1, "");
  }, [fetchRequests]);

  const handleStatusFilterChange = useCallback((status: string) => {
    setStatusFilter(status);
    setPage(1);
    fetchRequests(1, status);
  }, [fetchRequests]);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    fetchRequests(newPage, statusFilter);
  }, [statusFilter, fetchRequests]);

  const handleToggleExpand = useCallback((id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const handleSave = useCallback(async (id: number) => {
    const edit = editState[id] || {};
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, _isSaving: true, _saveError: undefined } : r))
    );
    try {
      const res = await fetch(`/api/portal/admin/records-requests/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(edit),
      });
      if (res.ok) {
        // Update local state
        setRequests((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status: (edit.status as RecordsRequestStatus) || r.status,
                  responseNotes: edit.responseNotes ?? r.responseNotes,
                  denialReason: edit.denialReason ?? r.denialReason,
                  _isSaving: false,
                }
              : r
          )
        );
        setEditState((prev) => { const next = { ...prev }; delete next[id]; return next; });
      } else {
        const err = await res.json();
        setRequests((prev) =>
          prev.map((r) => (r.id === id ? { ...r, _isSaving: false, _saveError: err.error || "Failed to save" } : r))
        );
      }
    } catch {
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, _isSaving: false, _saveError: "Network error" } : r))
      );
    }
  }, [editState]);

  const handleQuickStatusChange = useCallback(async (id: number, status: RecordsRequestStatus) => {
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, _isSaving: true, _saveError: undefined } : r))
    );
    try {
      const res = await fetch(`/api/portal/admin/records-requests/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setRequests((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status, _isSaving: false } : r))
        );
      } else {
        const err = await res.json();
        setRequests((prev) =>
          prev.map((r) => (r.id === id ? { ...r, _isSaving: false, _saveError: err.error || "Failed to save" } : r))
        );
      }
    } catch {
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, _isSaving: false, _saveError: "Network error" } : r))
      );
    }
  }, []);

  const handleExportCsv = useCallback(() => {
    const headers = ["Tracking #", "Name", "Email", "Type", "Status", "Submitted", "Due Date"];
    const rows = requests.map((r) => [
      r.trackingNumber,
      r.requesterName,
      r.requesterEmail,
      r.requestType,
      r.status,
      r.submittedAt,
      r.responseDueDate || "",
    ]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "records-requests.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [requests]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-gray-900">FOIA / Records Requests</h2>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
            aria-label="Filter by status"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            {(Object.keys(STATUS_LABELS) as RecordsRequestStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleExportCsv}
            aria-label="Export to CSV"
            className="px-4 py-2 text-sm font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Export CSV
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12" role="status" aria-label="Loading requests">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" aria-hidden="true" />
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No requests found.</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse" aria-label="Records requests">
              <caption className="sr-only">FOIA and public records requests</caption>
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tracking #</th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Submitted</th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Due Date</th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {requests.map((req) => (
                  <>
                    <tr
                      key={req.id}
                      className={`hover:bg-gray-50 cursor-pointer ${expandedId === req.id ? "bg-blue-50" : ""}`}
                      onClick={() => handleToggleExpand(req.id)}
                      aria-expanded={expandedId === req.id}
                    >
                      <td className="px-3 py-3 font-mono text-xs font-semibold text-gray-700">{req.trackingNumber}</td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-gray-900">{req.requesterName}</div>
                        <div className="text-xs text-gray-500">{req.requesterEmail}</div>
                      </td>
                      <td className="px-3 py-3 text-gray-600 capitalize">{req.requestType.replace("_", " ")}</td>
                      <td className="px-3 py-3"><StatusBadge status={req.status} /></td>
                      <td className="px-3 py-3 text-gray-600 text-xs">
                        {new Date(req.submittedAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-3 text-gray-600 text-xs">
                        {req.responseDueDate ? new Date(req.responseDueDate).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleToggleExpand(req.id); }}
                          aria-label={expandedId === req.id ? "Collapse row" : "Expand row to update status"}
                          className="text-xs text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                        >
                          {expandedId === req.id ? "Collapse ▲" : "Manage ▼"}
                        </button>
                      </td>
                    </tr>
                    {expandedId === req.id && (
                      <tr key={`${req.id}-expanded`} className="bg-blue-50">
                        <td colSpan={7} className="px-4 py-4">
                          <div className="space-y-3 max-w-2xl">
                            <div>
                              <p className="text-xs font-semibold text-gray-600 mb-1">Description</p>
                              <p className="text-sm text-gray-700">{req.description}</p>
                            </div>
                            {req._saveError && (
                              <div role="alert" className="text-sm text-red-600">{req._saveError}</div>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor={`status-${req.id}`}>
                                  Update Status
                                </label>
                                <select
                                  id={`status-${req.id}`}
                                  value={editState[req.id]?.status ?? req.status}
                                  onChange={(e) => setEditState((prev) => ({ ...prev, [req.id]: { ...prev[req.id], status: e.target.value } }))}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  {(Object.keys(STATUS_LABELS) as RecordsRequestStatus[]).map((s) => (
                                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor={`denial-${req.id}`}>
                                  Denial Reason
                                </label>
                                <input
                                  id={`denial-${req.id}`}
                                  type="text"
                                  value={editState[req.id]?.denialReason ?? req.denialReason ?? ""}
                                  onChange={(e) => setEditState((prev) => ({ ...prev, [req.id]: { ...prev[req.id], denialReason: e.target.value } }))}
                                  placeholder="If denied, enter reason..."
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor={`notes-${req.id}`}>
                                Response Notes (internal)
                              </label>
                              <textarea
                                id={`notes-${req.id}`}
                                rows={3}
                                value={editState[req.id]?.responseNotes ?? req.responseNotes ?? ""}
                                onChange={(e) => setEditState((prev) => ({ ...prev, [req.id]: { ...prev[req.id], responseNotes: e.target.value } }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleSave(req.id)}
                                disabled={req._isSaving}
                                aria-disabled={req._isSaving}
                                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                {req._isSaving ? "Saving..." : "Save Changes"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleQuickStatusChange(req.id, "fulfilled")}
                                className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                              >
                                Mark Fulfilled
                              </button>
                              <button
                                type="button"
                                onClick={() => handleQuickStatusChange(req.id, "denied")}
                                className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                              >
                                Mark Denied
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <nav aria-label="Requests pagination" className="flex justify-center gap-2 mt-4">
              <button
                type="button"
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                aria-label="Previous page"
                className="px-4 py-2 text-sm font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                ← Prev
              </button>
              <span className="px-4 py-2 text-sm text-gray-600" aria-current="page">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
                aria-label="Next page"
                className="px-4 py-2 text-sm font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Next →
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
