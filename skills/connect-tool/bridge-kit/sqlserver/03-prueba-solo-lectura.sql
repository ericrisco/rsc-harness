/*
  Kit puente · 03 · Prueba de aceptación: ia_lectura LEE y NO ESCRIBE.

  Sin esta prueba el puente no se entrega. Se ejecuta como administrador; el script
  se hace pasar por ia_lectura (EXECUTE AS) y cada intento va dentro de su propia
  transacción, que se deshace enseguida, así que no cambia nada aunque algo fallara.
  Con sqlcmd -b, sale con 0 si todo está bien y con error si hay que revisar.

  Rellena las tres variables de abajo con una vista del esquema ia y con una tabla y
  una columna REALES del programa. Si un nombre no existe, la prueba lo dice y se para.

  Cada orden prohibida solo cuenta como superada si se cumplen las dos cosas:
    1. SQL Server dice que ia_lectura no tiene ese permiso (HAS_PERMS_BY_NAME), y
    2. al intentarla, falla con un error de permiso: 229 (SELECT, INSERT, DELETE, UPDATE)
       o 262 (CREATE TABLE). Si la base está en solo lectura, SQL Server responde 3906 antes
       de mirar el permiso de CREATE TABLE; ahí vale con lo que diga HAS_PERMS_BY_NAME.
  Cualquier otro error (objeto inexistente, base de datos en solo lectura, columna que no
  se puede tocar…) no demuestra nada y cuenta como fallo.
  INSERT, DELETE y UPDATE no llegan a tocar ninguna fila que quede: TOP (0), o una fila
  que la transacción deshace. El UPDATE asigna NULL para no necesitar permiso de lectura.
*/
USE [ERP_IA];
GO

SET NOCOUNT ON;
SET XACT_ABORT OFF;

DECLARE @vista   sysname = N'ventas_por_dia';            -- una vista del esquema ia
DECLARE @tabla   sysname = N'<tabla_facturas_emitidas>'; -- una tabla real del programa (esquema dbo)
DECLARE @columna sysname = N'<columna_fecha>';           -- una columna de esa tabla, ni calculada ni IDENTITY

DECLARE @v nvarchar(300) = N'[ia].' + QUOTENAME(@vista);
DECLARE @t nvarchar(300) = N'[dbo].' + QUOTENAME(@tabla);
DECLARE @fallos int = 0;

-- 0. Como administrador, antes de hacerse pasar por ia_lectura: que todo exista.
IF DATABASE_PRINCIPAL_ID(N'ia_lectura') IS NULL
BEGIN
    SET @fallos += 1; PRINT N'FALLO · no existe el usuario ia_lectura en esta base: ejecuta antes 02-usuario-y-vistas.sql';
END;
IF OBJECT_ID(@v, N'V') IS NULL
BEGIN
    SET @fallos += 1; PRINT N'FALLO · no existe la vista ' + @v + N': revisa @vista o ejecuta antes 02-usuario-y-vistas.sql';
END;
IF OBJECT_ID(@t, N'U') IS NULL
BEGIN
    SET @fallos += 1; PRINT N'FALLO · no existe la tabla ' + @t + N': pon en @tabla una tabla real del programa';
END
ELSE IF COL_LENGTH(@t, @columna) IS NULL
BEGIN
    SET @fallos += 1; PRINT N'FALLO · la tabla ' + @t + N' no tiene la columna ' + QUOTENAME(@columna) + N': pon en @columna una real';
END
ELSE IF COLUMNPROPERTY(OBJECT_ID(@t), @columna, 'IsComputed') = 1
     OR COLUMNPROPERTY(OBJECT_ID(@t), @columna, 'IsIdentity') = 1
BEGIN
    SET @fallos += 1; PRINT N'FALLO · la columna ' + QUOTENAME(@columna) + N' es calculada o IDENTITY: elige otra';
END;

IF @fallos > 0
BEGIN
    PRINT N'RESULTADO: REVISAR — la prueba no ha llegado a ejecutarse. Corrige lo de arriba.';
    RAISERROR (N'Prueba de solo lectura: REVISAR', 16, 1);
    RETURN;
END;

