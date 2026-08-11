from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db import transaction
from .models import Sale
from core.mail import send_system_notification
from apps.users.models import SystemSetting


@receiver(post_save, sender=Sale)
def sale_notification(sender, instance, created, **kwargs):
    if created and instance.status == 'COMPLETED':
        sale_id = instance.id

        def send_email():
            sale = Sale.objects.select_related(
                'customer', 'user', 'warehouse'
            ).prefetch_related(
                'details__product', 'payments__payment_method'
            ).get(id=sale_id)

            settings = {s.key: s.value for s in SystemSetting.objects.all()}
            business_name = settings.get('business_name', 'AGS SALES')
            business_address = settings.get('business_address', '')
            business_phone = settings.get('business_phone', '')
            business_nit = settings.get('business_nit', '')
            logo_url = settings.get('app_logo', '') or settings.get('ticket_logo', '')
            currency_symbol = settings.get('currency_symbol', '$')

            customer_name = "Consumidor Final"
            customer_email_display = ""
            customer_doc = ""
            if sale.customer:
                customer_name = f"{sale.customer.first_name} {sale.customer.last_name}".strip()
                customer_email_display = sale.customer.email or ""
                customer_doc = sale.customer.document_number or ""

            def fmt(val):
                try:
                    return f"{currency_symbol}{int(float(val)):,}".replace(',', '.')
                except Exception:
                    return f"{currency_symbol}0"

            # ── Product rows ─────────────────────────────────────────────────
            product_rows_html = ""
            for d in sale.details.all():
                qty = int(d.quantity) if float(d.quantity) == int(float(d.quantity)) else d.quantity
                product_rows_html += f"""
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #334155;">
                    <span style="font-weight: 600;">{d.product.name}</span>
                    <span style="color: #94a3b8; font-size: 12px; margin-left: 6px;">x {qty}</span>
                  </td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; text-align: right; font-size: 14px; color: #334155; font-weight: 600; white-space: nowrap;">
                    {fmt(d.subtotal)}
                  </td>
                </tr>"""

            # ── Payment method ────────────────────────────────────────────────
            payment_method_label = "Efectivo"
            for p in sale.payments.all():
                payment_method_label = p.payment_method.name
                break

            # ── Promo badge ───────────────────────────────────────────────────
            promo_html = ""
            if getattr(sale, 'promo_percent', 0) and int(sale.promo_percent) > 0:
                promo_html = f"""
                <tr>
                  <td style="font-size:13px; color:#4b5563; font-weight:600; padding: 8px 0;">
                    Descuento Promocional ({sale.promo_percent}%)
                  </td>
                  <td style="text-align:right; font-size:13px; color:#b45309; font-weight:700; padding: 8px 0;">
                    -{fmt(sale.discount)}
                  </td>
                </tr>"""

            # ── Logo block ────────────────────────────────────────────────────
            logo_block = ""
            if logo_url:
                logo_block = f'<img src="{logo_url}" alt="{business_name}" style="height:45px; max-width:160px; object-fit:contain; display:block;" />'

            # ── Extra customer info rows ───────────────────────────────────────
            email_row = f"<tr><td style='font-size:13px; color:#4b5563; padding-top:2px;'>{customer_email_display}</td></tr>" if customer_email_display else ""
            doc_row = f"<tr><td style='font-size:13px; color:#4b5563; padding-top:2px;'>CC / NIT: {customer_doc}</td></tr>" if customer_doc else ""

            # ── Footer business info ───────────────────────────────────────────
            address_row = f"<p style='margin:4px 0 0; color:#93c5fd; font-size:11px;'>{business_address}</p>" if business_address else ""
            phone_row = f"<p style='margin:2px 0 0; color:#93c5fd; font-size:11px;'>Tel: {business_phone}</p>" if business_phone else ""
            nit_row = f"<p style='margin:2px 0 0; color:#93c5fd; font-size:11px;'>NIT: {business_nit}</p>" if business_nit else ""

            subject = f"Tu comprobante de compra #{sale.invoice_number or sale.id}"

            html = f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Comprobante de Pago</title>
