import { createServer } from "node:http";

type BasisConfig = {
	host: string | undefined;
	port: number | undefined;
};

type BasisInstance = {
	port: number | undefined;
	close: () => Promise<void>;
};

export async function basis(config: BasisConfig): Promise<BasisInstance> {
	config.host ||= "0.0.0.0";

	const server = createServer((req, res) => {
		console.log(req.headers);

		res.statusCode = 200;
		res.end("Hello world");
	});

	await new Promise<void>((resolve) =>
		server.listen({ port: config.port }, () => resolve()),
	);

	// get address port from server
	const address = server.address();
	if (address === null || typeof address !== "object") {
		throw new Error("Failed to get server address");
	}

	return {
		port: address.port,
		close: async () => {
			return new Promise<void>((resolve) => {
				server.close(() => resolve());
			});
		},
	};
}
