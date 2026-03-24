import { capture, CLERK_WEBHOOK_ANONYMOUS_ID } from "@/utils/posthog";
import { deleteAllSubscriptionsForUserId } from "@/utils/subscription";
import { DeletedObjectJSON } from "@clerk/nextjs/dist/types/server";

export async function handleUserDeleted(body: DeletedObjectJSON): Promise<void> {
  if (body.id == null) {
    console.warn("Received user.deleted webhook with no user ID");
    return;
  }

  capture(
    "account_deleted",
    {
      slug: body.slug,
    },
    body.id ?? CLERK_WEBHOOK_ANONYMOUS_ID
  );

  await deleteAllSubscriptionsForUserId(body.id);
}
