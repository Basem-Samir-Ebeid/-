import app from "../artifacts/api-server/dist/index.mjs";

export default function handler(request, response) {
  return app(request, response);
}
