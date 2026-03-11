import { registerAs } from "@nestjs/config";

export default registerAs("konnect", () => {
  const backendUrl = (
    process.env.BACKEND_URL || "http://localhost:3001"
  ).replace(/\/$/, "");
  return {
    apiKey: process.env.KONNECT_API_KEY,
    walletId: process.env.KONNECT_WALLET_ID,
    baseUrl: process.env.KONNECT_BASE_URL,
    successUrl: process.env.KONNECT_SUCCESS_URL,
    failUrl: process.env.KONNECT_FAIL_URL,
    webhookUrl: `${backendUrl}/payments/webhook`,
  };
});
