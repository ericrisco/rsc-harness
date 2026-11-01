# Kit puente: leer un programa de escritorio en solo lectura

Para que un agente de IA **lea** los datos de un programa instalado en la oficina (Sage 50 o 200, Contasol en local, ICG, Prevengos, CONTPAQi, a3ERP…) **sin poder escribir**, **sin abrir puertos** y **sin perder el soporte** del fabricante.

- Explicación para el dueño: [Mi programa no tiene API](https://executive-lab.github.io/conectores-pymes/guias/mi-programa-no-tiene-api.html).
- Explicación técnica: [Kit puente, parte técnica](https://executive-lab.github.io/conectores-pymes/guias/kit-puente-tecnico.html).
- Para **escribir** (asientos, facturas) no se usa el puente: se usa el [fichero de importación oficial](https://executive-lab.github.io/conectores-pymes/guias/escribir-en-contabilidad-por-importacion.html), que importa una persona.

> Plantillas genéricas. Los nombres de tablas y columnas de cada programa **no** están aquí: dependen de la versión y hay que confirmarlos con el distribuidor. Prueba todo primero en una copia.

## Qué hay

| Carpeta | Para qué |
|---------|----------|
| `sqlserver/01-login-servidor.sql` | Login `ia_lectura` (una vez, nivel servidor) |
| `sqlserver/02-usuario-y-vistas.sql` | Usuario, esquema `ia`, permisos de solo lectura y vistas de plantilla (idempotente) |
| `sqlserver/03-prueba-solo-lectura.sql` | Prueba de aceptación: lee las vistas, **no** lee tablas, **no** borra, **no** modifica, **no** crea |
| `sqlserver/copia-nocturna.ps1` | Backup `COPY_ONLY` → restauración en `ERP_IA` → vuelve a crear usuario y vistas → pasa la prueba |
| `access/access_a_sqlite.py` | Para programas en Access: copia el fichero y lo convierte a SQLite |
| `dbhub/dbhub.toml.ejemplo` | MCP de solo lectura con herramientas de SQL predefinido |
| `red/tailscale-grants.hujson` | Si el agente es Claude Code en el portátil |
| `red/cloudflared-config.yml.ejemplo` | Si el agente es un conector de claude.ai, Cowork o n8n en la nube |
| `01-TOOLS-plantilla/` | Carpeta para el arnés (`.env.example` y `test_connection.sh`) |

## Pasos

1. **Permiso por escrito** del distribuidor para crear un login y vistas, o para leer la copia.
2. **SQL Server:** ejecuta `01-login-servidor.sql` una vez. Ajusta las vistas de `02-usuario-y-vistas.sql` a tu programa.
3. **Copia nocturna** (recomendada): programa `copia-nocturna.ps1` en el Programador de tareas de Windows, fuera de horario, con una cuenta administradora de SQL Server:
   ```powershell
   $accion = New-ScheduledTaskAction -Execute "powershell.exe" -Argument '-ExecutionPolicy Bypass -File C:\KitPuente\sqlserver\copia-nocturna.ps1 -Origen "<BD_DEL_PROGRAMA>"'
   $cuando = New-ScheduledTaskTrigger -Daily -At 2am
   Register-ScheduledTask -TaskName "KitPuente copia nocturna" -Action $accion -Trigger $cuando -RunLevel Highest
   ```
   Sin copia (leyendo producción): ejecuta `02` y `03` directamente sobre la base del programa, si el distribuidor lo autoriza.
4. **Access:** `python access_a_sqlite.py --origen <fichero> --destino C:\KitPuente\empresa.sqlite`, programado igual.
5. **Prueba de aceptación:** `03-prueba-solo-lectura.sql` tiene que terminar en `RESULTADO: OK`. Si no, **no se conecta el agente**.
6. **DBHub** en el servidor, con `dbhub.toml` protegido. Fija la versión de npm. DBHub escucha en `0.0.0.0` por defecto: indica **siempre** `--host`.
7. **Red:** Tailscale (agente local) o Cloudflare Tunnel + Access (conectores de claude.ai o nube). **Nunca** abras el 1433 ni el 8080 en el router.
8. **Arnés:** copia `01-TOOLS-plantilla/` a `01-TOOLS/<PROGRAMA>/`, rellena `.env` y ejecuta `./test_connection.sh`. Añade el MCP a `.mcp.json`.

## Lo que el kit no hace

- No escribe en el programa: para eso está el fichero de importación.
- No incluye esquemas de tablas de programas comerciales.
- No sustituye al soporte del fabricante: si el programa se actualiza y cambia sus tablas, hay que revisar las vistas. La prueba 03 y el `test_connection` lo detectan.

Alternativa de pago si no quieres mantener el puente: una API unificada como Chift, que cubre Sage 200 ES y a3ERP con agente local, además de Contasol Nube, Ágora y Revo (ver la guía técnica).
