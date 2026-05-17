import { execFile } from "node:child_process";

export function detectRtk(): Promise<string | null> {
	return new Promise((resolve) => {
		execFile("rtk", ["--version"], { timeout: 3_000 }, (err, stdout) => {
			if (err) {
				resolve(null);
				return;
			}
			resolve(stdout.trim() || "unknown");
		});
	});
}
