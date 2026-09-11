from pathlib import Path
import sys

import duckdb
import pyarrow.feather as feather

DATA_DIR = Path("data/malecns")
DB_PATH = DATA_DIR / "malecns.duckdb"

ANNOTATIONS = DATA_DIR / "body-annotations-male-cns-v1.0-minconf-0.5.feather"

NEUROTRANSMITTERS = DATA_DIR / "body-neurotransmitters-male-cns-v1.0.feather"

BODY_STATS = DATA_DIR / "body-stats-male-cns-v1.0-minconf-0.5.feather"

CONNECTIVITY = DATA_DIR / "connectome-weights-male-cns-v1.0-minconf-0.5.feather"

SKELETON_DIR = DATA_DIR / "skeletons-swc"


def connect(read_only=False):

    return duckdb.connect(
        str(DB_PATH),
        read_only=read_only,
    )


def import_feather(con, path, table_name):
    table = feather.read_table(path)

    con.register("_arrow_table", table)

    con.execute(f"""
        CREATE OR REPLACE TABLE {table_name} AS
        SELECT *
        FROM _arrow_table
        """)

    con.unregister("_arrow_table")

    return table.num_rows


def build():

    DATA_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    required_files = [
        ANNOTATIONS,
        NEUROTRANSMITTERS,
        BODY_STATS,
        CONNECTIVITY,
    ]

    for path in required_files:

        if not path.exists():
            raise FileNotFoundError(f"Missing required file:\n{path}")

    print("=" * 60)
    print("Building MaleCNS v1.0 database")
    print("=" * 60)

    con = connect()

    # ---------------------------------------------------------
    # Neurons
    # ---------------------------------------------------------

    print("\n[1/5] Importing neuron annotations...")

    # con.execute(
    #    """
    #    CREATE OR REPLACE TABLE neurons AS
    #    SELECT *
    #    FROM read_feather(?)
    # """,
    #    [str(ANNOTATIONS)],
    # )

    count = import_feather(
        con,
        ANNOTATIONS,
        "neurons",
    )

    # print(
    #    f"       {con.execute('SELECT COUNT(*) FROM neurons').fetchone()[0]:,}"
    #    " neurons"
    # )
    print(f"       {count:,} neurons")

    # ---------------------------------------------------------
    # Neurotransmitters
    # ---------------------------------------------------------

    print("\n[2/5] Importing neurotransmitters...")

    # con.execute(
    #    """
    #    CREATE OR REPLACE TABLE neurotransmitters AS
    #    SELECT *
    #    FROM read_feather(?)
    # """,
    #    [str(NEUROTRANSMITTERS)],
    # )

    # print(
    #    f"       "
    #    f"{con.execute('SELECT COUNT(*) FROM neurotransmitters').fetchone()[0]:,}"
    #    " rows"
    # )

    count = import_feather(
        con,
        NEUROTRANSMITTERS,
        "neurotransmitters",
    )

    print(f"       {count:,} rows")

    # ---------------------------------------------------------
    # Body statistics
    # ---------------------------------------------------------

    print("\n[3/5] Importing body statistics...")

    # con.execute(
    #    """
    #    CREATE OR REPLACE TABLE body_stats AS
    #    SELECT *
    #    FROM read_feather(?)
    # """,
    #    [str(BODY_STATS)],
    # )

    # print(
    #    f"       "
    #    f"{con.execute('SELECT COUNT(*) FROM body_stats').fetchone()[0]:,}"
    #    " rows"
    # )

    count = import_feather(
        con,
        BODY_STATS,
        "body_stats",
    )

    print(f"       {count:,} rows")

    # ---------------------------------------------------------
    # Connectivity
    # ---------------------------------------------------------

    print("\n[4/5] Importing connectivity...")

    # con.execute(
    #    """
    #    CREATE OR REPLACE TABLE connections AS
    #    SELECT *
    #    FROM read_feather(?)
    # """,
    #    [str(CONNECTIVITY)],
    # )

    # print(
    #    f"       "
    #    f"{con.execute('SELECT COUNT(*) FROM connections').fetchone()[0]:,}"
    #    " connections"
    # )

    count = import_feather(
        con,
        CONNECTIVITY,
        "connections",
    )

    print(f"       {count:,} connections")

    # ---------------------------------------------------------
    # Morphology index
    # ---------------------------------------------------------

    print("\n[5/5] Building morphology index...")

    con.execute("""
        CREATE OR REPLACE TABLE morphology AS
        SELECT
            CAST(NULL AS BIGINT) AS body_id,
            CAST(NULL AS VARCHAR) AS path,
            CAST(NULL AS VARCHAR) AS format
        WHERE FALSE
    """)

    if SKELETON_DIR.exists():

        skeleton_files = list(SKELETON_DIR.glob("*.swc"))

        print(f"       Found {len(skeleton_files):,} SWC files")

        rows = []

        for path in skeleton_files:

            try:
                body_id = int(path.stem)
            except ValueError:
                continue

            rows.append(
                (
                    body_id,
                    str(path.relative_to(DATA_DIR)),
                    "swc",
                )
            )

        if rows:

            con.executemany(
                """
                INSERT INTO morphology
                VALUES (?, ?, ?)
                """,
                rows,
            )

    else:

        print("       Skeleton directory not found.")

    # ---------------------------------------------------------
    # Indexes
    # ---------------------------------------------------------

    print("\nCreating indexes...")

    indexes = [
        """
        CREATE INDEX IF NOT EXISTS
        idx_neurons_body_id
        ON neurons(bodyId)
        """,
        """
        CREATE INDEX IF NOT EXISTS
        idx_neurons_type
        ON neurons(type)
        """,
        """
        CREATE INDEX IF NOT EXISTS
        idx_neurons_class
        ON neurons(class)
        """,
        """
        CREATE INDEX IF NOT EXISTS
        idx_neurons_superclass
        ON neurons(superclass)
        """,
        """
        CREATE INDEX IF NOT EXISTS
        idx_connections_pre
        ON connections(body_pre)
        """,
        """
        CREATE INDEX IF NOT EXISTS
        idx_connections_post
        ON connections(body_post)
        """,
        """
        CREATE INDEX IF NOT EXISTS
        idx_morphology_body
        ON morphology(body_id)
        """,
    ]

    for sql in indexes:
        con.execute(sql)

    con.close()

    print("\n" + "=" * 60)
    print("Database build complete")
    print("=" * 60)

    print(f"\nDatabase:")
    print(DB_PATH)


