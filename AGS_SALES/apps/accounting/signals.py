from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db import transaction
from .models import CashShift, CashMovement
from core.mail import send_system_notification
from apps.users.models import SystemSetting

def get_business_info():
    settings = {s.key: s.value for s in SystemSetting.objects.all()}
    business_name = settings.get('business_name', 'AGS SALES')
    
    logo_url = settings.get('app_logo', '') or settings.get('ticket_logo', '')
            
    logo_html = f'<img src="{logo_url}" alt="{business_name}" style="max-height: 60px; margin-bottom: 10px;" />' if logo_url else ''
    return business_name, logo_html

def format_money(val):
    try:
        return f"{int(float(val)):,}".replace(',', '.')
    except:
        return "0"
@receiver(post_save, sender=CashShift)
def cash_shift_notification(sender, instance, created, **kwargs):
    if created:
        def send_apertura():
            business_name, logo_html = get_business_info()
            subject = f"Apertura de Caja: {instance.cash_register.name}"
            html = f"""
            <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; padding: 40px 20px; margin: 0;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                    <div style="background: linear-gradient(135deg, #10b981 0%, #047857 100%); padding: 30px; text-align: center;">
                        {logo_html}
                        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Apertura de Caja</h1>
                        <p style="color: #a7f3d0; margin: 8px 0 0 0; font-size: 14px;">{instance.cash_register.name}</p>
                    </div>
                    
                    <div style="padding: 40px 30px;">
                        <div style="background-color: #f8fafc; border-radius: 8px; padding: 25px; margin-bottom: 25px;">
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 10px 0; color: #6b7280; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0;">Usuario:</td>
                                    <td style="padding: 10px 0; text-align: right; color: #1f2937; font-weight: 600; font-size: 15px; border-bottom: 1px solid #e2e8f0;">{instance.user.username}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 15px 0 10px 0; color: #6b7280; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Saldo Inicial:</td>
                                    <td style="padding: 15px 0 10px 0; text-align: right; color: #10b981; font-weight: 800; font-size: 20px;">${format_money(instance.initial_balance)}</td>
                                </tr>
                            </table>
                        </div>
                        
                        <div style="text-align: center; color: #9ca3af; font-size: 12px;">
                            Registrado el {instance.opened_at.strftime('%Y-%m-%d a las %H:%M:%S') if instance.opened_at else 'N/A'}<br/>
                            {business_name} - Software Automático
                        </div>
                    </div>
                </div>
            </div>
            """
            send_system_notification(subject, html)
        transaction.on_commit(send_apertura)

    elif not instance.is_open:
        def send_cierre():
            business_name, logo_html = get_business_info()
            subject = f"Corte de Caja: {instance.cash_register.name}"
            html = f"""
            <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; padding: 40px 20px; margin: 0;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                    <div style="background: linear-gradient(135deg, #f59e0b 0%, #b45309 100%); padding: 30px; text-align: center;">
                        {logo_html}
                        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Corte de Caja (Cierre)</h1>
                        <p style="color: #fde68a; margin: 8px 0 0 0; font-size: 14px;">{instance.cash_register.name}</p>
                    </div>
                    
                    <div style="padding: 40px 30px;">
                        <div style="background-color: #f8fafc; border-radius: 8px; padding: 25px; margin-bottom: 25px;">
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 10px 0; color: #6b7280; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0;">Usuario que cierra:</td>
                                    <td style="padding: 10px 0; text-align: right; color: #1f2937; font-weight: 600; font-size: 15px; border-bottom: 1px solid #e2e8f0;">{instance.user.username}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 15px 0 10px 0; color: #6b7280; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Saldo Final Declarado:</td>
                                    <td style="padding: 15px 0 10px 0; text-align: right; color: #f59e0b; font-weight: 800; font-size: 20px;">${format_money(instance.final_balance)}</td>
                                </tr>
                            </table>
                        </div>
                        
                        <div style="text-align: center; color: #9ca3af; font-size: 12px;">
                            Cierre registrado el {instance.closed_at.strftime('%Y-%m-%d a las %H:%M:%S') if instance.closed_at else 'N/A'}<br/>
                            {business_name} - Software Automático
                        </div>
                    </div>
                </div>
            </div>
            """
            send_system_notification(subject, html)
        transaction.on_commit(send_cierre)

@receiver(post_save, sender=CashMovement)
def cash_movement_notification(sender, instance, created, **kwargs):
    if created:
        def send_movimiento():
            business_name, logo_html = get_business_info()
            tipo = "Ingreso" if instance.type == 'IN' else "Egreso"
            subject = f"Nuevo Movimiento de Caja ({tipo})"
            color_header = "#3b82f6 0%, #1d4ed8 100%" if tipo == "Ingreso" else "#ef4444 0%, #b91c1c 100%"
            color_text = "#3b82f6" if tipo == "Ingreso" else "#ef4444"
            
            html = f"""
            <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; padding: 40px 20px; margin: 0;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                    <div style="background: linear-gradient(135deg, {color_header}); padding: 30px; text-align: center;">
                        {logo_html}
                        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Nuevo {tipo}</h1>
                        <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0 0; font-size: 14px;">{instance.shift.cash_register.name}</p>
                    </div>
                    
                    <div style="padding: 40px 30px;">
                        <div style="background-color: #f8fafc; border-radius: 8px; padding: 25px; margin-bottom: 25px; border-left: 4px solid {color_text};">
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 10px 0; color: #6b7280; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0;">Descripción:</td>
                                    <td style="padding: 10px 0; text-align: right; color: #1f2937; font-weight: 500; font-size: 14px; border-bottom: 1px solid #e2e8f0;">{instance.description}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 15px 0 10px 0; color: #6b7280; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Monto:</td>
                                    <td style="padding: 15px 0 10px 0; text-align: right; color: {color_text}; font-weight: 800; font-size: 20px;">${format_money(instance.amount)}</td>
                                </tr>
                            </table>
                        </div>
                        
                        <div style="text-align: center; color: #9ca3af; font-size: 12px;">
                            Movimiento realizado el {instance.created_at.strftime('%Y-%m-%d a las %H:%M:%S') if instance.created_at else 'N/A'}<br/>
                            {business_name} - Software Automático
                        </div>
                    </div>
                </div>
            </div>
            """
            send_system_notification(subject, html)
        transaction.on_commit(send_movimiento)