</head>
<body style="margin:0; padding:0; background-color:#f3f4f6; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6; padding: 30px 15px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px; width:100%; background:#ffffff; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">

      <!-- TOP BRAND HEADER -->
      <tr>
        <td style="padding: 30px 40px 20px; border-bottom: 2px solid #002d72; background: #ffffff;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                {logo_block}
              </td>
              <td style="text-align: right; vertical-align: bottom;">
                <p style="margin: 0; font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Soporte de Pago</p>
                <p style="margin: 2px 0 0; font-size: 18px; font-weight: 800; color: #002d72;">Factura #{sale.invoice_number or sale.id}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- TRANS INFO -->
      <tr>
        <td style="padding: 20px 40px; background: #f8fafc; border-bottom: 1px solid #e5e7eb;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size: 13px; color: #4b5563; line-height: 1.4;">
                <strong>Fecha de emisión:</strong> {sale.created_at.strftime('%d/%m/%Y %H:%M')}<br>
                <strong>Medio de pago:</strong> {payment_method_label}
              </td>
              <td style="text-align: right; font-size: 13px; color: #4b5563; vertical-align: top;">
                <strong>Estado:</strong> <span style="background: #d1fae5; color: #065f46; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase;">Aprobado</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- CUSTOMER BLOCK -->
      <tr>
        <td style="padding: 24px 40px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="padding-bottom: 16px; border-bottom: 1px solid #e5e7eb;">
            <tr>
              <td style="font-size:11px; color:#9ca3af; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; padding-bottom:4px;">Datos del Adquirente</td>
            </tr>
            <tr>
              <td style="font-size:15px; color:#111827; font-weight:700;">{customer_name}</td>
            </tr>
            {email_row}
            {doc_row}
          </table>
        </td>
      </tr>

      <!-- PRODUCTS TABLE -->
      <tr>
        <td style="padding: 24px 40px 0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <thead>
              <tr>
                <th style="text-align:left; font-size:11px; color:#9ca3af; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; padding-bottom:8px; border-bottom:1px solid #e5e7eb;">Descripción</th>
                <th style="text-align:right; font-size:11px; color:#9ca3af; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; padding-bottom:8px; border-bottom:1px solid #e5e7eb; white-space:nowrap;">Valor Total</th>
              </tr>
            </thead>
            <tbody>
              {product_rows_html}
            </tbody>
          </table>
        </td>
      </tr>

      <!-- TOTALS -->
      <tr>
        <td style="padding: 16px 40px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid #e5e7eb; padding-top: 8px;">
            <tr>
              <td style="font-size:13px; color:#4b5563; padding: 4px 0;">Subtotal</td>
              <td style="text-align:right; font-size:13px; color:#111827; font-weight:600; padding:4px 0;">{fmt(sale.subtotal)}</td>
            </tr>
            <tr>
              <td style="font-size:13px; color:#4b5563; padding: 4px 0;">Impuestos (IVA)</td>
              <td style="text-align:right; font-size:13px; color:#111827; font-weight:600; padding:4px 0;">{fmt(sale.tax)}</td>
            </tr>
            {promo_html}
            <tr>
              <td style="font-size:15px; font-weight:700; color:#111827; padding: 10px 0 0; border-top:1px solid #e5e7eb;">Total Pagado</td>
              <td style="text-align:right; font-size:18px; font-weight:800; color:#002d72; padding:10px 0 0; border-top:1px solid #e5e7eb;">{fmt(sale.total)}</td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- IMPORTANT NOTICE -->
      <tr>
        <td style="padding: 0 40px 30px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:6px; padding:16px;">
            <tr>
              <td style="font-size:12px; color:#4b5563; line-height:1.5;">
                Estimado(a) cliente, agradecemos su compra. Este mensaje constituye el soporte de pago electrónico enviado en relación con la transacción referenciada. Conserve esta comunicación como constancia de su pago.
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td style="background:#002d72; padding:24px 40px; text-align:center;">
          <p style="margin:0; color:#ffffff; font-size:14px; font-weight:700;">{business_name}</p>
          {address_row}
          {nit_row}
          {phone_row}
          <p style="margin:16px 0 0; color:#93c5fd; font-size:10px;">Este es un mensaje generado automáticamente por el sistema ERP de facturación. Por favor no responder a esta cuenta de correo.</p>
        </td>
      </tr>

      <!-- SYSTEM WATERMARK -->
      <tr>
        <td style="padding: 16px 0; text-align: center;">
          <p style="margin: 0; font-size: 10px; color: #9ca3af;">Procesado por AGS SALES ERP</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>

</body>
</html>"""

            customer_email = None
            if sale.customer and sale.customer.email:
                customer_email = sale.customer.email

            send_system_notification(subject, html, recipient=customer_email)

        transaction.on_commit(send_email)
