export const PRO_CONFIG = {
  priceLabel: "$2",
  priceUsd: 2,
  payUrl: "/pay.html",
  supportEmail: import.meta.env.VITE_SUPPORT_EMAIL || "support@localdrop.tools",
  activateUrl: "/activate.html",
  demoLicense: import.meta.env.DEV ? "LOCALDROP-PRO-2026" : null,
};

export const PRO_MAX_BYTES = 100 * 1024 * 1024;
