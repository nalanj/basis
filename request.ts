import type { IncomingMessage } from "node:http";
import { HTTPError } from "./error.js";

const clientAddressSymbol = Symbol.for("basis.clientAddress");

/*
 * Based on Astro (https://github.com/withastro/astro/blob/2dca81bf2174cd5c27cb63cb0ae081ea2a1ac771/packages/integrations/vercel/src/serverless/request-transform.ts#L20)
 * and originally based on SvelteKit (https://github.com/sveltejs/kit/blob/8d1ba04825a540324bc003e85f36559a594aadc2/packages/kit/src/exports/node/index.js
)
 */
function get_raw_body(
	req: IncomingMessage,
	body_size_limit?: number,
): ReadableStream | null {
	const h = req.headers;

	if (!h["content-type"]) {
		return null;
	}

	const content_length = Number(h["content-length"]);

	// check if no request body
	if (
		(req.httpVersionMajor === 1 &&
			Number.isNaN(content_length) &&
			h["transfer-encoding"] == null) ||
		content_length === 0
	) {
		return null;
	}

	let length = content_length;

	if (body_size_limit) {
		if (!length) {
			length = body_size_limit;
		} else if (length > body_size_limit) {
			throw new HTTPError(
				413,
				`Received content-length of ${length}, but only accept up to ${body_size_limit} bytes.`,
			);
		}
	}

	if (req.destroyed) {
		const readable = new ReadableStream();
		readable.cancel();
		return readable;
	}

	let size = 0;
	let cancelled = false;

	return new ReadableStream({
		start(controller) {
			req.on("error", (error) => {
				cancelled = true;
				controller.error(error);
			});

			req.on("end", () => {
				if (cancelled) return;
				controller.close();
			});

			req.on("data", (chunk) => {
				if (cancelled) return;

				size += chunk.length;
				if (size > length) {
					cancelled = true;
					controller.error(
						new HTTPError(
							413,
							`request body size exceeded ${
								content_length ? "'content-length'" : "BODY_SIZE_LIMIT"
							} of ${length}`,
						),
					);
					return;
				}

				controller.enqueue(chunk);

				if (controller.desiredSize === null || controller.desiredSize <= 0) {
					req.pause();
				}
			});
		},

		pull() {
			req.resume();
		},

		cancel(reason) {
			cancelled = true;
			req.destroy(reason);
		},
	});
}

export async function getRequest(
	base: string,
	req: IncomingMessage,
	bodySizeLimit?: number,
): Promise<Request> {
	const headers = req.headers as Record<string, string>;
	const request = new Request(base + req.url, {
		// @ts-expect-error
		duplex: "half",
		method: req.method,
		headers,
		body: get_raw_body(req, bodySizeLimit),
	});
	Reflect.set(request, clientAddressSymbol, headers["x-forwarded-for"]);
	return request;
}
