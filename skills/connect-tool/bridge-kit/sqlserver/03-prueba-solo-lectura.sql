/*
  Kit puente · 03 · Prueba de aceptación: ia_lectura LEE y NO ESCRIBE.

  Sin esta prueba el puente no se entrega. Se ejecuta como administrador; el script
  se hace pasar por ia_lectura (EXECUTE AS) y todo va dentro de una transacción
  que se deshace al final, así que no cambia nada aunque algo fallara.

  Sustituye <tabla_facturas_emitidas> por una tabla real del programa.
  DELETE/UPDATE con TOP (0) no tocan ninguna fila, pero SQL Server comprueba igualmente
  el permiso: si ia_lectura lo tuviera, la prueba lo detecta.
*/
USE [ERP_IA];
GO

BEGIN TRANSACTION;
EXECUTE AS USER = N'ia_lectura';

DECLARE @fallos int = 0;

BEGIN TRY
    SELECT TOP (1) * FROM [ia].[ventas_por_dia];
    PRINT N'OK    · puede leer las vistas del esquema ia';
END TRY
BEGIN CATCH
    SET @fallos += 1; PRINT N'FALLO · no puede leer ia.ventas_por_dia: ' + ERROR_MESSAGE();
END CATCH;

BEGIN TRY
    SELECT TOP (1) * FROM [dbo].[<tabla_facturas_emitidas>];
    SET @fallos += 1; PRINT N'FALLO · puede leer las tablas directamente (solo debería ver el esquema ia)';
END TRY
BEGIN CATCH
    PRINT N'OK    · no puede leer las tablas directamente';
END CATCH;

BEGIN TRY
    DELETE TOP (0) FROM [dbo].[<tabla_facturas_emitidas>];
    SET @fallos += 1; PRINT N'FALLO · tiene permiso de DELETE';
END TRY
BEGIN CATCH
    PRINT N'OK    · no puede borrar';
END CATCH;

BEGIN TRY
    UPDATE TOP (0) [dbo].[<tabla_facturas_emitidas>] SET <columna_fecha> = <columna_fecha>;
    SET @fallos += 1; PRINT N'FALLO · tiene permiso de UPDATE';
END TRY
BEGIN CATCH
    PRINT N'OK    · no puede modificar';
END CATCH;

BEGIN TRY
    EXEC (N'CREATE TABLE [ia].[prueba_escritura] (x int)');
    SET @fallos += 1; PRINT N'FALLO · puede crear tablas';
END TRY
BEGIN CATCH
    PRINT N'OK    · no puede crear tablas';
END CATCH;

REVERT;
ROLLBACK TRANSACTION;

IF @fallos = 0 PRINT N'RESULTADO: OK — ia_lectura es de solo lectura.';
ELSE PRINT N'RESULTADO: REVISAR — hay ' + CAST(@fallos AS nvarchar(10)) + N' fallos. No conectes el agente.';
GO
