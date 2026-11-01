/*
  Kit puente · 01 · Login de solo lectura (nivel de SERVIDOR). Se ejecuta UNA vez.

  Quién: el informático, con un usuario administrador de SQL Server.
  Antes: confirma con el distribuidor del programa (Sage, ICG, Prevengos, CONTPAQi,
  Wolters Kluwer…) que crear un login y vistas no afecta al soporte. Pídelo por escrito.

  Requisito: el servidor debe admitir autenticación de SQL Server (modo mixto).
  Si solo admite Windows, usa una cuenta de Windows dedicada en lugar de este login.

  La contraseña NO se guarda en ningún repositorio: genérala larga y aleatoria y
  guárdala solo en el dbhub.toml protegido del servidor (ver ../dbhub/).
*/
USE [master];
GO

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'ia_lectura')
    CREATE LOGIN [ia_lectura]
        WITH PASSWORD = N'<<PON AQUÍ UNA CONTRASEÑA LARGA Y ALEATORIA>>',
             CHECK_POLICY = ON,
             DEFAULT_DATABASE = [master];
GO

-- Nada de roles de servidor: ia_lectura NO es sysadmin, ni securityadmin, ni nada más.
-- Los permisos se dan en la base de datos con 02-usuario-y-vistas.sql.
