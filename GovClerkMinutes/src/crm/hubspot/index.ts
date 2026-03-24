import { createContact } from "./createContact";
import { createTask } from "./createTask";
import {
  associateContactWithTask,
  associateContactWithEmail,
  associateContactWithCommunication,
  getAssociationLabels,
} from "./associations";
import { HUBSPOT_OWNER_IDS } from "./consts";
import { getContact } from "./getContact";
import { createEmail } from "./createEmail";
import { createNote } from "./createNote";
import { updateContact } from "./updateContact";
import { createCommunication } from "./createCommunication";
import { getOwnerIdFromEmail, getOwnerIdFromUserId } from "./owner";
import { getOwners } from "./getOwners";
import { deleteContact } from "./deleteContact";

const hubspot = {
  createContact,
  getContact,
  updateContact,
  createTask,
  createNote,
  createEmail,
  createCommunication,
  associateContactWithTask,
  associateContactWithEmail,
  associateContactWithCommunication,
  getAssociationLabels,
  getOwnerIdFromEmail,
  getOwnerIdFromUserId,
  getOwners,
  deleteContact,
  HUBSPOT_OWNER_IDS,
};

export default hubspot;
