from pathlib import Path

import pandas as pd

DATA_DIR = Path("data/malecns")


FILES = {
    "neurotransmitters": ("body-neurotransmitters-male-cns-v1.0.feather"),
    "body_stats": ("body-stats-male-cns-v1.0-minconf-0.5.feather"),
    "connectivity": ("connectome-weights-male-cns-v1.0-minconf-0.5.feather"),
}


def inspect(name, filename):

    path = DATA_DIR / filename

    print()
    print("=" * 80)
    print(name)
    print("=" * 80)

    df = pd.read_feather(path)

    print()
    print("Shape:")
    print(df.shape)

    print()
    print("Columns:")
    print(df.columns.tolist())

    print()
    print("Dtypes:")
    print(df.dtypes)

    print()
    print("First 5 rows:")
    print(df.head().to_string(index=False))


def main():

    for name, filename in FILES.items():
        inspect(name, filename)


if __name__ == "__main__":
    main()