def validate():

    if not DB_PATH.exists():

        print("Database does not exist.")

        sys.exit(1)

    print("=" * 60)
    print("Validating MaleCNS database")
    print("=" * 60)

    con = connect(read_only=True)

    # ---------------------------------------------------------
    # Table existence
    # ---------------------------------------------------------

    tables = {row[0] for row in con.execute("SHOW TABLES").fetchall()}

    required_tables = {
        "neurons",
        "neurotransmitters",
        "body_stats",
        "connections",
        "morphology",
    }

    missing = required_tables - tables

    if missing:

        print(f"\n✗ Missing tables: {missing}")

        sys.exit(1)

    print("\n✓ All tables exist")

    # ---------------------------------------------------------
    # Neurons
    # ---------------------------------------------------------

    neuron_count = con.execute("""
        SELECT COUNT(*)
        FROM neurons
    """).fetchone()[0]

    print(f"✓ Neurons: {neuron_count:,}")

    # ---------------------------------------------------------
    # Connections
    # ---------------------------------------------------------

    connection_count = con.execute("""
        SELECT COUNT(*)
        FROM connections
    """).fetchone()[0]

    print(f"✓ Connections: {connection_count:,}")

    # ---------------------------------------------------------
    # Morphology
    # ---------------------------------------------------------

    morphology_count = con.execute("""
        SELECT COUNT(*)
        FROM morphology
    """).fetchone()[0]

    print(f"✓ Morphology files indexed: " f"{morphology_count:,}")

    # ---------------------------------------------------------
    # Body ID consistency
    # ---------------------------------------------------------

    missing_morphology = con.execute("""
        SELECT COUNT(*)
        FROM neurons n
        WHERE NOT EXISTS (
            SELECT 1
            FROM morphology m
            WHERE m.body_id = n.bodyId
        )
    """).fetchone()[0]

    print(f"✓ Neurons without skeleton: " f"{missing_morphology:,}")

    # ---------------------------------------------------------
    # Duplicate body IDs
    # ---------------------------------------------------------

    duplicate_body_ids = con.execute("""
        SELECT COUNT(*)
        FROM (
            SELECT bodyId
            FROM neurons
            GROUP BY bodyId
            HAVING COUNT(*) > 1
        )
    """).fetchone()[0]

    if duplicate_body_ids == 0:

        print("✓ No duplicate neuron body IDs")

    else:

        print(f"⚠ Duplicate body IDs: " f"{duplicate_body_ids:,}")

    # ---------------------------------------------------------
    # Example neuron
    # ---------------------------------------------------------

    result = con.execute("""
        SELECT
            n.bodyId,
            n.type,
            n.instance,
            m.path
        FROM neurons n
        LEFT JOIN morphology m
            ON n.bodyId = m.body_id
        WHERE n.bodyId = 13882
    """).fetchone()

    print("\nExample neuron:")

    if result:

        print(f"  bodyId:   {result[0]}")
        print(f"  type:     {result[1]}")
        print(f"  instance: {result[2]}")
        print(f"  skeleton: {result[3]}")

    else:

        print("  bodyId 13882 not found")

    con.close()

    print("\n" + "=" * 60)
    print("Validation complete")
    print("=" * 60)


def main():

    if len(sys.argv) < 2:

        print("Usage:")
        print("  python -m src.viewer.database build")
        print("  python -m src.viewer.database validate")

        sys.exit(1)

    command = sys.argv[1]

    if command == "build":

        build()

    elif command == "validate":

        validate()

    else:

        print(f"Unknown command: {command}")

        sys.exit(1)


if __name__ == "__main__":
    main()
