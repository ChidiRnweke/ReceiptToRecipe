# Changelog

## [0.1.0](https://github.com/ChidiRnweke/ReceiptToRecipe/compare/v0.0.1...v0.1.0) (2026-11-08)


### Features

* add custom font styles and enhance UI elements for better readability ([b482164](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/b4821645f10100697ea738022c124f491dea7c9a))
* add development Docker Compose configuration for local setup ([7fc6bcc](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/7fc6bcc255f1da697fe2b6750728e95b2da258ad))
* add PushPin and WashiTape components; enhance app styles with new button and card designs ([d095570](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/d0955706e0bb6b4c5fad9eec0c02f30cc6a61111))
* add recipe, shopping list, and taste profile services with interfaces ([b12c712](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/b12c7122ec7d338b61481ee2a5571f0020513d1b))
* add Taste Profile feature with user preferences for diet, allergies, ingredients, and cuisines ([13244be](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/13244be26ae664b590125fca4c8e41debf6d1364))
* add trigger for Komodo redeploy after Docker build and push ([dfb2977](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/dfb29779f2958773ca91709e146558165e8ba8ad))
* add user roles and admin functionality ([c2b95b8](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/c2b95b86a795a7fa725a75d3a66a099b30b43ffe))
* **allergy:** implement allergy risk review functionality ([a4a50ff](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/a4a50ff4ff798c477bc8e1d99e86af7b6cc251ae))
* **auth:** implement OAuth2 authentication with Auth0 ([7cbac82](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/7cbac82b1537b36cb0bb17aa7c65675966eb9943))
* enhance receipt display with improved layout and truncation for long text ([1a0be25](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/1a0be252df8bc0cbfd241a4c4b049c676d74e450))
* enhance receipts and recipes management ([f7e8ff1](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/f7e8ff1d4c489ee7ab0c6077f860e938f9467376))
* enhance recipe generation page layout and improve pantry item selection ([47ce649](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/47ce6493b5e4a641b10d1c0364e21c89a1263ad7))
* enhance recipe management with source receipt integration ([857381c](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/857381ca934f32fa1e9ec114546e454942a35ef0))
* enhance UI and functionality for recipe and shopping pages ([1b2ba87](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/1b2ba87514255d8a64716ff67cba537eb16bd73b))
* implement database and MinIO provisioning scripts with Infisical integration ([9219c08](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/9219c0847f5b07ddfb1d019e0cbcc1304539483c))
* implement delete functionality for receipts and recipes with confirmation dialog ([74887be](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/74887bed08d8a0c979740e81f0cdd124ab5916b3))
* implement onboarding modal for new users and integrate pantry warning dialog ([e431ad4](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/e431ad48f9b08f845e7172b5171fa984644e8e9c))
* Implement waitlist functionality with signup and success pages ([2bafb6a](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/2bafb6ac2032596ab800ac69485724bfc7be6ac0))
* integrate OpenTelemetry for enhanced observability ([e903ddf](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/e903ddfcadadb03789ce4afd329dd292352df56d))
* integrate OpenTelemetry for enhanced telemetry and monitoring across services ([63acd5a](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/63acd5a9efc5139f1e21993933e0b69ca1d384a9))
* integrate pantry service and enhance recipe suggestions ([bd1993e](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/bd1993e03854ad98a9f4ff1bd11b10b0ebcb193a))
* integrate PWA support with Vite PWA and add offline handling ([08596de](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/08596decfa811245181863be66c82373b3377130))
* **nav:** enhance MobileBottomNav with new icons and button types for improved navigation ([8d655da](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/8d655da0e511cfd4c390fce1e725474022f07b45))
* **planning:** add meal planning functionality with calorie tracking and shopping list integration ([e60d30c](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/e60d30c86198f586cc0e140a148199974e6212ea))
* redesign recipe page layout and enhance suggested recipes display ([b9052b6](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/b9052b60fe84a31a6e309a7dc836f3408fba8cb4))
* simplify layout and remove unused sections from recipe and receipt display ([28e1250](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/28e1250ee096494aff61e85f14d399d7a37f8a7a))
* update favicon and add logo SVG for improved branding ([cbc07f0](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/cbc07f040c47e64c62f5ed9c2770ced3ad010af1))


### Bug Fixes

