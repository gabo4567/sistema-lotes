# 🔧 Configuración de Firebase para Desarrollo Local

## Problema
Firebase bloquea solicitudes desde `localhost` porque no está configurado como dominio autorizado.

## Solución

### Paso 1: Configurar Authorized Domains en Firebase Authentication

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto: `sistema-lotes-4ce37`
3. En el menú lateral, ve a **Authentication**
4. Haz clic en la pestaña **Settings** (⚙️)
5. Desplázate hacia abajo hasta **Authorized Domains**
6. Haz clic en **Add domain**
7. Ingresa: `localhost`
8. Haz clic en **Add**

### Paso 2: Configurar HTTP Referrers en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Selecciona tu proyecto: `sistema-lotes-4ce37`
3. En el menú lateral, ve a **APIs & Services** > **Credentials**
4. Busca la API Key que usa Firebase (generalmente termina en `...AIzaSy...`)
5. Haz clic en el nombre de la API Key
6. En **Application restrictions**, selecciona **HTTP referrers (web sites)**
7. En **Website restrictions**, agrega:
   - `localhost`
   - `http://localhost`
   - `http://localhost:*` (para permitir cualquier puerto)
8. Haz clic en **Save**

### Paso 3: Verificar configuración

Después de hacer estos cambios:

1. Reinicia tu servidor de desarrollo: `npm run dev` en `web-app`
2. Recarga la página: `http://localhost:5174`
3. El error de Firebase debería desaparecer

### Notas importantes

- Los cambios pueden tardar hasta 5 minutos en propagarse
- Para producción, ya tienes configurado `sistema-lotes.vercel.app`
- No modifiques las configuraciones de producción

### Si el problema persiste

Si después de seguir estos pasos aún tienes problemas:

1. Verifica en la consola del navegador (F12) que no hay otros errores
2. Revisa que las variables de entorno en `web-app/.env` estén correctas
3. Asegúrate de que el backend esté corriendo en `http://localhost:3000`</content>
<parameter name="filePath">c:\Users\gabri\Documents\Proyectos\sistema-lotes\docs\configuracion-firebase-local.md