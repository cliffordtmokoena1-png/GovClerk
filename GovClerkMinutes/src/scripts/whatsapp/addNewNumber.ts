import { Command } from "commander";
import { assertString } from "@/utils/assert";
import whatsapp from "@/admin/whatsapp/api";

const program = new Command();
program
  .name("whatsapp-add-number")
  .description("Verify a phone number with WhatsApp Cloud API")
  .option(
    "--access-token <token>",
    "Override access token (defaults to META_WHATSAPP_BUSINESS_API_KEY)"
  );

program
  .command("request")
  .description("Request a verification code via SMS or VOICE for a given phone number id")
  .requiredOption("--phone-number-id <id>", "WhatsApp Cloud API phone number ID")
  .option("--method <SMS|VOICE>", "Delivery method for the code", "SMS")
  .option("--language <code>", "Two-letter language code (e.g. en)", "en")
  .action(async (cmdOpts: any) => {
    const root = program.opts<{ accessToken?: string }>();
    const phoneNumberId = assertString(cmdOpts.phoneNumberId, "phone-number-id");
    const method = String(cmdOpts.method || "SMS").toUpperCase();
    if (method !== "SMS" && method !== "VOICE") {
      console.error("❌ method must be SMS or VOICE");
      process.exit(1);
    }
    const language = assertString(cmdOpts.language || "en", "language");
    try {
      const res = await whatsapp.requestVerificationCode({
        phoneNumberId,
        codeMethod: method,
        language,
        accessToken: root.accessToken,
      });
      console.log("✅ Code requested via", method, "— response:", res.raw ?? res);
      console.log("Next: run 'verify' with the received code to complete verification.");
    } catch (err) {
      console.error("❌ Failed to request code:", err);
      process.exit(1);
    }
  });

program
  .command("verify")
  .description("Verify a phone number using the code you received")
  .requiredOption("--phone-number-id <id>", "WhatsApp Cloud API phone number ID")
  .requiredOption("--code <code>", "Verification code received via SMS/VOICE")
  .action(async (cmdOpts: any) => {
    const root = program.opts<{ accessToken?: string }>();
    const phoneNumberId = assertString(cmdOpts.phoneNumberId, "phone-number-id");
    const code = assertString(cmdOpts.code, "code");
    try {
      const res = await whatsapp.verifyCode({ phoneNumberId, code, accessToken: root.accessToken });
      if (res.success) {
        console.log("✅ Verification successful.");
      } else {
        console.log("ℹ️ Verification response:", res.raw ?? res);
      }
    } catch (err) {
      console.error("❌ Failed to verify:", err);
      process.exit(1);
    }
  });

program
  .command("register")
  .description(
    "Register a verified phone number with Cloud API (requires two-step PIN; sets one if absent)"
  )
  .requiredOption("--phone-number-id <id>", "WhatsApp Cloud API phone number ID")
  .requiredOption("--pin <pin>", "6-digit two-step verification PIN")
  .option(
    "--region <code>",
    "Optional 2-letter ISO country code for data localization (e.g. CH, IN, DE)"
  )
  .action(async (cmdOpts: any) => {
    const root = program.opts<{ accessToken?: string }>();
    const phoneNumberId = assertString(cmdOpts.phoneNumberId, "phone-number-id");
    const pin = assertString(cmdOpts.pin, "pin");

    // Basic PIN validation (non-blocking; Cloud will validate definitively)
    if (!/^\d{6}$/.test(pin)) {
      console.warn("⚠️ PIN should be a 6-digit numeric string.");
    }

    try {
      const res = await whatsapp.registerPhoneNumber({
        phoneNumberId,
        pin,
        dataLocalizationRegion: cmdOpts.region,
        accessToken: root.accessToken,
      });
      if (res.success) {
        console.log("✅ Registration successful.");
      } else {
        console.log("ℹ️ Registration response:", res.raw ?? res);
      }
    } catch (err: any) {
      console.error("❌ Failed to register number:", err?.message || err);
      process.exit(1);
    }
  });

program
  .command("list")
  .description("List all phone numbers for a WhatsApp Business Account")
  .option(
    "--waba-id <id>",
    "WhatsApp Business Account ID (defaults to WHATSAPP_BUSINESS_ACCOUNT_ID env)"
  )
  .action(async (cmdOpts: any) => {
    const root = program.opts<{ accessToken?: string }>();
    try {
      const res = await whatsapp.getPhoneNumbers({
        businessAccountId: cmdOpts.wabaId,
        accessToken: root.accessToken,
      });
      const rows = res.data;
      console.log(rows);
      if (!rows.length) {
        console.log("No phone numbers found.");
        return;
      }
      // Compute simple column widths
      const headers = ["ID", "Display #", "Verified Name", "Quality Rating"] as const;
      const widths = [
        Math.max(headers[0].length, ...rows.map((r) => (r.id || "").length)),
        Math.max(headers[1].length, ...rows.map((r) => (r.display_phone_number || "").length)),
        Math.max(headers[2].length, ...rows.map((r) => (r.verified_name || "").length)),
        Math.max(headers[3].length, ...rows.map((r) => (r.quality_rating || "").length)),
      ];

      const pad = (s: string, n: number) => s.padEnd(n);
      const line = (cols: string[]) =>
        cols
          .map((c, i) => pad(c, widths[i]))
          .join("  ")
          .trimEnd();

      console.log(line([...headers] as unknown as string[]));
      console.log(
        widths
          .map((n) => "-".repeat(n))
          .join("  ")
          .trimEnd()
      );
      for (const r of rows) {
        console.log(
          line([
            String(r.id || ""),
            String(r.display_phone_number || ""),
            String(r.verified_name || ""),
            String(r.quality_rating || ""),
          ])
        );
      }
    } catch (err) {
      console.error("❌ Failed to list phone numbers:", err);
      process.exit(1);
    }
  });

program.parse(process.argv);
