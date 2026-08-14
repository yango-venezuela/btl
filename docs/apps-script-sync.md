# Yango MKT - Sync con Google Apps Script

Este setup hace que cada guardado del panel en Railway/Postgres también se copie a un Google Sheet como respaldo/auditoría.

## 1. Crear el Google Sheet

Crea un Google Sheet, por ejemplo: `Yango MKT - Backup`.

## 2. Crear el Apps Script

En el Google Sheet:

1. Ve a `Extensions` > `Apps Script`.
2. Borra el contenido del archivo inicial.
3. Pega completo el contenido de `apps-script/yango-mkt-sync.gs` de este repo.
4. Guarda el proyecto.
5. Ejecuta `setup()` una vez para crear las pestañas.

## 3. Opcional: clave secreta

En Apps Script, ve a `Project Settings` > `Script properties` y agrega:

- `MKT_SYNC_SECRET`: una clave compartida.

Si usas esta clave, debes poner el mismo valor en Railway como `APPS_SCRIPT_SYNC_SECRET`.

## 4. Deploy como Web App

En Apps Script:

1. `Deploy` > `New deployment`.
2. Tipo: `Web app`.
3. `Execute as`: `Me`.
4. `Who has access`: `Anyone with the link` (o el dominio si aplica y funciona para Railway).
5. Deploy.
6. Copia el `Web app URL`.

## 5. Pegar URL en Railway

En Railway, servicio `btl` > `Variables`, agrega:

- `APPS_SCRIPT_WEBHOOK_URL`: el Web app URL copiado.
- `APPS_SCRIPT_SYNC_SECRET`: opcional, solo si agregaste `MKT_SYNC_SECRET` en Apps Script.

Railway redeploya automáticamente al cambiar variables.

## 6. Probar

Abre:

- `/api/apps-script-sync/status`

Debe devolver `configured: true`.

Luego haz un cambio pequeño en el panel. En Google Sheets debe actualizarse la pestaña correspondiente y agregarse una fila en `Raw Events`.

## 7. Backfill de data existente

Cuando ya esté configurado, se puede ejecutar un backfill técnico con:

```bash
curl -X POST https://btl-production-4f1e.up.railway.app/api/apps-script-sync/backfill
```

Eso manda al Sheet todo lo que ya exista en Postgres.
