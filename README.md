# Yango MKT Venezuela — Rebuild limpio

Este repo fue reseteado y reconstruido desde cero. La primera versión nueva es **Social Media v1**.

## Qué incluye ahora

- Login simple:
  - Admin: `admin` / `Yango2026!`
  - Giselle: `giselle` / `Giselle2026!`
- Admin de usuarios.
- Social Media → Influencers.
- Social Media → Reporte Social Media.
- Sync central vía Google Apps Script + Google Sheets.
- Railway solo aloja el panel; la data vive en Google Sheets.

## Backups antes del reset

- Google Sheet backup real: https://docs.google.com/spreadsheets/d/1gsYFnJHOjZVfGDN014Zj51jNL17YjI0wpUXvgCpDUxU/edit?usp=drivesdk
- JSON raw backup: https://drive.google.com/file/d/1Ck_JaMAKQVbGoKFwvZD6Ku0WEfqJDMjx/view?usp=drivesdk

## Apps Script

El backend de sync está en:

`apps-script/yango-mkt-social-sync.gs`

Ese script crea y usa estas pestañas en el Google Sheet:

- `SM_Users`
- `SM_Influencers`
- `SM_Report`
- `SM_ChangeLog`

## Railway

El servidor usa este deployment actual de Apps Script:

`https://script.google.com/macros/s/AKfycbzchhkH8NIMRwY5H117U3cXzzYF04yhiqu87HpHBckeFqVhrtISH9ltlLYHaFYb_bge7g/exec`

## Prueba mínima antes de seguir

1. Entrar como Admin.
2. Crear un influencer.
3. Verificar que aparece en `SM_Influencers`.
4. Entrar como Giselle.
5. Editar o borrar ese influencer.
6. Verificar que Admin ve el cambio después del auto-refresh.

No agregar BTL/POP/Branding/Media hasta que esta prueba funcione perfecto.
