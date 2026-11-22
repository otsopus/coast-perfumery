# Perfume Decant Catalog Implementation Plan

## 1. Product and launch scope

Build a mobile-first perfume decant catalog for a small shop in the Philippines. The catalog is the homepage and the primary entry point for customers arriving from Facebook or a shared product link. Start fresh with a warm editorial design, light neutral surfaces, and product photography.

Customers browse fragrances, select concentration and decant size, build a cart, and generate an order request to send through Facebook Messenger. Staff confirm availability, shipping charges, payment, and delivery in Messenger. The website accepts no payments, creates no customer accounts, stores no customer orders, and reserves no stock. Recurring operating spend must stay at zero.

Use React, Vite, TypeScript, Tailwind CSS, Supabase PostgreSQL, Supabase Auth, Supabase Storage, Cloudflare Pages, and GitHub. Connect the frontend directly to Supabase through its public client and database functions. Use the existing `index.html` only as part of repository history. Build the new application from a clean frontend scaffold.

## 2. Customer experience

### Catalog and product pages

- Use `/` for the catalog, `/perfumes/:slug` for product details, `/cart` for cart review, and `/checkout` for the checkout form and generated summary. Configure Cloudflare Pages to support direct visits and reloads on these routes.
- Search by perfume name or brand. Provide filters for scent profile, fragrance notes, gender, occasion, concentration, and price. Combine filter groups with AND and choices within a group with OR. Apply concentration, effective notes, and price filters to the same variant so a listing cannot match through unrelated variants.
- Store search and filters in the URL. Provide a clear-all action, a result count, and separate empty states for an empty catalog and a search with no matches.
- Show each listing’s name, brand, lead image, price where applicable, and orderability. Keep published listings visible when disabled or sold out. Product detail pages show the selected concentration’s description, images, top, middle, and base notes, and decant sizes and prices. Fall back to shared listing content where a variant has no override.
- Use an inline layout for filters where space permits and a filter panel on mobile. Support keyboard navigation, visible focus, labeled controls, and descriptive image alternatives. Provide clear loading, retry, and unavailable states.

### Cart and availability

- Use stable variant and size IDs for cart lines. Persist IDs and quantities in `localStorage`. Treat current catalog prices and availability as authoritative when loading the cart and before generating an order summary.
- Cap the combined volume across all cart lines for the same concentration. With 7 mL recorded, permit one 5 mL plus one 2 mL decant. Block one 10 mL decant and two 5 mL decants.
- Apply the listing and concentration availability toggles together. Disable size and quantity choices that exceed the available volume after accounting for the other lines in that concentration’s cart.
- Calculate line totals and subtotal in integer centavos. Format public prices in Philippine pesos.
- On checkout submission, validate the complete cart against current data. If a price changed, show the old and new prices and require review before generating the summary. If a size was removed or stock is insufficient, identify the affected lines and let the shopper adjust or remove them. Keep the checkout form populated in memory during corrections. If validation fails to load, show a retry action and retain the cart.

### Checkout and Messenger

- Collect name, contact number, street or unit, barangay, city or municipality, province or Metro Manila, preferred courier, payment preference, and optional notes. Offer Lalamove, GrabExpress, and J&T as preferences. Offer GCash, bank transfer, and undecided for payment. Staff confirm courier eligibility and payment details.
- Validate required fields and phone format in the browser. Allow common Philippine mobile formats with or without `+63`. Show errors next to the affected fields and preserve input when the shopper corrects a cart issue.
- Generate the text and order card from the same validated snapshot. Include product, concentration, size, quantity, line price, subtotal, contact and delivery details, preferences, and notes. Mark shipping and the final total as pending confirmation.
- Make **Copy order text** the primary action and **Open Messenger** the next action. If clipboard access fails, show selectable text. Provide a screenshot-friendly card and a client-generated PNG download. Use a configured shop Messenger URL and keep checkout details out of the URL.
- Keep checkout inputs and generated summaries in browser memory. Exclude them from local storage, Supabase, analytics, logs, and error reports. Keep the cart intact after opening Messenger because the site cannot tell whether the shopper sent the message.

## 3. Data, authorization, and administration

### Data model and public interfaces

| Entity | Purpose |
| --- | --- |
| Perfume listing | Stable slug, brand, name, shared description, ordered images, fragrance notes, tags, gender, and master availability toggle |
| Concentration variant | Parent listing, concentration, optional content overrides, private remaining mL, and variant availability toggle |
| Decant size | Parent variant, volume in mL, and price in integer centavos |
| Catalog tags | Reusable scent profiles, fragrance notes, and occasions with normalized names |
| Inventory adjustment | Staff user ID, timestamp, adjustment type, previous volume, new volume, and a product and concentration label snapshot |

