import { closeAccountRoute, getAccountRoute, openAccountRoute } from "./account/web/routes";
import { envConfig } from "./plumbing/config";

export const serverDefinition = {
  port: envConfig.PORT,
  routes: {
    "/accounts": { POST: openAccountRoute },
    "/accounts/:id": { GET: getAccountRoute },
    "/accounts/:id/close": { POST: closeAccountRoute },
  },
};
