import {
  ContactFilter,
  HubspotContactProperties,
  HubspotFilterOperatorEnum,
  HubspotSimplePublicObject,
} from "./types";
import { assertString } from "@/utils/assert";

export type GetContactParams = {
  filter: ContactFilter;
  returnedProperties?: HubspotContactProperties[];
};

export async function getContact({
  filter,
  returnedProperties,
}: GetContactParams): Promise<HubspotSimplePublicObject | null> {
  const response = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${assertString(process.env.HUBSPOT_ACCESS_TOKEN)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filterGroups: [
        {
          filters: [
            {
              propertyName: filter.propertyName,
              operator: HubspotFilterOperatorEnum.Eq,
              value: filter.value,
            },
          ],
        },
      ],
      properties: returnedProperties,
      limit: 1,
    }),
  });

  if (!response.ok) {
    throw new Error(`HubSpot API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();

  if (data.results.length === 0) {
    return null;
  }

  return data.results[0] as HubspotSimplePublicObject;
}
