export interface Album {
  id: string;
  albumName: string;
  assets: Asset[];
}

export interface Asset {
  id: string;
  originalFileName: string;
  type: "IMAGE" | "VIDEO";
  dateTimeOriginal?: string;
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
  albumIds: string[]
): Promise<Asset[]> {
  const response = await fetch(`${baseUrl}/api/search/metadata`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ albumIds }),
  });

  if (!response.ok) {
    throw new Error(`Failed to search assets: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.assets?.items ?? [];
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
