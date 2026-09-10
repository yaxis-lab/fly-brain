from pathlib import Path

import requests
from tqdm import tqdm

# ============================================================
# Configuration
# ============================================================

DATA_DIR = Path("data/malecns")

BASE_URL = "https://storage.googleapis.com/" "flyem-male-cns/v1.0"


FILES = {
    "body_annotations": (
        "connectome-data/flat-connectome/"
        "body-annotations-male-cns-v1.0-minconf-0.5.feather"
    ),
}


# ============================================================
# Download
# ============================================================


def download_file(relative_path: str):

    url = f"{BASE_URL}/{relative_path}"

    filename = Path(relative_path).name
    output = DATA_DIR / filename

    DATA_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    if output.exists():
        print(f"\nAlready downloaded:")
        print(f"  {output}")
        return

    print()
    print("=" * 70)
    print(f"Downloading:")
    print(f"  {filename}")
    print("=" * 70)

    response = requests.get(
        url,
        stream=True,
        timeout=60,
    )

    response.raise_for_status()

    total_size = int(
        response.headers.get(
            "content-length",
            0,
        )
    )

    print(f"Size: {total_size / (1024 ** 2):.2f} MB")
    print(f"URL:  {url}")
    print()

    with open(output, "wb") as file:

        with tqdm(
            total=total_size,
            unit="B",
            unit_scale=True,
            unit_divisor=1024,
            desc=filename,
        ) as progress:

            for chunk in response.iter_content(
                chunk_size=1024 * 1024,
            ):

                if chunk:
                    file.write(chunk)
                    progress.update(len(chunk))

    print()
    print(f"Saved:")
    print(f"  {output}")


# ============================================================
# Main
# ============================================================


def main():

    print("=" * 70)
    print("MaleCNS v1.0 visualization data")
    print("=" * 70)

    for name, relative_path in FILES.items():

        print(f"\nDataset: {name}")

        download_file(relative_path)

    print()
    print("=" * 70)
    print("Complete")
    print("=" * 70)

    print("\nCurrent data/malecns contents:")

    for path in sorted(DATA_DIR.iterdir()):

        if path.is_file():

            size_mb = path.stat().st_size / (1024**2)

            print(f"{path.name:<70}" f"{size_mb:>10.2f} MB")


if __name__ == "__main__":
    main()
