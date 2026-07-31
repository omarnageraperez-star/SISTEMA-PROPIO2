import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from apps.users.models import SystemSetting
import threading

import re
import os
from email.mime.image import MIMEImage

def _send_email_async(subject, html_content, recipient=None):
    try:
        # Recuperar configuración desde SystemSetting
        settings = SystemSetting.objects.all()
        config = {s.key: s.value for s in settings}
        
        smtp_host = config.get('smtp_host')
        smtp_port = config.get('smtp_port')
        smtp_user = config.get('smtp_user')
        smtp_password = config.get('smtp_password')
        business_name = config.get('business_name', 'AGS SALES')

        if not smtp_host or not smtp_user or not smtp_password:
            print("Configuración SMTP incompleta. No se enviará el correo.")
            return False

        # Send to customer if provided, always CC the admin/business
        receiver = recipient if recipient else smtp_user
        
        msg = MIMEMultipart('related')
        msg['From'] = f"{business_name} <{smtp_user}>"
        msg['To'] = receiver
        if recipient and recipient != smtp_user:
            msg['Cc'] = smtp_user  # Copy the admin as well
        msg['Subject'] = f"[{business_name}] {subject}"
        
        # Procesar imágenes locales para incrustarlas como CID
        images = re.findall(r'src=["\']([^"\']+)["\']', html_content)
        cid_map = {}
        for idx, img_src in enumerate(images):
            if not img_src.startswith('http') and not img_src.startswith('cid:'):
                if os.path.exists(img_src):
                    cid = f'image{idx}@ags.local'
                    cid_map[img_src] = cid
                    
        # Reemplazar rutas en el HTML por sus respectivos cid
        for img_src, cid in cid_map.items():
            html_content = html_content.replace(f'src="{img_src}"', f'src="cid:{cid}"')
            html_content = html_content.replace(f"src='{img_src}'", f"src='cid:{cid}'")

        msg_alternative = MIMEMultipart('alternative')
        msg.attach(msg_alternative)
        msg_alternative.attach(MIMEText(html_content, 'html'))
        
        # Adjuntar las imágenes físicas
        for img_src, cid in cid_map.items():
            try:
                with open(img_src, 'rb') as f:
                    img_data = f.read()
                img = MIMEImage(img_data)
                img.add_header('Content-ID', f'<{cid}>')
                img.add_header('Content-Disposition', 'inline')
                msg.attach(img)
            except Exception as e:
                print(f"Error incrustando imagen {img_src}: {e}")
        
        server = smtplib.SMTP(smtp_host, int(smtp_port or 587))
        server.starttls()
        server.login(smtp_user, smtp_password)
        # Send to both customer and admin if customer email provided
        all_recipients = [receiver]
        if recipient and recipient != smtp_user:
            all_recipients.append(smtp_user)
        server.sendmail(smtp_user, all_recipients, msg.as_string())
        server.quit()
        
        return True
    except Exception as e:
        print(f"Error al enviar correo SMTP: {e}")
        return False

def send_system_notification(subject, html_content, recipient=None):
    """
    Envia un correo de notificación usando un hilo secundario para no bloquear el request.
    Si se provee recipient, el correo va al cliente. El admin recibe copia.
    """
    thread = threading.Thread(target=_send_email_async, args=(subject, html_content, recipient))
    thread.daemon = True
    thread.start()
