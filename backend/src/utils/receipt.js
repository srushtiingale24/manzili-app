export function buildReceiptHtml(order, user) {
  const addons = JSON.parse(order.addons_json || "{}");
  const isCod = order.payment_method === "cod";
  const addonRows = [];
  if (addons.materials) {
    addonRows.push(
      `<tr><td style="padding:4px 0;">Cleaning materials</td><td style="padding:4px 0; text-align:right;">30 SAR</td></tr>`
    );
  }
  if (addons.ironing) {
    addonRows.push(
      `<tr><td style="padding:4px 0;">Ironing service</td><td style="padding:4px 0; text-align:right;">40 SAR</td></tr>`
    );
  }

  return `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width:480px; margin:0 auto; color:#14231F;">
    <div style="background:#0E5C56; padding:24px; border-radius:14px 14px 0 0; text-align:center;">
      <h1 style="color:#ffffff; margin:0; font-size:22px;">Manzili</h1>
      <p style="color:#E3EEEC; margin:6px 0 0; font-size:12px;">Booking receipt</p>
    </div>
    <div style="border:1px solid #E3E7E4; border-top:none; padding:24px; border-radius:0 0 14px 14px;">
      <p style="font-size:12px; color:#5B6B67; margin:0;">Booking reference</p>
      <p style="font-size:20px; font-weight:bold; margin:4px 0 16px;">${order.booking_ref}</p>

      <table style="width:100%; border-collapse:collapse; font-size:14px;">
        <tr>
          <td style="padding:4px 0;">Hours &times; Cleaners</td>
          <td style="padding:4px 0; text-align:right;">${order.hours} &times; ${order.cleaners}</td>
        </tr>
        ${addonRows.join("")}
        <tr>
          <td style="padding-top:12px; font-weight:bold; border-top:1px dashed #E3E7E4;">
            ${isCod ? "Total due in cash" : "Total paid"}
          </td>
          <td style="padding-top:12px; font-weight:bold; text-align:right; border-top:1px dashed #E3E7E4;">
            ${order.amount_sar} SAR
          </td>
        </tr>
      </table>

      <p style="font-size:13px; color:#5B6B67; margin-top:18px; line-height:1.6;">
        ${order.visit_date} &middot; ${order.time_slot}<br/>
        ${order.building}, ${order.district}, ${order.city}
      </p>

      <p style="font-size:12px; color:#5B6B67; margin-top:18px;">
        ${
          isCod
            ? `Please have ${order.amount_sar} SAR ready in cash for the cleaning team on arrival.`
            : `Paid via ${order.payment_method}.`
        }
        Thank you for booking with Manzili, ${user.name}.
      </p>
    </div>
  </div>`;
}
