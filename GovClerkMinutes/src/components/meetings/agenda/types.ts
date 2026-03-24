export interface AgendaItemFormData {
  title: string;
  description: string;
}

export interface MotionFormData {
  title: string;
  description?: string;
  mover?: string;
  seconder?: string;
}

export const initialFormData: AgendaItemFormData = {
  title: "",
  description: "",
};
