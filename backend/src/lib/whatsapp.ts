type OrderNotification = { orderNumber: string; name: string; phone: string; email: string; total: number; paymentStatus: string; address: string; items: string; to?: string };

export async function notifyAdminOrderPaid(data: OrderNotification) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  let to = data.to || process.env.WHATSAPP_ADMIN_TO;
  const template = process.env.WHATSAPP_TEMPLATE_NAME;
  const language = process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? "en_US";
  if (!token || !phoneNumberId || !to || !template) return { sent: false, reason: "WHATSAPP_NOT_CONFIGURED" };
  to = to.replace(/\D/g, "");
  if (to.length === 10) to = `91${to}`;

  const details = [
    `Order: ${data.orderNumber}`,
    `Customer: ${data.name}`,
    `Mobile: ${data.phone}`,
    `Email: ${data.email}`,
    `Payment: ${data.paymentStatus}`,
    `Total: ₹${data.total.toLocaleString("en-IN")}`,
    `Products: ${data.items}`,
    `Address: ${data.address}`
  ].join("\n");

  const url = `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION ?? "v23.0"}/${phoneNumberId}/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "template", template: { name: template, language: { code: language }, components: [{ type: "body", parameters: [{ type: "text", text: details }] }] } })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || `WhatsApp ${response.status}`);
  return { sent: true, id: body?.messages?.[0]?.id ?? null };
}
