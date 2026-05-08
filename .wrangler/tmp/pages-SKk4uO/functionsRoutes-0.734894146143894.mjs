import { onRequestPost as __api_create_js_onRequestPost } from "C:\\Users\\GrahamCameron(M365)\\Documents\\GitHub\\site-builder\\functions\\api\\create.js"

export const routes = [
    {
      routePath: "/api/create",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_create_js_onRequestPost],
    },
  ]