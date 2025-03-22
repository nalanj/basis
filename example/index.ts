import { basis } from "../server";

const server = await basis({ host: "0.0.0.0", port: 3000 });
console.log(`Server running on port ${server.port}`);

process.on("SIGINT", async () => {
	await server.close();
	console.log("Server closed");
	process.exit(0);
});
