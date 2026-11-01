/*
  Kit puente · 02 · Usuario, esquema "ia" y vistas (nivel de BASE DE DATOS).

  Se ejecuta en la base que lee el agente. Por defecto es la COPIA "ERP_IA".
  Es IDEMPOTENTE: copia-nocturna.ps1 lo vuelve a lanzar después de cada restauración,
  porque restaurar la copia borra el usuario, el esquema y las vistas.

  Las vistas son PLANTILLAS: los nombres de tablas y columnas dependen del programa
  y de su versión. Complétalos con el distribuidor o con la documentación del esquema.
  Regla: solo las columnas necesarias. Sin IBAN, sin datos de salud, sin nóminas.
*/
-- Cambia el nombre si no usas la copia:
USE [ERP_IA];
GO

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'ia')
    EXEC (N'CREATE SCHEMA [ia] AUTHORIZATION [dbo]');
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'ia_lectura')
    CREATE USER [ia_lectura] FOR LOGIN [ia_lectura] WITH DEFAULT_SCHEMA = [ia];
GO

-- Solo lectura sobre el esquema de vistas. Las vistas son de dbo (dueño del esquema),
-- así que la cadena de propiedad deja leer las tablas a través de ellas sin dar
-- permiso directo sobre las tablas.
GRANT SELECT ON SCHEMA::[ia] TO [ia_lectura];
ALTER ROLE [db_denydatawriter] ADD MEMBER [ia_lectura];
DENY CREATE TABLE TO [ia_lectura];
DENY CREATE VIEW TO [ia_lectura];
DENY CREATE PROCEDURE TO [ia_lectura];
DENY CREATE FUNCTION TO [ia_lectura];
GO

/* ----------------------------------------------------------------------------
   VISTAS (plantillas). Sustituye <…> por las tablas y columnas reales.
   Una vista por "pregunta de negocio". DBHub expone cada una como herramienta.
---------------------------------------------------------------------------- */

CREATE OR ALTER VIEW [ia].[ventas_por_dia] AS
SELECT
    CAST(f.<columna_fecha> AS date)       AS fecha,
    SUM(f.<columna_base_imponible>)       AS base_imponible,
    COUNT(*)                              AS facturas
FROM [dbo].[<tabla_facturas_emitidas>] AS f
GROUP BY CAST(f.<columna_fecha> AS date);
GO

CREATE OR ALTER VIEW [ia].[cobros_pendientes] AS
SELECT
    c.<columna_codigo_cliente>            AS cliente,
    c.<columna_nombre_cliente>            AS nombre,
    v.<columna_vencimiento>               AS vencimiento,
    v.<columna_importe_pendiente>         AS pendiente
FROM [dbo].[<tabla_vencimientos>] AS v
JOIN [dbo].[<tabla_clientes>]     AS c ON c.<columna_codigo_cliente> = v.<columna_codigo_cliente>
WHERE v.<columna_importe_pendiente> > 0;
GO

CREATE OR ALTER VIEW [ia].[stock_bajo_minimos] AS
SELECT
    a.<columna_codigo_articulo>           AS articulo,
    a.<columna_descripcion>               AS descripcion,
    s.<columna_stock>                     AS stock,
    a.<columna_stock_minimo>              AS minimo
FROM [dbo].[<tabla_articulos>] AS a
JOIN [dbo].[<tabla_stock>]     AS s ON s.<columna_codigo_articulo> = a.<columna_codigo_articulo>
WHERE s.<columna_stock> < a.<columna_stock_minimo>;
GO
