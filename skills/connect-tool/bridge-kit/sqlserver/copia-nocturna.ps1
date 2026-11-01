<#
  Kit puente · Copia nocturna de la base del programa a "ERP_IA" (SQL Server, Express incluido).

  Qué hace, en este orden:
    1. BACKUP ... WITH COPY_ONLY de la base de producción. COPY_ONLY no rompe la cadena
       de copias del programa.
    2. RESTORE en ERP_IA (la sobrescribe), moviendo los ficheros a la carpeta de datos.
    3. Vuelve a crear el usuario, el esquema "ia" y las vistas con 02-usuario-y-vistas.sql,
       porque la restauración los borra.
    4. Pasa la prueba de solo lectura (03-prueba-solo-lectura.sql) y deja un registro.

  SQL Server Express no tiene SQL Server Agent: se programa con el Programador de tareas
  de Windows (ver el README del kit). Se ejecuta con una cuenta de Windows que sea
  administradora de SQL Server, NUNCA con ia_lectura.

  Uso:
    powershell -ExecutionPolicy Bypass -File copia-nocturna.ps1 -Origen "<BD_DEL_PROGRAMA>"
#>
param(
    [Parameter(Mandatory = $true)][string]$Origen,
    [string]$Servidor = ".\SQLEXPRESS",
    [string]$Copia = "ERP_IA",
    [string]$CarpetaBackup = "C:\KitPuente\backups",
    [string]$CarpetaDatos = "C:\KitPuente\datos",
    [string]$CarpetaScripts = $PSScriptRoot,
    [int]$DiasRetencion = 3
)
$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $CarpetaBackup, $CarpetaDatos | Out-Null
$registro = Join-Path $CarpetaBackup "copia-nocturna.log"
function Log($texto) { "$(Get-Date -Format s)  $texto" | Tee-Object -FilePath $registro -Append }

$bak = Join-Path $CarpetaBackup ("{0}-{1}.bak" -f $Origen, (Get-Date -Format yyyyMMdd))
Log "Backup de [$Origen] a $bak"
sqlcmd -S $Servidor -E -b -Q "BACKUP DATABASE [$Origen] TO DISK = N'$bak' WITH COPY_ONLY, INIT, CHECKSUM"
if ($LASTEXITCODE -ne 0) { Log "ERROR en el backup"; exit 1 }

# Nombres lógicos de los ficheros para el MOVE.
$lista = sqlcmd -S $Servidor -E -b -h -1 -W -s "|" -Q "SET NOCOUNT ON; RESTORE FILELISTONLY FROM DISK = N'$bak'"
$moves = @()
foreach ($linea in $lista) {
    $campos = $linea -split "\|"
    if ($campos.Count -lt 3) { continue }
    $logico = $campos[0].Trim(); $tipo = $campos[2].Trim()
    $ext = if ($tipo -eq "L") { "ldf" } else { "mdf" }
    $moves += "MOVE N'$logico' TO N'$(Join-Path $CarpetaDatos "$Copia-$logico.$ext")'"
}
if ($moves.Count -eq 0) { Log "ERROR: no se han leído los ficheros del backup"; exit 1 }

Log "Restaurando en [$Copia]"
$restore = "IF DB_ID(N'$Copia') IS NOT NULL ALTER DATABASE [$Copia] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; " +
           "RESTORE DATABASE [$Copia] FROM DISK = N'$bak' WITH REPLACE, RECOVERY, " + ($moves -join ", ") + "; " +
           "ALTER DATABASE [$Copia] SET MULTI_USER;"
sqlcmd -S $Servidor -E -b -Q $restore
if ($LASTEXITCODE -ne 0) { Log "ERROR en la restauración"; exit 1 }

Log "Usuario, esquema ia y vistas"
sqlcmd -S $Servidor -E -b -d $Copia -i (Join-Path $CarpetaScripts "02-usuario-y-vistas.sql")
if ($LASTEXITCODE -ne 0) { Log "ERROR al crear usuario o vistas"; exit 1 }

Log "Prueba de solo lectura"
$prueba = sqlcmd -S $Servidor -E -b -d $Copia -i (Join-Path $CarpetaScripts "03-prueba-solo-lectura.sql")
$prueba | ForEach-Object { Log $_ }
if (-not ($prueba -match "RESULTADO: OK")) { Log "ERROR: la prueba de solo lectura no ha dado OK"; exit 1 }

Get-ChildItem $CarpetaBackup -Filter "$Origen-*.bak" |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$DiasRetencion) } | Remove-Item -Force
Log "OK — copia lista en [$Copia]"