-- Las órdenes que ia_lectura NO debe poder ejecutar, con el permiso y el error que se esperan.
DECLARE @pruebas TABLE (orden int, que nvarchar(60), permiso nvarchar(30), clase nvarchar(20),
                        objeto nvarchar(300), sentencia nvarchar(max), esperado int);
INSERT @pruebas VALUES
    (1, N'leer las tablas directamente', N'SELECT', N'OBJECT', @t,
        N'DECLARE @n int; SELECT TOP (1) @n = 1 FROM ' + @t + N';', 229),
    (2, N'insertar', N'INSERT', N'OBJECT', @t,
        N'INSERT INTO ' + @t + N' DEFAULT VALUES;', 229),
    (3, N'borrar', N'DELETE', N'OBJECT', @t,
        N'DELETE TOP (0) FROM ' + @t + N';', 229),
    (4, N'modificar', N'UPDATE', N'OBJECT', @t,
        N'UPDATE TOP (0) ' + @t + N' SET ' + QUOTENAME(@columna) + N' = NULL;', 229),
    (5, N'crear tablas', N'CREATE TABLE', N'DATABASE', DB_NAME(),
        N'CREATE TABLE [ia].[prueba_escritura] (x int);', 262);

DECLARE @que nvarchar(60), @permiso nvarchar(30), @clase nvarchar(20), @objeto nvarchar(300),
        @sql nvarchar(max), @esperado int, @tiene int, @err int, @msg nvarchar(4000),
        @i int = 1, @n int = (SELECT COUNT(*) FROM @pruebas);

EXECUTE AS USER = N'ia_lectura';

-- 1. Debe poder leer la vista.
BEGIN TRY
    SET @sql = N'DECLARE @n int; SELECT TOP (1) @n = 1 FROM ' + @v + N';';
    EXEC sys.sp_executesql @sql;
    PRINT N'OK    · puede leer ' + @v;
END TRY
BEGIN CATCH
    SET @fallos += 1; PRINT N'FALLO · no puede leer ' + @v + N': ' + ERROR_MESSAGE();
END CATCH;

-- 2. No debe poder hacer nada de lo demás. Cada intento va en su propia transacción, que se
--    deshace enseguida: algunos errores (el 262, por ejemplo) dejan la transacción inutilizable
--    y no deben arrastrar a los intentos siguientes. sp_executesql hace que cualquier error se
--    pueda capturar aquí, también el de un objeto inexistente.
WHILE @i <= @n
BEGIN
    SELECT @que = que, @permiso = permiso, @clase = clase, @objeto = objeto,
           @sql = sentencia, @esperado = esperado
    FROM @pruebas WHERE orden = @i;

    SET @tiene = ISNULL(HAS_PERMS_BY_NAME(@objeto, @clase, @permiso), 0);
    SET @err = 0; SET @msg = NULL;
    BEGIN TRANSACTION;
    BEGIN TRY
        EXEC sys.sp_executesql @sql;
    END TRY
    BEGIN CATCH
        SELECT @err = ERROR_NUMBER(), @msg = ERROR_MESSAGE();
    END CATCH;
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;

    IF @tiene = 0 AND (@err = @esperado
                       OR (@err = 3906 AND DATABASEPROPERTYEX(DB_NAME(), 'Updateability') = 'READ_ONLY'))
        PRINT N'OK    · no puede ' + @que;
    ELSE IF @tiene = 1 OR @err = 0
    BEGIN
        SET @fallos += 1; PRINT N'FALLO · puede ' + @que + N' (tiene el permiso ' + @permiso + N')';
    END
    ELSE
    BEGIN
        SET @fallos += 1;
        PRINT N'FALLO · al intentar ' + @que + N' falló por otro motivo, así que no demuestra nada: Msg '
            + CAST(@err AS nvarchar(10)) + N' · ' + @msg;
    END;
    SET @i += 1;
END;

REVERT;

IF @fallos = 0
    PRINT N'RESULTADO: OK — ia_lectura es de solo lectura.';
ELSE
BEGIN
    PRINT N'RESULTADO: REVISAR — hay ' + CAST(@fallos AS nvarchar(10)) + N' fallos. No conectes el agente.';
    RAISERROR (N'Prueba de solo lectura: REVISAR', 16, 1);
END;
GO
