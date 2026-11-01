#!/usr/bin/env python3
"""Kit puente · Copia una base de Access (.mdb/.accdb) y la convierte a SQLite para leerla en solo lectura.

Para programas que guardan los datos en Access (p. ej. Factusol en local). Nunca se conecta
nada al fichero vivo: primero se COPIA y se trabaja sobre la copia, fuera de horario.

Requisitos (Windows): Python 3.11+, `pip install pyodbc` y el controlador
"Microsoft Access Driver (*.mdb, *.accdb)" (Access Database Engine) de la misma
arquitectura que Python (64 bits con 64 bits).

Después, sirve el .sqlite con DBHub (ver ../dbhub/dbhub.toml.ejemplo, fuente sqlite).

Ejemplos:
  python access_a_sqlite.py --origen "D:\\Programa\\Datos\\EMPRESA.accdb" --destino C:\\KitPuente\\empresa.sqlite
  python access_a_sqlite.py --origen ... --destino ... --tablas F_FAC,F_LFA,F_CLI
"""
import argparse
import datetime
import decimal
import shutil
import sqlite3
import sys
import tempfile
from pathlib import Path


def convertir(valor):
    if isinstance(valor, decimal.Decimal):
        return float(valor)
    if isinstance(valor, (datetime.date, datetime.datetime, datetime.time)):
        return valor.isoformat()
    if isinstance(valor, (bytes, bytearray, memoryview)):
        return None  # adjuntos o binarios: no se copian
    return valor


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--origen", required=True, type=Path, help="Fichero .mdb o .accdb del programa")
    parser.add_argument("--destino", required=True, type=Path, help="Fichero .sqlite que se genera (se sustituye)")
    parser.add_argument("--tablas", default="", help="Lista de tablas separadas por comas (por defecto, todas)")
    options = parser.parse_args()

    try:
        import pyodbc
    except ImportError:
        sys.exit("ERROR: falta pyodbc (pip install pyodbc) y el controlador de Access")

    if not options.origen.exists():
        sys.exit(f"ERROR: no existe {options.origen}")
    permitidas = {t.strip().lower() for t in options.tablas.split(",") if t.strip()}

    with tempfile.TemporaryDirectory() as carpeta:
        copia = Path(carpeta) / options.origen.name
        shutil.copy2(options.origen, copia)  # trabajamos SIEMPRE sobre una copia
        origen = pyodbc.connect(rf"DRIVER={{Microsoft Access Driver (*.mdb, *.accdb)}};DBQ={copia};")
        cursor = origen.cursor()
        tablas = [t.table_name for t in cursor.tables(tableType="TABLE")]
        if permitidas:
            tablas = [t for t in tablas if t.lower() in permitidas]

        temporal = options.destino.with_suffix(".tmp.sqlite")
        temporal.unlink(missing_ok=True)
        destino = sqlite3.connect(temporal)
        for tabla in tablas:
            columnas = [c.column_name for c in cursor.columns(table=tabla)]
            lista = ", ".join(f'"{c}"' for c in columnas)
            destino.execute(f'CREATE TABLE "{tabla}" ({lista})')
            filas = 0
            for fila in cursor.execute(f"SELECT * FROM [{tabla}]"):
                destino.execute(f'INSERT INTO "{tabla}" VALUES ({", ".join("?" * len(columnas))})', [convertir(v) for v in fila])
                filas += 1
            print(f"  {tabla}: {filas} filas")
        destino.commit()
        destino.close()
        origen.close()
        temporal.replace(options.destino)  # sustitución atómica: el lector nunca ve un fichero a medias
    print(f"OK — {len(tablas)} tablas en {options.destino}")


if __name__ == "__main__":
    main()
