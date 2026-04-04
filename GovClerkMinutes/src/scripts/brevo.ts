import { BREVO_LISTS } from "@/brevo/lists";
import { getContactsFromList } from "@/brevo/contacts";
import dotenv from "dotenv";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

dotenv.config({ path: ".env" });

yargs(hideBin(process.argv))
  .command(
    "*",
    "List contacts in a Brevo list",
    (yargs) => {},
    async (argv) => {
      console.log("Fetching contacts from SIGNUP_URGENT list...");

      const contacts = await getContactsFromList(BREVO_LISTS.SIGNUP_URGENT);
      console.log(JSON.stringify(contacts, null, 2));
    }
  )
  .help()
  .alias("help", "h").argv;
