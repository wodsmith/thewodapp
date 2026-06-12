---
sidebar_position: 6
---

# How to Sell Merch During Registration

Sell event t-shirts and other add-ons inside your registration flow. Athletes pick items while registering and pay for everything in one checkout; you hand the merch out at the venue.

## Prerequisites

- Competition organizer permissions
- Registration add-ons enabled for your team (this is an account-level feature — contact WODsmith to turn it on)
- A verified Stripe account connected to your team (merch is always paid)

If add-ons aren't enabled, the Merch page shows a locked notice instead of the editor.

## Adding a Product

1. Open your competition from the **Organizer** dashboard
2. Click **Merch** in the sidebar (under Business)
3. Click **Add product**
4. Fill in the product details:
   - **Name** — what athletes see (e.g., "Event Tee 2026")
   - **Price ($)** — your price per unit; processing fees are added on top according to your competition's fee settings
   - **Max per athlete** *(optional)* — caps how many one registrant can order across all sizes
   - **Order by** *(optional)* — last day athletes can order, end of day in your competition's timezone
   - **Description** and **Image URL** *(optional)*
5. Add **Options** if the product comes in sizes (e.g., S, M, L, XL)
6. Click **Create add-on**

To sell a shirt that's *included* in the registration fee, don't use Merch — collect sizes with a [registration question](/how-to/organizers/registration-questions) instead. Use Merch when athletes pay extra for the item.

## Controlling Availability

Pick the model that matches how you source the merch:

- **Ordering from a print shop after registration?** Set **Order by** to your print deadline and leave each option's **Stock** blank. Athletes can order any quantity until the cutoff, and your final counts go to the printer.
- **Selling fixed inventory you already have?** Set **Stock** per option. Sold-out sizes are disabled automatically, and the rare order that slips through during simultaneous checkouts is refunded automatically.
- You can combine both: "order by June 1, while supplies last."

## How Athletes Buy

Athletes see an **Event merch** section in the registration form, between the coupon field and the order summary. They pick a size and quantity, and the items are added to the same Stripe checkout as their registration fee.

- Merch works with free divisions too — a $0 registration with a paid shirt still goes through checkout.
- Coupons never discount merch; codes apply to registration fees only.
- Only registrants can buy. There is no standalone store.

## Hiding, Editing, and Archiving

From the products table on the Merch page:

- Click the **eye icon** to hide a product from athletes without losing it (e.g., while you fix a price)
- Click the **pencil icon** to edit details, sizes, and stock
- Click the **archive icon** to retire a product; its sales history stays in your reports

Sizes that have sold units can't be removed — set their stock to 0 instead.

## Fulfilling Orders

The Merch page gives you both reports you need:

- **Print shop summary** — total units per product and size. Send this to your printer after the order deadline passes.
- **Pickup list** — every athlete with the items and quantities they bought. Use it at the check-in table on event day.

## Refunds

If a size oversells during simultaneous checkouts, the extra order is refunded automatically and the athlete's registration is unaffected. To refund a merch purchase for any other reason, issue the refund from your Stripe dashboard — it's recorded in your WODsmith revenue ledger automatically.

---

*See also: [How to Manage Registrations](/how-to/organizers/manage-registrations) · [How to Create Registration Questions](/how-to/organizers/registration-questions)*