* add profiles and labels to migrate and minio-init services in Docker Compose ([cb97373](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/cb97373685ecd0eae76cc626bdd0135093109fcb))
* add PWA icons to static/ and unignore static directory ([c392c34](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/c392c34b09456b17950ba2e14a6c3dd8d0af8f8f))
* Change servings from $derived to $state with $effect initialization ([3d8b879](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/3d8b8797dcbf0b5296063d5e42c7ed8cae0bf2b9))
* correct image name casing in Docker configurations ([924a09a](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/924a09a003e8d6bda62484ae62b0b781a38a7434))
* correct image name casing in Docker configurations ([ffef29c](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/ffef29c64cc2896323515a75514d07543eb4c941))
* correct image name in Docker configurations and update webhook deployment command ([308682f](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/308682fb02f64fdea7a597d5f910a221f41bf30f))
* correct Infisical SDK site URL environment variable reference ([ee63735](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/ee637354f21e09d90ef064680aeadaf9fbd7bce7))
* enhance console logging by adding trace context for better correlation in OpenTelemetry ([6e22840](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/6e2284014c97d024905d26affa5b869bb77c397c))
* enhance Komodo redeploy trigger with HMAC signature for security ([3e17ae3](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/3e17ae3eadc3b1b4fed6af93080861c2fd21f026))
* enhance OpenTelemetry logging by bridging console methods and improving shutdown logic ([d5f0a2e](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/d5f0a2efc8c1229069ece423df0d3f3842988f69))
* **generate:** add form ID for recipe generation and adjust sticky button visibility ([8d655da](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/8d655da0e511cfd4c390fce1e725474022f07b45))
* improve console bridging logic in OpenTelemetry integration ([cb90ae5](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/cb90ae5afa33db91e2e86c539f793e5a11275a2c))
* refactor console logging integration with OpenTelemetry and improve initialization flow ([c8b8756](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/c8b8756191bfdb8437dbc1b635584815f6d76790))
* refactor LoggerProvider initialization to use processors array for log record processing ([342ce79](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/342ce7959f1cacdf259cfb98623abaa75e0ed940))
* refactor telemetry initialization to improve endpoint handling and environment variable usage ([1a3e5ca](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/1a3e5ca4fa2fb6741b411ea7a4ac746b12b27a73))
* remove deprecated OTel instrumentation file and update Dockerfile to use new script ([e9fda8f](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/e9fda8f3174a908a16bb27ead96740655a2207bf))
* **shopping:** add ID to new list input for better accessibility ([8d655da](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/8d655da0e511cfd4c390fce1e725474022f07b45))
* **ui:** adjust PinnedNote max-width for better responsiveness ([d1a47a9](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/d1a47a9f845c605a2598645eb452fd63098268a1))
* **ui:** enhance onboarding and offline prompts with improved messaging and structure ([2c5e589](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/2c5e589cea8a05db9d92a7b95b64a311cbf4af29))
* **ui:** enhance signup error handling and improve form structure ([9a831d9](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/9a831d9198b5916d9ee68f4eff652fd2b0342c63))
* **ui:** implement client-side session revalidation and enhance offline screen handling ([23334a5](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/23334a5792432058018ba3eebb8b61550042121d))
* **ui:** improve session handling and mobile menu visibility based on user authentication ([ee2b27c](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/ee2b27cce046ef9f08eec23cc1f4f1d01478877e))
* **ui:** overhaul mobile responsiveness across key pages ([1ca38a7](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/1ca38a7e8b938b2b749a40107b7b94a26f9c4a20))
* **ui:** overhaul mobile responsiveness across key pages ([ede030d](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/ede030d61160c4e83bd0d1f38c8fe01a4f8eae3a))
* update database privilege grants and improve MinIO service account creation logic ([c16d9f9](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/c16d9f9ab62272755417738cb43bbf5a7dff28bf))
* update IMAGE_NAME to use dynamic repository name and clean up workflow ([491bc5a](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/491bc5a0cacb60d8708a319be88faac8a3adb9d5))
* update imports for Resource and semantic conventions in telemetry initialization ([cf36bc8](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/cf36bc88437810abc34c47cce923bd695b5fd918))
* update resource initialization to use resourceFromAttributes for telemetry ([a2f4edd](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/a2f4eddc8ecfc019f387349e8e03b3dc4bcb548b))
* **upload:** update upload instructions for better clarity on mobile ([8d655da](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/8d655da0e511cfd4c390fce1e725474022f07b45))


### Code Refactoring

* clear the eslint errors so lint can gate CI ([f6b87c1](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/f6b87c11c366a2f2905afe3f08526ed664d17ccc))
* improve workflow state handling and remove unused dashboard files ([f7adff2](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/f7adff21d88b3dd6bcf70e98a49ea02f83ea56e4))
* **layout:** adjust header structure for better readability ([8d655da](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/8d655da0e511cfd4c390fce1e725474022f07b45))
* remove password handling from user repository and auth service ([f19e7c9](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/f19e7c9d70f6f73170a3a8520e8d6dcf3cdf9151))
* **shopping:** simplify new item input handling and improve state management ([edac668](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/edac66851fda647f45622825f4c7be448bd32de7))
* **shopping:** streamline new item input handling and improve reactivity ([a04147e](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/a04147e7ff84e948ec9363d68ff724b1d3007ca6))
* update test commands and remove DalleImageService ([5f1cf57](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/5f1cf5777fd17651f85c651b3c2ab98b58de72de))


### Styles

* fix the broken eslint config and the prettier failures ([38fbf98](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/38fbf981eefde15cfd46c137b53203263059d987))
* format code for consistency and readability ([f482b1b](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/f482b1b2684e189f8eed9b2808b8178b15b8596c))
* **recipes:** refine button layout for new recipe generation ([8d655da](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/8d655da0e511cfd4c390fce1e725474022f07b45))
* standardize quotation marks for consistency in layout server file ([cbd970d](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/cbd970d4f0ee4b95e745b83358d746708be062d5))
* standardize quotes and improve formatting in layout and offline pages ([d824ac7](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/d824ac720cbb48105d9beba7843055be96320a04))


### Continuous Integration

* add CI, commit linting and release-please, and deploy only on release ([67cbe04](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/67cbe04806e1e8ea8e4f25fe7b3b734a523f802e))


### Miscellaneous

* add agent skills, CI and release-please, and fix lint and tests ([654710a](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/654710a93daa09588913715de2b02301e9c4ab5f))
* **agents:** add agent skills and the worktree workflow ([eae0f9e](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/eae0f9e1521e0caa140a80ec23b23e7d795d872a))
* remove obsolete configuration and documentation files ([65d2690](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/65d269040880554fcbf48dbea8775087a5cf1b3c))
* update page structure across multiple routes ([c9733aa](https://github.com/ChidiRnweke/ReceiptToRecipe/commit/c9733aa13920e4924bacc358993a03cf15c7abfa))
