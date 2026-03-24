import { Command } from "commander";
import hubspot from "@/crm/hubspot";
import { HubspotObjectLabel, isHubspotObjectLabel } from "@/crm/hubspot/types";
import { HUBSPOT_OBJECT_LABELS } from "@/crm/hubspot/consts";

async function getOwners(): Promise<void> {
  const response = await hubspot.getOwners();
  const owners = response?.results.map((owner) => ({
    id: owner.id,
    email: owner.email,
    firstName: owner.firstName,
    lastName: owner.lastName,
    userId: owner.userId,
  }));

  console.log("✅ Owners found:");
  console.table(owners);
}

async function listLabels(from: HubspotObjectLabel, to: HubspotObjectLabel): Promise<void> {
  const response = await hubspot.getAssociationLabels(from, to);
  console.log("✅ Association types found:");
  console.table(response.results);
}

async function waitForContactMatch({
  expectedFirstName,
  email,
}: {
  expectedFirstName: string;
  email: string;
}) {
  const MAX_RETRIES = 10;
  const DELAY_MS = 2000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`Attempt ${attempt}: Checking contact firstname...`);

    const contact = await hubspot.getContact({
      filter: { propertyName: "email", value: email },
      returnedProperties: ["email", "firstname", "user_id"],
    });

    if (contact?.properties.firstname === expectedFirstName) {
      console.log("Contact name matches:", expectedFirstName);
      return contact;
    }

    if (attempt < MAX_RETRIES) {
      await new Promise((res) => setTimeout(res, DELAY_MS));
    } else {
      throw new Error(
        `Failed to confirm contact first name as '${expectedFirstName}' after ${MAX_RETRIES} attempts.`
      );
    }
  }
}

async function runTest(): Promise<void> {
  const TEST_DATA = {
    email: "test@test.com",
    firstName: "TestName",
    userId: "test-user-id",
  };

  // Deleting test contact if needed
  console.log("Deleting test Contact if it exists");
  const contactExists = await hubspot.getContact({
    filter: { propertyName: "email", value: TEST_DATA.email },
    returnedProperties: ["email", "firstname", "user_id"],
  });
  if (contactExists) {
    console.log("Contact exists, deleting...");
    await hubspot.deleteContact({ contactId: contactExists.id });
    console.log("Contact deleted!");
  }

  // Create a contact and many objects
  console.log("Creating test Contact");
  const contactId = await hubspot.createContact({
    userId: TEST_DATA.userId,
    email: TEST_DATA.email,
    firstName: TEST_DATA.firstName,
    lead_source: "test_source",
  });

  console.log("Creating test Email");
  const emailId = await hubspot.createEmail({
    subject: "Test Email",
    direction: "INCOMING",
    text: "This is a test email.",
    html: "<p>This is a test email.</p>",
    receiverAddress: "receiver@test.com",
    senderAddress: "sender@test.com",
    timestamp: new Date().toISOString(),
  });

  console.log("Creating test Note");
  await hubspot.createNote({
    noteBody: "This is a test note.",
    timestamp: new Date().toISOString(),
  });

  console.log("Creating test Task");
  const taskId = await hubspot.createTask({
    taskSubject: "Test Task",
    taskDueDate: new Date(),
    taskBody: "This is a test task.",
    taskType: "TODO",
  });

  console.log("Creating test Communication");
  const communicationId = await hubspot.createCommunication({
    channel: "WHATS_APP",
    body: "This is a test communication.",
    timestamp: new Date(),
  });

  // Associate the contact with all these objects
  console.log("Associating Contact with Email");
  await hubspot.associateContactWithEmail({
    contactId,
    emailId,
  });
  console.log("Associating Contact with Task");
  await hubspot.associateContactWithTask({
    contactId,
    taskId,
  });
  console.log("Associating Contact with Communication");
  await hubspot.associateContactWithCommunication({
    contactId,
    communicationId,
  });

  console.log("Waiting for HubSpot DB to become consistent and match original name");
  await waitForContactMatch({
    expectedFirstName: TEST_DATA.firstName,
    email: TEST_DATA.email,
  });

  // Update the contact
  console.log("Updating contact name and checking update worked");
  await hubspot.updateContact({
    filter: { propertyName: "email", value: TEST_DATA.email },
    properties: {
      firstName: "UpdatedName",
    },
  });

  // Wait again and confirm update
  console.log("Waiting for HubSpot DB to become consistent and reflect updated name");
  await waitForContactMatch({
    expectedFirstName: "UpdatedName",
    email: TEST_DATA.email,
  });
}

const program = new Command().name("hubspot").description("CLI helpers for the HubSpot API");

program
  .command("owners")
  .description("List all HubSpot owners")
  .action(async () => {
    try {
      console.log("🔍 Fetching owners from HubSpot...");
      await getOwners();
      console.log("🎉 Done.");
    } catch (err) {
      console.error("❌ Failed to fetch owners:", err);
      process.exit(1);
    }
  });

program
  .command("labels")
  .description(
    `List all HubSpot association labels.  Choose from: ${HUBSPOT_OBJECT_LABELS.join(", ")}`
  )
  .arguments("[from] [to]")
  .action(async function (from: string | undefined, to: string | undefined) {
    try {
      if (!from || !to || !isHubspotObjectLabel(from) || !isHubspotObjectLabel(to)) {
        console.error(
          `❌ Invalid labels: "${from}" or "${to}" is not a valid HubSpot object label.`
        );
        return this.help();
      }
      console.log(`🔍 Fetching labels from "${from}" to "${to}"...`);
      await listLabels(from, to);
    } catch (err) {
      console.error("❌ Failed to fetch labels:", err);
      process.exit(1);
    }
  });

program
  .command("test")
  .description("Test our Hubspot API code by adding some objects/associations")
  .action(async () => {
    try {
      console.log("Starting test...");
      await runTest();
      console.log("✅ Test finished!");
    } catch (err) {
      console.error("❌ Test failed!", err);
      process.exit(1);
    }
  });

program.parseAsync(process.argv).catch((err) => {
  console.error("❌ CLI crashed:", err);
  process.exit(1);
});
