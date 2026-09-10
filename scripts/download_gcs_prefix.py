from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
import sys

BUCKET = "flyem-male-cns"

PREFIX = "v1.0/segmentation/skeletons-malecns/skeletons-swc/"

OUTPUT_DIR = Path("data/malecns/skeletons-swc")

MAX_WORKERS = 8

SESSION = requests.Session()


def list_objects(prefix: str):

    objects = []

    url = f"https://storage.googleapis.com/storage/v1/b/{BUCKET}/o"

    params = {
        "prefix": prefix,
        "maxResults": 1000,
    }

    while True:

        response = SESSION.get(url, params=params)
        response.raise_for_status()

        data = response.json()

        for item in data.get("items", []):
            objects.append(
                (
                    item["name"],
                    int(item.get("size", 0)),
                )
            )

        token = data.get("nextPageToken")

        if not token:
            break

        params["pageToken"] = token

    return objects


def download_object(item):

    name, size = item

    relative_path = name[len(PREFIX) :]

    if not relative_path:
        return False, name, size

    output = OUTPUT_DIR / relative_path

    output.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    if output.exists() and output.stat().st_size == size:
        return False, name, size

    url = f"https://storage.googleapis.com/" f"{BUCKET}/{name}"

    temp = output.with_suffix(output.suffix + ".part")

    with SESSION.get(
        url,
        stream=True,
        timeout=120,
    ) as response:

        response.raise_for_status()

        with open(temp, "wb") as f:

            for chunk in response.iter_content(chunk_size=1024 * 1024):

                if chunk:
                    f.write(chunk)

    temp.replace(output)

    return True, name, size


def main():

    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    print("MaleCNS skeleton downloader")
    print("=" * 60)

    print("\nListing objects...")

    objects = list_objects(PREFIX)

    print(f"Objects found: {len(objects):,}")

    total_size = sum(size for _, size in objects)

    print(f"Total remote size: " f"{total_size / 1024**3:.2f} GB")

    print("\nDownloading...")

    downloaded = 0
    skipped = 0
    failed = []

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:

        futures = [
            executor.submit(
                download_object,
                item,
            )
            for item in objects
        ]

        for i, future in enumerate(
            as_completed(futures),
            start=1,
        ):

            try:

                was_downloaded, name, size = future.result()

                if was_downloaded:
                    downloaded += 1
                else:
                    skipped += 1

                print(f"[{i:,}/{len(objects):,}] " f"{name}")

            except Exception as e:

                failed.append((future, str(e)))

                print(
                    f"\nERROR: {e}",
                    file=sys.stderr,
                )

    print("\n" + "=" * 60)
    print("Download complete")
    print("=" * 60)

    print(f"Objects:    {len(objects):,}")
    print(f"Downloaded: {downloaded:,}")
    print(f"Skipped:    {skipped:,}")
    print(f"Failed:     {len(failed):,}")

    if failed:
        print("\nSome files failed.")
        print("Run the script again to retry them.")


if __name__ == "__main__":
    main()
