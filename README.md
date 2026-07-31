# 🚀 Guía de Inicio - AGS SALES ERP

Este documento contiene las instrucciones exactas para encender todo el sistema todos los días. Para que la aplicación de PC, la aplicación Móvil y el Catálogo Digital funcionen correctamente y se sincronicen, debes seguir estos **dos pasos** en tu computadora principal (el servidor).

---

## PASO 1: Encender el Cerebro (Backend)

Este es el motor de tu sistema. Debe estar siempre encendido mientras estés operando el negocio.

1. Abre una ventana de **PowerShell** o **Símbolo del Sistema (CMD)**.
2. Navega a la carpeta del proyecto (si no estás ahí ya):
   ```cmd
   cd "C:\Users\USUARIO\Documents\trabajos sena\AGS SALES\AGS_SALES"
   ```
3. Activa el entorno virtual:
   ```cmd
   .\venv\Scripts\activate
   ```
4. Enciende el servidor:
   ```cmd
   python manage.py runserver 0.0.0.0:8000
   ```
> ✅ **Listo:** Verás unas letras y dirá que el servidor está corriendo. **NO CIERRES ESTA VENTANA.**

---

## PASO 2: Encender la Antena (Túnel de Cloudflare)

Esto es lo que permite que el sistema salga a internet de forma segura. Sin esto, el celular no se conectará y el catálogo público no funcionará.

1. Abre **OTRA** ventana nueva de PowerShell o CMD.
2. Ejecuta el archivo de Cloudflare apuntando al servidor que encendiste en el Paso 1:
   ```cmd
   C:\Users\USUARIO\Downloads\cloudflared-windows-amd64.exe tunnel --url http://localhost:8000
   ```
3. **Copia el enlace** que te genera (se ve algo así como `https://palabra-rara-aleatoria.trycloudflare.com`).

> ✅ **Listo:** **NO CIERRES ESTA VENTANA TAMPOCO.** Tu PC ahora está transmitiendo a internet de forma segura.

---

## PASO 3: Conectar el Sistema

1. **En la PC:** Abre tu programa **AGS SALES ERP** desde tu escritorio. Al iniciar sesión o en la configuración, pega el enlace de Cloudflare que copiaste en el Paso 2 (asegúrate de que tenga el `https://`).
2. **En el Celular:** Abre la aplicación, ve a la tuerca de configuración (si te lo pide) y pega el mismo enlace.
3. **El Catálogo Digital:** ¡Ya está funcionando! El código QR que generaste apuntará automáticamente a este enlace.

> ⚠️ **IMPORTANTE:** Como estás usando un túnel temporal gratuito, el enlace de Cloudflare cambiará cada vez que apagues y prendas la PC. Por eso siempre debes copiar el nuevo enlace generado y actualizarlo en la PC y en el celular al inicio del turno.
   