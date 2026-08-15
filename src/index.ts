import { Command } from "commander";
import { fetchAlbums, findAlbumByName, filterImages, searchAssetsByAlbumIds as getAssetsFromAlbumId, updateAssetTimestamp, Album, Asset } from "./immich";
import { naturalSort } from "./sort";

function addSecondsToISO(iso: string, seconds: number): string {
  const offsetMatch = iso.match(/([+-]\d{2}:\d{2}|Z)$/);
  if (!offsetMatch) {
    const date = new Date(iso);
    date.setTime(date.getTime() + seconds * 1000);
    return date.toISOString();
  }

  const offsetStr = offsetMatch[1];
  let offsetMinutes = 0;
  if (offsetStr !== "Z") {
    const sign = offsetStr[0] === "-" ? -1 : 1;
    offsetMinutes = sign * (parseInt(offsetStr.slice(1, 3), 10) * 60 + parseInt(offsetStr.slice(4, 6), 10));
  }

  const date = new Date(iso);
  date.setTime(date.getTime() + seconds * 1000);

  const localMs = date.getTime() + offsetMinutes * 60 * 1000;
  const localDate = new Date(localMs);

  const pad = (n: number) => n.toString().padStart(2, "0");
  const year = localDate.getUTCFullYear();
  const month = pad(localDate.getUTCMonth() + 1);
  const day = pad(localDate.getUTCDate());
  const hours = pad(localDate.getUTCHours());
  const minutes = pad(localDate.getUTCMinutes());
  const secs = pad(localDate.getUTCSeconds());

  if (offsetStr === "Z") {
    return `${year}-${month}-${day}T${hours}:${minutes}:${secs}Z`;
  }

  const absOffsetHours = pad(Math.floor(Math.abs(offsetMinutes) / 60));
  const absOffsetMins = pad(Math.abs(offsetMinutes) % 60);
  const signStr = offsetMinutes >= 0 ? "+" : "-";

  return `${year}-${month}-${day}T${hours}:${minutes}:${secs}${signStr}${absOffsetHours}:${absOffsetMins}`;
}

function formatTable(rows: { filename: string; oldTime: string; newTime: string }[]): string {
  if (rows.length === 0) return "";

  const headers = ["Filename", "Old Time", "New Time"];
  const lines = rows.map((r) => [r.filename, r.oldTime, r.newTime]);

  const colWidths = headers.map((h, i) => {
    const maxContent = lines.reduce((max, line) => Math.max(max, line[i].length), 0);
    return Math.max(h.length, maxContent);
  });

  const formatRow = (cells: string[]) =>
    cells.map((c, i) => c.padEnd(colWidths[i])).join("  ");

  const separator = colWidths.map((w) => "-".repeat(w)).join("  ");

  return [
    formatRow(headers),
    separator,
    ...lines.map((line) => formatRow(line)),
  ].join("\n");
}

async function run(args: string[]): Promise<number> {
  const program = new Command();

  program
    .name("immich-album-sorter")
    .description("Adjust Immich asset timestamps so images display in filename order")
    .requiredOption("--url <url>", "Immich server base URL")
    .requiredOption("--api-key <key>", "Immich API key")
    .requiredOption("--album <name>", "Exact album name")
    .option("--increment <seconds>", "Seconds to add per subsequent file", "1")
    .option("--force", "Apply changes without confirmation prompt", false);

  program.exitOverride();

  try {
    await program.parseAsync(args, { from: "user" });
  } catch (error) {
    console.error((error as Error).message);
    return 1;
  }

  const options = program.opts();

  const url = options.url as string;
  const apiKey = options.apiKey as string;
  const albumName = options.album as string;
  const increment = parseInt(options.increment as string, 10);
  const force = options.force as boolean;

  let albums: Album[];
  try {
    albums = await fetchAlbums(url, apiKey);
  } catch (error) {
    console.error(`Failed to fetch albums: ${(error as Error).message}`);
    return 1;
  }

  const album = findAlbumByName(albums, albumName);
  if (!album) {
    console.error(`Album '${albumName}' not found`);
    return 1;
  }

  let images: Asset[];
  try {
    const assets = await getAssetsFromAlbumId(url, apiKey, [album.id], album.assetCount);
    images = filterImages(assets);
  } catch (error) {
    console.error(`Failed to fetch assets: ${(error as Error).message}`);
    return 1;
  }

  if (images.length === 0) {
    console.error(`Album '${albumName}' contains no images`);
    return 1;
  }

  const sorted = [...images].sort((a, b) =>
    naturalSort(a.originalFileName, b.originalFileName)
  );

  const allRows: { filename: string; oldTime: string; newTime: string }[] = [];
  const allAssets: Asset[] = [];
  let cumulativeOffset = 0;

  for (let i = 0; i < sorted.length; ) {
    const currentTime = sorted[i].fileCreatedAt;
    if (!currentTime) {
      i++;
      continue;
    }

    let j = i + 1;
    while (j < sorted.length && sorted[j].fileCreatedAt === currentTime) {
      j++;
    }

    const group = sorted.slice(i, j);
    if (group.length >= 2) {
      const baseTime = addSecondsToISO(currentTime, cumulativeOffset);
      cumulativeOffset += group.length * increment;

      for (let k = 0; k < group.length; k++) {
        allRows.push({
          filename: group[k].originalFileName,
          oldTime: group[k].fileCreatedAt ?? "",
          newTime: addSecondsToISO(baseTime, k * increment),
        });
        allAssets.push(group[k]);
      }
    }

    i = j;
  }

  if (allRows.length === 0) {
    console.log("No groups of 2+ images with the same timestamp found");
    return 0;
  }

  if (!force) {
    console.log(formatTable(allRows));
    return 0;
  }

  let failureCount = 0;
  for (let i = 0; i < allRows.length; i++) {
    const asset = allAssets[i];

    try {
      await updateAssetTimestamp(url, apiKey, asset.id!, allRows[i].newTime);
      console.log(`Updated: ${allRows[i].filename} -> ${allRows[i].newTime}`);
    } catch (error) {
      console.error(`Failed to update ${allRows[i].filename}: ${(error as Error).message}`);
      failureCount++;
    }
  }

  if (failureCount > 0) {
    console.error(`\n${failureCount} update(s) failed`);
    return 1;
  }

  return 0;
}

export function runCLI(args: string[]): Promise<number> {
  return run(args);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run(process.argv.slice(2)).then((code) => {
    process.exit(code);
  });
}
