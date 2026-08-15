export interface Album {
  id: string;
  albumName: string;
  assetCount: number;
}

export interface Asset {
  id: string;
  originalFileName: string;
  type: "IMAGE" | "VIDEO";
  fileCreatedAt?: string;
}

export async function fetchAlbums(baseUrl: string, apiKey: string): Promise<Album[]> {
  const response = await fetch(`${baseUrl}/api/albums`, {
    method: "GET",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch albums: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function searchAssetsByAlbumIds(
  baseUrl: string,
  apiKey: string,
  albumIds: string[],
  assetCount?: number,
): Promise<Asset[]> {
  const pageSize = assetCount && assetCount > 0 ? Math.min(assetCount, 1000) : 1000;
  let page = 1;
  let hasNextPage = true;
  const allAssets: Asset[] = [];

  while (hasNextPage) {
    const response = await fetch(`${baseUrl}/api/search/metadata`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ albumIds, size: pageSize, page }),
    });

    if (!response.ok) {
      throw new Error(`Failed to search assets: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const items = data.assets?.items ?? [];
    allAssets.push(...items);
    hasNextPage = data.assets?.hasNextPage ?? false;
    page = data.assets?.nextPage ?? page + 1;
  }

  return allAssets;
}

export function findAlbumByName(albums: Album[], name: string): Album | undefined {
  return albums.find((album) => album.albumName === name);
}

export function filterImages(assets: Asset[]): Asset[] {
  return assets.filter((asset) => asset.type === "IMAGE");
}

export async function updateAssetTimestamp(
  baseUrl: string,
  apiKey: string,
  assetId: string,
  dateTimeOriginal: string
): Promise<void> {
  const body = {
    dateTimeOriginal,
    fileCreatedAt: dateTimeOriginal,
    fileModifiedAt: dateTimeOriginal,
  };

  const response = await fetch(`${baseUrl}/api/assets/${assetId}`, {
    method: "PUT",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Failed to update asset ${assetId}: ${response.status} ${response.statusText}`);
  }
}
