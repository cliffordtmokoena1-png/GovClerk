import {
  GOOGLE_ADS_ID,
  GOOGLE_ADS_PURCHASE_CONVERSION_ID,
  GOOGLE_ADS_SUBMIT_LEAD_FORM_CONVERSION_ID,
} from "./consts";
import { getGtag } from "./gtag";

export type ReportPurchaseConversionParams = {
  value: number;
  currency: string;
  transactionId?: string;
};

export function reportPurchaseConversion({
  value,
  currency,
  transactionId,
}: ReportPurchaseConversionParams): void {
  const gtag = getGtag();
  if (gtag == null) {
    return;
  }

  gtag("event", "conversion", {
    send_to: `${GOOGLE_ADS_ID}/${GOOGLE_ADS_PURCHASE_CONVERSION_ID}`,
    value,
    currency,
    transaction_id: transactionId ?? "",
  });
}

export type ReportSubmitLeadFormConversionParams = {
  email?: string;
  phoneNumber?: string;
  firstName?: string;
  lastName?: string;
};

export function reportSubmitLeadFormConversion({
  email,
  phoneNumber,
  firstName,
  lastName,
}: ReportSubmitLeadFormConversionParams): void {
  const gtag = getGtag();
  if (gtag == null) {
    return;
  }

  if (email || phoneNumber || firstName || lastName) {
    gtag("set", "user_data", {
      email: email ? email.trim().toLowerCase() : undefined,
      phone_number: phoneNumber ? phoneNumber.trim() : undefined,
      address: {
        first_name: firstName ? firstName.trim() : undefined,
        last_name: lastName ? lastName.trim() : undefined,
      },
    });
  }

  gtag("event", "conversion", {
    send_to: `${GOOGLE_ADS_ID}/${GOOGLE_ADS_SUBMIT_LEAD_FORM_CONVERSION_ID}`,
  });
}
