import { NextResponse } from "next/server";

type JsonInit = {
  status?: number;
  headers?: HeadersInit;
};

const ALLOWED_ORIGIN = process.env.MOBILE_APP_ORIGIN ?? "*";
const ALLOWED_METHODS = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
const ALLOWED_HEADERS = "Content-Type, Authorization";

function shouldAllowCredentials(origin: string) {
  if (origin === "*") return false;
  return (process.env.MOBILE_APP_ALLOW_CREDENTIALS ?? "true").toLowerCase() === "true";
}

function applyCorsHeaders(response: NextResponse, methods: string = ALLOWED_METHODS) {
  response.headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  response.headers.set("Access-Control-Allow-Methods", methods);
  response.headers.set("Access-Control-Allow-Headers", ALLOWED_HEADERS);
  response.headers.set("Access-Control-Allow-Credentials", shouldAllowCredentials(ALLOWED_ORIGIN) ? "true" : "false");
  return response;
}

export function jsonResponse<T>(data: T, init: JsonInit = {}) {
  const response = NextResponse.json(data, init);
  return applyCorsHeaders(response);
}

export function noContentResponse(methods: string = ALLOWED_METHODS) {
  const response = new NextResponse(null, { status: 204 });
  return applyCorsHeaders(response, methods);
}

export function errorResponse(message: string, status: number) {
  return jsonResponse({ error: message }, { status });
}