- Enforce unique slugs, unique concentrations within a listing, and unique size volumes within a variant. Enforce positive size volumes and prices and nonnegative inventory. Use PostgreSQL constraints for these invariants.
- Expose two public Supabase operations. The catalog read returns published catalog content and size-level orderability. The cart validation function accepts variant IDs, size IDs, and quantities and returns authoritative line prices plus availability outcomes. Shopper contact and delivery data never enter either API.
- For quantity controls, expose derived limits or validate proposed cart quantities without returning the remaining-mL field. Per-size limits and repeated validations can allow shoppers to infer a stock range.
- Enable RLS on catalog, inventory, adjustment, and Storage records. Public clients can read published storefront content through the public interface. Staff permissions are enforced by the database using privately provisioned staff identities. Restrict privileged functions to the minimum required grants and use a fixed search path. Keep service-role credentials out of the frontend and repository.

### Admin dashboard

- Provide `/admin/login` and a protected `/admin` area with a mobile-friendly listing manager, editor, and inventory controls. Provision individual email-and-password accounts privately. Disable public signup. Give the owner and staff equal application permissions.
- Use one listing editor for shared details, tags, concentration overrides, sizes, prices, and images. Require a name, brand, shared description, lead image, and at least one valid concentration with one priced size before the first save. Save listing data and related records atomically. A successful first save publishes immediately. Keep the public slug stable when staff rename a listing.
- Stage image uploads before saving a listing. Enforce allowed image types and file size at the Storage boundary. If a save fails, keep the previous public data and remove newly uploaded files that the failed save left unused. If an image is replaced, remove the old object after the successful save once it has no remaining reference.
- Provide separate availability toggles for each listing and each concentration. Provide a quick deduction action and an absolute correction action. Apply deductions atomically and reject any deduction that would produce negative stock. Require staff to refresh a stale absolute count before overwriting a newer edit. Write the stock update and its audit record in the same transaction.
- Permanently delete listings only after explicit staff confirmation. Remove their variants and sizes from the storefront and clean up unreferenced images. Preserve inventory history using the recorded label snapshot so the audit remains interpretable after deletion.

## 4. Delivery, operations, and acceptance

### Implementation order

1. Scaffold the frontend, routes, shared styles, and Cloudflare Pages configuration. Keep machine-local environment files and secrets out of Git.
2. Add versioned Supabase migrations for catalog data, grants, RLS, public reads, cart validation, and inventory adjustments. Verify access as an anonymous visitor, an authenticated non-staff user, and staff before connecting the production frontend.
3. Build admin sign-in, listing management, image uploads, availability controls, inventory adjustments, and deletion. Use the admin workflow to enter the launch catalog.
4. Build the catalog, filters, product details, and cart. Build checkout after the cart validation interface is ready, then verify the text, screenshot, PNG, and Messenger handoffs.
5. Deploy a Cloudflare Pages preview using non-production data where practical within free allowances. Use GitHub for version control and run type checking, tests, and the production build before merging. Promote the verified build to production after the launch checks pass.

### Launch acceptance

- **Catalog and cart.** Test combined filters, variant detail fallback, shareable URLs, unavailable listings, cart persistence, mixed sizes, multiple concentrations, price changes, removed sizes, and network failure during validation.
- **Checkout.** Complete an order on iOS and Android, including Facebook’s in-app browser. Verify the copied text, screenshot, PNG, pending amounts, and Messenger destination. Verify clipboard fallback and confirm that customer details never appear in network requests to the application backend, browser storage, or app logs.
- **Admin and security.** Verify private staff onboarding and password recovery. Confirm that anonymous users and authenticated non-staff cannot read raw inventory, write catalog data, change stock, or upload images. Verify publish on save, both availability toggles, concurrent deductions and corrections, permanent deletion, and audit history.
- **Operations.** Confirm that catalog edits appear without redeployment. Document database and image backup and recovery, keep a private off-service copy, and complete a test restore. Keep customer analytics out of v1. Use hosting build logs and Supabase service logs for initial troubleshooting without sending customer details to either service.
- **Go live.** Verify the shop’s Messenger URL, brand assets, initial catalog, courier coverage, and payment preferences. Confirm that account recovery, backup and restore, storage, hosting, and expected traffic fit current free allowances. Check official documentation when pinning framework versions and validating service limits. Launch after staff can manage the catalog and the core mobile flow passes acceptance.

## 5. Assumptions and open risks

- **ASSUMPTION** The first release uses English and Philippine pesos. Addresses use structured text fields. The storefront requests basic page metadata and shareable links. Product-specific social previews and search indexing are outside launch acceptance.
- **ASSUMPTION** Launch uses the standard Cloudflare Pages hostname unless the shop already controls a domain it can use without new recurring spend. Use a local Supabase environment or isolated test data if a separate hosted staging project would exceed free allowances.
- **ASSUMPTION** Permanent deletion removes catalog records and unreferenced images while retaining inventory adjustment history with a label snapshot.
- **OPEN RISK** Concurrent shoppers can generate requests against the same stock. Staff must confirm orders in Messenger before promising availability.
- **OPEN RISK** Private stock can be partly inferred from orderability and cart limits. The public interface must avoid disclosing raw stock or inventory history.
- **OPEN RISK** Free-tier email delivery, backup tooling, and browser support need verification before launch. If a required capability cannot be delivered at zero recurring cost, resolve the constraint before committing to a paid service.
