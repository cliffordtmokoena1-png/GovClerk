export interface CreditDetail {
  id: number;
  token: number;
  action: string;
  checkout_session_id: string | null;
  transcript_id: number | null;
  invoice_id: string | null;
  created_at: string;
  mode: string | null;
  transcript_title: string | null;
}
