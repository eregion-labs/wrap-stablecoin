# Delete `exposure_cap` (redeploy later)

`exposure_cap` is the same wrap check as `mint_cap` (`new_liability` vs ceiling; `0` = unlimited). Quotes already ignore it. On the next program deploy, delete the field everywhere. Keep `mint_cap` as the only liability ceiling. Do not deploy as part of this item.

## Program
- Drop `exposure_cap` from `AssetConfig`, `UpdateAssetPolicyArgs`, `add_asset` / `update_asset_policy`, and the second branch in `check_mint_cap`.
- Delete `ExposureCapExceeded`.

## Clients
- Backend: drop from admin request bodies, `VaultAssetView`, and `dummy_asset`.
- Admin UI: remove the Exposure cap column, draft field, and copy. One column: Issue cap.
- Public frontend: drop unused `exposureCap` on the vault asset type.

Do not rename `mint_cap`. Do not dual-write. Do not migrate live accounts.
