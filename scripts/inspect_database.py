from pathlib import Path

import duckdb


DB_PATH = Path("data/malecns/malecns.duckdb")


def main():

    con = duckdb.connect(
        str(DB_PATH),
        read_only=True,
    )

    tables = con.execute(
        "SHOW TABLES"
    ).fetchall()

    print("=" * 70)
    print("MaleCNS database")
    print("=" * 70)

    for (table,) in tables:

        print("\n" + "=" * 70)
        print(f"TABLE: {table}")
        print("=" * 70)

        columns = con.execute(
            f"DESCRIBE {table}"
        ).fetchdf()

        print(
            columns[
                ["column_name", "column_type"]
            ].to_string(index=False)
        )

        count = con.execute(
            f"SELECT COUNT(*) FROM {table}"
        ).fetchone()[0]

        print(f"\nRows: {count:,}")

    con.close()


if __name__ == "__main__":
    main()