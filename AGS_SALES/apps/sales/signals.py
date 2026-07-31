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
                  <td style="font-size:13px; color:#92400e; font-weight:600; padding: 8px 0;">
                    🎲 Descuento por dados ({sale.promo_percent}%)
                  </td>
                  <td style="text-align:right; font-size:13px; color:#b45309; font-weight:700; padding: 8px 0;">
                    -{fmt(sale.discount)}
                  </td>
                </tr>"""

            # ── Logo block ────────────────────────────────────────────────────
            logo_block = ""
            if logo_url:
                logo_block = f'<img src="{logo_url}" alt="{business_name}" style="height:50px; max-width:180px; object-fit:contain; margin-bottom:12px; display:block; margin-left:auto; margin-right:auto;" />'

            # ── Extra customer info rows ───────────────────────────────────────
            email_row = f"<tr><td style='font-size:13px; color:#64748b; padding-top:2px;'>{customer_email_display}</td></tr>" if customer_email_display else ""
            doc_row = f"<tr><td style='font-size:13px; color:#64748b; padding-top:2px;'>CC / NIT: {customer_doc}</td></tr>" if customer_doc else ""

            # ── Footer business info ───────────────────────────────────────────
            address_row = f"<p style='margin:4px 0 0; color:#64748b; font-size:12px;'>{business_address}</p>" if business_address else ""
            phone_row = f"<p style='margin:2px 0 0; color:#64748b; font-size:12px;'>Tel: {business_phone}</p>" if business_phone else ""
            nit_row = f"<p style='margin:2px 0 0; color:#64748b; font-size:12px;'>NIT: {business_nit}</p>" if business_nit else ""

            subject = f"Tu comprobante de compra #{sale.invoice_number or sale.id}"

            html = f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Comprobante de Compra</title>
</head>
<body style="margin:0; padding:0; background-color:#f8fafc; font-family:'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc; padding: 40px 20px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">

      <!-- HEADER -->
      <tr>
        <td style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 36px 40px; text-align:center;">
          {logo_block}
          <h1 style="margin:0; color:#ffffff; font-size:22px; font-weight:700; letter-spacing:-0.5px;">Comprobante de Compra</h1>
          <p style="margin:8px 0 0; color:#94a3b8; font-size:13px; letter-spacing:0.5px;">#{sale.invoice_number or sale.id} &nbsp;&bull;&nbsp; {sale.created_at.strftime('%d/%m/%Y a las %H:%M')}</p>
        </td>
      </tr>

      <!-- STATUS BANNER -->
      <tr>
        <td style="background: linear-gradient(90deg, #10b981, #059669); padding: 12px 40px; text-align:center;">
          <p style="margin:0; color:#fff; font-size:13px; font-weight:700; letter-spacing:1px; text-transform:uppercase;">&#10003; &nbsp; Pago confirmado &nbsp;&bull;&nbsp; {payment_method_label}</p>
        </td>
      </tr>

      <!-- CUSTOMER BLOCK -->
      <tr>
        <td style="padding: 28px 40px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc; border-radius:10px; padding:16px 20px; border:1px solid #e2e8f0;">
            <tr>
              <td style="font-size:11px; color:#94a3b8; font-weight:700; text-transform:uppercase; letter-spacing:1px; padding-bottom:4px;">Cliente</td>
            </tr>
            <tr>
              <td style="font-size:16px; color:#0f172a; font-weight:700;">{customer_name}</td>
            </tr>
            {email_row}
            {doc_row}
          </table>
        </td>
      </tr>

      <!-- PRODUCTS TABLE -->
      <tr>
        <td style="padding: 24px 40px 0;">
          <p style="margin:0 0 12px; font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:1px;">Detalle del pedido</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <th style="text-align:left; font-size:11px; color:#94a3b8; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; padding-bottom:8px; border-bottom:2px solid #e2e8f0;">Producto</th>
              <th style="text-align:right; font-size:11px; color:#94a3b8; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; padding-bottom:8px; border-bottom:2px solid #e2e8f0; white-space:nowrap;">Total</th>
            </tr>
            {product_rows_html}
          </table>
        </td>
      </tr>

      <!-- TOTALS -->
      <tr>
        <td style="padding: 20px 40px 0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:13px; color:#64748b; padding: 6px 0; border-top:1px solid #e2e8f0;">Subtotal</td>
              <td style="text-align:right; font-size:13px; color:#334155; font-weight:600; padding:6px 0; border-top:1px solid #e2e8f0;">{fmt(sale.subtotal)}</td>
            </tr>
            <tr>
              <td style="font-size:13px; color:#64748b; padding: 6px 0;">IVA</td>
              <td style="text-align:right; font-size:13px; color:#334155; font-weight:600; padding:6px 0;">{fmt(sale.tax)}</td>
            </tr>
            {promo_html}
            <tr>
              <td style="font-size:18px; font-weight:800; color:#0f172a; padding: 14px 0 8px; border-top:2px solid #e2e8f0;">TOTAL PAGADO</td>
              <td style="text-align:right; font-size:22px; font-weight:900; color:#10b981; padding:14px 0 8px; border-top:2px solid #e2e8f0;">{fmt(sale.total)}</td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- THANK YOU -->
      <tr>
        <td style="padding: 28px 40px;">
          <div style="background: linear-gradient(135deg, #eff6ff, #dbeafe); border-radius:10px; padding:18px 22px; border-left: 4px solid #3b82f6;">
            <p style="margin:0; font-size:14px; color:#1e40af; font-weight:700;">&#127881; &#161;Gracias por tu compra!</p>
            <p style="margin:6px 0 0; font-size:13px; color:#3b82f6; line-height:1.5;">Conserva este correo como comprobante de tu transacci&#243;n. Si tienes alguna duda, cont&#225;ctanos directamente.</p>
          </div>
        </td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td style="background:#0f172a; padding:24px 40px; text-align:center; border-radius: 0 0 16px 16px;">
          <p style="margin:0; color:#ffffff; font-size:14px; font-weight:700;">{business_name}</p>
          {address_row}
          {phone_row}
          {nit_row}
          <p style="margin:12px 0 0; color:#475569; font-size:11px;">Este correo fue generado autom&#225;ticamente por AGS SALES ERP. Por favor no respondas a este mensaje.</p>
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
