# Yango MKT Venezuela — Clean Rebuild

Este repo fue reseteado para reconstruir el panel desde cero.

## Backups antes del reset

- Google Sheet backup real: https://docs.google.com/spreadsheets/d/1gsYFnJHOjZVfGDN014Zj51jNL17YjI0wpUXvgCpDUxU/edit?usp=drivesdk
- JSON raw backup: https://drive.google.com/file/d/1Ck_JaMAKQVbGoKFwvZD6Ku0WEfqJDMjx/view?usp=drivesdk

## Estado actual

Base mínima desplegable en Railway:

- `index.html`: pantalla limpia de inicio
- `server.js`: servidor Node sin dependencias externas
- `package.json`: start script
- `railway.json`: config de Railway

La reconstrucción se hará por secciones y conectando la data a una fuente única estable.
