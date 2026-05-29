/**
 * Auto-update checker
 * Checks GitHub releases for new versions and provides download links.
 */

const REPO = "yuelangmanle/flowith";
const GITHUB_API = `https://api.github.com/repos/${REPO}/releases/latest`;

export interface UpdateInfo {
  version: string;
  htmlUrl: string;
  body: string;
  publishedAt: string;
  assets: Array<{ name: string; browserDownloadUrl: string; size: number }>;
}

export async function checkForUpdate(currentVersion: string): Promise<UpdateInfo | null> {
  try {
    const resp = await fetch(GITHUB_API, {
      headers: { Accept: "application/vnd.github.v3+json" },
    });
    if (!resp.ok) return null;

    const release = await resp.json() as {
      tag_name: string;
      html_url: string;
      body: string;
      published_at: string;
      assets: Array<{ name: string; browser_download_url: string; size: number }>;
    };

    const latestVersion = release.tag_name.replace(/^v/, "");
    const current = currentVersion.replace(/^v/, "");

    if (isNewerVersion(latestVersion, current)) {
      return {
        version: release.tag_name,
        htmlUrl: release.html_url,
        body: release.body ?? "",
        publishedAt: release.published_at,
        assets: release.assets.map((a) => ({
          name: a.name,
          browserDownloadUrl: a.browser_download_url,
          size: a.size,
        })),
      };
    }
    return null;
  } catch {
    return null;
  }
}

function isNewerVersion(latest: string, current: string): boolean {
  const l = latest.split(".").map(Number);
  const c = current.split(".").map(Number);
  for (let i = 0; i < Math.max(l.length, c.length); i++) {
    const li = l[i] ?? 0;
    const ci = c[i] ?? 0;
    if (li > ci) return true;
    if (li < ci) return false;
  }
  return false;
}

export function getDownloadAsset(update: UpdateInfo, platform: "mac" | "win" | "android"): { name: string; url: string; size: number } | null {
  const platformMap: Record<string, string[]> = {
    mac: [".dmg", "darwin", "macos", "mac"],
    win: [".exe", ".msi", "windows", "win"],
    android: [".apk", "android"],
  };

  const keywords = platformMap[platform] ?? [];
  const asset = update.assets.find((a) =>
    keywords.some((kw) => a.name.toLowerCase().includes(kw))
  );

  return asset ? { name: asset.name, url: asset.browserDownloadUrl, size: asset.size } : null;
}
