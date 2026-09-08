import { createApplication } from "./app.js";
const { app } = await createApplication();
const port = Number(process.env.API_PORT ?? 4000);
await app.listen(port, "0.0.0.0");
console.log(
  `TubePilot API listening on port ${port}. Demo fixtures are clearly labeled; no YouTube connection is implied.`,
);
