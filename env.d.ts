/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

interface ImportMetaEnv {
  readonly VITE_RPC_URL: string;
  readonly VITE_API_BASE: string;
  readonly VITE_TOKEN_ADDRESS: string;
  readonly VITE_AIRDROP_ADDRESS: string;
  readonly VITE_SWAP_ADDRESS: string;
  readonly VITE_USDT_ADDRESS: string;
  readonly VITE_CHAIN_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
