export type Channel = "whatsapp" | "email" | "webpush";

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  is_staff: boolean;
}

export interface Template {
  id: number;
  channel: Channel;
  is_active: boolean;
  subject: string;
  body: string;
  wa_template_name: string;
  wa_language_code: string;
  wa_approval_status: "pending" | "approved" | "rejected";
  wa_variable_mapping: string[];
}

export interface Trigger {
  id: number;
  key: string;
  display_name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  templates: Record<Channel, Template | null>;
}

export interface NotificationLog {
  id: number;
  trigger_key: string | null;
  channel: Channel;
  recipient: string;
  status: "sent" | "failed";
  provider_response: unknown;
  error: string;
  is_test: boolean;
  created_at: string;
}

export interface Stats {
  sent_today: number;
  failed_today: number;
  active_triggers: number;
  total_triggers: number;
  recent: NotificationLog[];
}
