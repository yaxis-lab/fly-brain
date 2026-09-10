from pathlib import Path

import requests
from tqdm import tqdm

BASE_URL = (
    "https://storage.googleapis.com/"
    "flyem-male-cns/v1.0/connectome-data/flat-connectome"
)

DATA_DIR = Path("data/malecns")


FILES = {
    "body_neurotransmitters": ("body-neurotransmitters-male-cns-v1.0.feather"),
    "body_stats": ("body-stats-male-cns-v1.0-minconf-0.5.feather"),
    "connectome_weights": ("connectome-weights-male-cns-v1.0-minconf-0.5.feather"),
}


def download_file(name: str, filename: str):
    url = f"{BASE_URL}/{filename}"
    output = DATA_DIR / filename

    output.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    if output.exists():
        print(f"[exists] {name}")
        print(f"         {output}")
        return

    print()
    print(f"Downloading: {name}")
    print(f"URL:        {url}")
    print(f"Output:     {output}")

    response = requests.get(
        url,
        stream=True,
        timeout=60,
    )

    response.raise_for_status()

    total = int(
        response.headers.get(
            "content-length",
            0,
        )
    )

    with open(output, "wb") as f:

        with tqdm(
            total=total,
            unit="B",
            unit_scale=True,
            unit_divisor=1024,
            desc=name,
        ) as progress:

            for chunk in response.iter_content(
                chunk_size=1024 * 1024,
            ):
                if not chunk:
                    continue

                f.write(chunk)
                progress.update(len(chunk))

    print(f"Finished: {output}")


def main():

    print("=" * 60)
    print("MaleCNS v1.0 download")
    print("=" * 60)

    for name, filename in FILES.items():
        download_file(
            name,
            filename,
        )

    print()
    print("=" * 60)
    print("Download complete")
    print("=" * 60)

    for path in DATA_DIR.iterdir():

        if path.is_file():

            size_gb = path.stat().st_size / (1024**3)

            print(f"{path.name:65s}" f"{size_gb:8.3f} GB")


if __name__ == "__main__":
    main()
