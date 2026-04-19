import { createRouter, createWebHistory } from "vue-router";
import HomeView from "./views/HomeView.vue";
import ClaimView from "./views/ClaimView.vue";
import AdminView from "./views/AdminView.vue";
import WalletView from "./views/WalletView.vue";
import SwapView from "./views/SwapView.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: HomeView },
    { path: "/claim", name: "claim", component: ClaimView },
    { path: "/swap", name: "swap", component: SwapView },
    { path: "/wallet", name: "wallet", component: WalletView },
    { path: "/admin", name: "admin", component: AdminView },
  ],
});
