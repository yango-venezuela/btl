# Yango MKT Venezuela

Dashboard de marketing para BTL, Social Media, Influencers, Branding, Material POP y Media OOH.

## Deploy recomendado: GitHub + Railway

GitHub guarda el código. Railway corre la app y guarda la data compartida en PostgreSQL.

### Railway setup

1. En Railway, crear un nuevo proyecto desde este repo de GitHub.
2. Agregar un servicio de PostgreSQL al proyecto.
3. Conectar la variable `DATABASE_URL` del PostgreSQL al servicio web.
4. Railway detecta `package.json` y corre:

```bash
npm start
```

5. La app crea automáticamente la tabla `app_state` al iniciar.

### Cómo funciona la data

- En GitHub Pages, el dashboard sigue funcionando con `localStorage` como fallback.
- En Railway, el dashboard lee/escribe en `/api/state`, que guarda todo en PostgreSQL.
- Luis, Giselle y cualquier usuario creado desde “Usuarios” editan la misma data central.
- El Master lee esa misma base de datos y se actualiza automáticamente.

### Endpoints

- `GET /api/health`: verifica app y conexión a base de datos.
- `GET /api/state`: obtiene el estado compartido.
- `PUT /api/state/:key`: guarda una sección del dashboard.
