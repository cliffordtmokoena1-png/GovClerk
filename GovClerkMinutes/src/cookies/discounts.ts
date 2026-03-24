import { isDev } from "@/utils/dev";

export const DISCOUNT_COOKIE_NAME = "gc_discount";

export function getDiscountCodeId(
  discountCode: undefined | null | string | string[]
): string | undefined {
  if (typeof discountCode !== "string") {
    return;
  }

  switch (discountCode) {
    case "BESTADMIN25": {
      return isDev() ? "promo_1QtIlxIV9fK89cLXDMZrnozh" : "promo_1Qsvc4IV9fK89cLXLhBeXiWO";
    }
    case "valuedcustomer": {
      return isDev() ? "promo_1PfZDLIV9fK89cLXuYX84el6" : "promo_1PfZCfIV9fK89cLXqlNQju9X";
    }
  }
}
