import { UtmParams } from "@/meta/utils";
import { NextRequest } from "next/server";

export enum IntakeFormStep {
  ASK_EMAIL = 0,
  ASK_FIRST_NAME = 1,
  ASK_PHONE = 2,
  ASK_FREQUENCY = 3,
  ASK_DUE_DATE = 4,
}

export type IntakeFormEmailStepBody = {
  step: IntakeFormStep.ASK_EMAIL;
  email: string;
  utmParams: UtmParams;
};

export type IntakeFormFirstNameStepBody = {
  step: IntakeFormStep.ASK_FIRST_NAME;
  firstName: string;
  userId: string;
};

export type IntakeFormPhoneStepBody = {
  step: IntakeFormStep.ASK_PHONE;
  phone: string;
  userId: string;
};

export type IntakeFormFrequencyStepBody = {
  step: IntakeFormStep.ASK_FREQUENCY;
  frequency: string;
  userId: string;
};

export type IntakeFormDueDateStepBody = {
  step: IntakeFormStep.ASK_DUE_DATE;
  dueDate: string;
  userId: string;
};

export type IntakeFormStepBody =
  | IntakeFormEmailStepBody
  | IntakeFormFirstNameStepBody
  | IntakeFormPhoneStepBody
  | IntakeFormFrequencyStepBody
  | IntakeFormDueDateStepBody;

function isIntakeFormStepBody(body: any): body is IntakeFormStepBody {
  if (typeof body !== "object" || body === null) {
    return false;
  }

  const step: IntakeFormStep = body.step;

  switch (step) {
    case IntakeFormStep.ASK_EMAIL:
      return typeof body.email === "string" && body.utmParams != null;

    case IntakeFormStep.ASK_FIRST_NAME:
      return typeof body.firstName === "string" && body.userId != null;

    case IntakeFormStep.ASK_PHONE:
      return typeof body.phone === "string" && body.userId != null;

    case IntakeFormStep.ASK_FREQUENCY:
      return typeof body.frequency === "string" && body.userId != null;

    case IntakeFormStep.ASK_DUE_DATE:
      return typeof body.dueDate === "string" && body.userId != null;

    default: {
      const _exhaustiveCheck: never = step;
      return false;
    }
  }
}

export async function validateBody(req: NextRequest): Promise<IntakeFormStepBody> {
  const body = await req.json();

  if (!isIntakeFormStepBody(body)) {
    throw new Error("Invalid request body for this step");
  }

  return body;
}
