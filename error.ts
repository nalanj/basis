export class HTTPError extends Error {
	status: number;

	constructor(status: number, reason: string) {
		super(reason);
		this.status = status;
	}

	get reason() {
		return super.message;
	}
}
