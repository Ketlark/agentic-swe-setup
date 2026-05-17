export function isPrivateUrl(url: string): string | null {
	try {
		const parsed = new URL(url);

		if (!["http:", "https:"].includes(parsed.protocol)) {
			return `Blocked: protocol "${parsed.protocol}" is not allowed (only http/https).`;
		}

		const hostname = parsed.hostname.toLowerCase();

		if (
			hostname === "localhost" ||
			hostname === "localhost.localdomain" ||
			hostname.endsWith(".local") ||
			hostname === "0.0.0.0" ||
			hostname.endsWith(".internal")
		) {
			return `Blocked: hostname "${hostname}" resolves to a private address.`;
		}

		const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
		if (ipv4) {
			const [, aStr, bStr] = ipv4;
			const a = Number(aStr);
			const b = Number(bStr);
			if (a === 127) return "Blocked: 127.0.0.0/8 is a loopback address.";
			if (a === 10) return "Blocked: 10.0.0.0/8 is a private network.";
			if (a === 172 && b >= 16 && b <= 31) return "Blocked: 172.16.0.0/12 is a private network.";
			if (a === 192 && b === 168) return "Blocked: 192.168.0.0/16 is a private network.";
			if (a === 169 && b === 254) return "Blocked: 169.254.0.0/16 is a link-local address.";
			if (a === 0) return "Blocked: 0.0.0.0/8 is a reserved address.";
		}

		if (
			hostname === "::1" ||
			hostname === "[::1]" ||
			/^fe80:/i.test(hostname) ||
			/^fc/i.test(hostname) ||
			/^fd/i.test(hostname)
		) {
			return `Blocked: IPv6 address "${hostname}" is a private/link-local address.`;
		}

		return null;
	} catch {
		return "Blocked: could not parse URL.";
	}
}
