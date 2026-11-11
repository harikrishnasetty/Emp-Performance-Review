# Bundled fonts

`src/app/globals.css` declares two self-hosted variable fonts so the app makes
**no third-party font requests at runtime** (important for CSP and for
deployments without egress).

| File | Family | Used for | Source |
|------|--------|----------|--------|
| `InterVariable.woff2` | Inter (variable, weights 100–900) | `--font-sans` (`Meridian Sans`) | <https://rsms.me/inter/> |
| `SpaceGrotesk-Variable.woff2` | Space Grotesk (variable, weights 300–700, latin subset) | `--font-display` (`Meridian Display`) | Google Fonts (`fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700`) |

Both families are licensed under the **SIL Open Font License 1.1**, which
permits bundling and redistribution with this application.

- Inter: © The Inter Project Authors — <https://github.com/rsms/inter/blob/master/LICENSE.txt>
- Space Grotesk: © The Space Grotesk Project Authors — <https://github.com/floriankarsten/space-grotesk/blob/master/OFL.txt>

If either file is replaced, keep the filename in sync with the `src:` URLs in
`src/app/globals.css`, and keep the `format("woff2-variations")` hint and the
`font-weight` range in each `@font-face` rule.
