import { assertString } from "@/utils/assert";

export type CreateTaskParams = {
  taskSubject: string;
  taskDueDate: Date;
  taskBody: string;
  taskType: "CALL" | "EMAIL" | "TODO";
  ownerId?: string;
};

export async function createTask({
  taskSubject,
  taskDueDate,
  taskBody,
  taskType,
  ownerId,
}: CreateTaskParams): Promise<string> {
  const response = await fetch("https://api.hubapi.com/crm/v3/objects/tasks", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${assertString(process.env.HUBSPOT_ACCESS_TOKEN)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        hs_task_subject: taskSubject,
        hs_task_body: taskBody,
        hs_task_type: taskType,
        hs_task_status: "NOT_STARTED",
        hs_task_priority: "HIGH",
        hs_timestamp: taskDueDate.toISOString(),
        ...(ownerId && { hubspot_owner_id: ownerId }),
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`HubSpot API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();

  return data.id;
}
