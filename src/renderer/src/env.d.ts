import type { YouFarmApi } from '../../main/preload'

declare global {
  interface Window {
    youfarm: YouFarmApi
  }
}
