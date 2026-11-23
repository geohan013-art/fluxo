import { sendResendRequest } from "@/lib/email/resend-route";

export async function POST(request: Request) {
  return sendResendRequest(request);
}
