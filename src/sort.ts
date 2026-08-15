export function naturalSort(a: string, b: string): number {
  const regex = /(\d+|\D+)/g;
  const aParts = a.match(regex) ?? [a];
  const bParts = b.match(regex) ?? [b];

  const maxLength = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < maxLength; i++) {
    const aPart = aParts[i] ?? "";
    const bPart = bParts[i] ?? "";

    const aNum = Number(aPart);
    const bNum = Number(bPart);

    if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
      if (aNum !== bNum) {
        return aNum - bNum;
      }
    } else {
      const cmp = aPart.localeCompare(bPart);
      if (cmp !== 0) {
        return cmp;
      }
    }
  }

  return 0;
}
